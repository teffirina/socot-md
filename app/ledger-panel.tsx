"use client";
import { useState } from "react";
import {
  ledgerReport,
  accountCard,
  type LedgerReport,
} from "../lib/ledger-report";
import type { Snapshot } from "../lib/storage";
import { api } from "../lib/api";
import AmountDetail from "./amount-detail";
import type { Column, DrillRequest } from "../lib/drilldown";
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
    [drill, setDrill] = useState<DrillRequest | null>(null);
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDrill(null);
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
  const document = (id: string) =>
    setDrill({ kind: "documents", invoiceIds: [id] });
  const cell = (account: string, column: Column, value: number, i: number) => (
    <td key={i}>
      {value ? (
        <button
          className="amount-link"
          title="Vezi documentele, calculul, înregistrările și istoricul"
          onClick={() =>
            report &&
            setDrill({
              kind: "account",
              account,
              column,
              from: report.from,
              to: report.to,
            })
          }
        >
          {money(value)}
        </button>
      ) : (
        money(value)
      )}
    </td>
  );
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
        Alege perioada, apoi un cont pentru a vedea mișcările. Apasă pe orice
        sumă ca să vezi documentele, calculul, înregistrările și istoricul. Se
        includ numai articolele postate cu dată cunoscută.
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
            <button className="secondary" onClick={() => setCode("")}>
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
                      {(
                        [
                          [Math.max(a.opening, 0), "opening"],
                          [Math.max(-a.opening, 0), "opening"],
                          [a.debit, "debit"],
                          [a.credit, "credit"],
                          [Math.max(a.closing, 0), "closing"],
                          [Math.max(-a.closing, 0), "closing"],
                        ] as const
                      ).map(([v, column], i) => cell(a.code, column, v, i))}
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
                        <td>
                          {e.debitAmount ? (
                            <button
                              className="amount-link"
                              onClick={() => document(e.invoiceId)}
                            >
                              {money(e.debitAmount)}
                            </button>
                          ) : (
                            money(0)
                          )}
                        </td>
                        <td>
                          {e.creditAmount ? (
                            <button
                              className="amount-link"
                              onClick={() => document(e.invoiceId)}
                            >
                              {money(e.creditAmount)}
                            </button>
                          ) : (
                            money(0)
                          )}
                        </td>
                        <td>{money(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {drill && (
            <AmountDetail
              request={drill}
              demo={demo}
              snapshot={snapshot}
              onClose={() => setDrill(null)}
            />
          )}
        </>
      )}
    </section>
  );
}
