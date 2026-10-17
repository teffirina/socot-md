"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Company } from "../lib/company";
import {
  buildReconciliation,
  paymentsFromLedger,
  reconciliationSchema,
  type ActResult,
} from "../lib/reconciliation";
import type { Snapshot } from "../lib/storage";

const lei = (v: number) =>
  (v / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const cell = (v: number) => (v ? lei(v) : "");
const dateRo = (v: string) => v.split("-").reverse().join(".");

export default function ReconciliationPanel({
  demo,
  snapshot,
}: {
  demo: boolean;
  snapshot: Snapshot;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [customer, setCustomer] = useState(""),
    [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [act, setAct] = useState<
      (ActResult & { customer: string; from: string; to: string }) | null
    >(null),
    [company, setCompany] = useState<Company | null>(
      demo ? (snapshot.company ?? null) : null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (demo) return;
    let active = true;
    api("/company")
      .then((r) => {
        if (active) setCompany(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [demo]);
  const partners = (snapshot.catalog ?? []).filter(
    (e) => e.kind === "partner" && e.details.role !== "furnizor",
  );
  const customers = useMemo(
    () =>
      [
        ...new Set([
          ...partners.map((p) => p.name),
          ...snapshot.invoices
            .filter((i) => (i.kind ?? "sale") === "sale")
            .map((i) => i.customer),
        ]),
      ].sort((a, b) => a.localeCompare(b, "ro")),
    [snapshot.invoices, snapshot.catalog],
  );
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = reconciliationSchema.parse({ customer, from, to });
      const result: ActResult = demo
        ? buildReconciliation(
            snapshot.invoices,
            paymentsFromLedger(snapshot.ledger ?? []),
            input.customer,
            input.from,
            input.to,
          )
        : await api("/reconciliation", input);
      setAct({ ...result, ...input });
    } catch (e) {
      setError(
        e instanceof Error && !("issues" in e)
          ? e.message
          : "Alege clientul și o perioadă validă.",
      );
      setAct(null);
    } finally {
      setBusy(false);
    }
  }
  const partner = act && partners.find((p) => p.name === act.customer);
  const own = company
    ? `${company.name}${company.idno ? `, c.f. ${company.idno}` : ""}`
    : "întreprinderea noastră";
  const other = act
    ? `${act.customer}${partner?.details.idno ? `, c.f. ${partner.details.idno}` : ""}`
    : "";
  return (
    <section className="panel settings reconciliation">
      <p className="eyebrow">RAPOARTE · CREANȚE</p>
      <h2>Act de verificare a decontărilor reciproce</h2>
      <p className="muted">
        Alege clientul și perioada. Socot completează partea întreprinderii cu
        facturile de vânzare și încasările înregistrate; partea clientului
        rămâne goală, pentru datele lui.
      </p>
      <form onSubmit={generate} data-t="act-form">
        <div className="formgrid">
          <label>
            Clientul
            <input
              list="reconciliation-customers"
              required
              autoComplete="off"
              placeholder="Scrie primele litere ale numelui…"
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);
                setAct(null);
              }}
            />
            <datalist id="reconciliation-customers">
              {customers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            De la
            <input
              type="date"
              required
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setAct(null);
              }}
            />
          </label>
          <label>
            Până la
            <input
              type="date"
              required
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setAct(null);
              }}
            />
          </label>
        </div>
        <div className="controls">
          <button disabled={busy}>
            {busy ? "Se calculează…" : "Generează actul"}
          </button>
          {act && (
            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              Imprimă / PDF
            </button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {act && (
        <div className="act-sheet">
          <p className="act-title">
            <strong>Act de verificare al decontărilor reciproce</strong>
            <br />
            privind decontările reciproce la data {dateRo(act.to)} între {own}{" "}
            și {other}
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th colSpan={4}>Conform datelor {own}, MDL</th>
                  <th colSpan={4}>Conform datelor {other}, MDL</th>
                </tr>
                <tr>
                  <th>DATA</th>
                  <th>DOCUMENT</th>
                  <th>DEBIT</th>
                  <th>CREDIT</th>
                  <th>DATA</th>
                  <th>DOCUMENT</th>
                  <th>DEBIT</th>
                  <th>CREDIT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2}>Sold inițial la {dateRo(act.from)}</td>
                  <td>{act.soldInitial < 0 ? lei(-act.soldInitial) : ""}</td>
                  <td>{act.soldInitial > 0 ? lei(act.soldInitial) : ""}</td>
                  <td colSpan={2}>Sold inițial la {dateRo(act.from)}</td>
                  <td />
                  <td />
                </tr>
                {act.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{dateRo(r.date)}</td>
                    <td>{r.document}</td>
                    <td>{cell(r.debit)}</td>
                    <td>{cell(r.credit)}</td>
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}>
                    <strong>Rulaje pe perioadă</strong>
                  </td>
                  <td>
                    <strong>{lei(act.rulajDebit)}</strong>
                  </td>
                  <td>
                    <strong>{lei(act.rulajCredit)}</strong>
                  </td>
                  <td colSpan={2}>
                    <strong>Rulaje pe perioadă</strong>
                  </td>
                  <td />
                  <td />
                </tr>
                <tr>
                  <td colSpan={2}>
                    <strong>Sold final</strong>
                  </td>
                  <td>
                    <strong>
                      {act.soldFinal < 0 ? lei(-act.soldFinal) : ""}
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {act.soldFinal > 0 ? lei(act.soldFinal) : ""}
                    </strong>
                  </td>
                  <td colSpan={2}>
                    <strong>Sold final</strong>
                  </td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Conform datelor {own}{" "}
            <strong>
              la {dateRo(act.to)}{" "}
              {act.soldFinal === 0
                ? "datoriile lipsesc."
                : act.soldFinal > 0
                  ? `datoria clientului este de ${lei(act.soldFinal)} lei.`
                  : `datoria noastră față de client este de ${lei(-act.soldFinal)} lei.`}
            </strong>
          </p>
          <div className="act-parties">
            <div>
              <strong>{company?.name ?? ""}</strong>
              <br />
              Cod fiscal (IDNO): {company?.idno ?? ""}
              <br />
              Adresa: {company?.legalAddress ?? ""}
              <br />
              Cont de decontare: {company?.iban ?? ""}
              {company?.bank ? ` în ${company.bank}` : ""}
              <p>L.Ș. ____________________</p>
            </div>
            <div>
              <strong>{act.customer}</strong>
              <br />
              Cod fiscal (IDNO): {partner?.details.idno ?? ""}
              <br />
              Adresa: {partner?.details.address ?? ""}
              <br />
              Cont de decontare:
              <p>L.Ș. ____________________</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
