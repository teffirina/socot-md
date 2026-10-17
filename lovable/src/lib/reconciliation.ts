import type { Doc } from "@/lib/documents";

export type ActRow = { date: string; document: string; debit: number; credit: number };

export type ActResult = {
  rows: ActRow[];
  rulajDebit: number;
  rulajCredit: number;
  soldFinal: number; // pozitiv = partenerul datorează (creanță)
};

type PaymentRow = { date: string; amount: number; document_id: string; documents: { number: string } | null };

/**
 * Construiește rândurile actului de verificare pentru un client:
 * facturile de vânzare confirmate intră la Credit, încasările (bancă/casă) la Debit.
 */
export function buildReconciliation(docs: Doc[], payments: PaymentRow[], partnerName: string, from?: string, to?: string): ActResult {
  const inPeriod = (d: string) => (!from || d >= from) && (!to || d <= to);
  const sales = docs.filter((d) => d.kind === "sale" && d.status === "confirmed" && d.partner_name === partnerName && inPeriod(d.date));
  const saleIds = new Set(sales.map((d) => d.id));
  const rows: ActRow[] = [
    ...sales.map((d) => ({ date: d.date, document: `Factura fiscală ${d.number}`, debit: 0, credit: d.total })),
    ...payments
      .filter((p) => saleIds.has(p.document_id) && inPeriod(p.date))
      .map((p) => ({ date: p.date, document: `Încasare factura ${p.documents?.number ?? ""} (bancă/casă)`, debit: p.amount, credit: 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const rulajDebit = rows.reduce((s, r) => s + r.debit, 0);
  const rulajCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, rulajDebit, rulajCredit, soldFinal: rulajCredit - rulajDebit };
}
