// Monthly payroll with retroactive recalculation. Rates are settings the
// accountant fills in and checks against the law in force; nothing is
// assumed. When an input of a month already accepted changes (a sick note
// brought late, a bonus changed), the month is recomputed and the
// difference is proposed in the current month, while the accepted month
// is flagged for a corrected IPC21.

export type PayrollSettings = {
  /** basis points: 1200 = 12% */
  incomeTax?: number;
  employeeHealth?: number;
  employerSocial?: number;
  /** monthly personal exemption, bani */
  exemption?: number;
  /** supplement for night hours, basis points over the hourly rate */
  nightSupplement?: number;
  /** pay for overtime hours, basis points of the hourly rate */
  overtimeRate?: number;
  /** sick days paid by the employer before social insurance pays */
  employerSickDays?: number;
  hoursPerDay?: number;
  expenseAccount?: string;
};

export type Employee = {
  id: string;
  name: string;
  /** monthly salary from a month on, bani */
  salaries: { from: string; amount: number }[];
  /** second position held at the same time (cumul), bani per month */
  secondJob?: number;
};

export type Timesheet = {
  normDays: number;
  workedDays: number;
  nightHours?: number;
  overtimeHours?: number;
  bonus?: number;
  sickDays?: number;
  /** share of the average daily pay, basis points (stage-dependent) */
  sickPercent?: number;
};

export type Pay = {
  base: number;
  night: number;
  overtime: number;
  secondJob: number;
  bonus: number;
  sickEmployer: number;
  sickSocial: number;
  gross: number;
  health: number;
  tax: number;
  net: number;
  social: number;
};

export type PayrollRegister = {
  settings: PayrollSettings;
  employees: Employee[];
  /** month → employee id → timesheet */
  timesheets: Record<string, Record<string, Timesheet>>;
  /** month → what was accepted, per employee */
  accepted: Record<string, { at: string; pay: Record<string, Pay> }>;
  /** month → corrections of earlier months taken into it */
  corrections: Record<
    string,
    { from: string; at: string; diff: Record<string, Pay> }[]
  >;
};

export const requiredSettings: [keyof PayrollSettings, string][] = [
  ["incomeTax", "Cota impozitului pe venit"],
  ["employeeHealth", "Prima de asigurare medicală (angajat)"],
  ["employerSocial", "Contribuția de asigurări sociale (angajator)"],
  ["exemption", "Scutirea personală lunară"],
  ["nightSupplement", "Sporul pentru orele de noapte"],
  ["overtimeRate", "Plata orelor suplimentare"],
  ["employerSickDays", "Zile de boală plătite de angajator"],
];

export function missingSettings(s: PayrollSettings) {
  return requiredSettings.filter(([k]) => s[k] === undefined).map(([, l]) => l);
}

const zero: Pay = {
  base: 0,
  night: 0,
  overtime: 0,
  secondJob: 0,
  bonus: 0,
  sickEmployer: 0,
  sickSocial: 0,
  gross: 0,
  health: 0,
  tax: 0,
  net: 0,
  social: 0,
};
export const payKeys = Object.keys(zero) as (keyof Pay)[];

export function salaryIn(e: Employee, month: string) {
  return (
    [...e.salaries]
      .filter((s) => s.from <= month)
      .sort((a, b) => b.from.localeCompare(a.from))[0]?.amount ?? 0
  );
}

export function prevMonth(month: string, back = 1) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 7);
}

const pct = (amount: number, bp: number) => Math.round((amount * bp) / 10000);

/** Average daily pay over the six months before `month`, from the data. */
export function averageDaily(
  r: PayrollRegister,
  e: Employee,
  month: string,
  depth = 0,
): number {
  let pay = 0,
    days = 0;
  if (depth < 2)
    for (let i = 1; i <= 6; i++) {
      const m = prevMonth(month, i);
      const t = r.timesheets[m]?.[e.id];
      if (!t || !t.workedDays) continue;
      const p = computePay(r, e, m, depth + 1);
      pay += p.base + p.night + p.overtime + p.secondJob + p.bonus;
      days += t.workedDays;
    }
  if (days) return Math.round(pay / days);
  const t = r.timesheets[month]?.[e.id];
  return t?.normDays ? Math.round(salaryIn(e, month) / t.normDays) : 0;
}

