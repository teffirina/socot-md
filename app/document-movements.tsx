"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Snapshot } from "../lib/storage";

type Movement = NonNullable<Snapshot["ledger"]>[number];
const money = (amount: number) =>
  (amount / 100).toLocaleString("ro-MD", {
    style: "currency",
    currency: "MDL",
  });
export default function DocumentMovements({
  id,
  snapshot,
  demo,
}: {
  id: string;
  snapshot: Snapshot;
  demo: boolean;
}) {
  const [remote, setRemote] = useState<{
    id: string;
    entries: Movement[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setRemote(null);
    if (demo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api("/document-movements", { id })
      .then((result) => {
        if (active) setRemote({ id, entries: result.entries });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, demo, refresh]);
  const entries = demo
    ? (snapshot.ledger ?? []).filter((e) => e.invoiceId === id)
    : remote?.id === id
      ? remote.entries
      : null;
  return (
    <section aria-label="Mișcările contabile ale documentului">
      <div className="panelhead">
        <h3>Debit și credit · mișcările documentului</h3>
        {!demo && (
          <button
            className="secondary"
            disabled={loading}
            onClick={() => setRefresh((x) => x + 1)}
          >
            Reîncarcă mișcările
          </button>
        )}
      </div>
      <p className="footnote">
        Articolele documentului și ale plăților asociate. Numai articolele
        postate intră în balanță. Sumele de mai jos reprezintă mișcări
        contabile, nu totalul facturii.
      </p>
      {loading && <p role="status">Se citesc mișcările de pe server…</p>}
      {error && (
        <p className="error" role="alert">
          Mișcările nu au putut fi citite: {error}
        </p>
      )}
      {!loading &&
        !error &&
        entries &&
        (entries.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Operațiune</th>
                  <th>Data</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Sumă</th>
                  <th>Regulă / versiune</th>
                  <th>Stare</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {(e.operationId ?? e.id).slice(0, 8)} · {e.lineNo ?? 1}
                    </td>
                    <td>{e.effectiveDate || "Dată neprecizată"}</td>
                    <td>
                      <strong>{e.debit}</strong>
                    </td>
                    <td>
                      <strong>{e.credit}</strong>
                    </td>
                    <td>{money(e.amount)}</td>
                    <td>
                      {e.ruleId ?? "—"}
                      {e.ruleVersion ? ` · v${e.ruleVersion}` : ""}
                    </td>
                    <td>
                      {e.state === "posted"
                        ? "Postat"
                        : e.state === "proposed"
                          ? "Propus"
                          : "Stare neprecizată"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Nu există încă articole contabile pentru acest document. O
            operațiune în coadă trebuie sincronizată înainte ca mișcările să
            apară aici.
          </p>
        ))}
    </section>
  );
}
