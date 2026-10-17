import { z } from "zod";
import type { Json, Tables } from "@/integrations/supabase/types";

const text = z.string().nullable();
const amount = z.number().nullable();
const party = z.object({ name: text, address: text, fiscalCode: text, iban: text, bank: text }).strict();
export const invoiceSchema = z.object({
  number: text, series: text, issueDate: text, deliveryDate: text, dueDate: text,
  currency: text, supplier: party, customer: party,
  lines: z.array(z.object({ name: text, unit: text, quantity: text, unitPrice: amount, net: amount, vatRate: text, vat: amount }).strict()),
  net: amount, vat: amount, total: amount, warnings: z.array(z.string()),
}).strict();
const attachmentSchema = z.object({ path: z.string().max(300), name: z.string().max(200), type: z.string().max(100) });
const extendedParty = party.extend({ vatCode: text.optional(), bankCode: text.optional() });
export const completeInvoiceSchema = invoiceSchema.extend({ supplier: extendedParty, customer: extendedParty, version: z.literal(2).optional(), mode: z.enum(['simple', 'complete']).optional(), reference: text.optional(), contract: text.optional(), exchangeRate: text.optional(), attachment: attachmentSchema.nullable().optional() });
export type Invoice = z.infer<typeof completeInvoiceSchema>;
export type InvoiceParty = Invoice["supplier"];
export const invoiceParty = (invoice: Invoice, kind: "sale" | "expense") => kind === "sale" ? invoice.customer : invoice.supplier;
export const fiscalKey = (code: string | null | undefined) => (code ?? "").replace(/\s/g, "").toUpperCase();
export function matchInvoicePartner(rows: Tables<"catalog_entries">[], code: string | null) {
  if (!fiscalKey(code)) return undefined;
  return rows.find(row => {
    const details = row.details as Record<string, Json>;
    return [details['idno'], details['cif'], details['fiscalCode']].some(value => typeof value === "string" && fiscalKey(value) === fiscalKey(code));
  });
}
export function validateInvoice(invoice: Invoice): string | null {
  if (!invoice.number?.trim()) return "Completează numărul facturii.";
  if (!invoice.issueDate || !validDate(invoice.issueDate)) return "Completează data emiterii validă.";
  for (const date of [invoice.deliveryDate, invoice.dueDate]) if (date && !validDate(date)) return "Verifică datele livrării și scadenței.";
  if (!['MDL', 'EUR', 'USD'].includes(invoice.currency ?? '')) return "Alege moneda MDL, EUR sau USD.";
  if (invoice.currency !== 'MDL' && (!invoice.exchangeRate || !decimalParts(invoice.exchangeRate) || Number(invoice.exchangeRate.replace(',', '.')) <= 0)) return "Completează cursul de schimb în MDL; nu se face conversie automată.";
  if (!invoice.total || !Number.isSafeInteger(invoice.total) || invoice.total <= 0 || invoice.total > 100000000) return "Totalul trebuie să fie pozitiv și de cel mult 1 000 000 MDL.";
  const amounts = [invoice.net, invoice.vat, ...invoice.lines.flatMap(l => [l.unitPrice, l.net, l.vat])];
  if (amounts.some(v => v !== null && (!Number.isSafeInteger(v) || v < 0))) return "Verifică sumele: maximum două zecimale, fără valori negative.";
  if (invoice.lines.some(l => l.quantity !== null && (!/^\d+(?:[.,]\d+)?$/.test(l.quantity) || Number(l.quantity.replace(',', '.')) <= 0))) return "Verifică cantitățile: trebuie să fie pozitive.";
  if (invoice.mode === 'complete' && (!invoice.supplier.name?.trim() || !invoice.customer.name?.trim())) return 'Completează furnizorul și cumpărătorul.';
  if (invoice.lines.some(l => !l.name?.trim() || !l.unit?.trim() || !l.quantity || l.unitPrice === null || vatPercent(l.vatRate) === null)) return 'Completează denumirea, unitatea, cantitatea, prețul și cota TVA pentru fiecare poziție.';
  if (invoice.version === 2 && invoiceDiscrepancies(invoice).length) return 'Verifică totalurile facturii.';
  return null;
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function invoiceDiscrepancies(invoice: Invoice) {
  const warnings: string[] = [];
  if (invoice.net !== null && invoice.vat !== null && invoice.total !== null && Math.abs(invoice.net + invoice.vat - invoice.total) > 1) warnings.push("Totalul net + TVA diferă de totalul de plată.");
  if (invoice.lines.length && invoice.lines.every(l => l.net !== null) && invoice.net !== null && Math.abs(invoice.lines.reduce((s, l) => s + (l.net ?? 0), 0) - invoice.net) > 1) warnings.push("Suma liniilor diferă de totalul net.");
  for (const line of invoice.lines) {
    const quantity = Number(line.quantity?.replace(',', '.'));
    if (line.unitPrice !== null && line.net !== null && quantity > 0 && Math.abs(Math.round(quantity * line.unitPrice) - line.net) > 1) warnings.push(`Verifică valoarea netă: ${line.name ?? "linie fără denumire"}.`);
  }
  return warnings;
}
export function readInvoice(value: Json | null | undefined) {
  const parsed = completeInvoiceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export const emptyParty = (): InvoiceParty => ({ name: null, address: null, fiscalCode: null, iban: null, bank: null, vatCode: null, bankCode: null });
export const emptyInvoice = (number: string, date: string): Invoice => ({ version: 2, mode: 'complete', number, series: null, issueDate: date, deliveryDate: null, dueDate: null, reference: null, contract: null, currency: 'MDL', exchangeRate: '1', supplier: emptyParty(), customer: emptyParty(), lines: [], net: null, vat: 0, total: null, warnings: [] });
export function partyFromCatalog(row: Tables<'catalog_entries'>): InvoiceParty {
  const d = row.details as Record<string, Json>;
  const get = (...keys: string[]) => keys.map(k => d[k]).find(v => typeof v === 'string') as string | undefined;
  return { name: row.name, fiscalCode: get('idno', 'fiscalCode', 'cif') ?? null, address: get('address') ?? null, iban: get('iban') ?? null, bank: get('bank') ?? null, vatCode: get('vatCode') ?? null, bankCode: get('bankCode') ?? null };
}
function decimalParts(value: string): [bigint, bigint] | null {
  const clean = value.replace(',', '.');
  if (!/^\d+(\.\d{1,6})?$/.test(clean) || clean.length > 20) return null;
  const [whole, fraction = ''] = clean.split('.');
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
function multiplyRounded(value: number, decimal: string): number | null {
  const parts = decimalParts(decimal);
  if (!parts || !Number.isSafeInteger(value) || value < 0) return null;
  const [n, d] = parts; const result = Number((BigInt(value) * n * 2n + d) / (2n * d));
  return Number.isSafeInteger(result) ? result : null;
}
export function vatPercent(value: string | null): string | null {
  const normalized = (value ?? '').trim().replace('%', '').replace(',', '.');
  if (/^(scutit|neimpozabil)$/i.test(normalized)) return '0';
  return decimalParts(normalized) && Number(normalized) <= 100 ? normalized : null;
}
export function recalculateInvoice(invoice: Invoice): Invoice {
  const lines = invoice.lines.map(line => {
    const rate = vatPercent(line.vatRate);
    const net = line.unitPrice === null || !line.quantity ? null : multiplyRounded(line.unitPrice, line.quantity);
    const vat = net === null || rate === null ? null : multiplyRounded(net, String(Number(rate) / 100));
    return { ...line, vatRate: rate === '0' && /scutit|neimpozabil/i.test(line.vatRate ?? '') ? '0' : line.vatRate, net, vat };
  });
  if (!lines.length) return { ...invoice, lines, net: 0, vat: 0, total: 0 };
  const complete = lines.every(l => l.net !== null && l.vat !== null);
  const net = complete ? lines.reduce((s, l) => s + (l.net ?? 0), 0) : null;
  const vat = complete ? lines.reduce((s, l) => s + (l.vat ?? 0), 0) : null;
  return { ...invoice, lines, net, vat, total: net === null || vat === null ? null : net + vat };
}
export const invoiceMdlTotal = (invoice: Invoice) => invoice.total === null ? null : invoice.currency === 'MDL' ? invoice.total : multiplyRounded(invoice.total, invoice.exchangeRate ?? '');
export const paymentStatus = (total: number, paid: number) => paid >= total ? 'Achitată' : paid > 0 ? 'Parțial achitată' : 'Neachitată';
export function duplicateInvoice(docs: Tables<'documents'>[], kind: string, number: string, partner: InvoiceParty, exceptId?: string) {
  const normalize = (v: string) => v.replace(/\s/g, '').toLowerCase();
  return docs.some(d => d.id !== exceptId && d.kind === kind && normalize(d.number) === normalize(number) && (d.partner_name.trim().toLowerCase() === partner.name?.trim().toLowerCase() || (!!fiscalKey(partner.fiscalCode) && fiscalKey(readInvoice(d.invoice_details)?.[kind === 'sale' ? 'customer' : 'supplier'].fiscalCode) === fiscalKey(partner.fiscalCode))));
}
export function validateInvoiceFile(file: { size: number; type: string }) {
  if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) return "Alege un fișier PNG, JPG, WebP sau PDF.";
  if (!file.size || file.size > 10 * 1024 * 1024) return "Fișierul trebuie să aibă între 1 octet și 10 MB.";
  return null;
}