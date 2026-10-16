"use client";
import {
  calculateDocumentLines,
  lineFromCatalog,
  type DocumentLine,
} from "../lib/document-lines";
import { useState } from "react";
import type { CatalogEntry } from "../lib/catalog";
const money = (amount: number) =>
  (amount / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function DocumentLinesEditor({
  lines,
  onChange,
  readonly = false,
  catalog = [],
}: {
  lines: DocumentLine[];
  onChange?: (lines: DocumentLine[]) => void;
  readonly?: boolean;
  catalog?: CatalogEntry[];
}) {
  const [selectionError, setSelectionError] = useState("");
  let result: ReturnType<typeof calculateDocumentLines> | undefined,
    error = "";
  try {
    result = calculateDocumentLines(lines);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const update = (id: string, field: keyof DocumentLine, value: string) =>
    onChange?.(
      lines.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: value,
              ...(["description", "unit", "category"].includes(field)
                ? { itemId: undefined }
                : {}),
            }
          : line,
      ),
    );
  return (
    <section aria-label="Pozițiile documentului">
      <h3>Produse și servicii</h3>
      <p className="footnote">
        Pregătire în ciornă. TVA se introduce explicit și trebuie verificat
        pentru operațiunea respectivă. Rotunjire la bani pe fiecare rând;
        cantități cu până la trei zecimale. Reducerea se aplică valorii rândului
        în modul de preț ales, înainte de calculul TVA.
      </p>
      {!readonly && (
        <label>
          Adaugă din nomenclator
          <select
            value=""
            disabled={lines.length >= 200}
            onChange={(e) => {
              setSelectionError("");
              try {
                onChange?.([
                  ...lines,
                  lineFromCatalog(e.target.value, catalog, crypto.randomUUID()),
                ]);
              } catch (error) {
                setSelectionError(
                  error instanceof Error ? error.message : String(error),
                );
              }
            }}
          >
            <option value="">Alege un produs, material sau serviciu…</option>
            {catalog
              .filter((e) => e.kind === "item" && e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {selectionError && (
        <p className="error" role="alert">
          {selectionError}
        </p>
      )}
      <div className="tablewrap">
        <table style={{ minWidth: readonly ? 820 : 1240 }}>
          <thead>
            <tr>
              <th>Denumire / tip</th>
              <th>Unitate</th>
              <th>Cantitate</th>
              <th>Preț MDL</th>
              <th>Reducere %</th>
              <th>TVA % / preț</th>
              <th>Fără TVA</th>
              <th>TVA</th>
              <th>Total</th>
              {!readonly && <th>Acțiuni</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                <td>
                  {readonly ? (
                    <>
                      <strong>{line.description}</strong>
                      <small>
                        {line.category === "service"
                          ? "Serviciu"
                          : "Produs / material"}
                      </small>
                    </>
                  ) : (
                    <>
                      <input
                        aria-label={`Denumire poziția ${index + 1}`}
                        value={line.description}
                        disabled={readonly}
                        maxLength={160}
                        onChange={(e) =>
                          update(line.id, "description", e.target.value)
                        }
                      />
                      <select
                        aria-label={`Tip poziția ${index + 1}`}
                        value={line.category}
                        disabled={readonly}
                        onChange={(e) =>
                          update(line.id, "category", e.target.value)
                        }
                      >
                        <option value="service">Serviciu</option>
                        <option value="goods">Produs / material</option>
                      </select>
                    </>
                  )}
                </td>
                {(
                  [
                    ["unit", "Unitate"],
                    ["quantity", "Cantitate"],
                    ["price", "Preț"],
                    ["discount", "Reducere"],
                    ["vat", "TVA"],
                  ] as const
                ).map(([field, label]) => (
                  <td key={field}>
                    {readonly ? (
                      <>
                        {line[field] ?? "0"}
                        {field === "vat" && (
                          <small>
                            {line.priceMode === "net"
                              ? "TVA adăugată"
                              : "TVA inclusă"}
                          </small>
                        )}
                      </>
                    ) : (
                      <>
                        <input
                          aria-label={`${label} poziția ${index + 1}`}
                          value={line[field] ?? "0"}
                          disabled={readonly}
                          inputMode={field === "unit" ? "text" : "decimal"}
                          onChange={(e) =>
                            update(line.id, field, e.target.value)
                          }
                        />
                        {field === "vat" && (
                          <select
                            aria-label={`Mod preț poziția ${index + 1}`}
                            disabled={readonly}
                            value={line.priceMode}
                            onChange={(e) =>
                              update(line.id, "priceMode", e.target.value)
                            }
                          >
                            <option value="net">Fără TVA</option>
                            <option value="gross">Include TVA</option>
                          </select>
                        )}
                      </>
                    )}
                  </td>
                ))}
                <td>{result ? money(result.rows[index].net) : "—"}</td>
                <td>{result ? money(result.rows[index].vat) : "—"}</td>
                <td>{result ? money(result.rows[index].total) : "—"}</td>
                {!readonly && (
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      disabled={lines.length >= 200}
                      onClick={() =>
                        onChange?.([
                          ...lines.slice(0, index + 1),
                          { ...line, id: crypto.randomUUID() },
                          ...lines.slice(index + 1),
                        ])
                      }
                    >
                      Copiază rândul {index + 1}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={lines.length === 1}
                      onClick={() =>
                        onChange?.(lines.filter((r) => r.id !== line.id))
                      }
                    >
                      Elimină rândul {index + 1}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <p role="status" className="notice">
          {error} Ciorna poate fi salvată incompletă.
        </p>
      ) : (
        <p>
          <strong>
            Fără TVA: {money(result!.net)} · TVA: {money(result!.vat)} · Total:{" "}
            {money(result!.total)} MDL
          </strong>
        </p>
      )}
      {!readonly && (
        <button
          type="button"
          className="secondary"
          disabled={lines.length >= 200}
          onClick={() =>
            onChange?.([
              ...lines,
              {
                id: crypto.randomUUID(),
                description: "",
                unit: "buc.",
                quantity: "1",
                price: "0.00",
                vat: "0",
                priceMode: "net",
                category: "service",
              },
            ])
          }
        >
          ＋ Adaugă poziție
        </button>
      )}
    </section>
  );
}
