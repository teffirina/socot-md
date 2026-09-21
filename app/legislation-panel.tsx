"use client";
import { useState } from "react";
import { api } from "../lib/api";
const labels: Record<string, string> = {
  current: "În vigoare",
  future: "Viitoare",
  archive: "Arhivă",
  draft: "Proiecte",
  unverified: "Neverificate",
  unknown: "Aplicare necunoscută",
};
type Result = {
  total: number;
  verified: number;
  hasMore: boolean;
  items: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    sourceDocumentId: string;
    status: string;
    validFrom: string | null;
    validTo: string | null;
    provisions: Array<{ reference: string; text: string }>;
  }>;
};
export default function LegislationPanel({ demo }: { demo: boolean }) {
  const [at, setAt] = useState(
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Chisinau" }).format(
      new Date(),
    ),
  );
  const [q, setQ] = useState(""),
    [filter, setFilter] = useState("current"),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [offset, setOffset] = useState(0);
  async function search(next = 0) {
    setBusy(true);
    setError("");
    try {
      setResult(
        await api("/legislation/search", { at, q, view: filter, offset: next }),
      );
      setOffset(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Bibliotecă legislativă</h2>
      <p>
        Consultă prevederile la data operațiunii. Versiunile istorice se
        păstrează separat. Validarea unui text nu activează formule contabile.
      </p>
      {demo ? (
        <p>
          Corpusul legislativ nu este inclus în demonstrația locală. Nu există
          acte oficiale importate în acest mod. Biblioteca conectată folosește
          corpusul verificat de pe server.
        </p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <label>
              Data aplicării
              <input
                type="date"
                required
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </label>
            <label>
              Cuvinte-cheie
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={200}
              />
            </label>
            <label>
              Versiuni
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>
              {busy ? "Se caută…" : "Caută în corpus"}
            </button>
          </form>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {result && (
            <>
              <p>
                {result.total} versiuni importate · {result.verified} validate.
                Acoperirea integrală a legislației nu este confirmată.
              </p>
              {!result.items.length && (
                <p>
                  Nicio versiune în selecția curentă. Aceasta nu înseamnă că nu
                  există acte aplicabile.
                </p>
              )}
              {result.items.map((v) => (
                <article key={v.id}>
                  <h3>{v.title}</h3>
                  <p>
                    {labels[v.status]} · aplicare:{" "}
                    {v.validFrom ?? "necunoscută"} —{" "}
                    {v.validTo ?? "fără termen confirmat"} · doc_id:{" "}
                    {v.sourceDocumentId}
                  </p>
                  <a href={v.sourceUrl} target="_blank" rel="noreferrer">
                    Consultă sursa
                  </a>
                  {v.provisions.map((p) => (
                    <details key={p.reference}>
                      <summary>{p.reference}</summary>
                      <p style={{ whiteSpace: "pre-wrap" }}>{p.text}</p>
                    </details>
                  ))}
                </article>
              ))}
              <button
                disabled={busy || offset === 0}
                onClick={() => search(Math.max(0, offset - 50))}
              >
                Înapoi
              </button>
              <button
                disabled={busy || !result.hasMore}
                onClick={() => search(offset + 50)}
              >
                Următoarele
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
