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
  return {
    invoices,
    pending: [],
    ledger,
    compliance: initialCompliance(),
    company: structuredClone(demoCompany),
    accounts: structuredClone(demoAccounts),
  };
}
