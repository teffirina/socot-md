"use client";
import { useEffect, useState } from "react";
import { dashboardDate, dashboardMoney } from "../lib/dashboard";
import { readValue, writeValue, type Snapshot } from "../lib/storage";
import {
  demoRegister,
  runRegister,
  stockKey,
  type StockRegister,
} from "../lib/production";
import {
  decideEntry,
  manualTypes,
  movementNames,
  parseLei,
  parseQuantity,
  review,
  stockMethodNames,
  stockMethods,
  type Movement,
  type StockMethod,
} from "../lib/stock";
import type { SyncEngine } from "../lib/sync";

type Register = StockRegister;

const money = (bani: number) => dashboardMoney(bani, false);
const entryNames: Record<string, string> = {
  "811|821": "Cheltuieli indirecte repartizate pe producție",
};
const qty = (thousandths: number) =>
  (thousandths / 1000).toLocaleString("ro-MD", { maximumFractionDigits: 3 });
const stockAccounts = [
  ["217", "217 · Mărfuri"],
  ["211", "211 · Materiale"],
  ["216", "216 · Produse"],
] as const;

const empty = {
  date: new Date().toISOString().slice(0, 10),
  type: "receipt" as Movement["type"],
  item: "",
  account: "217",
  quantity: "",
  cost: "",
  note: "",
};

