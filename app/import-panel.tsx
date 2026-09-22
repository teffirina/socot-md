"use client";
import { useEffect, useRef, useState } from "react";
import { readValue, writeValue, type Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
import {
  calculate,
  checkXlsxArchive,
  duplicateKey,
  MAX_COLS,
  MAX_ROWS,
  parseDelimited,
  prepareRow,
  suggestMapping,
  type Grid,
  type Mapping,
} from "../lib/workbook";
type Batch = {
  name: string;
  original: string;
  mime: string;
  hash: string;
  sheet: string;
  grid: Grid;
  originalGrid: Grid;
  ids: string[];
  mapping: Mapping;
  kind: "sale" | "expense";
  frozen: boolean;
  sent: number[];
};
async function digest(value: ArrayBuffer | string) {
  const data =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ImportPanel({
  engine,
  snapshot,
  writable,
}: {
  engine: SyncEngine;
  snapshot: Snapshot;
  writable: boolean;
}) {
  const [batch, setBatch] = useState<Batch | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(""),
    [original, setOriginal] = useState(false),
    [review, setReview] = useState(false);
  const lock = useRef(false);
  const key = `${engine.scope}:import-workspace-v1`;
  useEffect(() => {
    let live = true;
    readValue<Batch>(key)
      .then((b) => {
        if (live) {
          setBatch(b);
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [key]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(next: Batch | null) {
    if (JSON.stringify(next).length > 2_000_000)
      throw new Error("Importul prelucrat depășește limita locală de 2 MB.");
    await writeValue(key, next);
    setBatch(next);
  }
  async function importFile(file: File) {
    if (file.size > 512_000)
      throw new Error("Pentru această versiune: maximum 500 KB per fișier.");
    const bytes = await file.arrayBuffer(),
      hash = await digest(bytes);
    let grid: Grid,
      sheet = "CSV";
    if (/\.xlsx$/i.test(file.name)) {
      checkXlsxArchive(bytes);
      const ExcelJS = await import("exceljs");
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes);
      if (book.worksheets.length !== 1)
        throw new Error(
          "Exportă foaia dorită într-un XLSX separat. Această versiune acceptă o singură foaie.",
        );
      const ws = book.worksheets[0];
      sheet = ws.name;
      if (ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS)
        throw new Error("Limită: antet + 500 rânduri, 26 coloane.");
      if (ws.model.merges?.length)
        throw new Error("Separă celulele îmbinate înainte de import.");
      grid = Array.from({ length: ws.rowCount }, (_, r) =>
        Array.from({ length: ws.columnCount }, (_, c) => {
          const v = ws.getCell(r + 1, c + 1).value;
          if (v === null || v === undefined) return "";
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          if (typeof v === "object") {
            if ("formula" in v || "sharedFormula" in v)
              return "=" + ws.getCell(r + 1, c + 1).formula;
            if ("richText" in v) return v.richText.map((t) => t.text).join("");
            throw new Error(
              `Celulă nesuportată ${ws.getCell(r + 1, c + 1).address}; convertește explicit în text sau număr.`,
            );
          }
          return String(v);
        }),
      );
    } else if (/\.(csv|tsv)$/i.test(file.name))
      grid = parseDelimited(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    else
      throw new Error(
        "Alege XLSX, CSV UTF-8 sau TSV. Macrocomenzile nu sunt acceptate.",
      );
    if (grid.length < 2 || grid.some((r) => r.some((c) => c.length > 2000)))
      throw new Error(
        "Este necesar un antet și cel puțin un rând; maximum 2000 caractere/celulă.",
      );
    const ids = await Promise.all(
      grid.map(async (_, r) => {
        const h = await digest(`${engine.scope}|${hash}|${sheet}|${r}`);
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
      }),
    );
    let binary = "";
    for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
    await save({
      name: file.name,
      original: btoa(binary),
      mime: file.type,
      hash,
      sheet,
      grid,
      originalGrid: grid.map((r) => [...r]),
      ids,
      mapping: suggestMapping(grid[0]),
      kind: "expense",
      frozen: false,
      sent: [],
    });
    setReview(false);
  }
  const visibleGrid = batch ? (original ? batch.originalGrid : batch.grid) : [];
  const width = Math.max(0, ...visibleGrid.map((r) => r.length));
  function proposal(r: number) {
    return prepareRow(
      batch!.grid,
      r,
      batch!.mapping,
      batch!.ids[r],
      `${batch!.hash}:${batch!.sheet.slice(0, 60)}:${r + 1}`,
      batch!.kind,
    );
  }
  function problems(r: number): string {
    try {
      const doc = proposal(r);
      const earlier = batch!.grid.slice(1, r).some((_, i) => {
        try {
          return duplicateKey(proposal(i + 1)) === duplicateKey(doc);
        } catch {
          return false;
        }
      });
      const existing = snapshot.invoices.some(
        (i) => i.id !== doc.id && duplicateKey(i) === duplicateKey(doc),
      );
      if (earlier || existing)
        return "Posibil duplicat — corectează rândul înainte de confirmare.";
      return "";
    } catch (e) {
      return e instanceof Error && e.name === "ZodError"
        ? "Verifică partenerul, data și suma pozitivă."
        : String(e);
    }
  }
  async function send(r: number) {
    const issue = problems(r);
    if (issue) throw new Error(issue);
    const next = { ...batch!, frozen: true };
    await save(next); // Freeze input before the first potentially durable accounting operation.
    const doc = proposal(r);
    if (
      !engine.state.invoices.some((i) => i.id === doc.id) &&
      !engine.state.pending.some((i) => i.invoice.id === doc.id)
    )
      await engine.enqueue(doc);
    if (
      !engine.state.invoices.some((i) => i.id === doc.id) &&
      !engine.state.pending.some((i) => i.invoice.id === doc.id)
    )
      throw new Error("Operațiunea nu a fost păstrată. Reîncearcă.");
    await save({ ...next, sent: [...new Set([...next.sent, r])] });
  }
  return (
    <section className="panel import-panel">
      <h2>Spațiu de lucru</h2>
      <p>1. Importă → 2. Prelucrează → 3. Verifică → 4. Confirmă în evidență</p>
      <p>
        Datele de aici nu modifică soldurile până la confirmare. Originalul și
        tabelul sunt păstrate local, în profilul curent; nu sunt încă arhivate
        pe server.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!ready ? (
        <p>Se încarcă spațiul salvat…</p>
      ) : !batch ? (
        <>
          <label>
            Importă XLSX / CSV / TSV{" "}
            <input
              aria-label="Importă tabel"
              type="file"
              accept=".xlsx,.csv,.tsv"
              disabled={busy || !writable}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void run(() => importFile(file));
                e.target.value = "";
              }}
            />
          </label>
          <p>
            O foaie, maximum 500 rânduri și 26 coloane. Primul rând este
            antetul. Date: AAAA-LL-ZZ sau ZZ.LL.AAAA. Sume în MDL.
          </p>
        </>
      ) : (
        <>
          <h3>
            {batch.name} · {batch.sheet}
          </h3>
          <p>
            {batch.grid.length - 1} rânduri ·{" "}
            {batch.frozen
              ? "Prelucrare încheiată — confirmarea a început"
              : "Ciornă locală salvată"}{" "}
            · SHA-256: <code>{batch.hash.slice(0, 16)}…</code>
          </p>
          <div className="import-actions">
            <button
              onClick={() => {
                const a = Uint8Array.from(atob(batch.original), (c) =>
                  c.charCodeAt(0),
                );
                download(new Blob([a], { type: batch.mime }), batch.name);
              }}
            >
              Descarcă originalul
            </button>
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(batch, null, 2)], {
                    type: "application/json",
                  }),
                  "Socot-dosar-import.json",
                )
              }
            >
              Descarcă dosarul de lucru
            </button>
            <button onClick={() => setOriginal(!original)}>
              {original ? "Arată datele prelucrate" : "Arată originalul"}
            </button>
            <button onClick={() => setReview(!review)}>
              {review ? "Înapoi la tabel" : "Verifică operațiunile"}
            </button>
          </div>
          {!original && (
            <div className="import-actions">
              <label>
                Operațiuni{" "}
                <select
                  aria-label="Tip operațiuni"
                  disabled={busy || batch.frozen || !writable}
                  value={batch.kind}
                  onChange={(e) =>
                    void run(() =>
                      save({ ...batch, kind: e.target.value as Batch["kind"] }),
                    )
                  }
                >
                  <option value="expense">Cheltuieli</option>
                  <option value="sale">Vânzări</option>
                </select>
              </label>
              {(["customer", "date", "total"] as const).map((field, i) => (
                <label key={field}>
                  {["Partener", "Data", "Total MDL"][i]}{" "}
                  <select
                    aria-label={
                      ["Coloana partener", "Coloana data", "Coloana total"][i]
                    }
                    value={batch.mapping[field]}
                    disabled={busy || batch.frozen || !writable}
                    onChange={(e) =>
                      void run(() =>
                        save({
                          ...batch,
                          mapping: {
                            ...batch.mapping,
                            [field]: Number(e.target.value),
                          },
                        }),
                      )
                    }
                  >
                    <option value={-1}>Alege coloana</option>
                    {batch.grid[0].map((h, c) => (
                      <option key={c} value={c}>
                        {String.fromCharCode(65 + c)} · {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <label>
            Filtrează rândurile{" "}
            <input value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <p>
            Formule: + − * /, paranteze, A1 și SUM(A2:A5). Zecimale în formule
            cu punct. Rezultatele memorate în Excel nu sunt folosite. Lipirea
            mai multor celule acceptă TSV.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Rând</th>
                  {review && !original ? (
                    <>
                      <th>Partener</th>
                      <th>Data</th>
                      <th>Total MDL</th>
                      <th>Verificare</th>
                    </>
                  ) : (
                    Array.from({ length: width }, (_, c) => (
                      <th key={c}>
                        {String.fromCharCode(65 + c)} · {visibleGrid[0]?.[c]}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleGrid
                  .slice(1)
                  .map((row, i) => ({ row, r: i + 1 }))
                  .filter(({ row }) =>
                    row.join(" ").toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map(({ row, r }) => {
                    if (review && !original) {
                      let doc;
                      try {
                        doc = proposal(r);
                      } catch {}
                      const issue = problems(r),
                        pending = snapshot.pending.find(
                          (p) => p.invoice.id === batch.ids[r],
                        ),
                        recorded = snapshot.invoices.some(
                          (i) => i.id === batch.ids[r],
                        );
                      return (
                        <tr key={r}>
                          <td>{r + 1}</td>
                          <td>{doc?.customer ?? "—"}</td>
                          <td>{doc?.date ?? "—"}</td>
                          <td>{doc ? (doc.total / 100).toFixed(2) : "—"}</td>
                          <td>
                            {pending
                              ? "În coadă — vezi starea sincronizării"
                              : recorded
                                ? "Document creat; verifică în Contabilitate"
                                : batch.sent.includes(r)
                                  ? "Trimis anterior"
                                  : issue || (
                                      <button
                                        disabled={busy || !writable}
                                        onClick={() => void run(() => send(r))}
                                      >
                                        Confirmă rândul {r + 1}
                                      </button>
                                    )}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={r}>
                        <td>{r + 1}</td>
                        {Array.from({ length: width }, (_, c) => {
                          let result = "";
                          if (row[c]?.startsWith("=")) {
                            try {
                              result = String(calculate(visibleGrid, r, c));
                            } catch (e) {
                              result = String(e);
                            }
                          }
                          return (
                            <td key={c}>
                              <input
                                aria-label={`${String.fromCharCode(65 + c)}${r + 1}`}
                                defaultValue={row[c] ?? ""}
                                key={`${original}:${row[c]}`}
                                readOnly={
                                  original || batch.frozen || !writable || busy
                                }
                                onBlur={(e) => {
                                  if (e.target.value !== (row[c] ?? "")) {
                                    const grid = batch.grid.map((a) => [...a]);
                                    grid[r][c] = e.target.value.slice(0, 2000);
                                    void run(() => save({ ...batch, grid }));
                                  }
                                }}
                                onPaste={(e) => {
                                  const text = e.clipboardData.getData("text");
                                  if (
                                    !/[\t\n]/.test(text) ||
                                    original ||
                                    batch.frozen ||
                                    !writable ||
                                    busy
                                  )
                                    return;
                                  e.preventDefault();
                                  void run(async () => {
                                    const cells = parseDelimited(text, "\t");
                                    if (
                                      r + cells.length > batch.grid.length ||
                                      cells.some((a) => c + a.length > width)
                                    )
                                      throw new Error(
                                        "Lipirea depășește tabelul.",
                                      );
                                    const grid = batch.grid.map((a) => [...a]);
                                    cells.forEach((a, y) =>
                                      a.forEach(
                                        (v, x) => (grid[r + y][c + x] = v),
                                      ),
                                    );
                                    await save({ ...batch, grid });
                                  });
                                }}
                              />
                              {result && <small>{result}</small>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p>
            Confirmarea creează un document și propunerea contabilă aferentă,
            folosind regulile și perioadele existente. Nu transmite facturi sau
            declarații către autorități. După prima confirmare, tabelul se
            blochează pentru a păstra traseul sumelor.
          </p>
          <details>
            <summary>Închide spațiul de lucru</summary>
            <p>
              Descarcă originalul înainte de eliminare. Se elimină numai copia
              locală și prelucrarea; documentele create păstrează referința
              sursei.
            </p>
            <button
              disabled={
                busy ||
                !writable ||
                snapshot.pending.some((p) => batch.ids.includes(p.invoice.id))
              }
              onClick={() => void run(() => save(null))}
            >
              Elimină copia locală a importului
            </button>
          </details>
        </>
      )}
    </section>
  );
}
