import { z } from "zod";
import { journalEntries, type Invoice } from "./domain";
import type { Rule } from "./compliance";

// The model can only select these filters; it cannot issue SQL or mutations.
export const aiSearchSchema = z
  .object({
    intent: z.enum(["search", "unsupported"]),
    customer: z.string().trim().max(120).nullable(),
    sourceRef: z.string().trim().max(180).nullable(),
    kind: z.enum(["sale", "expense"]).nullable(),
    unpaid: z.boolean(),
    from: z.iso.date().nullable(),
    to: z.iso.date().nullable(),
  })
  .strict()
  .refine((x) => !x.from || !x.to || x.from <= x.to, "Interval invalid");
export type AiSearch = z.infer<typeof aiSearchSchema>;
export function proposalFor(invoice: Invoice, rules: Rule[]) {
  const entries = journalEntries(null, invoice, rules, invoice.date, false);
  return { entries, amount: invoice.total };
}
export type AiSearchResult = {
  filters: AiSearch;
  documents: Invoice[];
  hasMore: boolean;
};
export type AiProposal = {
  document: Invoice;
  entries: { debit: string; credit: string; amount: number }[];
  rule: { id: string; version: number; name: string; source: string };
  existing: {
    id: string;
    debit: string;
    credit: string;
    amount: number;
    state: string;
  }[];
};

// Applies AI filters to documents held in the browser (demo mode), with the
// same rules as the server search: newest first, at most 50 shown.
export function filterDocuments(
  invoices: Invoice[],
  filters: AiSearch,
): AiSearchResult {
  const has = (value: string | null | undefined, part: string | null) =>
    !part || (value ?? "").toLowerCase().includes(part.toLowerCase());
  const documents = invoices
    .filter(
      (i) =>
        has(i.customer, filters.customer) &&
        has(i.sourceRef, filters.sourceRef) &&
        (!filters.kind || (i.kind ?? "sale") === filters.kind) &&
        (!filters.unpaid || i.paid < i.total) &&
        (!filters.from || i.date >= filters.from) &&
        (!filters.to || i.date <= filters.to),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return {
    filters,
    documents: documents.slice(0, 50),
    hasMore: documents.length > 50,
  };
}