// Stock movements valued by FIFO or average cost, with monthly entries to accept.
export default function StockPanel({
  engine,
  snapshot,
  writable,
}: {
  engine: SyncEngine;
  snapshot: Snapshot;
  writable: boolean;
}) {
  const key = stockKey(engine.scope);
  const [register, setRegister] = useState<Register | null>(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    readValue<Register>(key)
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
    return () => {
      live = false;
    };
  }, [key, engine.demo]);
  if (!register) return null;
  const { valued, balances, extra } = runRegister(register);
  const months = review(valued, register.decisions, extra).slice(0, 12);
  const items = (snapshot.catalog ?? [])
    .filter((e) => e.kind === "item" && e.active)
    .map((e) => e.name);

  async function save(next: Register) {
    setError("");
    try {
      await writeValue(key, next);
      setRegister(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const seq = Math.max(-1, ...register!.movements.map((m) => m.seq)) + 1;
      const old = register!.movements.find((m) => m.id === editing);
      const movement: Movement = {
        id: old?.id ?? crypto.randomUUID(),
        seq: old?.seq ?? seq,
        date: form.date,
        type: form.type,
        item: form.item.trim(),
        account: form.account,
        quantity: parseQuantity(form.quantity),
        cost: form.type === "receipt" ? parseLei(form.cost) : undefined,
        note: form.note.trim() || undefined,
      };
      if (!movement.item) throw Error("Scrie denumirea articolului.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(movement.date))
        throw Error("Alege data.");
      await save({
        ...register!,
        movements: [
          ...register!.movements.filter((m) => m.id !== movement.id),
          movement,
        ],
      });
      setForm({
        ...empty,
        date: form.date,
        type: form.type,
        account: form.account,
      });
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const edit = (m: Movement) => {
    setEditing(m.id);
    setForm({
      date: m.date,
      type: m.type,
      item: m.item,
      account: m.account,
      quantity: String(m.quantity / 1000),
      cost: m.cost === undefined ? "" : (m.cost / 100).toFixed(2),
      note: m.note ?? "",
    });
  };

  return (
    <section className="home-panel stock" data-t="stock">
      <div className="home-panel-head">
        <div>
          <p className="eyebrow">Recalculare automată</p>
          <h2>Stocuri și costul ieșirilor</h2>
        </div>
        <label className="stock-method">
          Metoda
          <select
            value={register.method}
            disabled={!writable}
            onChange={(e) =>
              void save({ ...register, method: e.target.value as StockMethod })
            }
          >
            {stockMethods.map((m) => (
              <option key={m} value={m}>
                {stockMethodNames[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Introdu intrările și ieșirile. Socot calculează costul fiecărei ieșiri
        și, la orice modificare, chiar și pe o dată din trecut, reface tot
        lanțul de după ea. Articolele contabile lunare le accepți sau le
        respingi tu.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {writable && (
        <form className="stock-form" onSubmit={(e) => void submit(e)}>
          <label>
            Data
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label>
            Operațiune
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as Movement["type"] })
              }
            >
              {manualTypes.map((t) => (
                <option key={t} value={t}>
                  {movementNames[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-item">
            Articol
            <input
              list="stock-items"
              value={form.item}
              maxLength={120}
              onChange={(e) => setForm({ ...form, item: e.target.value })}
            />
            <datalist id="stock-items">
              {[...new Set([...items, ...balances.map((b) => b.item)])].map(
                (n) => (
                  <option key={n} value={n} />
                ),
              )}
            </datalist>
          </label>
          <label>
            Cont
            <select
              value={form.account}
              onChange={(e) => setForm({ ...form, account: e.target.value })}
            >
              {stockAccounts.map(([v, l]) => (
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
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </label>
          {form.type === "receipt" && (
            <label>
              Valoare (MDL)
              <input
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </label>
          )}
          <div className="stock-form-actions">
            <button type="submit">
              {editing ? "Salvează modificarea" : "Adaugă"}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                }}
              >
                Renunță
              </button>
            )}
          </div>
        </form>
      )}

      <div className="stock-grid">
        <div>
          <h3>Mișcări</h3>
          <div className="tablewrap">
            <table className="home-table">
              <thead>
                <tr>
                  <th>DATA</th>
                  <th>OPERAȚIUNE</th>
                  <th>ARTICOL</th>
                  <th className="right">CANT.</th>
                  <th className="right">VALOARE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...valued].reverse().map((m) => (
                  <tr key={m.id} className={editing === m.id ? "selected" : ""}>
                    <td className="num">{dashboardDate(m.date)}</td>
                    <td>{movementNames[m.type]}</td>
                    <td>
                      {m.item}
                      <small className="num">{m.account}</small>
                    </td>
                    <td className="num right">{qty(m.quantity)}</td>
                    <td className="num right">
                      {money(m.value)}
                      {m.error && <small className="error">{m.error}</small>}
                    </td>
                    <td className="stock-row-actions">
                      {writable && !m.id.includes(":") && (
                        <>
                          <button
                            className="textbutton"
                            onClick={() => edit(m)}
                          >
                            Editează
                          </button>
                          <button
                            className="textbutton"
                            onClick={() =>
                              void save({
                                ...register,
                                movements: register.movements.filter(
                                  (x) => x.id !== m.id,
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
          {!valued.length && (
            <p className="muted">Încă nu ai introdus mișcări de stoc.</p>
          )}
        </div>
        <div>
          <h3>Solduri</h3>
          <div className="tablewrap">
            <table className="home-table">
              <thead>
                <tr>
                  <th>ARTICOL</th>
                  <th className="right">CANT.</th>
                  <th className="right">VALOARE</th>
                  <th className="right">PREȚ MEDIU</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={`${b.item}|${b.account}`}>
                    <td>
                      {b.item}
                      <small className="num">{b.account}</small>
                    </td>
                    <td className="num right">{qty(b.quantity)}</td>
                    <td className="num right">{money(b.value)}</td>
                    <td className="num right">
                      {b.quantity
                        ? money(Math.round((b.value * 1000) / b.quantity))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h3>Articole contabile lunare</h3>
      {months.length ? (
        <div className="tablewrap">
          <table className="home-table">
            <thead>
              <tr>
                <th>LUNA</th>
                <th>ARTICOL</th>
                <th className="right">SUMA</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {months.flatMap(({ month, rows }) =>
                rows.map((row) => (
                  <tr key={`${month}|${row.debit}|${row.credit}`}>
                    <td className="num">{month}</td>
                    <td className="num">
                      Dt {row.debit} · Ct {row.credit}
                      <small>
                        {entryNames[`${row.debit}|${row.credit}`] ??
                          (row.debit === "711"
                            ? "Costul mărfurilor vândute"
                            : row.credit === "811"
                              ? "Produse obținute la cost efectiv"
                              : "Consum în activitatea de bază")}
                      </small>
                    </td>
                    <td className="num right">
                      {money(row.amount)}
                      {row.difference !== 0 && (
                        <small className="stock-diff">
                          Recalculat: {row.difference > 0 ? "+" : ""}
                          {money(row.difference)} față de suma acceptată (
                          {money(row.decision!.amount)})
                        </small>
                      )}
                    </td>
                    <td className="depreciation-actions">
                      {row.decision && row.difference === 0 ? (
                        <>
                          <span
                            className={`status-pill ${row.decision.decision === "accepted" ? "success" : "muted"}`}
                          >
                            {row.decision.decision === "accepted"
                              ? "Acceptat"
                              : "Respins"}
                          </span>
                          {writable && (
                            <button
                              className="textbutton"
                              onClick={() =>
                                void save({
                                  ...register,
                                  decisions: decideEntry(
                                    register.decisions,
                                    row,
                                    null,
                                  ),
                                })
                              }
                            >
                              Schimbă
                            </button>
                          )}
                        </>
                      ) : (
                        writable && (
                          <>
                            <button
                              onClick={() =>
                                void save({
                                  ...register,
                                  decisions: decideEntry(
                                    register.decisions,
                                    row,
                                    "accepted",
                                  ),
                                })
                              }
                            >
                              {row.difference
                                ? "Acceptă recalcularea"
                                : "Acceptă"}
                            </button>
                            {!row.difference && (
                              <button
                                className="secondary"
                                onClick={() =>
                                  void save({
                                    ...register,
                                    decisions: decideEntry(
                                      register.decisions,
                                      row,
                                      "rejected",
                                    ),
                                  })
                                }
                              >
                                Respinge
                              </button>
                            )}
                          </>
                        )
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Articolele apar după prima ieșire din stoc.</p>
      )}
      <p className="footnote">
        Mișcările și deciziile se păstrează în acest profil. Articolele
        acceptate nu se postează încă automat în registrul contabil general.
        Ieșirile la vânzare se înregistrează Dt 711, consumurile Dt 811.
        Producția se introduce în secțiunea Producție.
      </p>
    </section>
  );
}
