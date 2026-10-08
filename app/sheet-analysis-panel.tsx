"use client";
import { useMemo, useState } from "react";
import type { SheetBook } from "../lib/socot-sheets";
import {
  buildPivot,
  chartSvg,
  pivotConfig,
  sheetHeaders,
  type PivotConfig,
  type PivotResult,
} from "../lib/sheet-analysis";
export default function SheetAnalysisPanel({
  initial,
  activeSheet,
  onRefresh,
  onInsert,
  onClose,
}: {
  initial: SheetBook;
  activeSheet: string;
  onRefresh: () => Promise<SheetBook>;
  onInsert: (p: PivotResult, c: PivotConfig) => Promise<void>;
  onClose: () => void;
}) {
  const existing = pivotConfig(initial.sheets[activeSheet]?.custom?.socotPivot);
  const [book, setBook] = useState(initial),
    [config, setConfig] = useState<PivotConfig>(
      existing ?? {
        sourceSheetId: activeSheet,
        row: 0,
        column: -1,
        value: Math.max(
          0,
          Math.min(
            2,
            sheetHeaders(initial.sheets[activeSheet] ?? {}).length - 1,
          ),
        ),
        operation: "sum",
      },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const headers = sheetHeaders(book.sheets[config.sourceSheetId] ?? {});
  const preview = useMemo(() => {
    try {
      return { pivot: buildPivot(book, config), error: "" };
    } catch (e) {
      return { pivot: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [book, config]);
  const svg = preview.pivot ? chartSvg(preview.pivot) : "";
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sheet-analysis" aria-label="Centralizare și grafic">
      <div className="sheet-analysis-heading">
        <div>
          <h2>Centralizare și grafic</h2>
          <p>Grupează datele dintr-o foaie. Sursa rămâne neschimbată.</p>
        </div>
        <button className="secondary" onClick={onClose} disabled={busy}>
          Înapoi la foi
        </button>
      </div>
      <div className="sheet-analysis-fields">
        <label>
          Foaie sursă
          <select
            value={config.sourceSheetId}
            onChange={(e) =>
              setConfig({
                ...config,
                sourceSheetId: e.target.value,
                row: 0,
                column: -1,
                value: Math.min(
                  2,
                  sheetHeaders(book.sheets[e.target.value]).length - 1,
                ),
              })
            }
          >
            {book.sheetOrder.map((id) => (
              <option key={id} value={id}>
                {book.sheets[id].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Grupează rândurile după
          <select
            value={config.row}
            onChange={(e) =>
              setConfig({ ...config, row: Number(e.target.value) })
            }
          >
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label>
          Împarte în coloane după
          <select
            value={config.column}
            onChange={(e) =>
              setConfig({ ...config, column: Number(e.target.value) })
            }
          >
            <option value={-1}>Fără împărțire</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label>
          Calcul
          <select
            value={config.operation}
            onChange={(e) =>
              setConfig({
                ...config,
                operation: e.target.value as PivotConfig["operation"],
              })
            }
          >
            <option value="sum">Sumă</option>
            <option value="count">Număr de rânduri</option>
            <option value="average">Medie</option>
          </select>
        </label>
        {config.operation !== "count" && (
          <label>
            Valori din
            <select
              value={config.value}
              onChange={(e) =>
                setConfig({ ...config, value: Number(e.target.value) })
              }
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {(error || preview.error) && (
        <p role="alert" className="error">
          {error || preview.error}
        </p>
      )}
      {preview.pivot && (
        <>
          <p>
            {preview.pivot.sourceRows} rânduri de date ·{" "}
            {preview.pivot.series.length} categorii. Sunt incluse și rândurile
            ascunse sau filtrate.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  {preview.pivot.grid[0].map((v, c) => (
                    <th key={c}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.pivot.grid.slice(1).map((row, r) => (
                  <tr key={r}>
                    {row.map((v, c) => (
                      <td key={c}>
                        {typeof v === "number"
                          ? new Intl.NumberFormat("ro-MD", {
                              maximumFractionDigits: 2,
                            }).format(v)
                          : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <img
            className="sheet-chart"
            src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)}
            alt={preview.pivot.title}
          />
        </>
      )}
      <div className="sheet-filebar">
        <button
          disabled={busy || !preview.pivot}
          onClick={() =>
            void run(async () => {
              const fresh = await onRefresh();
              setBook(fresh);
              await onInsert(buildPivot(fresh, config), config);
            })
          }
        >
          Inserează centralizarea în foaie nouă
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void run(async () => setBook(await onRefresh()))}
        >
          Recalculează din sursă
        </button>
        {svg && (
          <a
            className="sheet-download-link"
            download="Socot-grafic.svg"
            href={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)}
          >
            Descarcă graficul SVG
          </a>
        )}
      </div>
      <p className="muted">
        Centralizarea inserată este o fotografie a datelor. Pentru o versiune
        actualizată, redeschide această comandă din foaia de centralizare și
        generează o foaie nouă. Graficul este afișat aici și se exportă separat;
        nu este încorporat în fișierul Excel.
      </p>
    </section>
  );
}
