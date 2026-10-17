import { describe, expect, it } from 'vitest';
import { invoiceParty, matchInvoicePartner, invoiceDiscrepancies, validateInvoice, validateInvoiceFile, recalculateInvoice, invoiceMdlTotal, paymentStatus, duplicateInvoice, partyFromCatalog, readInvoice, type Invoice } from './invoice';
import type { Tables } from '@/integrations/supabase/types';
const party = { name: 'Partener', fiscalCode: '1000000000001', address: null, iban: null, bank: null };
const invoice: Invoice = { number: '001', series: 'AA', issueDate: '2026-10-17', deliveryDate: null, dueDate: null, currency: 'MDL', supplier: party, customer: { ...party, name: 'Client' }, lines: [{ name: 'Servicii', quantity: '2', unit: 'ore', unitPrice: 10025, net: 20050, vatRate: '20%', vat: 4010 }], net: 20050, vat: 4010, total: 24060, warnings: [] };
const line: Invoice['lines'][number] = { name: 'Servicii', unit: 'ore', quantity: '2', unitPrice: 10025, net: 20050, vatRate: '20', vat: 4010 };
describe('invoice import', () => {
  it('selects supplier for purchases and customer for sales', () => { expect(invoiceParty(invoice, 'expense').name).toBe('Partener'); expect(invoiceParty(invoice, 'sale').name).toBe('Client'); });
  it('matches partners by fiscal code, never empty codes or name', () => {
    const row: Tables<'catalog_entries'> = { id: '1', company_id: '1', code: 'P1', name: 'Existing', kind: 'partner', details: { idno: '1000000000001' }, created_at: '' };
    expect(matchInvoicePartner([row], '1000000000001')?.id).toBe('1'); expect(matchInvoicePartner([row], '')).toBeUndefined(); expect(matchInvoicePartner([row], '1000000000002')).toBeUndefined();
  });
  it('stores money in integer bani and rejects fractional bani', () => { expect(validateInvoice(invoice)).toBeNull(); expect(validateInvoice({ ...invoice, total: 24060.5 })).not.toBeNull(); });
  it('preserves invoice totals and reports net plus VAT mismatches', () => { expect(invoiceDiscrepancies(invoice)).toEqual([]); expect(invoiceDiscrepancies({ ...invoice, total: 24000 })).toContain('Totalul net + TVA diferă de totalul de plată.'); });
  it('does not convert other currencies silently', () => { expect(validateInvoice({ ...invoice, currency: 'EUR' })).not.toBeNull(); expect(validateInvoice({ ...invoice, currency: null })).not.toBeNull(); });
  it('requires invoice number and real issue date instead of inventing them', () => { expect(validateInvoice({ ...invoice, number: null })).not.toBeNull(); expect(validateInvoice({ ...invoice, issueDate: '2026-02-30' })).not.toBeNull(); });
  it('accepts requested image formats and scanned PDFs', () => { for (const type of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) expect(validateInvoiceFile({ type, size: 100 })).toBeNull(); expect(validateInvoiceFile({ type: 'text/plain', size: 100 })).not.toBeNull(); });
});
describe('complete invoices', () => {
  it('calculates quantity times net price and VAT then sums gross totals', () => {
    const result = recalculateInvoice({ ...invoice, lines: [{ ...line, quantity: '2', unitPrice: 10025, vatRate: '20' }] });
    expect(result.net).toBe(20050); expect(result.vat).toBe(4010); expect(result.total).toBe(24060);
  });
  it('recalculates after line edits and deletes', () => {
    const result = recalculateInvoice({ ...invoice, lines: [{ ...line, quantity: '3', vatRate: '20' }] });
    expect(result.total).toBe(36090);
    expect(recalculateInvoice({ ...invoice, lines: [{ ...line, quantity: '1', vatRate: '0' }] }).total).toBe(10025);
    expect(recalculateInvoice({ ...invoice, lines: [] }).total).toBe(0);
  });
  it('supports MDL EUR USD with explicit accounting exchange rate', () => {
    expect(invoiceMdlTotal(invoice)).toBe(24060);
    for (const currency of ['EUR','USD']) { const foreign = { ...invoice, currency, exchangeRate: '19,50' }; expect(validateInvoice(foreign)).toBeNull(); expect(invoiceMdlTotal(foreign)).toBe(469170); }
  });
  it('derives unpaid partially paid and fully paid states', () => {
    expect(paymentStatus(24060,0)).toBe('Neachitată'); expect(paymentStatus(24060,10000)).toBe('Parțial achitată'); expect(paymentStatus(24060,24060)).toBe('Achitată');
  });
  it('prepopulates all fiscal and banking partner fields from catalog', () => {
    const p = partyFromCatalog({ id:'p', company_id:'c', kind:'partner', code:'p', name:'SRL', created_at:'', details:{idno:'1000000000001',vatCode:'123',address:'Chișinău',iban:'MD00',bank:'MAIB',bankCode:'AGRNMD2X'} });
    expect(p).toEqual({name:'SRL',fiscalCode:'1000000000001',vatCode:'123',address:'Chișinău',iban:'MD00',bank:'MAIB',bankCode:'AGRNMD2X'});
  });
  it('detects same-number partner duplicates but excludes the edited record', () => {
    const row = { id:'d',kind:'sale',number:'AA 001',partner_name:'Client',invoice_details:invoice } as unknown as Tables<'documents'>;
    expect(duplicateInvoice([row],'sale','AA001',invoice.customer)).toBe(true);
    expect(duplicateInvoice([row],'sale','AA001',invoice.customer,'d')).toBe(false);
    expect(duplicateInvoice([row],'expense','AA001',invoice.customer)).toBe(false);
  });
  it('keeps existing scanned invoice data readable', () => { expect(readInvoice(invoice)?.total).toBe(24060); });
});