"use client";
import { useEffect, useRef, useState } from "react";
import { dashboardMoney } from "../lib/dashboard";
import {
  acceptMonth,
  changes,
  entries,
  missingSettings,
  monthPay,
  prevMonth,
  requiredSettings,
  salaryIn,
  takeCorrection,
  total,
  type Pay,
  type PayrollRegister,
  type PayrollSettings,
  type Timesheet,
} from "../lib/payroll";
import { readValue, writeValue } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";

const money = (bani: number) => dashboardMoney(bani, false);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const lei = (text: string) => {
  const s = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return 0;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw Error("Sumă invalidă.");
  return Math.round(Number(s) * 100);
};
const num = (text: string, max: number) => {
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) throw Error("Număr invalid.");
  return n;
};

// Settings kept as percent or lei in the form, basis points or bani inside.
const settingFields: {
  key: keyof PayrollSettings;
  label: string;
  unit: "%" | "lei" | "zile" | "ore" | "cont";
}[] = [
  { key: "incomeTax", label: "Impozit pe venit", unit: "%" },
  { key: "employeeHealth", label: "Asigurare medicală, angajat", unit: "%" },
  { key: "employerSocial", label: "Asigurări sociale, angajator", unit: "%" },
  { key: "exemption", label: "Scutire personală pe lună", unit: "lei" },
  { key: "nightSupplement", label: "Spor ore de noapte", unit: "%" },
  { key: "overtimeRate", label: "Plata orei suplimentare", unit: "%" },
  {
    key: "employerSickDays",
    label: "Zile de boală plătite de angajator",
    unit: "zile",
  },
  { key: "hoursPerDay", label: "Ore pe zi", unit: "ore" },
  { key: "expenseAccount", label: "Cont de cheltuieli", unit: "cont" },
];
const show = (s: PayrollSettings, f: (typeof settingFields)[number]) => {
  const v = s[f.key];
  if (v === undefined) return "";
  if (f.unit === "%") return String(Number(v) / 100);
  if (f.unit === "lei") return String(Number(v) / 100);
  return String(v);
};

function demo(): PayrollRegister {
  const m = thisMonth();
  const prev = prevMonth(m);
  const sheet = (worked: number, extra: Partial<Timesheet> = {}) => ({
    normDays: 21,
    workedDays: worked,
    ...extra,
  });
  return {
    // Example values for the demonstration only; check them before real use.
    settings: {
      incomeTax: 1200,
      employeeHealth: 900,
      employerSocial: 2400,
      exemption: 225_000,
      nightSupplement: 5000,
      overtimeRate: 15000,
      employerSickDays: 5,
      hoursPerDay: 8,
      expenseAccount: "713",
    },
    employees: [
      {
        id: "e1",
        name: "Ion Rusu",
        salaries: [{ from: "2026-01", amount: 1_500_000 }],
      },
      {
        id: "e2",
        name: "Maria Ciobanu",
        salaries: [{ from: "2026-01", amount: 1_200_000 }],
        secondJob: 300_000,
      },
    ],
    timesheets: {
      [prev]: { e1: sheet(21), e2: sheet(21, { nightHours: 16 }) },
      [m]: {
        e1: sheet(21, { overtimeHours: 4, bonus: 200_000 }),
        e2: sheet(21),
      },
    },
    accepted: {},
    corrections: {},
  };
}

