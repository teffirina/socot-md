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
