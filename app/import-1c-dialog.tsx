"use client";
import { useState } from "react";
import type { CatalogEntry } from "../lib/catalog";
import { dashboardDate, dashboardMoney } from "../lib/dashboard";
import type { Invoice } from "../lib/domain";
import { read1C, type Kind, type Read1C } from "../lib/import-1c";
import { gridFrom1CFile } from "../lib/import-1c-file";
import type { SyncEngine } from "../lib/sync";
import { duplicateKey } from "../lib/workbook";

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

type Prepared =
  | {
      type: "documents";
      items: { line: number; doc?: Invoice; note: string }[];
    }
  | {
      type: "partners";
      items: { line: number; entry?: CatalogEntry; note: string }[];
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
        if (row.error) return { line: row.line, note: row.error };
        const code = row.code || `1C-${row.line}`;
        const twin = [...catalog, ...seen].find(
          (e) =>
            same(e.code, code) ||
            same(e.name, row.name) ||
            (row.idno && e.details.idno === row.idno),
        );
        if (twin) return { line: row.line, note: `Există deja: ${twin.name}` };
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
        return { line: row.line, entry, note: "Nou" };
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
    const items = await Promise.all(
      r.rows.map(async (row) => {
        if (row.error) return { line: row.line, note: row.error };
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
        if (taken.has(doc.id) || keys.has(duplicateKey(doc)))
          return { line: row.line, note: "Există deja în Socot" };
        taken.add(doc.id);
        keys.add(duplicateKey(doc));
        return { line: row.line, doc, note: "Nou" };
      }),
    );
    setPrepared({ type: "documents", items });
  }

  async function choose(f: File) {
    setError("");
    setResult(null);
    setPrepared(null);
    setRead(null);
    setBusy(true);
    try {
      const r = read1C(await gridFrom1CFile(await f.arrayBuffer(), f.name));
      setFile(f.name);
      setRead(r);
      const kind =
        r.type === "documents" ? (r.defaultKind ?? fallback) : fallback;
      setFallback(kind);
      await prepare(r, kind);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
  const ready = prepared?.items.filter((i) =>
    "doc" in i ? !!i.doc : "entry" in i && !!i.entry,
  ).length;

  return (
    <div className="modalback">
      <section
        className="modal import-1c"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-1c-title"
      >
        <p className="eyebrow">Import din 1C</p>
        <h2 id="import-1c-title">Adu datele din 1C în Socot</h2>
        {!read && !result && (
          <ol className="phone-steps">
            <li>
              În 1C deschide lista dorită: facturile de livrare sau de intrare,
              jurnalul documentelor sau lista de contragenți.
            </li>
            <li>Alege perioada, apoi „Mai multe → Afișează lista…”.</li>
            <li>
              Salvează lista ca Excel (.xlsx) sau CSV și alege fișierul aici.
            </li>
          </ol>
        )}
        <label className="import-1c-file">
          {read ? "Alege alt fișier" : "Alege fișierul din 1C"}
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
                        <td className={item.note === "Nou" ? "" : "muted"}>
                          {item.note}
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.line}>
                        <td className="num">{row.line}</td>
                        <td>{row.code}</td>
                        <td>{row.name}</td>
                        <td className="num">{row.idno}</td>
                        <td className={item.note === "Nou" ? "" : "muted"}>
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
            <p className="footnote">
              {read.type === "documents"
                ? "Documentele intră neachitate, cu articole contabile propuse pe care le verifici în Contabilitate. Plățile din 1C le adaugi apoi ca încasări sau plăți."
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
                disabled={busy || !ready}
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
