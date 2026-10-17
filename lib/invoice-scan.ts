import { z } from "zod";
import type { CatalogEntry } from "./catalog";
import { draftSchema, type DocumentDraft } from "./document-workflow";

// Extraction contract for the model; amounts are integer bani, as in GLIA.
const text = z.string().max(500).nullable();
const amount = z.number().int().nonnegative().nullable();
const party = z.object({ name: text, fiscalCode: text }).strict();
export const scannedInvoiceSchema = z
  .object({
    number: text,
    issueDate: text,
    currency: text,
    supplier: party,
    customer: party,
    lines: z
      .array(
        z
          .object({
            name: text,
            unit: text,
            quantity: text,
            unitPrice: amount,
            vatRate: text,
          })
          .strict(),
      )
      .max(200),
    total: amount,
    warnings: z.array(z.string().max(500)).max(30),
  })
  .strict();
export type ScannedInvoice = z.infer<typeof scannedInvoiceSchema>;

export const scanFileTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const scanMaxBytes = 7 * 1024 * 1024;
export const scanRequestSchema = z
  .object({
    kind: z.enum(["sale", "expense"]),
    file: z
      .object({
        name: z.string().trim().min(1).max(200),
        type: z.enum(scanFileTypes),
        data: z
          .string()
          .max(Math.ceil(scanMaxBytes / 3) * 4)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict(),
  })
  .strict();
export type ScanRequest = z.infer<typeof scanRequestSchema>;

// Reject files whose bytes do not match the declared format.
export function scanSignatureMatches(type: string, bytes: Uint8Array) {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (type === "application/pdf") return ascii(0, 5) === "%PDF-";
  if (type === "image/png")
    return bytes[0] === 137 && ascii(1, 4) === "PNG";
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216;
  if (type === "image/webp")
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  return false;
}

const fiscalKey = (code: string | null | undefined) =>
  (code ?? "").replace(/\s/g, "").toUpperCase();
const validDate = (v: string | null): v is string =>
  !!v &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
/**
 * Turns an AI extraction into an editable draft. Nothing is saved or confirmed:
 * the user checks every field in the document editor first.
 */
export function draftFromScan(
  scan: ScannedInvoice,
  kind: "sale" | "expense",
  catalog: CatalogEntry[],
  id: string,
  today: string,
): { draft: DocumentDraft; number: string | null; warnings: string[] } {
  const warnings = [...scan.warnings];
  if (scan.currency && scan.currency.trim().toUpperCase() !== "MDL")
    throw Error(
      `Factura este în ${scan.currency}. Socot înregistrează deocamdată numai documente în MDL.`,
    );
  if (!scan.currency)
    warnings.push("Moneda nu apare pe factură; verifică dacă este MDL.");
  const partyData = kind === "sale" ? scan.customer : scan.supplier;
  const code = fiscalKey(partyData.fiscalCode);
  const partner = code
    ? catalog.find(
        (e) =>
          e.kind === "partner" &&
          e.active &&
          fiscalKey(e.details.idno) === code,
      )
    : undefined;
  if (!partner && partyData.name)
    warnings.push(
      "Partenerul nu există în nomenclator; verifică numele sau adaugă-l.",
    );
  const date = validDate(scan.issueDate) ? scan.issueDate : today;
  if (date !== scan.issueDate)
    warnings.push("Data facturii nu a fost citită; s-a pus data de azi.");
  const lines = scan.lines.filter((l) => l.name).length;
  if (lines)
    warnings.push(
      `Poziții citite: ${lines}. Ciorna păstrează totalul de plată, pentru că confirmarea pe poziții nu este încă disponibilă în Socot.`,
    );
  const total = scan.total ?? 0;
  if (!scan.total) warnings.push("Totalul facturii nu a fost citit.");
  const draft = draftSchema.parse({
    id,
    kind,
    customer: (partner?.name ?? partyData.name ?? "").slice(0, 120),
    category: "",
    partnerId: partner?.id ?? null,
    contractId: null,
    date,
    total: Math.min(total, 100_000_000),
    revision: 0,
  });
  return { draft, number: scan.number, warnings };
}
