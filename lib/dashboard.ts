import type { Invoice } from "./domain";

// Figures for the home overview, computed only from saved documents.
const monthNames = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];
const shortNames = [
  "ian.",
  "feb.",
  "mar.",
  "apr.",
  "mai",
  "iun.",
  "iul.",
  "aug.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
];
const weekDays = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];

export type MonthTotals = {
  key: string;
  label: string;
  name: string;
  sales: number;
  expenses: number;
  profit: number;
};

export const isExpense = (i: Invoice) => i.kind === "expense";

export function dashboardMoney(bani: number, currency = true) {
  const absolute = Math.abs(bani);
  const whole = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${bani < 0 ? "−" : ""}${whole},${String(absolute % 100).padStart(2, "0")}${currency ? " MDL" : ""}`;
}

export const dashboardDate = (date: string) =>
  date.split("-").reverse().join(".");

export function todayLine(today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  return `${weekDays[d.getUTCDay()]}, ${dashboardDate(today)} · Perioada: ${monthNames[d.getUTCMonth()]}`;
}

export function monthlyTotals(
  invoices: Invoice[],
  today: string,
  months = 6,
): MonthTotals[] {
  const [y, m] = today.split("-").map(Number);
  const rows: MonthTotals[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const own = invoices.filter((x) => x.date.startsWith(key));
    const sales = own.filter((x) => !isExpense(x)).reduce((s, x) => s + x.total, 0);
    const expenses = own.filter(isExpense).reduce((s, x) => s + x.total, 0);
    rows.push({
      key,
      label: shortNames[d.getUTCMonth()],
      name: monthNames[d.getUTCMonth()],
      sales,
      expenses,
      profit: sales - expenses,
    });
  }
  return rows;
}

export function expenseStructure(invoices: Invoice[], month: string, top = 5) {
  const groups = new Map<string, number>();
  for (const x of invoices)
    if (isExpense(x) && x.date.startsWith(month)) {
      const name = x.category?.trim() || "Fără categorie";
      groups.set(name, (groups.get(name) ?? 0) + x.total);
    }
  const sorted = [...groups].sort((a, b) => b[1] - a[1]);
  const rows = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((s, [, v]) => s + v, 0);
  if (rest) rows.push(["Altele", rest]);
  return rows;
}

export function balances(invoices: Invoice[]) {
  const sales = invoices.filter((x) => !isExpense(x));
  const costs = invoices.filter(isExpense);
  const open = (rows: Invoice[]) => rows.filter((x) => x.paid < x.total);
  return {
    sales: sales.reduce((s, x) => s + x.total, 0),
    expenses: costs.reduce((s, x) => s + x.total, 0),
    receivable: sales.reduce((s, x) => s + x.total - x.paid, 0),
    payable: costs.reduce((s, x) => s + x.total - x.paid, 0),
    openSales: open(sales).length,
    openCosts: open(costs).length,
  };
}

// A rounded axis maximum so bars keep a readable scale.
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value)!;
  return step * power;
}
