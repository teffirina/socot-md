import { documentLinesSchema } from "./document-lines";
import { z } from "zod";
import { invoiceSchema, type Invoice } from "./domain";
import type { Snapshot } from "./storage";

export const draftSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["sale", "expense"]),
    customer: z.string().max(120),
    category: z.string().max(80),
    partnerId: z.uuid().nullable(),
    contractId: z.uuid().nullable(),
    date: z.iso.date(),
    total: z.number().int().min(0).max(100_000_000),
    lines: documentLinesSchema.optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type DocumentDraft = z.infer<typeof draftSchema>;

export function invoiceFromDraft(draft: DocumentDraft): Invoice {
  const { revision: _revision, lines, ...fields } = draftSchema.parse(draft);
  if (lines)
    throw Error(
      "Ciorna cu poziții este salvată pentru pregătire. Confirmarea contabilă pe poziții, TVA și stocuri nu este încă disponibilă; nu transforma totalul într-un articol simplificat.",
    );
  return invoiceSchema.parse({ ...fields, version: 0, paid: 0 });
}

export function documentProgress(id: string, snapshot: Snapshot) {
  const pending = snapshot.pending.filter((p) => p.invoice.id === id);
  if (pending.some((p) => p.conflict !== undefined)) return "Conflict";
  if (pending.some((p) => p.error)) return "Necesită corectare";
  if (pending.length) return "În sincronizare";
  if (snapshot.drafts?.some((d) => d.id === id)) return "Ciornă";
  const entries = snapshot.ledger?.filter((e) => e.invoiceId === id) ?? [];
  if (entries.length && entries.every((e) => e.state === "posted"))
    return "Postat";
  if (entries.length) return "De verificat";
  return "Confirmat";
}

// Amount entry accepts at most two decimal places; never rounds user input silently.
export function documentAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized))
    throw Error("Introdu o sumă în MDL cu cel mult două zecimale.");
  const [whole, cents = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  if (amount > 100_000_000) throw Error("Suma depășește limita documentului.");
  return amount;
}