export default function PayrollPanel({
  engine,
  writable,
}: {
  engine: SyncEngine;
  writable: boolean;
}) {
  const key = `${engine.scope}:payroll-v1`;
  const [r, setR] = useState<PayrollRegister | null>(null);
  const [month, setMonth] = useState(thisMonth);
  const [error, setError] = useState("");
  const [editSettings, setEditSettings] = useState(false);
  const [person, setPerson] = useState({ name: "", salary: "", second: "" });
  // Edits build on the newest register, not the one from the last render, so
  // quick tabbing between cells keeps every value.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const latest = useRef<PayrollRegister | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let live = true;
    readValue<PayrollRegister>(key)
      .then(
        (x) =>
          live &&
          setR(
            (latest.current =
              x ??
              (engine.demo
                ? demo()
                : {
                    settings: {},
                    employees: [],
                    timesheets: {},
                    accepted: {},
                    corrections: {},
                  })),
          ),
      )
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [key, engine.demo]);
  if (!r) return null;
  const missing = missingSettings(r.settings);
  const pay = monthPay(r, month);
  const sum = total(Object.values(pay));
  const accepted = r.accepted[month];
  const changed = Object.keys(r.accepted)
    .sort()
    .map((m) => ({ m, diff: changes(r, m) }))
    .filter((x) => x.diff);
  const taken = r.corrections[month] ?? [];

  function save(update: (current: PayrollRegister) => PayrollRegister) {
    setError("");
    const next = update(latest.current ?? r!);
    latest.current = next;
    setR(next);
    const write = writes.current.then(() => writeValue(key, next));
    writes.current = write.catch(() => {});
    return write.catch((e) => setError((e as Error).message));
  }
  const attempt = (fn: () => Promise<void> | void) => {
    try {
      const p = fn();
      if (p) p.catch((e) => setError((e as Error).message));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const setSheet = (id: string, patch: Partial<Timesheet>) => {
    return save((r) => {
      const current = r.timesheets[month]?.[id] ?? {
        normDays: 0,
        workedDays: 0,
      };
      return {
        ...r,
        timesheets: {
          ...r.timesheets,
          [month]: { ...r.timesheets[month], [id]: { ...current, ...patch } },
        },
      };
    });
  };
  const cell = (
    id: string,
    field: keyof Timesheet,
    kind: "days" | "hours" | "lei" | "pct",
  ) => {
    const t = r.timesheets[month]?.[id];
    const v = t?.[field];
    const shown =
      v === undefined
        ? ""
        : kind === "lei" || kind === "pct"
          ? String(v / 100)
          : String(v);
    const draftKey = `${month}|${id}|${field}`;
    return (
      <input
        className="payroll-input"
        inputMode="decimal"
        aria-label={field}
        value={drafts[draftKey] ?? shown}
        disabled={!writable}
        onChange={(e) =>
          setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))
        }
        onBlur={(e) =>
          attempt(() => {
            const text = e.target.value.trim();
            setDrafts(({ [draftKey]: _, ...rest }) => rest);
            const value =
              kind === "lei"
                ? lei(text)
                : kind === "pct"
                  ? Math.round(num(text || "0", 100) * 100)
                  : num(text || "0", kind === "days" ? 31 : 300);
            if (value !== (v ?? 0)) return setSheet(id, { [field]: value });
          })
        }
      />
    );
  };
  const row = (p: Pay) => (
    <>
      <td className="num right">{money(p.gross)}</td>
      <td className="num right">{money(p.health)}</td>
      <td className="num right">{money(p.tax)}</td>
      <td className="num right">
        <strong>{money(p.net)}</strong>
      </td>
      <td className="num right">{money(p.social)}</td>
    </>
  );

  return (
    <section className="home-panel payroll" data-t="payroll">
      <div className="home-panel-head">
        <div>
          <p className="eyebrow">Recalculare retroactivă</p>
          <h2>Salarii</h2>
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
        Completezi pontajul lunii, iar Socot calculează salariul, sporurile,
        cumulul, concediul medical (din media ultimelor 6 luni), reținerile și
        contribuțiile. Dacă schimbi ceva într-o lună deja acceptată, de exemplu
        un concediu medical adus mai târziu, Socot recalculează luna și îți
        propune diferența în luna curentă.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {(missing.length > 0 || editSettings) && (
        <div className="production-form">
          <p className="eyebrow">Cote și reguli</p>
          {missing.length > 0 && (
            <p className="error">
              Completează din legislația în vigoare: {missing.join(", ")}. Socot
              nu presupune nicio cotă.
            </p>
          )}
          <form
            className="stock-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              attempt(() => {
                const settings: PayrollSettings = { ...r.settings };
                for (const field of settingFields) {
                  const text = String(f.get(field.key) ?? "").trim();
                  if (!text) {
                    delete settings[field.key];
                    continue;
                  }
                  (settings as Record<string, number | string>)[field.key] =
                    field.unit === "cont"
                      ? text
                      : field.unit === "%"
                        ? Math.round(num(text, 1000) * 100)
                        : field.unit === "lei"
                          ? lei(text)
                          : num(text, 24);
                }
                return save((r) => ({ ...r, settings })).then(() =>
                  setEditSettings(false),
                );
              });
            }}
          >
            {settingFields.map((f) => (
              <label key={f.key}>
                {f.label} ({f.unit})
                <input
                  name={f.key}
                  defaultValue={show(r.settings, f)}
                  disabled={!writable}
                />
              </label>
            ))}
            {writable && (
              <div className="stock-form-actions">
                <button type="submit">Salvează cotele</button>
              </div>
            )}
          </form>
        </div>
      )}
      {!missing.length && !editSettings && (
        <p className="muted">
          Cote: impozit {(r.settings.incomeTax ?? 0) / 100}%, asigurare medicală{" "}
          {(r.settings.employeeHealth ?? 0) / 100}%, asigurări sociale{" "}
          {(r.settings.employerSocial ?? 0) / 100}%, scutire{" "}
          {money(r.settings.exemption ?? 0)} lei.{" "}
          <button className="textbutton" onClick={() => setEditSettings(true)}>
            Verifică sau schimbă cotele
          </button>
        </p>
      )}

      {changed.map(({ m, diff }) => {
        const d = total(Object.values(diff!));
        return (
          <div key={m} className="payroll-alert" role="status">
            <strong>Luna {m} s-a schimbat după acceptare.</strong>
            <span>
              Brut {d.gross > 0 ? "+" : ""}
              {money(d.gross)}, impozit {d.tax > 0 ? "+" : ""}
              {money(d.tax)}, asigurare medicală {d.health > 0 ? "+" : ""}
              {money(d.health)}, contribuții {d.social > 0 ? "+" : ""}
              {money(d.social)}. Declarația IPC21 pentru {m} trebuie corectată.
            </span>
            {writable && m < month && (
              <button
                onClick={() => void save((r) => takeCorrection(r, m, month))}
              >
                Include diferența în {month}
              </button>
            )}
            {writable && m === month && (
              <button onClick={() => void save((r) => acceptMonth(r, month))}>
                Acceptă luna din nou
              </button>
            )}
          </div>
        );
      })}

      {!missing.length && (
        <>
          <div className="tablewrap">
            <table className="home-table payroll-table">
              <thead>
                <tr>
                  <th>ANGAJAT</th>
                  <th>ZILE NORMĂ</th>
                  <th>ZILE LUCRATE</th>
                  <th>ORE NOAPTE</th>
                  <th>ORE SUPLIM.</th>
                  <th>PRIMĂ (LEI)</th>
                  <th>ZILE BOALĂ</th>
                  <th>% INDEMN.</th>
                  <th className="right">BRUT</th>
                  <th className="right">AS. MED.</th>
                  <th className="right">IMPOZIT</th>
                  <th className="right">NET</th>
                  <th className="right">CONTRIB.</th>
                </tr>
              </thead>
              <tbody>
                {r.employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong>
                      <small className="num">
                        {money(salaryIn(e, month))}
                        {e.secondJob ? ` + cumul ${money(e.secondJob)}` : ""}
                      </small>
                    </td>
                    <td>{cell(e.id, "normDays", "days")}</td>
                    <td>{cell(e.id, "workedDays", "days")}</td>
                    <td>{cell(e.id, "nightHours", "hours")}</td>
                    <td>{cell(e.id, "overtimeHours", "hours")}</td>
                    <td>{cell(e.id, "bonus", "lei")}</td>
                    <td>{cell(e.id, "sickDays", "days")}</td>
                    <td>{cell(e.id, "sickPercent", "pct")}</td>
                    {pay[e.id] ? (
                      row(pay[e.id])
                    ) : (
                      <td colSpan={5} className="muted">
                        Completează zilele normă
                      </td>
                    )}
                  </tr>
                ))}
                {taken.map((c) => (
                  <tr key={c.from + c.at} className="payroll-correction">
                    <td colSpan={8}>Recalculare pentru luna {c.from}</td>
                    {row(total(Object.values(c.diff)))}
                  </tr>
                ))}
                <tr className="payroll-total">
                  <td colSpan={8}>Total lună</td>
                  {row(
                    total([
                      sum,
                      ...taken.flatMap((c) => Object.values(c.diff)),
                    ]),
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="depreciation-foot">
            {accepted ? (
              <span className="status-pill success">Luna acceptată</span>
            ) : (
              writable &&
              Object.keys(pay).length > 0 && (
                <button onClick={() => void save((r) => acceptMonth(r, month))}>
                  Acceptă salariile lunii
                </button>
              )
            )}
          </div>
          <h3>Articolele lunii</h3>
          <ul className="production-overheads">
            {entries(r, month).map((e) => (
              <li key={e.label}>
                <span>
                  <span className="num">
                    Dt {e.debit} · Ct {e.credit}
                  </span>{" "}
                  · {e.label}
                </span>
                <span className="num">{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {writable && (
        <form
          className="stock-form"
          onSubmit={(e) => {
            e.preventDefault();
            attempt(() => {
              if (person.name.trim().length < 2)
                throw Error("Scrie numele angajatului.");
              const amount = lei(person.salary);
              if (!amount) throw Error("Scrie salariul lunar.");
              return save((r) => ({
                ...r,
                employees: [
                  ...r.employees,
                  {
                    id: crypto.randomUUID(),
                    name: person.name.trim(),
                    salaries: [{ from: month, amount }],
                    secondJob: lei(person.second) || undefined,
                  },
                ],
              })).then(() => setPerson({ name: "", salary: "", second: "" }));
            });
          }}
        >
          <label className="stock-item">
            Angajat nou
            <input
              value={person.name}
              maxLength={80}
              onChange={(e) => setPerson({ ...person, name: e.target.value })}
            />
          </label>
          <label>
            Salariu lunar (lei), din {month}
            <input
              inputMode="decimal"
              value={person.salary}
              onChange={(e) => setPerson({ ...person, salary: e.target.value })}
            />
          </label>
          <label>
            Cumul (lei, opțional)
            <input
              inputMode="decimal"
              value={person.second}
              onChange={(e) => setPerson({ ...person, second: e.target.value })}
            />
          </label>
          <div className="stock-form-actions">
            <button type="submit">Adaugă angajatul</button>
          </div>
        </form>
      )}
      <p className="footnote">
        Procentul indemnizației de boală depinde de stagiul de cotizare și îl
        completezi pentru fiecare certificat. Calculul nu acoperă încă toate
        regulile din Republica Moldova (de exemplu plafonările sau tichetele de
        masă) și nu trimite declarații. Datele se păstrează în acest profil și
        nu se postează încă automat în registrul contabil general.
      </p>
    </section>
  );
}
