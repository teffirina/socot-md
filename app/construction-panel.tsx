"use client";
import { useEffect, useState } from "react";
import { catalogSchema } from "../lib/catalog";
import {
  completion,
  contractAccount,
  costTo,
  decide,
  defaultReceivable,
  ownAccount,
  parseLei,
  review,
  revenueTo,
  type ConstructionObject,
  type ConstructionRegister,
} from "../lib/construction";
import { dashboardDate, dashboardMoney } from "../lib/dashboard";
import { readValue, writeValue } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";

const money = (bani: number) => dashboardMoney(bani, false);
const percent = (bp: number) =>
  (bp / 100).toLocaleString("ro-MD", { maximumFractionDigits: 1 }) + "%";
const creditAccounts = [
  ["211", "211 · Materiale"],
  ["521", "521 · Furnizori"],
  ["531", "531 · Salarii"],
  ["533", "533 · Contribuții"],
  ["124", "124 · Uzura utilajelor"],
] as const;
const today = () => new Date().toISOString().slice(0, 10);

function demo(): ConstructionRegister {
  const day = (monthsAgo: number, d: number) => {
    const x = new Date();
    x.setUTCDate(d);
    x.setUTCMonth(x.getUTCMonth() - monthsAgo);
    return x.toISOString().slice(0, 10);
  };
  return {
    objects: [
      {
        id: "demo-c1",
        name: "Depozit nou, str. Industrială",
        kind: "own",
        budget: 45_000_000,
        account: ownAccount,
      },
      {
        id: "demo-c2",
        name: "Reparație capitală, client Grădina Mică",
        kind: "contract",
        budget: 8_000_000,
        price: 11_000_000,
        account: contractAccount,
        receivable: defaultReceivable,
      },
    ],
    costs: [
      {
        id: "d1",
        objectId: "demo-c1",
        date: day(2, 10),
        label: "Fundație, beton",
        amount: 12_000_000,
        credit: "211",
      },
      {
        id: "d2",
        objectId: "demo-c1",
        date: day(1, 12),
        label: "Structură metalică",
        amount: 18_500_000,
        credit: "521",
      },
      {
        id: "d3",
        objectId: "demo-c1",
        date: day(0, 5),
        label: "Manoperă montaj",
        amount: 4_200_000,
        credit: "531",
      },
      {
        id: "d4",
        objectId: "demo-c2",
        date: day(1, 8),
        label: "Materiale de construcție",
        amount: 2_600_000,
        credit: "211",
      },
      {
        id: "d5",
        objectId: "demo-c2",
        date: day(0, 6),
        label: "Lucrări subantreprenor",
        amount: 1_800_000,
        credit: "521",
      },
    ],
    decisions: {},
  };
}

