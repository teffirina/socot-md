"use client";
import { useEffect, useState } from "react";
import { dashboardDate, dashboardMoney } from "../lib/dashboard";
import {
  allocationBases,
  allocationNames,
  demoRegister,
  runRegister,
  stockKey,
  type AllocationBase,
  type ProductionReport,
  type StockRegister,
} from "../lib/production";
import { monthEntries, parseLei, parseQuantity } from "../lib/stock";
import { readValue, writeValue, type Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";

// Decisions kept by the depreciation screen in Active, read here only.
type DepreciationRegister = Record<
  string,
  Record<string, { amount: number; decision: string; debit: string }>
>;
const money = (bani: number) => dashboardMoney(bani, false);
const qty = (thousandths: number) =>
  (thousandths / 1000).toLocaleString("ro-MD", { maximumFractionDigits: 3 });
const materialAccounts = [
  ["211", "211 · Materiale"],
  ["216", "216 · Semifabricate"],
  ["217", "217 · Mărfuri"],
] as const;

type Draft = {
  id: string | null;
  date: string;
  product: string;
  quantity: string;
  materials: { item: string; account: string; quantity: string }[];
};
const blank = (month: string): Draft => ({
  id: null,
  date: `${month}-${new Date().toISOString().slice(8, 10)}`,
  product: "",
  quantity: "",
  materials: [{ item: "", account: "211", quantity: "" }],
});

// Month-end production costing, sharing the stock register with Depozit.
export default function ProductionPanel({
  engine,
  snapshot,
  writable,
  navigate,
}: {
  engine: SyncEngine;
  snapshot: Snapshot;
  writable: boolean;
  navigate: (view: string) => void;
}) {
  const key = stockKey(engine.scope);
  const [register, setRegister] = useState<StockRegister | null>(null);
  const [depreciation, setDepreciation] = useState<DepreciationRegister>({});
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [overhead, setOverhead] = useState({ label: "", amount: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    readValue<StockRegister>(key)
      .then(
        (r) =>
          live &&
          setRegister(
            r ??
              (engine.demo
                ? demoRegister()
                : { method: "fifo", movements: [], decisions: {} }),
          ),
      )
      .catch((e) => live && setError(String(e)));
    readValue<DepreciationRegister>(`${engine.scope}:depreciation-v1`)
      .then((d) => live && setDepreciation(d ?? {}))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, engine.demo, engine.scope]);
  if (!register) return null;
  const result = runRegister(register);
  const reports = (register.productions ?? []).filter((r) =>
    r.date.startsWith(month),
  );
  const costs = result.costs.filter((c) => c.report.date.startsWith(month));
  const overheads = register.overheads?.[month] ?? [];
  const entries = monthEntries(result.valued, month, result.extra[month]);
  const shortages = result.valued.filter(
    (v) => v.error && v.type === "production" && v.date.startsWith(month),
  );
  // Depreciation accepted in Active on production equipment (Dt 821).
  const machineDepreciation = Object.values(depreciation[month] ?? {})
    .filter((d) => d.decision === "accepted" && d.debit === "821")
    .reduce((a, d) => a + d.amount, 0);
  const names = [
    ...new Set([
      ...(snapshot.catalog ?? [])
        .filter((e) => e.kind === "item" && e.active)
        .map((e) => e.name),
      ...result.balances.map((b) => b.item),
    ]),
  ];

  async function save(next: StockRegister) {
    setError("");
    try {
      await writeValue(key, next);
      setRegister(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      if (!draft.product.trim()) throw Error("Scrie denumirea produsului.");
      const materials = draft.materials
        .filter((m) => m.item.trim() || m.quantity.trim())
        .map((m) => ({
          item: m.item.trim(),
          account: m.account,
          quantity: parseQuantity(m.quantity),
        }));
      if (materials.some((m) => !m.item))
        throw Error("Fiecare material are nevoie de denumire.");
      const all = register!.productions ?? [];
      const old = all.find((r) => r.id === draft.id);
      const report: ProductionReport = {
        id: old?.id ?? crypto.randomUUID(),
        seq:
          old?.seq ??
          Math.max(
            0,
            ...register!.movements.map((m) => m.seq),
            ...all.map((r) => r.seq),
          ) + 1,
        date: draft.date,
        product: draft.product.trim(),
        quantity: parseQuantity(draft.quantity),
        materials,
      };
      await save({
        ...register!,
        productions: [...all.filter((r) => r.id !== report.id), report],
      });
      setDraft(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function addOverhead(label: string, amount: number) {
    if (!label.trim()) throw Error("Scrie denumirea cheltuielii.");
    if (!(amount > 0)) throw Error("Suma trebuie să fie pozitivă.");
    await save({
      ...register!,
      overheads: {
        ...register!.overheads,
        [month]: [
          ...overheads,
          { id: crypto.randomUUID(), label: label.trim(), amount },
        ],
      },
    });
    setOverhead({ label: "", amount: "" });
  }

  return (
    <section className="home-panel production" data-t="production">
      <div className="home-panel-head">
        <div>
          <p className="eyebrow">Închiderea lunii</p>
          <h2>Costul de producție</h2>
        </div>
        <label className="depreciation-month">
          Luna
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </div>
      <p className="muted">
        Materialele ies din stoc la costul lor (FIFO sau mediu, ca în Depozit).
        Cheltuielile indirecte ale lunii se repartizează pe produse, iar
        produsele intră în contul 216 la costul efectiv. Orice corecție în
        stocuri, rapoarte sau cheltuieli recalculează singură costul.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <h3>Rapoarte de producție</h3>
      {costs.length ? (
        <div className="tablewrap">
          <table className="home-table">
            <thead>
              <tr>
                <th>DATA</th>
                <th>PRODUS</th>
                <th className="right">CANT.</th>
                <th className="right">MATERIALE</th>
                <th className="right">INDIRECTE</th>
                <th className="right">COST TOTAL</th>
                <th className="right">COST UNITAR</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.report.id}>
                  <td className="num">{dashboardDate(c.report.date)}</td>
                  <td>
                    <strong>{c.report.product}</strong>
                    <small>
                      {c.report.materials
                        .map((m) => `${m.item} × ${qty(m.quantity)}`)
                        .join(", ")}
                    </small>
                  </td>
                  <td className="num right">{qty(c.report.quantity)}</td>
                  <td className="num right">{money(c.materials)}</td>
                  <td className="num right">{money(c.overhead)}</td>
                  <td className="num right">
                    <strong>{money(c.total)}</strong>
                  </td>
                  <td className="num right">{money(c.unit)}</td>
                  <td className="stock-row-actions">
                    {writable && (
                      <>
                        <button
                          className="textbutton"
                          onClick={() =>
                            setDraft({
                              id: c.report.id,
                              date: c.report.date,
                              product: c.report.product,
                              quantity: String(c.report.quantity / 1000),
                              materials: c.report.materials.map((m) => ({
                                item: m.item,
                                account: m.account,
                                quantity: String(m.quantity / 1000),
                              })),
                            })
                          }
                        >
                          Editează
                        </button>
                        <button
                          className="textbutton"
                          onClick={() =>
                            void save({
                              ...register,
                              productions: (register.productions ?? []).filter(
                                (r) => r.id !== c.report.id,
                              ),
                            })
                          }
                        >
                          Șterge
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          Nu există rapoarte de producție în această lună.
        </p>
      )}
      {shortages.map((s) => (
        <p key={s.id} className="error">
          {s.item}: {s.error}
        </p>
      ))}
      {writable && !draft && (
        <button onClick={() => setDraft(blank(month))}>
          ＋ Raport de producție
        </button>
      )}
      {draft && (
        <form
          className="production-form"
          onSubmit={(e) => void submitReport(e)}
        >
          <datalist id="production-items">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="stock-form">
            <label>
              Data
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label className="stock-item">
              Produs obținut
              <input
                list="production-items"
                value={draft.product}
                maxLength={120}
                onChange={(e) =>
                  setDraft({ ...draft, product: e.target.value })
                }
              />
            </label>
            <label>
              Cantitate
              <input
                inputMode="decimal"
                value={draft.quantity}
                onChange={(e) =>
                  setDraft({ ...draft, quantity: e.target.value })
                }
              />
            </label>
          </div>
          <p className="eyebrow">Materiale consumate</p>
          {draft.materials.map((m, i) => (
            <div className="stock-form" key={i}>
              <label className="stock-item">
                Material
                <input
                  list="production-items"
                  value={m.item}
                  maxLength={120}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      materials: draft.materials.map((x, k) =>
                        k === i ? { ...x, item: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Din contul
                <select
                  value={m.account}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      materials: draft.materials.map((x, k) =>
                        k === i ? { ...x, account: e.target.value } : x,
                      ),
                    })
                  }
                >
                  {materialAccounts.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantitate
                <input
                  inputMode="decimal"
                  value={m.quantity}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      materials: draft.materials.map((x, k) =>
                        k === i ? { ...x, quantity: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
            </div>
          ))}
          <div className="stock-form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  materials: [
                    ...draft.materials,
                    { item: "", account: "211", quantity: "" },
                  ],
                })
              }
            >
              ＋ Material
            </button>
            <button type="submit">Salvează raportul</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDraft(null)}
            >
              Renunță
            </button>
          </div>
        </form>
      )}

      <h3>Cheltuieli indirecte ale lunii</h3>
      <label className="depreciation-month">
        Repartizare
        <select
          value={register.base ?? "materials"}
          disabled={!writable}
          onChange={(e) =>
            void save({ ...register, base: e.target.value as AllocationBase })
          }
        >
          {allocationBases.map((b) => (
            <option key={b} value={b}>
              {allocationNames[b]}
            </option>
          ))}
        </select>
      </label>
      <ul className="production-overheads">
        {overheads.map((o) => (
          <li key={o.id}>
            <span>{o.label}</span>
            <span className="num">{money(o.amount)}</span>
            {writable && (
              <button
                className="textbutton"
                onClick={() =>
                  void save({
                    ...register,
                    overheads: {
                      ...register.overheads,
                      [month]: overheads.filter((x) => x.id !== o.id),
                    },
                  })
                }
              >
                Șterge
              </button>
            )}
          </li>
        ))}
      </ul>
      {result.idle.includes(month) && (
        <p className="error">
          În această lună nu există producție; cheltuielile indirecte rămân în
          contul 821 până le repartizezi.
        </p>
      )}
      {writable && (
        <form
          className="stock-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              void addOverhead(overhead.label, parseLei(overhead.amount)).catch(
                (err) => setError(err.message),
              );
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label className="stock-item">
            Cheltuială (energie, salarii secție, chirie atelier…)
            <input
              value={overhead.label}
              maxLength={80}
              onChange={(e) =>
                setOverhead({ ...overhead, label: e.target.value })
              }
            />
          </label>
          <label>
            Suma (MDL)
            <input
              inputMode="decimal"
              value={overhead.amount}
              onChange={(e) =>
                setOverhead({ ...overhead, amount: e.target.value })
              }
            />
          </label>
          <div className="stock-form-actions">
            <button type="submit">Adaugă</button>
          </div>
        </form>
      )}
      {writable &&
        machineDepreciation > 0 &&
        !overheads.some((o) => o.label === "Uzura utilajelor") && (
          <button
            className="secondary"
            onClick={() =>
              void addOverhead("Uzura utilajelor", machineDepreciation)
            }
          >
            Adaugă uzura utilajelor acceptată în Active (
            {money(machineDepreciation)} MDL)
          </button>
        )}

      <h3>Articolele lunii</h3>
      {entries.length ? (
        <ul className="production-overheads">
          {entries.map((e) => (
            <li key={`${e.debit}|${e.credit}`}>
              <span className="num">
                Dt {e.debit} · Ct {e.credit}
              </span>
              <span className="num">{money(e.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nu există articole în această lună.</p>
      )}
      <p className="footnote">
        Le accepți sau le respingi în{" "}
        <button className="textbutton" onClick={() => navigate("Depozit")}>
          Depozit → Articole contabile lunare
        </button>
        , unde apar și diferențele după fiecare recalculare. Uzura utilajelor
        apare aici dacă în fișa mijlocului fix contul de cheltuieli este 821.
      </p>
    </section>
  );
}
