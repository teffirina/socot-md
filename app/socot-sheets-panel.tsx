"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { readValue, writeValue, type Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
import {
  makeBook,
  templateBook,
  readSpreadsheet,
  writeSpreadsheet,
  accountingGrid,
  restoreSpreadsheet,
  printableSheet,
  safeDownload,
  BOOK_LIMIT,
  type SheetBook,
} from "../lib/socot-sheets";
import { suggestMapping, type Grid } from "../lib/workbook";
import type { SheetController } from "./socot-sheet-canvas";
import ImportPanel from "./import-panel";
import SheetAnalysisPanel from "./sheet-analysis-panel";
import { pivotSheet } from "../lib/sheet-analysis";
const Canvas = dynamic(() => import("./socot-sheet-canvas"), {
  ssr: false,
  loading: () => (
    <p className="sheet-loading">Se încarcă editorul de foi de calcul…</p>
  ),
});
type Index = { id: string; name: string }[];
// Serial writes prevent an older autosave from replacing a more recent edit or index.
let writes = Promise.resolve();
export default function SocotSheetsPanel({
  engine,
  snapshot,
  writable,
}: {
  engine: SyncEngine;
  snapshot: Snapshot;
  writable: boolean;
}) {
  const key = `${engine.scope}:sheets-v2`,
    controller = useRef<SheetController | null>(null),
    latest = useRef<SheetBook | null>(null),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    dirty = useRef(false),
    saving = useRef(0),
    fileRef = useRef<HTMLInputElement>(null);
  const [book, setBook] = useState<SheetBook | null>(null),
    [books, setBooks] = useState<Index>([]),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Se încarcă…"),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"sheet" | "review">("sheet"),
    [wide, setWide] = useState(false),
    [warnings, setWarnings] = useState<string[]>([]),
    [hasOriginal, setHasOriginal] = useState(false),
    [analysis, setAnalysis] = useState<{
      book: SheetBook;
      sheet: string;
    } | null>(null),
    [download, setDownload] = useState<{ url: string; name: string } | null>(
      null,
    );
  const downloadRef = useRef<string | null>(null);
  function offerDownload(blob: Blob, name: string) {
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    const url = URL.createObjectURL(blob);
    downloadRef.current = url;
    setDownload({ url, name });
  }
  useEffect(
    () => () => {
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
    },
    [],
  );
  const indexRef = useRef<Index>([]);
  function persist(value: SheetBook) {
    const copy = structuredClone(value),
      revision = ++saving.current;
    dirty.current = true;
    if (mounted.current) setStatus("Se salvează local…");
    const job = writes
      .catch(() => {})
      .then(async () => {
        if (new TextEncoder().encode(JSON.stringify(copy)).length > BOOK_LIMIT)
          throw Error(
            "Registrul depășește 4,5 MB. Exportă o copie și împarte datele în registre mai mici.",
          );
        await writeValue(`${key}:book:${copy.id}`, copy);
        const index = (await readValue<Index>(`${key}:index`)) ?? [];
        const next = [
          ...index.filter((b) => b.id !== copy.id),
          { id: copy.id, name: copy.name },
        ];
        await writeValue(`${key}:index`, next);
        await writeValue(`${key}:active`, copy.id);
        if (mounted.current) {
          indexRef.current = next;
          setBooks(next);
          if (revision === saving.current) {
            dirty.current = false;
            setStatus("Salvat local");
          }
        }
      });
    writes = job;
    return job.catch((e) => {
      if (mounted.current) {
        setError(String(e));
        setStatus("Nesalvat — exportă o copie");
      }
      throw e;
    });
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;
  function changed(value: SheetBook) {
    latest.current = value;
    dirty.current = true;
    setStatus("Modificări în curs…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void persistRef.current(value).catch(() => {});
    }, 300);
  }
  async function flush(persistLocally = true) {
    if (persistLocally && timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const value = controller.current
      ? await controller.current.commit()
      : latest.current;
    if (value) {
      latest.current = value;
      if (persistLocally) await persist(value);
    }
    return value;
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let live = true;
    void (async () => {
      const index = (await readValue<Index>(`${key}:index`)) ?? [],
        active = await readValue<string>(`${key}:active`);
      let value = active
        ? await readValue<SheetBook>(`${key}:book:${active}`)
        : null;
      if (!value) {
        const old = await readValue<{ grid: Grid; name: string }>(
          `${engine.scope}:import-workspace-v1`,
        );
        value = old ? makeBook(old.name, old.grid) : makeBook();
      }
      if (!live) return;
      indexRef.current = index;
      setBooks(index);
      latest.current = value;
      setBook(value);
      setHasOriginal(Boolean(await readValue(`${key}:original:${value.id}`)));
      await persistRef.current(value);
    })().catch((e) => live && setError(String(e)));
    const before = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      live = false;
      mounted.current = false;
      window.removeEventListener("beforeunload", before);
      if (timer.current) clearTimeout(timer.current);
      if (latest.current && dirty.current)
        void persistRef.current(latest.current).catch(() => {});
    };
  }, [key, engine.scope]);
  async function open(value: SheetBook) {
    await flush();
    latest.current = value;
    await persist(value);
    setBook(value);
    setHasOriginal(Boolean(await readValue(`${key}:original:${value.id}`)));
    setMode("sheet");
    setAnalysis(null);
    setDownload(null);
  }
  async function create(template = false) {
    if (books.length >= 20)
      throw Error(
        "Maximum 20 registre locale. Exportă registrele pentru arhivare.",
      );
    await open(
      template ? templateBook() : makeBook(`Registru ${books.length + 1}`),
    );
    setWarnings([]);
  }
  async function importFile(file: File) {
    if (books.length >= 20) throw Error("Maximum 20 registre locale.");
    const bytes = await file.arrayBuffer();
    if (/\.socot\.json$/i.test(file.name)) {
      await open(restoreSpreadsheet(new TextDecoder().decode(bytes)));
      setWarnings([]);
      return;
    }
    const result = await readSpreadsheet(bytes, file.name);
    const base64 = btoa(
      Array.from(new Uint8Array(bytes), (b) => String.fromCharCode(b)).join(""),
    );
    await writeValue(`${key}:original:${result.book.id}`, {
      name: file.name,
      data: base64,
      type: file.type,
    });
    await open(result.book);
    setWarnings(result.warnings);
    setHasOriginal(true);
  }
  async function exportFile() {
    const value = await flush(false);
    if (!value) return;
    const bytes = await writeSpreadsheet(value);
    offerDownload(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      value.name.replace(/[\\/:*?"<>|]/g, "_") + ".xlsx",
    );
  }
  async function prepare() {
    const value = await flush();
    if (!value || !controller.current) return;
    const sheetId = controller.current.activeSheet(),
      s = value.sheets[sheetId],
      grid = accountingGrid(s, value);
    const oldKey = `${engine.scope}:import-workspace-v1`,
      old = await readValue<{ hash: string; name: string }>(oldKey);
    if (old) {
      const index =
        (await readValue<{ hash: string; name: string }[]>(
          `${oldKey}:index`,
        )) ?? [];
      await writeValue(`${oldKey}:table:${old.hash}`, old);
      await writeValue(`${oldKey}:index`, [
        ...index.filter((i) => i.hash !== old.hash),
        { hash: old.hash, name: old.name },
      ]);
    }
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            JSON.stringify({ id: value.id, sheetId, grid }),
          ),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    await writeValue(`${key}:handoff:${hash}`, {
      book: value,
      sheetId,
      createdAt: new Date().toISOString(),
    });
    const prior = await readValue<{ hash: string }>(`${oldKey}:table:${hash}`);
    if (prior) await writeValue(oldKey, prior);
    else
      await writeValue(oldKey, {
        name: value.name,
        manual: true,
        original: "",
        mime: "",
        hash,
        sheet: s.name ?? sheetId,
        grid,
        originalGrid: grid,
        ids: grid.map(() => crypto.randomUUID()),
        mapping: suggestMapping(grid[0]),
        kind: "expense",
        frozen: false,
        sent: [],
        workbookId: value.id,
        sheetId,
      });
    setAnalysis(null);
    setMode("review");
  }
  return (
    <section className={`socot-sheets ${wide ? "socot-sheets-wide" : ""}`}>
      <div className="sheet-top">
        <div>
          <strong>Socot · Foi de calcul</strong>
          <span role="status">{status} · în acest profil</span>
        </div>
        <button className="secondary" onClick={() => setWide(!wide)}>
          {wide ? "Ieși din ecran mare" : "Ecran mare"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="sheet-filebar">
        <button
          disabled={busy || !writable}
          onClick={() => void run(() => create())}
        >
          ＋ Registru gol
        </button>
        <button
          className="secondary"
          disabled={busy || !writable}
          onClick={() => void run(() => create(true))}
        >
          Model cheltuieli
        </button>
        <button
          className="secondary"
          disabled={busy || !writable}
          onClick={() => fileRef.current?.click()}
        >
          Deschide fișier
        </button>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept=".xlsx,.csv,.tsv,.socot.json"
          aria-label="Importă registru Excel"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void run(() => importFile(f));
          }}
        />
        <button
          className="secondary"
          disabled={busy || !book}
          onClick={() => void run(exportFile)}
        >
          Pregătește Excel (.xlsx)
        </button>
        <button
          className="secondary"
          disabled={busy || !book}
          onClick={() =>
            void run(async () => {
              const b = await flush(false);
              if (b)
                offerDownload(
                  new Blob([JSON.stringify(b)], { type: "application/json" }),
                  b.name + ".socot.json",
                );
            })
          }
        >
          Copie completă
        </button>
        <button
          className="secondary"
          disabled={busy || !book}
          onClick={() =>
            void run(async () => {
              await flush();
            })
          }
        >
          Salvează
        </button>
        <button
          className="secondary"
          disabled={busy || !book}
          onClick={() =>
            void run(async () => {
              const b = await flush(false);
              if (!b || !controller.current) return;
              const html = printableSheet(b, controller.current.activeSheet());
              const frame = document.createElement("iframe");
              frame.style.cssText =
                "position:fixed;left:-10000px;width:1000px;height:700px";
              frame.title = "Imprimare Socot";
              frame.onload = () => {
                frame.contentWindow?.print();
                setTimeout(() => frame.remove(), 60000);
              };
              frame.srcdoc = html;
              document.body.append(frame);
            })
          }
        >
          Imprimă / PDF
        </button>
      </div>
      {download && (
        <div className="sheet-export-ready" role="status">
          <span>
            Fișier pregătit: <strong>{download.name}</strong>
          </span>
          <a
            href={download.url}
            download={download.name}
            className="sheet-download-link"
          >
            Salvează fișierul
          </a>
          <span>Apasă linkul pentru a începe descărcarea.</span>
        </div>
      )}
      <div className="sheet-filebar">
        <button
          className="secondary"
          disabled={busy || !writable || !book}
          onClick={() =>
            void run(async () => {
              const value = await flush();
              if (value && controller.current) {
                setAnalysis({
                  book: value,
                  sheet: controller.current.activeSheet(),
                });
                setMode("sheet");
              }
            })
          }
        >
          Centralizare / grafic
        </button>
      </div>
      <div className="sheet-documentbar">
        <label>
          Registru deschis
          <select
            aria-label="Registre salvate"
            disabled={busy}
            value={book?.id ?? ""}
            onChange={(e) =>
              void run(async () => {
                const b = await readValue<SheetBook>(
                  `${key}:book:${e.target.value}`,
                );
                if (!b) throw Error("Registrul nu a fost găsit.");
                await open(b);
                setWarnings([]);
              })
            }
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {book && (
          <label>
            Denumire
            <input
              key={book.id}
              aria-label="Denumire registru"
              defaultValue={book.name}
              disabled={!writable}
              maxLength={120}
              onBlur={(e) => {
                const n = e.target.value.trim();
                if (n) {
                  controller.current?.rename(n);
                  setBook((b) => (b ? { ...b, name: n } : b));
                }
              }}
            />
          </label>
        )}
        <div className="sheet-mode">
          <button
            className={mode === "sheet" ? "" : "secondary"}
            onClick={() => setMode("sheet")}
          >
            Foi de calcul
          </button>
          <button
            className={mode === "review" ? "" : "secondary"}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await flush();
                setAnalysis(null);
                setMode("review");
              })
            }
          >
            Verificare contabilă
          </button>
        </div>
      </div>
      {warnings.length > 0 && (
        <details className="sheet-notes" open>
          <summary>Compatibilitatea fișierului importat</summary>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      )}
      {hasOriginal && (
        <button
          className="sheet-original secondary"
          onClick={() =>
            void run(async () => {
              const o = await readValue<{
                name: string;
                data: string;
                type: string;
              }>(`${key}:original:${book!.id}`);
              if (o)
                safeDownload(
                  new Blob(
                    [Uint8Array.from(atob(o.data), (c) => c.charCodeAt(0))],
                    { type: o.type },
                  ),
                  o.name,
                );
            })
          }
        >
          Descarcă originalul
        </button>
      )}
      {!writable ? (
        <p>Profilul curent nu are drept de editare a documentelor.</p>
      ) : (
        book && (
          <div
            style={{
              display: mode === "sheet" && !analysis ? "block" : "none",
            }}
          >
            <Canvas
              key={book.id}
              initial={book}
              onChange={changed}
              onReady={(c) => {
                controller.current = c;
              }}
              onError={setError}
            />
          </div>
        )
      )}
      {analysis && (
        <SheetAnalysisPanel
          key={analysis.book.id + analysis.sheet}
          initial={analysis.book}
          activeSheet={analysis.sheet}
          onClose={() => setAnalysis(null)}
          onRefresh={async () => {
            const value = await flush();
            if (!value) throw Error("Registrul nu este disponibil.");
            return value;
          }}
          onInsert={async (p, c) => {
            if (!controller.current) throw Error("Editorul nu este pregătit.");
            controller.current.insertSheet("Centralizare", pivotSheet(p, c));
            await flush();
            setAnalysis(null);
            setMode("sheet");
          }}
        />
      )}
      {mode === "sheet" && !analysis && (
        <div className="sheet-bottom">
          <span>
            Selectează celule • Formule cu = • Ctrl/Cmd+C, V, Z • Adaugă foi cu
            ＋
          </span>
          <button
            disabled={busy || !writable || !book}
            onClick={() => void run(prepare)}
          >
            Pregătește foaia pentru contabilitate →
          </button>
        </div>
      )}
      {mode === "review" && (
        <ImportPanel
          key={`${book?.id}-review`}
          engine={engine}
          snapshot={snapshot}
          writable={writable}
        />
      )}
      <details className="sheet-notes">
        <summary>Despre compatibilitate și salvare</summary>
        <p>
          Editor integrat Univer, fără Excel instalat. Include foi multiple,
          formule, formatare, îmbinări, sortare, filtre, căutare, validări și
          formatare condițională. Unele meniuri sunt în engleză. Centralizările
          și graficele simple sunt disponibile prin „Centralizare / grafic”. Nu
          include VBA, Power Query sau toate opțiunile pivot/grafice Microsoft
          Excel. Exportul XLSX păstrează datele și formatarea de bază; copia
          Socot JSON păstrează structura completă a editorului și se restaurează
          prin „Deschide fișier”. Datele sunt locale, nu sincronizate între
          dispozitive. Așteaptă „Salvat local” înainte de închidere.
        </p>
        <p>
          În contabilitate se transferă o copie verificabilă a valorilor din
          foaia activă; formulele și registrul original rămân în spațiul de
          lucru. Nu se transmit documente către autorități.
        </p>
      </details>
    </section>
  );
}
