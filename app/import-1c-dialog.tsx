"use client";
import { useState } from "react";
import type { CatalogEntry } from "../lib/catalog";
import { dashboardDate, dashboardMoney } from "../lib/dashboard";
import type { Invoice } from "../lib/domain";
import {
  amount1C,
  blankLayout,
  detect1C,
  documentFields,
  partnerFields,
  read1C,
  requiredFields,
  type Kind,
  type Layout,
  type Read1C,
} from "../lib/import-1c";
import { gridFrom1CFile } from "../lib/import-1c-file";
import { checkTotals, partnerBalances } from "../lib/import-check";
import type { SyncEngine } from "../lib/sync";
import { duplicateKey, type Grid } from "../lib/workbook";

async function stableId(text: string) {
  const h = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

type Status = "new" | "duplicate" | "error";
type Prepared =
  | {
      type: "documents";
      items: {
        line: number;
        doc?: Invoice;
        note: string;
        status: Status;
        total: number;
      }[];
    }
  | {
      type: "partners";
      items: {
        line: number;
        entry?: CatalogEntry;
        note: string;
        status: Status;
      }[];
    };

const letter = (i: number) =>
  i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(64 + Math.floor(i / 26)) +
      String.fromCharCode(65 + (i % 26));
const money = (bani: number) => dashboardMoney(bani, false);
const optionalLei = (text: string) => {
  if (!text.trim()) return null;
  try {
    return amount1C(text);
  } catch {
    return undefined;
  }
};

// Brings lists saved from 1C (documents or counterparties) into Socot.
export default function Import1CDialog({
  engine,
  onClose,
  onDone,
}: {
  engine: SyncEngine;
  onClose: () => void;
  onDone: (view: string) => void;
}) {
  const [file, setFile] = useState("");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [typedTotal, setTypedTotal] = useState("");
  const [typedBalances, setTypedBalances] = useState<Record<string, string>>(
    {},
  );
  const [confirmed, setConfirmed] = useState(false);
  const [read, setRead] = useState<Read1C | null>(null);
  const [fallback, setFallback] = useState<Kind>("expense");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{
    done: number;
    failed: string[];
    view: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function prepare(r: Read1C, kind: Kind) {
    const state = engine.state;
    if (r.type === "partners") {
      const catalog = (state.catalog ?? []).filter((e) => e.kind === "partner");
      const seen: CatalogEntry[] = [];
      const items = r.rows.map((row) => {
        if (row.error)
          return { line: row.line, note: row.error, status: "error" as const };
        const code = row.code || `1C-${row.line}`;
        const twin = [...catalog, ...seen].find(
          (e) =>
            same(e.code, code) ||
            same(e.name, row.name) ||
            (row.idno && e.details.idno === row.idno),
        );
        if (twin)
          return {
            line: row.line,
            note: seen.includes(twin)
              ? `Apare de două ori în fișier: ${twin.name}`
              : `Există deja: ${twin.name}`,
            status: "duplicate" as const,
          };
        const entry: CatalogEntry = {
          id: crypto.randomUUID(),
          kind: "partner",
          code,
          name: row.name,
          version: 0,
          active: true,
          details: {
            role: "ambele",
            idno: row.idno,
            vatCode: row.vatCode,
            address: row.address,
          },
        };
        seen.push(entry);
        return { line: row.line, entry, note: "Nou", status: "new" as const };
      });
      setPrepared({ type: "partners", items });
      return;
    }
    const partners = (state.catalog ?? []).filter(
      (e) => e.kind === "partner" && e.active,
    );
    const taken = new Set([
      ...state.invoices.map((i) => i.id),
      ...state.pending.map((p) => p.invoice.id),
    ]);
    const keys = new Set([
      ...state.invoices.map(duplicateKey),
      ...state.pending.map((p) => duplicateKey(p.invoice)),
    ]);
    const inFile = new Map<string, number>();
    const items = await Promise.all(
      r.rows.map(async (row) => {
        if (row.error)
          return {
            line: row.line,
            note: row.error,
            status: "error" as const,
            total: row.total,
          };
        const docKind = row.kind ?? kind;
        const partner = partners.find(
          (p) =>
            p.name === row.partner &&
            [docKind === "expense" ? "furnizor" : "client", "ambele"].includes(
              p.details.role,
            ),
        );
        const doc: Invoice = {
          id: await stableId(
            `${engine.scope}|1c|${docKind}|${row.number}|${row.date}|${row.partner}|${row.total}`,
          ),
          sourceRef: `1C ${row.number || `rândul ${row.line}`} din ${dashboardDate(row.date)}`,
          kind: docKind,
          partnerId: partner?.id ?? null,
          customer: row.partner,
          total: row.total,
          paid: 0,
          version: 0,
          date: row.date,
        };
        const twin = inFile.get(doc.id) ?? inFile.get(duplicateKey(doc));
        if (
          twin !== undefined ||
          taken.has(doc.id) ||
          keys.has(duplicateKey(doc))
        )
          return {
            line: row.line,
            note:
              twin !== undefined
                ? `Apare de două ori în fișier (rândul ${twin})`
                : "Există deja în Socot",
            status: "duplicate" as const,
            total: row.total,
          };
        inFile.set(doc.id, row.line);
        inFile.set(duplicateKey(doc), row.line);
        return {
          line: row.line,
          doc,
          note: "Nou",
          status: "new" as const,
          total: row.total,
        };
      }),
    );
    setPrepared({ type: "documents", items });
  }

  // Reads the grid with the chosen columns; a missing column leaves the
  // column picker open with the reason.
  async function apply(g: Grid, l: Layout, kind = fallback) {
    setError("");
    setPrepared(null);
    setRead(null);
    setConfirmed(false);
    try {
      const r = read1C(g, l);
      setRead(r);
      const k = r.type === "documents" ? (r.defaultKind ?? kind) : kind;
      setFallback(k);
      await prepare(r, k);
    } catch (e) {
      setShowColumns(true);
      setError((e as Error).message);
    }
  }

  async function choose(f: File) {
    setError("");
    setResult(null);
    setPrepared(null);
    setRead(null);
    setGrid(null);
    setTypedTotal("");
    setTypedBalances({});
    setBusy(true);
    try {
      const g = await gridFrom1CFile(await f.arrayBuffer(), f.name);
      const found = detect1C(g);
      const l = found ?? blankLayout(g);
      setFile(f.name);
      setGrid(g);
      setLayout(l);
      setShowColumns(!found);
      if (found) await apply(g, l);
      else
        setError(
          "Nu am recunoscut singur coloanele. Arată mai jos unde sunt data, contragentul și suma.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function changeLayout(next: Layout) {
    setLayout(next);
    if (grid) void apply(grid, next);
  }

  async function run() {
    if (!prepared) return;
    setBusy(true);
    setError("");
    const failed: string[] = [];
    let done = 0;
    const todo = prepared.items.filter((i) =>
      prepared.type === "documents"
        ? "doc" in i && i.doc
        : "entry" in i && i.entry,
    );
    for (const [n, item] of todo.entries()) {
      setProgress(`Se importă ${n + 1} din ${todo.length}…`);
      try {
        if ("doc" in item && item.doc) await engine.enqueue(item.doc);
        else if ("entry" in item && item.entry)
          await engine.saveCatalog(item.entry, "Import din 1C");
        done++;
      } catch (e) {
        failed.push(`Rândul ${item.line}: ${(e as Error).message}`);
      }
    }
    setProgress("");
    setBusy(false);
    setResult({
      done,
      failed,
      view:
        prepared.type === "partners"
          ? "catalog:partner"
          : todo.some((i) => "doc" in i && i.doc?.kind === "sale")
            ? "documents:sale"
            : "documents:expense",
    });
    setPrepared(null);
  }

  const rows =
    read && prepared
      ? prepared.items.map((item, i) => ({ item, row: read.rows[i] }))
      : [];
  const ready = prepared?.items.filter((i) => i.status === "new").length;

  const docs =
    prepared?.type === "documents" && read?.type === "documents"
      ? prepared.items
      : null;
  const typed = optionalLei(typedTotal);
  const totals = docs
    ? checkTotals(
        docs,
        read?.type === "documents" ? read.controlTotal : null,
        typed ?? null,
      )
    : null;
  const balances = docs
    ? partnerBalances(
        [
          ...engine.state.invoices,
          ...engine.state.pending.map((p) => p.invoice),
        ],
        docs.flatMap((i) => (i.doc ? [i.doc] : [])),
      )
    : [];
  const balanceDiff = (key: string, after: number) => {
    const v = optionalLei(typedBalances[key] ?? "");
    return v === null ? null : v === undefined ? undefined : v - after;
  };
  const mismatch =
    !!totals &&
    (!!totals.fileDifference ||
      !!totals.typedDifference ||
      typed === undefined ||
      balances.some((b) => {
        const d = balanceDiff(b.key, b.after);
        return d !== null && d !== 0;
      }));
  const header = grid && layout ? (grid[layout.header] ?? []) : [];
  const width = grid
    ? Math.min(40, Math.max(...grid.slice(0, 60).map((r) => r.length)))
    : 0;
  const sample = grid && layout ? (grid[layout.header + 1] ?? []) : [];

  return (
    <div className="modalback">
      <section
        className="modal import-1c"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-1c-title"
      >
        <p className="eyebrow">Import din 1C sau Excel</p>
        <h2 id="import-1c-title">Adu datele din 1C sau Excel în Socot</h2>
        {!read && !result && (
          <ol className="phone-steps">
            <li>
              În 1C deschide lista dorită: facturile de livrare sau de intrare,
              jurnalul documentelor sau lista de contragenți.
            </li>
            <li>Alege perioada, apoi „Mai multe → Afișează lista…”.</li>
            <li>
              Salvează lista ca Excel (.xlsx) sau CSV și alege fișierul aici.
              Merge și un tabel Excel făcut de mână: alegi tu coloanele.
            </li>
            <li>
              Verifici rândurile, duplicatele și totalurile, apoi confirmi.
              Nimic nu intră în Socot înainte de confirmare.
            </li>
          </ol>
        )}
        <label className="import-1c-file">
          {grid ? "Alege alt fișier" : "Alege fișierul din 1C sau Excel"}
          <input
            type="file"
            accept=".xlsx,.csv,.txt"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void choose(f);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {grid && layout && (
          <details
            className="import-columns"
            open={showColumns}
            onToggle={(e) =>
              setShowColumns((e.target as HTMLDetailsElement).open)
            }
          >
            <summary>
              Coloanele fișierului: antetul pe rândul {layout.header + 1},{" "}
              {layout.type === "documents" ? "documente" : "contragenți"}
            </summary>
            <div className="import-columns-grid">
              <label>
                Antetul este pe rândul
                <select
                  value={layout.header}
                  disabled={busy}
                  onChange={(e) =>
                    changeLayout({ ...layout, header: Number(e.target.value) })
                  }
                >
                  {grid.slice(0, 30).map((row, i) => (
                    <option key={i} value={i}>
                      {i + 1}:{" "}
                      {row
                        .filter((v) => v.trim())
                        .slice(0, 3)
                        .join(" · ")
                        .slice(0, 60) || "(gol)"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fișierul conține
                <select
                  value={layout.type}
                  disabled={busy}
                  onChange={(e) => {
                    const type = e.target.value as Layout["type"];
                    const found = detect1C(grid);
                    changeLayout(
                      found?.type === type
                        ? found
                        : { type, header: layout.header, columns: {} },
                    );
                  }}
                >
                  <option value="documents">Documente (facturi)</option>
                  <option value="partners">Contragenți</option>
                </select>
              </label>
              {Object.entries(
                layout.type === "documents" ? documentFields : partnerFields,
              ).map(([field, label]) => {
                const f = field as keyof Layout["columns"];
                const required = (
                  requiredFields[layout.type] as string[]
                ).includes(field);
                return (
                  <label key={field}>
                    {label}
                    {required ? " *" : ""}
                    <select
                      value={layout.columns[f] ?? -1}
                      disabled={busy}
                      onChange={(e) =>
                        changeLayout({
                          ...layout,
                          columns: {
                            ...layout.columns,
                            [f]: Number(e.target.value),
                          },
                        })
                      }
                    >
                      <option value={-1}>
                        {required ? "Alege coloana" : "Nu există"}
                      </option>
                      {Array.from({ length: width }, (_, i) => (
                        <option key={i} value={i}>
                          {letter(i)}:{" "}
                          {(header[i] || sample[i] || "").slice(0, 40)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </details>
        )}
        {read && prepared && (
          <>
            <p className="muted">
              {file}:{" "}
              {read.type === "documents"
                ? `${read.rows.length} documente găsite`
                : `${read.rows.length} contragenți găsiți`}
              , {ready} de importat.
            </p>
            {read.type === "documents" &&
              read.rows.some((r) => !r.kind && !r.error) && (
                <label className="import-1c-kind">
                  Rândurile fără tip sunt
                  <select
                    value={fallback}
                    disabled={busy}
                    onChange={(e) => {
                      const kind = e.target.value as Kind;
                      setFallback(kind);
                      void prepare(read, kind);
                    }}
                  >
                    <option value="expense">Cumpărări (de la furnizori)</option>
                    <option value="sale">Vânzări (către clienți)</option>
                  </select>
                </label>
              )}
            <div className="tablewrap import-1c-table">
              <table>
                <thead>
                  {read.type === "documents" ? (
                    <tr>
                      <th>Rând</th>
                      <th>Data</th>
                      <th>Nr.</th>
                      <th>Contragent</th>
                      <th>Tip</th>
                      <th className="right">Suma</th>
                      <th>Stare</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Rând</th>
                      <th>Cod</th>
                      <th>Denumire</th>
                      <th>IDNO</th>
                      <th>Stare</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.slice(0, 300).map(({ item, row }) =>
                    "partner" in row ? (
                      <tr key={item.line}>
                        <td className="num">{row.line}</td>
                        <td className="num">
                          {row.date ? dashboardDate(row.date) : ""}
                        </td>
                        <td>{row.number}</td>
                        <td>{row.partner}</td>
                        <td>
                          {"doc" in item && item.doc
                            ? item.doc.kind === "sale"
                              ? "Vânzare"
                              : "Cumpărare"
                            : ""}
                        </td>
                        <td className="num right">
                          {row.total ? dashboardMoney(row.total, false) : ""}
                        </td>
                        <td className={item.status === "new" ? "" : "muted"}>
                          {item.note}
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.line}>
                        <td className="num">{row.line}</td>
                        <td>{row.code}</td>
                        <td>{row.name}</td>
                        <td className="num">{row.idno}</td>
                        <td className={item.status === "new" ? "" : "muted"}>
                          {item.note}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 300 && (
              <p className="muted">Se arată primele 300 de rânduri.</p>
            )}
            {totals && (
              <section className="import-check" aria-label="Verificare">
                <h3>Verificare înainte de import</h3>
                <dl className="import-check-sums">
                  <div>
                    <dt>Toate rândurile din fișier</dt>
                    <dd className="num">{money(totals.rows)}</dd>
                  </div>
                  <div>
                    <dt>Se importă ({ready})</dt>
                    <dd className="num">{money(totals.importing)}</dd>
                  </div>
                  <div>
                    <dt>
                      Duplicate, nu se importă (
                      {docs!.filter((i) => i.status === "duplicate").length})
                    </dt>
                    <dd className="num">{money(totals.duplicates)}</dd>
                  </div>
                  {totals.errors > 0 && (
                    <div>
                      <dt>Rânduri cu erori</dt>
                      <dd className="num">{totals.errors}</dd>
                    </div>
                  )}
                </dl>
                {totals.fileDifference !== null && (
                  <p
                    className={
                      totals.fileDifference
                        ? "import-check-bad"
                        : "import-check-ok"
                    }
                  >
                    {totals.fileDifference
                      ? `Rândul „Total” din fișier arată ${money(totals.rows + totals.fileDifference)}, cu ${money(totals.fileDifference)} diferit de suma rândurilor. Verifică rândurile cu erori și filtrele din 1C.`
                      : `Suma rândurilor coincide cu rândul „Total” din fișier.`}
                  </p>
                )}
                <label className="import-check-typed">
                  Totalul din 1C pentru aceeași listă (opțional)
                  <input
                    inputMode="decimal"
                    value={typedTotal}
                    placeholder="de ex. 125 000,00"
                    onChange={(e) => {
                      setTypedTotal(e.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                {typed === undefined && (
                  <p className="import-check-bad">
                    Suma scrisă nu se poate citi.
                  </p>
                )}
                {totals.typedDifference !== null && (
                  <p
                    className={
                      totals.typedDifference
                        ? "import-check-bad"
                        : "import-check-ok"
                    }
                  >
                    {totals.typedDifference
                      ? `Totalul din 1C diferă de rândurile fișierului cu ${money(totals.typedDifference)}.`
                      : "Totalul din 1C coincide cu rândurile fișierului."}
                  </p>
                )}
                {balances.length > 0 && (
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Contragent</th>
                          <th className="right">Sold în Socot</th>
                          <th className="right">Din import</th>
                          <th className="right">Sold după import</th>
                          <th className="right">Sold în 1C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balances.slice(0, 50).map((b) => {
                          const d = balanceDiff(b.key, b.after);
                          return (
                            <tr key={b.key}>
                              <td>
                                {b.partner}
                                <small className="muted">
                                  {b.kind === "sale"
                                    ? " creanță client"
                                    : " datorie furnizor"}
                                </small>
                              </td>
                              <td className="num right">{money(b.before)}</td>
                              <td className="num right">{money(b.imported)}</td>
                              <td className="num right">
                                <strong>{money(b.after)}</strong>
                              </td>
                              <td className="right">
                                <input
                                  className="import-check-balance"
                                  inputMode="decimal"
                                  aria-label={`Sold în 1C pentru ${b.partner}`}
                                  value={typedBalances[b.key] ?? ""}
                                  onChange={(e) => {
                                    setTypedBalances((t) => ({
                                      ...t,
                                      [b.key]: e.target.value,
                                    }));
                                    setConfirmed(false);
                                  }}
                                />
                                {d !== null && (
                                  <small
                                    className={
                                      d ? "import-check-bad" : "import-check-ok"
                                    }
                                  >
                                    {d === undefined
                                      ? "sumă invalidă"
                                      : d
                                        ? `diferă cu ${money(d)}`
                                        : "coincide"}
                                  </small>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {balances.length > 50 && (
                  <p className="muted">Se arată primii 50 de contragenți.</p>
                )}
                {mismatch && (
                  <label className="import-check-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Am verificat diferențele și vreau să import totuși.
                  </label>
                )}
              </section>
            )}
            <p className="footnote">
              {read.type === "documents"
                ? "Documentele intră neachitate, cu articole contabile propuse pe care le verifici în Contabilitate. Plățile din 1C le adaugi apoi ca încasări sau plăți, așa că soldul din 1C poate fi mai mic cu plățile deja făcute."
                : "Contragenții intră în Nomenclatoare ca „client și furnizor”; poți schimba tipul după import."}
            </p>
          </>
        )}
        {progress && <p role="status">{progress}</p>}
        {result && (
          <div role="status" className="import-1c-result">
            <p>
              <strong>Am importat {result.done}.</strong>
              {result.failed.length > 0 &&
                ` ${result.failed.length} nu au putut fi importate:`}
            </p>
            {result.failed.length > 0 && (
              <ul>
                {result.failed.slice(0, 20).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="controls">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Închide
          </button>
          {result ? (
            <button type="button" onClick={() => onDone(result.view)}>
              Vezi ce am importat
            </button>
          ) : (
            prepared && (
              <button
                type="button"
                disabled={busy || !ready || (mismatch && !confirmed)}
                onClick={() => void run()}
              >
                Importă {ready}{" "}
                {prepared.type === "documents" ? "documente" : "contragenți"}
              </button>
            )
          )}
        </div>
      </section>
    </div>
  );
}
