"use client";
import { useState } from "react";
import {
  ledgerReport,
  accountCard,
  type LedgerReport,
} from "../lib/ledger-report";
import type { Snapshot } from "../lib/storage";
import { api } from "../lib/api";
const money = (v: number) =>
  (v / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function LedgerPanel({
  demo,
  snapshot,
}: {
  demo: boolean;
  snapshot: Snapshot;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01"),
    [to, setTo] = useState(today),
    [report, setReport] = useState<LedgerReport | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState<{
      id: string;
      customer: string;
      date: string;
      total: number;
      paid: number;
    } | null>(null);
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSource(null);
    try {
      setReport(
        demo
          ? ledgerReport(snapshot.ledger ?? [], from, to)
          : await api("/ledger-report", { from, to }),
      );
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setBusy(false);
    }
  }
  async function document(id: string) {
    setError("");
    setSource(null);
    try {
      const value = demo
        ? snapshot.invoices.find((i) => i.id === id)
        : await api("/source-document", { id });
      if (!value) throw new Error("Documentul sursă nu este disponibil.");
      setSource(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function exportCsv() {
    if (!report) return;
    const rows = code
      ? [
          ["Data", "Document", "Debit MDL", "Credit MDL", "Sold net MDL"],
          ...accountCard(report, code).map((e) => [
            e.effectiveDate,
            e.invoiceId,
            e.debitAmount / 100,
            e.creditAmount / 100,
            e.balance / 100,
          ]),
        ]
      : [
          [
            "Cont",
            "Sold inițial net MDL",
            "Rulaj debit MDL",
            "Rulaj credit MDL",
            "Sold final net MDL",
          ],
          ...report.accounts.map((a) => [
            a.code,
            a.opening / 100,
            a.debit / 100,
            a.credit / 100,
            a.closing / 100,
          ]),
        ];
    const csv = rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = documentCreate();
    a.href = url;
    a.download = `Socot-${code || "balanta"}-${report.from}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function documentCreate() {
    return window.document.createElement("a");
  }
  const selected = report?.accounts.find((a) => a.code === code);
  return (
    <section className="panel settings">
      <p className="eyebrow">RAPOARTE CONTABILE</p>
      <h2>Balanță și fișa contului</h2>
      <p className="muted">
        Alege perioada, apoi un cont pentru a vedea mișcările și documentele
        sursă. Se includ numai articolele postate cu dată cunoscută.
      </p>
      <form onSubmit={generate}>
        <div className="formgrid">
          <label>
            De la
            <input
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Până la
            <input
              type="date"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <button disabled={busy}>
          {busy ? "Se calculează…" : "Generează balanța"}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {report && (
        <>
          <p className="notice">
            Perioada {report.from} — {report.to}. {report.excluded} articole
            propuse sau fără dată excluse. Soldurile inițiale provin numai din
            istoricul postat disponibil; nu înlocuiesc introducerea soldurilor
            de deschidere.
          </p>
          <div className="controls">
            <button
              className="secondary"
              onClick={() => {
                setCode("");
                setSource(null);
              }}
            >
              Toate conturile
            </button>
            <button className="secondary" onClick={exportCsv}>
              Exportă CSV
            </button>
          </div>
          {!code ? (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>CONT</th>
                    <th>INIȚIAL D</th>
                    <th>INIȚIAL C</th>
                    <th>RULAJ D</th>
                    <th>RULAJ C</th>
                    <th>FINAL D</th>
                    <th>FINAL C</th>
                  </tr>
                </thead>
                <tbody>
                  {report.accounts.map((a) => (
                    <tr key={a.code}>
                      <td>
                        <button
                          className="textbutton"
                          onClick={() => setCode(a.code)}
                        >
                          {a.code} ↗
                        </button>
                      </td>
                      {[
                        Math.max(a.opening, 0),
                        Math.max(-a.opening, 0),
                        a.debit,
                        a.credit,
                        Math.max(a.closing, 0),
                        Math.max(-a.closing, 0),
                      ].map((v, i) => (
                        <td key={i}>{money(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total MDL</th>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <td key={i}>
                        {money(
                          report.accounts.reduce(
                            (n, a) =>
                              n +
                              [
                                Math.max(a.opening, 0),
                                Math.max(-a.opening, 0),
                                a.debit,
                                a.credit,
                                Math.max(a.closing, 0),
                                Math.max(-a.closing, 0),
                              ][i],
                            0,
                          ),
                        )}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
              {!report.accounts.length && (
                <p>Nu există articole postate în istoricul selectat.</p>
              )}
            </div>
          ) : (
            <>
              <h3>Fișa contului {code}</h3>
              <p>
                Sold inițial net: {money(selected?.opening ?? 0)} MDL. Sold
                pozitiv = debit; negativ = credit.
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>DATĂ / DOCUMENT</th>
                      <th>CORESPONDENȚĂ</th>
                      <th>DEBIT</th>
                      <th>CREDIT</th>
                      <th>SOLD NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountCard(report, code).map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.effectiveDate}
                          <button
                            className="textbutton"
                            onClick={() => document(e.invoiceId)}
                          >
                            {e.invoiceId.slice(0, 8)} ↗
                          </button>
                        </td>
                        <td>
                          {e.debit} → {e.credit}
                        </td>
                        <td>{money(e.debitAmount)}</td>
                        <td>{money(e.creditAmount)}</td>
                        <td>{money(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {source && (
            <article className="reportcard">
              <h3>Document sursă · {source.id.slice(0, 8)}</h3>
              <p>
                {source.customer} · {source.date}
              </p>
              <p>
                Total: {money(source.total)} MDL · Încasat în prezent:{" "}
                {money(source.paid)} MDL
              </p>
              <small>
                Starea curentă a documentului; încasarea poate include
                operațiuni ulterioare perioadei raportului.
              </small>
              <p>
                <button className="secondary" onClick={() => setSource(null)}>
                  Închide detaliile
                </button>
              </p>
            </article>
          )}
        </>
      )}
    </section>
  );
}