// Costs gathered on objects under construction, with entries to review.
export default function ConstructionPanel({
  engine,
  writable,
}: {
  engine: SyncEngine;
  writable: boolean;
}) {
  const key = `${engine.scope}:construction-v1`;
  const [register, setRegister] = useState<ConstructionRegister | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<null | {
    name: string;
    kind: ConstructionObject["kind"];
    budget: string;
    price: string;
  }>(null);
  const [cost, setCost] = useState({
    date: today(),
    label: "",
    amount: "",
    credit: "211",
  });
  const [commission, setCommission] = useState<null | {
    id: string;
    date: string;
    life: string;
  }>(null);
  useEffect(() => {
    let live = true;
    readValue<ConstructionRegister>(key)
      .then(
        (r) =>
          live &&
          setRegister(
            r ??
              (engine.demo
                ? demo()
                : { objects: [], costs: [], decisions: {} }),
          ),
      )
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [key, engine.demo]);
  if (!register) return null;
  const months = review(register).slice(0, 12);

  async function save(next: ConstructionRegister) {
    setError("");
    try {
      await writeValue(key, next);
      setRegister(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const attempt = (fn: () => Promise<void>) => () =>
    void fn().catch((e) => setError((e as Error).message));

  const addObject = attempt(async () => {
    if (!form) return;
    if (form.name.trim().length < 2) throw Error("Scrie denumirea obiectului.");
    const budget = parseLei(form.budget);
    if (!budget) throw Error("Devizul trebuie să fie pozitiv.");
    const object: ConstructionObject = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      kind: form.kind,
      budget,
      account: form.kind === "own" ? ownAccount : contractAccount,
      ...(form.kind === "contract"
        ? { price: parseLei(form.price), receivable: defaultReceivable }
        : {}),
    };
    if (object.kind === "contract" && !object.price)
      throw Error("Scrie prețul contractului.");
    await save({ ...register!, objects: [...register!.objects, object] });
    setForm(null);
    setOpen(object.id);
  });

  const addCost = (objectId: string) =>
    attempt(async () => {
      if (!cost.label.trim()) throw Error("Scrie ce cost este.");
      const amount = parseLei(cost.amount);
      if (!amount) throw Error("Suma trebuie să fie pozitivă.");
      await save({
        ...register!,
        costs: [
          ...register!.costs,
          {
            id: crypto.randomUUID(),
            objectId,
            date: cost.date,
            label: cost.label.trim(),
            amount,
            credit: cost.credit,
          },
        ],
      });
      setCost({ ...cost, label: "", amount: "" });
    });

  const putIntoService = attempt(async () => {
    if (!commission) return;
    const o = register!.objects.find((x) => x.id === commission.id)!;
    const total = costTo(register!, o.id, commission.date.slice(0, 7));
    const life = Number(commission.life);
    if (!Number.isInteger(life) || life < 1)
      throw Error("Scrie durata de utilizare în luni.");
    const code = `MF-${o.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const asset = catalogSchema.parse({
      id: crypto.randomUUID(),
      kind: "asset",
      code,
      name: o.name.slice(0, 160),
      version: 0,
      active: true,
      details: {
        inServiceDate: commission.date,
        cost: (total / 100).toFixed(2),
        residual: "0",
        lifeMonths: String(life),
      },
    });
    await engine.saveCatalog(asset, "Dare în exploatare din construcții");
    await save({
      ...register!,
      objects: register!.objects.map((x) =>
        x.id === o.id
          ? { ...x, commissioned: { date: commission.date, assetId: asset.id } }
          : x,
      ),
    });
    setCommission(null);
  });

  return (
    <section className="home-panel construction" data-t="construction">
      <div className="home-panel-head">
        <div>
          <p className="eyebrow">Acumulare automată</p>
          <h2>Obiecte în construcție</h2>
        </div>
        {writable && !form && (
          <button
            onClick={() =>
              setForm({ name: "", kind: "own", budget: "", price: "" })
            }
          >
            ＋ Obiect nou
          </button>
        )}
      </div>
      <p className="muted">
        Costurile se adună pe fiecare obiect. O investiție proprie stă în 121
        până la darea în exploatare, când devine mijloc fix cu uzură calculată
        automat. La un contract pentru client, venitul se recunoaște după
        stadiul de execuție (cost realizat față de deviz). Orice cost adăugat
        sau corectat recalculează totul.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {form && (
        <div className="production-form">
          <div className="stock-form">
            <label className="stock-item">
              Denumirea obiectului
              <input
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Tip
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    kind: e.target.value as ConstructionObject["kind"],
                  })
                }
              >
                <option value="own">Investiție proprie (121)</option>
                <option value="contract">Contract pentru client (811)</option>
              </select>
            </label>
            <label>
              Deviz, cost estimat (MDL)
              <input
                inputMode="decimal"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </label>
            {form.kind === "contract" && (
              <label>
                Preț contract, fără TVA (MDL)
                <input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
            )}
          </div>
          <div className="stock-form-actions">
            <button onClick={addObject}>Salvează obiectul</button>
            <button className="secondary" onClick={() => setForm(null)}>
              Renunță
            </button>
          </div>
        </div>
      )}

      {register.objects.length ? (
        <div className="construction-list">
          {register.objects.map((o) => {
            const spent = costTo(register, o.id, "9999-12");
            const stage = completion(o, spent);
            const costs = register.costs
              .filter((c) => c.objectId === o.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            const late =
              o.commissioned &&
              costs.some(
                (c) => c.date.slice(0, 7) > o.commissioned!.date.slice(0, 7),
              );
            return (
              <article key={o.id} className="construction-item">
                <header>
                  <div>
                    <strong>{o.name}</strong>
                    <small>
                      {o.kind === "own"
                        ? o.commissioned
                          ? `Dat în exploatare la ${dashboardDate(o.commissioned.date)}`
                          : "Investiție proprie · cont 121"
                        : "Contract pentru client · cont 811"}
                    </small>
                  </div>
                  <button
                    className="textbutton"
                    onClick={() => setOpen(open === o.id ? null : o.id)}
                  >
                    {open === o.id ? "Închide" : "Costuri și acțiuni"}
                  </button>
                </header>
                <div className="construction-figures">
                  <span>
                    Cost acumulat <b className="num">{money(spent)}</b>
                  </span>
                  <span>
                    Deviz <b className="num">{money(o.budget)}</b>
                  </span>
                  <span>
                    Stadiu <b className="num">{percent(stage)}</b>
                  </span>
                  {o.kind === "contract" && (
                    <span>
                      Venit recunoscut{" "}
                      <b className="num">
                        {money(revenueTo(o, register, "9999-12"))}
                      </b>{" "}
                      din {money(o.price ?? 0)}
                    </span>
                  )}
                </div>
                <meter min={0} max={10000} value={stage} />
                {spent > o.budget && (
                  <p className="error">
                    Costurile depășesc devizul cu {money(spent - o.budget)} MDL.
                    {o.kind === "contract" &&
                      " Venitul s-a oprit la prețul contractului; verifică devizul."}
                  </p>
                )}
                {late && (
                  <p className="error">
                    Există costuri după darea în exploatare; ele nu intră în
                    valoarea mijlocului fix.
                  </p>
                )}
                {open === o.id && (
                  <div className="construction-detail">
                    <ul className="production-overheads">
                      {costs.map((c) => (
                        <li key={c.id}>
                          <span>
                            {dashboardDate(c.date)} · {c.label}{" "}
                            <small className="num">Ct {c.credit}</small>
                          </span>
                          <span className="num">{money(c.amount)}</span>
                          {writable && (
                            <button
                              className="textbutton"
                              onClick={() =>
                                void save({
                                  ...register,
                                  costs: register.costs.filter(
                                    (x) => x.id !== c.id,
                                  ),
                                })
                              }
                            >
                              Șterge
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {writable && (
                      <div className="stock-form">
                        <label>
                          Data
                          <input
                            type="date"
                            value={cost.date}
                            onChange={(e) =>
                              setCost({ ...cost, date: e.target.value })
                            }
                          />
                        </label>
                        <label className="stock-item">
                          Cost (materiale, lucrări, manoperă…)
                          <input
                            value={cost.label}
                            maxLength={120}
                            onChange={(e) =>
                              setCost({ ...cost, label: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Suma (MDL)
                          <input
                            inputMode="decimal"
                            value={cost.amount}
                            onChange={(e) =>
                              setCost({ ...cost, amount: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Din contul
                          <select
                            value={cost.credit}
                            onChange={(e) =>
                              setCost({ ...cost, credit: e.target.value })
                            }
                          >
                            {creditAccounts.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="stock-form-actions">
                          <button onClick={addCost(o.id)}>Adaugă costul</button>
                        </div>
                      </div>
                    )}
                    {writable &&
                      o.kind === "own" &&
                      !o.commissioned &&
                      spent > 0 &&
                      (commission?.id === o.id ? (
                        <div className="stock-form">
                          <label>
                            Data dării în exploatare
                            <input
                              type="date"
                              value={commission.date}
                              onChange={(e) =>
                                setCommission({
                                  ...commission,
                                  date: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Durata de utilizare (luni)
                            <input
                              inputMode="numeric"
                              value={commission.life}
                              onChange={(e) =>
                                setCommission({
                                  ...commission,
                                  life: e.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="stock-form-actions">
                            <button onClick={putIntoService}>
                              Confirmă: devine mijloc fix
                            </button>
                            <button
                              className="secondary"
                              onClick={() => setCommission(null)}
                            >
                              Renunță
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="secondary"
                          onClick={() =>
                            setCommission({ id: o.id, date: today(), life: "" })
                          }
                        >
                          Dă în exploatare ({money(spent)} MDL → 123)
                        </button>
                      ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">Nu ai încă obiecte în construcție.</p>
      )}

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
              {months.flatMap(({ month: m, rows }) =>
                rows.map((row) => (
                  <tr key={`${m}|${row.key}`}>
                    <td className="num">{m}</td>
                    <td>
                      <span className="num">
                        {row.debit && `Dt ${row.debit} · Ct ${row.credit}`}
                      </span>
                      <small>{row.label}</small>
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
                                void save(decide(register, row, null))
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
                                void save(decide(register, row, "accepted"))
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
                                  void save(decide(register, row, "rejected"))
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
        <p className="muted">Articolele apar după primul cost.</p>
      )}
      <p className="footnote">
        Datele și deciziile se păstrează în acest profil și nu se postează încă
        automat în registrul contabil general.
      </p>
    </section>
  );
}
