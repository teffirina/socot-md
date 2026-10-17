"use client";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  FileSpreadsheet,
  Scale,
  Wallet,
} from "lucide-react";
import {
  balances,
  dashboardDate,
  dashboardMoney,
  expenseStructure,
  isExpense,
  monthlyTotals,
  niceMax,
} from "../lib/dashboard";
import { documentProgress } from "../lib/document-workflow";
import type { Invoice } from "../lib/domain";
import type { Snapshot } from "../lib/storage";

const statusTone: Record<string, string> = {
  Postat: "success",
  Confirmat: "success",
  "De verificat": "warning",
  Ciornă: "muted",
  "În sincronizare": "verified",
  Conflict: "danger",
  "Necesită corectare": "danger",
};

// Home overview in the Socot.md-GLIA layout, fed only by saved documents.
export default function HomeDashboard({
  snapshot,
  today,
  writable,
  busy,
  canJournal,
  go,
  onPay,
}: {
  snapshot: Snapshot;
  today: string;
  writable: boolean;
  busy: boolean;
  canJournal: boolean;
  go: (view: string) => void;
  onPay: (invoice: Invoice) => void;
}) {
  const invoices = snapshot.invoices;
  const b = balances(invoices);
  const months = monthlyTotals(invoices, today);
  const current = months.at(-1)!;
  const structure = expenseStructure(invoices, current.key);
  const structureTotal = structure.reduce((s, [, v]) => s + v, 0);
  const scale = niceMax(
    Math.max(...months.flatMap((m) => [m.sales, m.expenses])),
  );
  const profitScale = niceMax(
    Math.max(...months.map((m) => Math.abs(m.profit))),
  );
  const progress = invoices.map((i) => documentProgress(i.id, snapshot));
  const flow = [
    {
      label: "Ciorne",
      count: snapshot.drafts?.length ?? 0,
      note: "De completat",
      view: "Documente",
    },
    {
      label: "Verificare",
      count:
        progress.filter((p) => p === "De verificat").length +
        snapshot.pending.length,
      note: "Articole propuse",
      view: canJournal ? "Contabilitate" : "Documente",
    },
    {
      label: "Înregistrare",
      count: progress.filter((p) => p === "Postat" || p === "Confirmat").length,
      note: "Documente confirmate",
      view: "Documente",
    },
    {
      label: "Balanța",
      count: null,
      note: "Solduri și rulaje",
      view: "Rapoarte",
    },
  ];
  const recent = invoices
    .slice()
    .sort((a, c) => c.date.localeCompare(a.date))
    .slice(0, 6);
  const openSales = invoices.filter((i) => !isExpense(i) && i.paid < i.total);
  const next = [
    openSales.length
      ? {
          title: `${openSales.length} facturi de încasat`,
          note: `Sold deschis: ${dashboardMoney(b.receivable)}`,
          view: "Vânzări",
        }
      : null,
    b.openCosts
      ? {
          title: `${b.openCosts} documente de plătit`,
          note: `Datorii către furnizori: ${dashboardMoney(b.payable)}`,
          view: "Cumpărări",
        }
      : null,
    snapshot.drafts?.length
      ? {
          title: `${snapshot.drafts.length} ciorne neconfirmate`,
          note: "Verifică-le și confirmă-le în Documente",
          view: "Documente",
        }
      : null,
    {
      title: "Pregătește datele în tabel",
      note: "Spațiu de lucru: foi Excel și import din fișiere",
      view: "Spațiu de lucru",
    },
  ].filter((x) => x !== null);
  const cards = [
    {
      label: "Vânzări",
      value: b.sales,
      note: `${invoices.filter((i) => !isExpense(i)).length} documente de vânzare`,
      Icon: ArrowUpRight,
    },
    {
      label: "Cheltuieli",
      value: b.expenses,
      note: "Documente de cumpărare",
      Icon: ArrowDownLeft,
    },
    {
      label: "De încasat",
      value: b.receivable,
      note: `${b.openSales} facturi deschise`,
      Icon: Wallet,
    },
    {
      label: "De plătit",
      value: b.payable,
      note: `${b.openCosts} documente deschise`,
      Icon: Scale,
    },
  ];
  return (
    <div className="home-dashboard">
      <section className="home-cards" data-t="home-metrics">
        {cards.map(({ label, value, note, Icon }) => (
          <article key={label} className="home-card">
            <div className="home-card-head">
              <span>{label}</span>
              <Icon size={16} aria-hidden />
            </div>
            <strong className="num">{dashboardMoney(value)}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="home-panel" data-t="home-actions">
        <div className="home-panel-head">
          <div>
            <p className="eyebrow">Fluxul documentelor</p>
            <h2>De la document la balanță</h2>
          </div>
        </div>
        <ol className="home-flow">
          {flow.map((step) => (
            <li key={step.label}>
              <button type="button" onClick={() => go(step.view)}>
                <span className="home-flow-label">{step.label}</span>
                <strong className="num">{step.count ?? "→"}</strong>
                <small>{step.note}</small>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel-head">
            <div>
              <p className="eyebrow">Ultimele 6 luni</p>
              <h2>Venituri și cheltuieli</h2>
            </div>
            <div className="home-legend">
              <span>
                <i className="sales" /> Venituri
              </span>
              <span>
                <i className="expenses" /> Cheltuieli
              </span>
            </div>
          </div>
          <svg
            className="home-chart"
            viewBox="0 0 600 220"
            role="img"
            aria-label="Venituri și cheltuieli pe ultimele 6 luni"
          >
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1="70" x2="590" y1={190 - t * 170} y2={190 - t * 170} />
                <text x="62" y={194 - t * 170} textAnchor="end">
                  {compact(scale * t)}
                </text>
              </g>
            ))}
            {months.map((m, i) => {
              const x = 80 + i * 86;
              const h = (v: number) => (v / scale) * 170;
              return (
                <g key={m.key}>
                  <rect
                    className="sales"
                    x={x}
                    y={190 - h(m.sales)}
                    width="28"
                    height={h(m.sales)}
                    rx="4"
                  >
                    <title>{`${m.name}: venituri ${dashboardMoney(m.sales)}`}</title>
                  </rect>
                  <rect
                    className="expenses"
                    x={x + 32}
                    y={190 - h(m.expenses)}
                    width="28"
                    height={h(m.expenses)}
                    rx="4"
                  >
                    <title>{`${m.name}: cheltuieli ${dashboardMoney(m.expenses)}`}</title>
                  </rect>
                  <text x={x + 30} y="212" textAnchor="middle">
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="home-profit">
            <p className="eyebrow">Profit lunar</p>
            <div className="home-profit-bars">
              {months.map((m) => (
                <div
                  key={m.key}
                  title={`${m.name}: ${dashboardMoney(m.profit)}`}
                >
                  <span
                    className={m.profit < 0 ? "loss" : ""}
                    style={{
                      height: `${Math.max(4, (Math.abs(m.profit) / profitScale) * 56)}px`,
                    }}
                  />
                  <small>{m.label}</small>
                </div>
              ))}
            </div>
            <strong className="num">{dashboardMoney(current.profit)}</strong>
            <small>Rezultat în luna {current.name}</small>
          </div>
        </section>

        <section className="home-panel">
          <div className="home-panel-head">
            <div>
              <p className="eyebrow">Luna {current.name}</p>
              <h2>Structura cheltuielilor</h2>
            </div>
          </div>
          {structure.length ? (
            <ul className="home-structure">
              {structure.map(([name, value]) => (
                <li key={name}>
                  <div>
                    <span>{name}</span>
                    <span className="num">{dashboardMoney(value, false)}</span>
                  </div>
                  <meter min={0} max={structureTotal} value={value} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Nu există cheltuieli înregistrate în această lună.
            </p>
          )}
        </section>
      </div>

      <div className="home-grid">
        <section className="home-panel" data-t="home-docs">
          <div className="home-panel-head">
            <div>
              <p className="eyebrow">Registru</p>
              <h2>Documente recente</h2>
            </div>
            <button
              type="button"
              className="textbutton"
              onClick={() => go("Documente")}
            >
              Toate documentele <ArrowRight size={14} aria-hidden />
            </button>
          </div>
          <div className="tablewrap">
            <table className="home-table">
              <thead>
                <tr>
                  <th>DATA</th>
                  <th>DOCUMENT</th>
                  <th>TIP</th>
                  <th className="right">SUMA</th>
                  <th>STARE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((i) => {
                  const state = documentProgress(i.id, snapshot);
                  return (
                    <tr key={i.id}>
                      <td className="num">{dashboardDate(i.date)}</td>
                      <td>
                        <strong>{i.customer}</strong>
                        <small className="num">
                          {i.sourceRef?.slice(0, 18) ??
                            i.id.slice(0, 8).toUpperCase()}
                        </small>
                      </td>
                      <td>{isExpense(i) ? "Cumpărare" : "Vânzare"}</td>
                      <td className="num right">
                        {dashboardMoney(i.total, false)}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${statusTone[state] ?? "muted"}`}
                        >
                          {state}
                        </span>
                      </td>
                      <td>
                        {writable && !isExpense(i) && i.paid < i.total && (
                          <button
                            type="button"
                            className="textbutton"
                            disabled={
                              busy ||
                              snapshot.pending.some(
                                (p) => p.invoice.id === i.id,
                              )
                            }
                            onClick={() => onPay(i)}
                          >
                            Încasează
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!recent.length && (
            <div className="empty">
              <h3>Aici începe ordinea.</h3>
              <p>Adaugă primul document pentru a vedea cifrele firmei.</p>
            </div>
          )}
        </section>

        <section className="home-panel highlight">
          <div className="home-panel-head">
            <div>
              <p className="eyebrow">De rezolvat</p>
              <h2>Ce urmează</h2>
            </div>
          </div>
          <ul className="home-next">
            {next.map((item) => (
              <li key={item.title}>
                <button type="button" onClick={() => go(item.view)}>
                  {item.view === "Spațiu de lucru" && (
                    <FileSpreadsheet size={16} aria-hidden />
                  )}
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.note}</small>
                  </span>
                  <ArrowRight size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function compact(bani: number) {
  const lei = bani / 100;
  if (lei >= 1_000_000)
    return `${(lei / 1_000_000).toLocaleString("ro-MD", { maximumFractionDigits: 1 })} mil.`;
  if (lei >= 1000)
    return `${(lei / 1000).toLocaleString("ro-MD", { maximumFractionDigits: 1 })} mii`;
  return lei.toLocaleString("ro-MD", { maximumFractionDigits: 0 });
}
