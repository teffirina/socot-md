import { demoCompany, demoAccounts } from "./company";
import { initialCompliance } from "./compliance";
import { applyOperation, journal, type Invoice } from "./domain";
import type { Snapshot } from "./storage";
export function demoData(): Snapshot {
  const rows = [
    ["Socot · Atelier Lumină", 1840000, 1200000],
    ["Socot · Studio Nord", 720000, 720000],
    ["Socot · Grădina Mică", 465000, 0],
    ["Socot · Forma Verde", 980000, 450000],
    ["Socot · Casa de Hârtie", 325000, 325000],
    ["Socot · Brutăria Zori", 610000, 0],
  ] as const;
  const invoices: Invoice[] = [],
    ledger: NonNullable<Snapshot["ledger"]> = [];
  rows.forEach(([customer, total, paid], index) => {
    const date = new Date();
    date.setUTCDate(5 + index * 3);
    date.setUTCMonth(date.getUTCMonth() - Math.floor(index / 2));
    const i: Invoice = {
      id: crypto.randomUUID(),
      customer,
      total,
      paid: 0,
      date: date.toISOString().slice(0, 10),
      version: 0,
    };
    const issued = applyOperation(null, {
      id: crypto.randomUUID(),
      invoice: i,
      baseVersion: 0,
    });
    ledger.push({
      id: crypto.randomUUID(),
      invoiceId: i.id,
      ...journal(null, issued),
      effectiveDate: issued.date,
      ruleId: "demo-sale-v1",
      ruleVersion: 1,
      state: "posted",
    });
    if (paid) {
      const next = applyOperation(issued, {
        id: crypto.randomUUID(),
        invoice: { ...issued, paid },
        baseVersion: 1,
      });
      ledger.push({
        id: crypto.randomUUID(),
        invoiceId: i.id,
        ...journal(issued, next),
        effectiveDate: next.date,
        ruleId: "demo-receipt-v1",
        ruleVersion: 1,
        state: "posted",
      });
      invoices.push(next);
    } else invoices.push(issued);
  });
  const monthsAgo = (n: number) => {
    const d = new Date();
    d.setUTCDate(10);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 10);
  };
  const asset = (
    code: string,
    name: string,
    details: Record<string, string>,
  ) => ({
    id: crypto.randomUUID(),
    kind: "asset" as const,
    code,
    name,
    version: 1,
    active: true,
    details,
  });
  return {
    invoices,
    catalog: [
      asset("MF-001", "Laptop pentru contabilitate", {
        inServiceDate: monthsAgo(1),
        cost: "24000",
        residual: "0",
        lifeMonths: "36",
      }),
      asset("MF-002", "Autoturism de serviciu", {
        inServiceDate: monthsAgo(14),
        cost: "280000",
        residual: "30000",
        lifeMonths: "60",
        openingDepreciation: "54166.67",
      }),
    ],
    pending: [],
    ledger,
    compliance: initialCompliance(),
    company: structuredClone(demoCompany),
    accounts: structuredClone(demoAccounts),
  };
}
