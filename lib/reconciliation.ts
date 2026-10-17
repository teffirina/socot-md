import type { Invoice } from "./domain";
import { z } from "zod";

export const reconciliationSchema = z
  .object({
    customer: z.string().trim().min(2).max(120),
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .strict()
  .refine(
    (v) => v.from <= v.to,
    "Data de început trebuie să fie înainte de sfârșit.",
  );

export type LedgerLine = {
  id: string;
  invoiceId: string;
  operationId?: string | null;
  amount: number;
  effectiveDate?: string | null;
};
export type Payment = { invoiceId: string; date: string; amount: number };
export type ActRow = {
  date: string;
  document: string;
  debit: number;
  credit: number;
};
export type ActResult = {
  rows: ActRow[];
  rulajDebit: number;
  rulajCredit: number;
  // Sold la începutul perioadei; pozitiv = clientul datorează.
  soldInitial: number;
  // Pozitiv = clientul datorează (creanță).
  soldFinal: number;
};

const label = (i: Invoice) =>
  i.sourceRef ? i.sourceRef : i.id.slice(0, 8).toUpperCase();

// Articolele unei operațiuni au același operationId; prima operațiune a
// documentului este emiterea, următoarele sunt încasări.
export function paymentsFromLedger(lines: LedgerLine[]): Payment[] {
  const groups = new Map<string, Payment[]>();
  const byOperation = new Map<string, Payment>();
  for (const line of lines) {
    const key = line.operationId ?? line.id;
    let group = byOperation.get(key);
    if (!group) {
      group = {
        invoiceId: line.invoiceId,
        date: line.effectiveDate ?? "",
        amount: 0,
      };
      byOperation.set(key, group);
      groups.set(line.invoiceId, [
        ...(groups.get(line.invoiceId) ?? []),
        group,
      ]);
    }
    group.amount += line.amount;
  }
  return [...groups.values()].flatMap((ops) =>
    ops.slice(1).filter((p) => p.date),
  );
}

/**
 * Act de verificare pentru un client: facturile de vânzare intră la Credit,
 * încasările la Debit, ca în modelul folosit în Socot.md-GLIA. Soldul
 * inițial cuprinde documentele și încasările dinaintea perioadei.
 */
export function buildReconciliation(
  invoices: Invoice[],
  payments: Payment[],
  customer: string,
  from?: string,
  to?: string,
): ActResult {
  const inPeriod = (d: string) => (!from || d >= from) && (!to || d <= to);
  const before = (d: string) => !!from && d < from;
  const sales = invoices.filter(
    (i) => (i.kind ?? "sale") === "sale" && i.customer === customer,
  );
  const byId = new Map(sales.map((i) => [i.id, i]));
  const rows: ActRow[] = [
    ...sales
      .filter((i) => inPeriod(i.date))
      .map((i) => ({
        date: i.date,
        document: `Factura ${label(i)}`,
        debit: 0,
        credit: i.total,
      })),
    ...payments
      .filter((p) => byId.has(p.invoiceId) && inPeriod(p.date))
      .map((p) => ({
        date: p.date,
        document: `Încasare factura ${label(byId.get(p.invoiceId)!)}`,
        debit: p.amount,
        credit: 0,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const soldInitial =
    sales.filter((i) => before(i.date)).reduce((s, i) => s + i.total, 0) -
    payments
      .filter((p) => byId.has(p.invoiceId) && before(p.date))
      .reduce((s, p) => s + p.amount, 0);
  const rulajDebit = rows.reduce((s, r) => s + r.debit, 0);
  const rulajCredit = rows.reduce((s, r) => s + r.credit, 0);
  return {
    rows,
    rulajDebit,
    rulajCredit,
    soldInitial,
    soldFinal: soldInitial + rulajCredit - rulajDebit,
  };
}
