import { demoRules, selectRule, type Rule } from "./compliance";
import { z } from "zod";
export const invoiceSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["sale", "expense"]).optional(),
    category: z.string().trim().max(80).optional(),
    customer: z.string().trim().min(2).max(120),
    total: z.number().int().positive().max(100_000_000),
    paid: z.number().int().nonnegative(),
    version: z.number().int().nonnegative(),
    date: z.iso.date(),
  })
  .strict()
  .refine((x) => x.paid <= x.total, "Plata depășește totalul");
export type Invoice = z.infer<typeof invoiceSchema>;
export const operationSchema = z
  .object({
    id: z.uuid(),
    invoice: invoiceSchema,
    baseVersion: z.number().int().nonnegative(),
    effectiveDate: z.iso.date().optional(),
  })
  .strict();
export type Operation = z.infer<typeof operationSchema>;
export type Pending = Operation & { conflict?: Invoice | null; error?: string };
export function applyOperation(
  current: Invoice | null,
  operation: Operation,
): Invoice {
  if ((current?.version ?? 0) !== operation.baseVersion)
    throw new Error("CONFLICT");
  if (!current && operation.invoice.paid !== 0)
    throw new Error("Factura nouă trebuie emisă fără plată");
  if (
    current &&
    ((current.kind ?? "sale") !== (operation.invoice.kind ?? "sale") ||
      (current.category ?? "") !== (operation.invoice.category ?? "") ||
      current.total !== operation.invoice.total ||
      current.customer !== operation.invoice.customer ||
      current.date !== operation.invoice.date ||
      current.paid > operation.invoice.paid)
  )
    throw new Error("Se pot adăuga numai încasări la o factură emisă");
  return { ...operation.invoice, version: operation.baseVersion + 1 };
}
export function totals(invoices: Invoice[]) {
  return invoices.reduce(
    (a, i) => ({
      sales: a.sales + i.total,
      paid: a.paid + i.paid,
      due: a.due + i.total - i.paid,
    }),
    { sales: 0, paid: 0, due: 0 },
  );
}
export function journal(
  previous: Invoice | null,
  next: Invoice,
  rules: Rule[] = demoRules,
  date = next.date,
  allowDemo = true,
) {
  const rule = selectRule(
    rules,
    operationKind(next, !!previous),
    date,
    allowDemo,
  );
  const amount = previous ? next.paid - previous.paid : next.total;
  if (amount <= 0) throw new Error("Încasarea trebuie să fie pozitivă.");
  return { debit: rule.debit, credit: rule.credit, amount };
}

export function operationKind(doc: Invoice, payment: boolean) {
  return doc.kind === "expense"
    ? payment
      ? "payment"
      : "expense"
    : payment
      ? "receipt"
      : "sale";
}
