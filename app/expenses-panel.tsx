"use client";
import PartnerFields from "./partner-fields";
import { documentAmount } from "../lib/document-workflow";
import { useState } from "react";
import { invoiceSchema, totals, type Invoice } from "../lib/domain";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
const money = (v: number) =>
  new Intl.NumberFormat("ro-MD", { style: "currency", currency: "MDL" }).format(
    v / 100,
  );
export default function ExpensesPanel({
  snapshot,
  engine,
  writable,
  onDraft,
}: {
  snapshot: Snapshot;
  engine: SyncEngine;
  writable: boolean;
  onDraft: () => void;
}) {
  const [form, setForm] = useState(false),
    [payment, setPayment] = useState<Invoice | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const expenses = snapshot.invoices.filter((i) => i.kind === "expense");
  const pending = snapshot.pending.filter((p) => p.invoice.kind === "expense");
  const summary = totals(expenses);
  const rows = expenses
    .filter(
      (i) =>
        `${i.customer} ${i.category}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter !== "due" || i.paid < i.total),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      const amount = documentAmount(String(data.get("amount")));
      const doc = payment
        ? invoiceSchema.parse({ ...payment, paid: payment.paid + amount })
        : invoiceSchema.parse({
            id: crypto.randomUUID(),
            kind: "expense",
            partnerId: data.get("partnerId") || null,
            contractId: data.get("contractId") || null,
            category: String(data.get("category")),
            customer: String(data.get("supplier")),
            date: String(data.get("date")),
            total: amount,
            paid: 0,
            version: 0,
          });
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new Error("Introdu o sumă pozitivă.");
      if (payment) await engine.enqueue(doc);
      else
        await engine.saveDraft({
          id: doc.id,
          kind: "expense",
          customer: doc.customer,
          category: doc.category ?? "",
          partnerId: doc.partnerId ?? null,
          contractId: doc.contractId ?? null,
          date: doc.date,
          total: doc.total,
          revision: 0,
        });
      setForm(false);
      setPayment(null);
      if (!payment) onDraft();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function csv() {
    const rows = [
      [
        "Socot — Cheltuieli",
        "Categorie",
        "Data",
        "Total MDL",
        "Achitat MDL",
        "De plată MDL",
      ],
      ...expenses.map((i) => [
        i.customer,
        i.category ?? "",
        i.date,
        i.total / 100,
        i.paid / 100,
        (i.total - i.paid) / 100,
      ]),
    ];
    const text =
      "\ufeff" +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+@-]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Socot-cheltuieli.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section className="metrics">
        {[
          ["Cheltuieli înregistrate", summary.sales],
          ["Achitat furnizorilor", summary.paid],
          ["De plată", summary.due],
        ].map(([name, value]) => (
          <article key={name}>
            <span>{name}</span>
            <strong>{money(Number(value))}</strong>
            <small>Documente locale · MDL</small>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panelhead">
          <div>
            <h2>Registrul cheltuielilor</h2>
            <p className="muted">
              {expenses.length} documente
              {pending.length
                ? ` · ${pending.length} operațiuni locale în așteptare`
                : ""}
            </p>
          </div>
          <div className="controls">
            <button className="secondary" onClick={csv}>
              Export CSV
            </button>
            {writable && (
              <button
                onClick={() => {
                  setError("");
                  setForm(true);
                }}
              >
                ＋ Cheltuială nouă
              </button>
            )}
          </div>
        </div>
        <div className="controls">
          <input
            aria-label="Caută furnizor sau categorie"
            placeholder="Caută furnizor sau categorie…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Filtrează cheltuielile"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Toate cheltuielile</option>
            <option value="due">De plată</option>
          </select>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {[
                  "Furnizor / categorie",
                  "Data",
                  "Total",
                  "Achitat",
                  "De plată",
                  "Stare",
                  "",
                ].map((t, i) => (
                  <th key={i}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.customer}</strong>
                    {i.sourceRef && (
                      <small title={i.sourceRef}>
                        Import · {i.sourceRef.slice(0, 12)}… · rând{" "}
                        {i.sourceRef.split(":").at(-1)}
                      </small>
                    )}
                    <small>
                      {i.category} · {i.id.slice(0, 8).toUpperCase()}
                    </small>
                  </td>
                  <td>{i.date}</td>
                  <td>{money(i.total)}</td>
                  <td>{money(i.paid)}</td>
                  <td>{money(i.total - i.paid)}</td>
                  <td>
                    {i.paid === i.total
                      ? "Achitată"
                      : i.paid
                        ? "Parțial achitată"
                        : "De plată"}
                  </td>
                  <td>
                    {writable && i.paid < i.total && (
                      <button
                        className="secondary"
                        disabled={snapshot.pending.some(
                          (p) => p.invoice.id === i.id,
                        )}
                        onClick={() => {
                          setError("");
                          setPayment(i);
                        }}
                      >
                        Înregistrează plata
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="muted">
            {expenses.length
              ? "Nicio cheltuială nu corespunde filtrelor."
              : "Înregistrează prima cheltuială: chirie, utilități, transport sau servicii."}
          </p>
        )}
        <p className="footnote">
          Totalurile sunt pentru documentele locale disponibile (API: ultimele
          200 documente, inclusiv vânzările). Sumele sunt în MDL. Acest registru
          nu calculează TVA deductibilă și nu ține loc de modul de achiziții sau
          stocuri. Plata este consemnată în Socot, fără transfer bancar.
        </p>
      </section>
      {(form || payment) && (
        <div className="modalback">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-title"
          >
            <h2 id="expense-title">
              {payment ? "Înregistrează plata furnizorului" : "Cheltuială nouă"}
            </h2>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <form onSubmit={save}>
              {payment ? (
                <p>
                  {payment.customer} · Rest:{" "}
                  {money(payment.total - payment.paid)}
                </p>
              ) : (
                <>
                  <PartnerFields entries={snapshot.catalog ?? []} expense />
                  <label>
                    Categorie
                    <select name="category">
                      {[
                        "Chirie",
                        "Utilități",
                        "Servicii",
                        "Transport",
                        "Consumabile",
                        "Altele",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Data documentului
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                </>
              )}
              <label>
                {payment ? "Suma achitată (MDL)" : "Total cheltuială (MDL)"}
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max={payment ? (payment.total - payment.paid) / 100 : 1000000}
                  step="0.01"
                  required
                />
              </label>
              <div className="controls">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setForm(false);
                    setPayment(null);
                  }}
                >
                  Renunță
                </button>
                <button disabled={busy}>
                  {busy
                    ? "Se salvează…"
                    : payment
                      ? "Confirmă plata"
                      : "Salvează ciorna"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