export function computePay(
  r: PayrollRegister,
  e: Employee,
  month: string,
  depth = 0,
): Pay {
  const t = r.timesheets[month]?.[e.id];
  const s = r.settings;
  if (!t || !t.normDays) return { ...zero };
  const salary = salaryIn(e, month);
  const hours = t.normDays * (s.hoursPerDay ?? 8);
  const hourly = hours ? salary / hours : 0;
  const share = Math.min(t.workedDays, t.normDays) / t.normDays;
  const base = Math.round(salary * share);
  const night = Math.round(
    hourly * (t.nightHours ?? 0) * ((s.nightSupplement ?? 0) / 10000),
  );
  const overtime = Math.round(
    hourly * (t.overtimeHours ?? 0) * ((s.overtimeRate ?? 0) / 10000),
  );
  const secondJob = Math.round((e.secondJob ?? 0) * share);
  const bonus = t.bonus ?? 0;
  let sickEmployer = 0,
    sickSocial = 0;
  if (t.sickDays) {
    const daily = pct(averageDaily(r, e, month, depth), t.sickPercent ?? 0);
    const employerDays = Math.min(t.sickDays, s.employerSickDays ?? 0);
    sickEmployer = daily * employerDays;
    sickSocial = daily * (t.sickDays - employerDays);
  }
  const gross =
    base + night + overtime + secondJob + bonus + sickEmployer + sickSocial;
  const health = pct(gross, s.employeeHealth ?? 0);
  const tax = Math.max(
    0,
    pct(gross - health - (s.exemption ?? 0), s.incomeTax ?? 0),
  );
  const social = pct(gross - sickEmployer - sickSocial, s.employerSocial ?? 0);
  return {
    base,
    night,
    overtime,
    secondJob,
    bonus,
    sickEmployer,
    sickSocial,
    gross,
    health,
    tax,
    net: gross - health - tax,
    social,
  };
}

export function monthPay(r: PayrollRegister, month: string) {
  return Object.fromEntries(
    r.employees
      .filter((e) => r.timesheets[month]?.[e.id])
      .map((e) => [e.id, computePay(r, e, month)]),
  ) as Record<string, Pay>;
}

export const subtract = (a: Pay = zero, b: Pay = zero) =>
  Object.fromEntries(payKeys.map((k) => [k, a[k] - b[k]])) as Pay;
export const add = (a: Pay = zero, b: Pay = zero) =>
  Object.fromEntries(payKeys.map((k) => [k, a[k] + b[k]])) as Pay;
export const isZero = (p: Pay) => payKeys.every((k) => !p[k]);
export const total = (pays: Pay[]) =>
  pays.reduce((a, p) => add(a, p), { ...zero });

/** What changed in an accepted month after it was accepted. */
export function changes(r: PayrollRegister, month: string) {
  const acc = r.accepted[month];
  if (!acc) return null;
  const now = monthPay(r, month);
  const ids = new Set([...Object.keys(now), ...Object.keys(acc.pay)]);
  // Differences already moved into a later month are not proposed again.
  const moved = Object.values(r.corrections)
    .flat()
    .filter((c) => c.from === month);
  const diff: Record<string, Pay> = {};
  for (const id of ids) {
    const already = moved.reduce((a, c) => add(a, c.diff[id]), { ...zero });
    const d = subtract(subtract(now[id], acc.pay[id]), already);
    if (!isZero(d)) diff[id] = d;
  }
  return Object.keys(diff).length ? diff : null;
}

export function acceptMonth(
  r: PayrollRegister,
  month: string,
  at = new Date().toISOString(),
): PayrollRegister {
  return {
    ...r,
    accepted: { ...r.accepted, [month]: { at, pay: monthPay(r, month) } },
  };
}

export function takeCorrection(
  r: PayrollRegister,
  from: string,
  into: string,
  at = new Date().toISOString(),
): PayrollRegister {
  const diff = changes(r, from);
  if (!diff) return r;
  return {
    ...r,
    corrections: {
      ...r.corrections,
      [into]: [...(r.corrections[into] ?? []), { from, at, diff }],
    },
  };
}

/** Entries for a month, including corrections taken into it. */
export function entries(r: PayrollRegister, month: string) {
  const p = add(
    total(Object.values(monthPay(r, month))),
    total((r.corrections[month] ?? []).flatMap((c) => Object.values(c.diff))),
  );
  const expense = r.settings.expenseAccount || "713";
  return [
    {
      debit: expense,
      credit: "531",
      amount: p.gross - p.sickSocial,
      label: "Salarii calculate",
    },
    {
      debit: "533",
      credit: "531",
      amount: p.sickSocial,
      label: "Indemnizații din asigurări sociale",
    },
    {
      debit: "531",
      credit: "533",
      amount: p.health,
      label: "Prima de asigurare medicală reținută",
    },
    {
      debit: "531",
      credit: "534",
      amount: p.tax,
      label: "Impozit pe venit reținut",
    },
    {
      debit: expense,
      credit: "533",
      amount: p.social,
      label: "Contribuții sociale ale angajatorului",
    },
  ].filter((e) => e.amount);
}
