"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { dashboardMoney } from "../lib/dashboard";
import {
  actionName,
  assembleDrill,
  type Drill,
  type DrillRequest,
  type HistoryItem,
} from "../lib/drilldown";
import type { Snapshot } from "../lib/storage";

const money = (bani: number) => dashboardMoney(bani, false);
const when = (iso: string) =>
  new Date(iso).toLocaleString("ro-MD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const tabs = ["Documente", "Calcul", "Înregistrări", "Istoric"] as const;

/** The demo's own data, put together like the server does. */
export function demoDrill(snapshot: Snapshot, request: DrillRequest): Drill {
  const ledger = snapshot.ledger ?? [];
  const ops = new Map(
    ledger.map((e) => [e.operationId ?? e.id, e.invoiceId] as const),
  );
  const ids = new Set(snapshot.invoices.map((i) => i.id));
  const history: HistoryItem[] = (snapshot.compliance?.audit ?? [])
    .filter((a) => ids.has(a.objectId) || ops.has(a.objectId))
    .map((a) => ({
      at: a.at,
      who: a.actor,
      invoiceId: ids.has(a.objectId) ? a.objectId : ops.get(a.objectId),
      what: `${actionName(a.action)}: ${a.reason}`,
      changes: [],
    }));
  return assembleDrill(request, ledger, snapshot.invoices, history);
}

// Opens one amount from a report: which documents make it, how it is
// calculated, the journal entries behind it and who changed them.
export default function AmountDetail({
  request,
  demo,
  snapshot,
  onClose,
}: {
  request: DrillRequest;
  demo: boolean;
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Calcul");
  const key = JSON.stringify(request);
  useEffect(() => {
    let live = true;
    setDrill(null);
    setError("");
    (demo
      ? Promise.resolve().then(() => demoDrill(snapshot, request))
      : (api("/drilldown", request) as Promise<Drill>)
    )
      .then((d) => live && setDrill(d))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
    // The request is compared by value; the snapshot only matters in the demo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, demo]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const name = (id: string) => {
    const i = drill?.invoices.find((x) => x.id === id);
    return i ? `${i.customer} · ${i.date}` : id.slice(0, 8);
  };

  return (
    <div className="modalback" onClick={onClose}>
      <section
        className="modal amount-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="amount-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">De unde vine suma</p>
        <h2 id="amount-detail-title">{drill?.title ?? "Se încarcă…"}</h2>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {drill && (
          <>
            <div className="amount-detail-tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                  <small>
                    {t === "Documente"
                      ? drill.invoices.length
                      : t === "Înregistrări"
                        ? drill.entries.length
                        : t === "Istoric"
                          ? drill.history.length
                          : ""}
                  </small>
                </button>
              ))}
            </div>
            {drill.truncated && (
              <p className="muted">
                Lista e prea lungă și se arată doar o parte; sumele din Calcul
                sunt complete.
              </p>
            )}
            {tab === "Calcul" && (
              <table className="amount-detail-steps">
                <tbody>
                  {drill.steps.map((s, i) => (
                    <tr key={i} className={s.sign === "=" ? "total" : ""}>
                      <td className="sign">{s.sign ?? ""}</td>
                      <td>{s.label}</td>
                      <td className="num right">{money(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "Documente" && (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Contragent</th>
                      <th>Tip</th>
                      <th className="right">Total</th>
                      <th className="right">Achitat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drill.invoices.map((i) => (
                      <tr key={i.id}>
                        <td className="num">{i.date}</td>
                        <td>
                          {i.customer}
                          <small className="muted">
                            {i.sourceRef ?? `Socot · ${i.id.slice(0, 8)}`}
                          </small>
                        </td>
                        <td>
                          {i.kind === "expense" ? "Cumpărare" : "Vânzare"}
                        </td>
                        <td className="num right">{money(i.total)}</td>
                        <td className="num right">{money(i.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!drill.invoices.length && (
                  <p className="muted">Niciun document în această sumă.</p>
                )}
              </div>
            )}
            {tab === "Înregistrări" && (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Document</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th className="right">Suma</th>
                      <th>Stare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drill.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="num">{e.effectiveDate ?? "—"}</td>
                        <td>{name(e.invoiceId)}</td>
                        <td className="num">{e.debit}</td>
                        <td className="num">{e.credit}</td>
                        <td className="num right">{money(e.amount)}</td>
                        <td>
                          {e.state === "posted" ? "Postat" : "Propus"}
                          {e.ruleVersion ? (
                            <small className="muted">
                              regula v{e.ruleVersion}
                            </small>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!drill.entries.length && (
                  <p className="muted">
                    Nu sunt articole contabile vizibile pentru rolul tău.
                  </p>
                )}
              </div>
            )}
            {tab === "Istoric" && (
              <ol className="amount-detail-history">
                {drill.history.map((h, i) => (
                  <li key={i}>
                    <small className="muted">
                      {when(h.at)} · {h.who}
                      {h.invoiceId ? ` · ${name(h.invoiceId)}` : ""}
                    </small>
                    <p>{h.what}</p>
                    {h.changes.length > 0 && (
                      <ul>
                        {h.changes.map((c) => (
                          <li key={c.field}>
                            {c.field}: {c.before} → <strong>{c.after}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {!drill.history.length && (
                  <p className="muted">Nu sunt modificări înregistrate.</p>
                )}
              </ol>
            )}
          </>
        )}
        <div className="controls">
          <button className="secondary" onClick={onClose}>
            Închide
          </button>
        </div>
      </section>
    </div>
  );
}
