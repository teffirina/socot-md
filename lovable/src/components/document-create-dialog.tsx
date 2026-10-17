import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanLine, Square, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { kindNames, type DocKind } from "@/lib/documents";
import { parseMoney } from "@/lib/money";
import { invoiceSchema, invoiceParty, matchInvoicePartner, validateInvoice, invoiceDiscrepancies, validateInvoiceFile, type Invoice, emptyInvoice, emptyParty, partyFromCatalog, recalculateInvoice, invoiceMdlTotal, duplicateInvoice, readInvoice } from "@/lib/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMembership } from "@/lib/company";
import { InvoiceAttachment } from "./invoice-attachment";
import type { Doc } from "@/lib/documents";
import { InvoiceFields } from "./invoice-fields";

export function DocumentCreateDialog(props: { kind: DocKind; companyId: string; partners: Tables<'catalog_entries'>[]; nextNumber: string; documents: Doc[]; editing?: Doc; onClose: () => void; onDone: () => void }) {
  const names = kindNames[props.kind];
  const { company } = useMembership();
  const existing = props.editing ? readInvoice(props.editing.invoice_details) : null;
  const [mode, setMode] = useState<"simple" | "complete">(existing ? "complete" : "simple");
  const attachmentInput = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();
  const [number, setNumber] = useState(props.editing?.number ?? props.nextNumber);
  const [date, setDate] = useState(props.editing?.date ?? new Date().toISOString().slice(0, 10));
  const [partner, setPartner] = useState(props.editing?.partner_name ?? '');
  const [description, setDescription] = useState(props.editing?.description ?? '');
  const [total, setTotal] = useState(props.editing ? (props.editing.total / 100).toFixed(2) : '');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(existing);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [scanError, setScanError] = useState('');
  const [paused, setPaused] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [createPartner, setCreatePartner] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (!file) return; const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => () => controller.current?.abort(), []);
  const extractedParty = invoice ? invoiceParty(invoice, props.kind) : null;
  const matched = extractedParty ? matchInvoicePartner(props.partners, extractedParty.fiscalCode) : undefined;
  const warnings = invoice ? [...invoice.warnings, ...invoiceDiscrepancies(invoice)] : [];
  const changed = (value: Invoice) => { setInvoice({ ...value, version: 2, mode: 'complete' }); setReviewed(false); };
  const fullInvoice = () => {
    const value = emptyInvoice(number, date);
    const own = { ...emptyParty(), name: company.name, fiscalCode: company.idno, address: company.address, iban: company.iban, bank: company.bank };
    const row = props.partners.find(p => p.name === partner);
    const other = row ? partyFromCatalog(row) : { ...emptyParty(), name: partner || null };
    return { ...value, net: parseMoney(total), total: parseMoney(total), supplier: props.kind === 'sale' ? own : other, customer: props.kind === 'sale' ? other : own };
  };
  const selectPartner = (name: string) => { setPartner(name); const row = props.partners.find(p => p.name === name); if (invoice && row) changed({ ...invoice, [props.kind === 'sale' ? 'customer' : 'supplier']: partyFromCatalog(row) }); };
  const switchMode = (next: 'simple' | 'complete') => {
    if (next === 'complete') { if (!invoice) setInvoice(fullInvoice()); else if (mode === 'simple') changed({ ...invoice, number, issueDate: date, [props.kind === 'sale' ? 'customer' : 'supplier']: { ...invoiceParty(invoice, props.kind), name: partner } }); }
    if (next === 'simple' && invoice) { setNumber(invoice.number ?? ''); setDate(invoice.issueDate ?? date); setPartner(invoiceParty(invoice, props.kind).name ?? ''); setTotal(((invoice.total ?? 0) / 100).toFixed(2)); }
    setMode(next);
  };
  const attach = (selected: File) => { const invalid = validateInvoiceFile(selected); if (invalid) { setScanError(invalid); return; } setFile(selected); setReviewed(false); };


  async function scan(selected: File, resume = false) {
    const invalid = validateInvoiceFile(selected);
    if (invalid) return setScanError(invalid);
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setFile(selected); setInvoice(null); setReviewed(false); setCreatePartner(false); setScanning(true); setScanError(''); setPaused(false);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Autentifică-te pentru a scana factura.');
      const form = new FormData(); form.append('file', selected); form.append('companyId', props.companyId); if (resume) form.append('resume', 'true');
      const response = await fetch('/api/invoice-scan', { method: 'POST', headers: { Authorization: `Bearer ${session.session.access_token}` }, body: form, signal: abort.signal });
      if (!response.ok) { const result = await response.json(); setPaused(!!result.paused); throw new Error(result.error ?? 'Scanarea nu a reușit.'); }
      if (!response.body) throw new Error('Nu am primit datele facturii.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let received = false;
      while (true) {
        const chunk = await reader.read(); buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'error') throw new Error(event.error);
          if (event.type === 'result') { const data = invoiceSchema.parse(event.invoice); setInvoice({ ...data, version: 2, mode: 'complete', exchangeRate: data.currency === 'MDL' ? '1' : null }); setMode('complete'); setReviewed(false); setCreatePartner(false); received = true; }
        }
        if (chunk.done) break;
      }
      if (!received) throw new Error('Nu s-au extras date lizibile din factură.');
    } catch (error) { if (!abort.signal.aborted) setScanError(error instanceof Error ? error.message : 'Scanarea nu a reușit.'); }
    finally { if (controller.current === abort) { setScanning(false); controller.current = null; } }
  }
  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    let value = parseMoney(total); let docNumber = number.trim(); let docDate = date; let docPartner = partner.trim();
    const activeInvoice = invoice && mode === 'simple' ? { ...invoice, number, issueDate: date, [props.kind === 'sale' ? 'customer' : 'supplier']: { ...invoiceParty(invoice, props.kind), name: partner }, ...(invoice.lines.length ? {} : { net: parseMoney(total), total: parseMoney(total), vat: 0 }) } : invoice;
    if (activeInvoice) {
      const invalid = validateInvoice(activeInvoice); if (invalid) return void toast.error(invalid);
      if (!reviewed) return void toast.error('Verifică și confirmă datele extrase.');
      value = invoiceMdlTotal(activeInvoice); docNumber = [activeInvoice.series, activeInvoice.number].filter(Boolean).join(' '); docDate = activeInvoice.issueDate ?? ''; docPartner = invoiceParty(activeInvoice, props.kind).name?.trim() ?? '';
    }
    if (!value || value <= 0) return void toast.error('Introdu o sumă validă, de exemplu 1250,00.');
    if (docPartner.length < 2) return void toast.error(`Completează ${names.partner.toLowerCase()}ul.`);
    if (!docNumber) return void toast.error('Completează numărul facturii.');
    const duplicateParty = invoice && mode === 'complete' && extractedParty ? extractedParty : { ...emptyParty(), name: docPartner };
    if (duplicateInvoice(props.documents, props.kind, docNumber, duplicateParty, props.editing?.id)) return void toast.error('Factura există deja pentru acest partener.');
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      let partnerId = invoice && mode === 'complete' ? matched?.id ?? null : props.partners.find(p => p.name === docPartner)?.id ?? null;
      if (invoice && mode === 'complete' && createPartner && !partnerId && extractedParty) {
        const { data, error } = await supabase.from('catalog_entries').insert({ company_id: props.companyId, kind: 'partner', code: extractedParty.fiscalCode?.trim() || `AI-${crypto.randomUUID().slice(0, 8)}`, name: docPartner, details: { idno: extractedParty.fiscalCode ?? '', address: extractedParty.address ?? '', iban: extractedParty.iban ?? '', bank: extractedParty.bank ?? '', vatCode: extractedParty.vatCode ?? '', bankCode: extractedParty.bankCode ?? '', role: props.kind === 'sale' ? 'client' : 'furnizor' } }).select('id').single();
        if (error) throw error; partnerId = data.id; await qc.invalidateQueries({ queryKey: ['catalog', props.companyId, 'partner'] });
      }
      let details: Invoice = activeInvoice ? { ...activeInvoice, version: 2, mode: 'complete' } : { ...emptyInvoice(docNumber, docDate), mode: 'simple', net: value, vat: 0, total: value, supplier: { ...emptyParty(), name: props.kind === 'expense' ? docPartner : company.name }, customer: { ...emptyParty(), name: props.kind === 'sale' ? docPartner : company.name }, attachment: existing?.attachment ?? null };
      if (file) {
        const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
        const path = `${props.companyId}/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from('invoice-attachments').upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) throw upload.error;
        uploadedPath = path; details = { ...details, attachment: { path, name: file.name.slice(0,200), type: file.type } };
      }
      const payload = { company_id: props.companyId, kind: props.kind, number: docNumber, date: docDate, partner_name: docPartner, partner_id: partnerId, description: description.trim() || invoice?.lines.map(l => l.name).filter(Boolean).join('; ') || '', total: value, invoice_details: details };
      const { error } = props.editing ? await supabase.from('documents').update(payload).eq('id', props.editing.id).eq('status', 'draft').select('id').single() : await supabase.from('documents').insert(payload);
      if (error) throw error;
      toast.success('Ciorna a fost salvată.'); props.onDone(); props.onClose();
    } catch (error) { if (uploadedPath) await supabase.storage.from('invoice-attachments').remove([uploadedPath]); toast.error(error instanceof Error ? error.message : 'Ciorna nu a putut fi salvată.'); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) props.onClose(); }}><DialogContent className={file || mode === 'complete' ? 'top-[5dvh] block max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl translate-y-0 space-y-4 overflow-y-auto' : 'top-[5dvh] block max-h-[90dvh] translate-y-0 space-y-4 overflow-y-auto'}>
    <DialogHeader><DialogTitle className="font-display text-2xl">{props.editing ? `Modifică factura ${props.editing.number}` : `${names.single} nouă`}</DialogTitle><DialogDescription>Document în ciornă</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1" role="group" aria-label="Mod de introducere"><Button type="button" size="sm" variant={mode === 'simple' ? 'default' : 'outline'} onClick={() => switchMode('simple')}>Simplu</Button><Button type="button" size="sm" variant={mode === 'complete' ? 'default' : 'outline'} onClick={() => switchMode('complete')}>Complet</Button></div>
      <input ref={attachmentInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-label="Atașament factură" className="hidden" onChange={e => { const selected = e.target.files?.[0]; if (selected) attach(selected); e.target.value = ''; }} />
      <Button type="button" variant="outline" onClick={() => attachmentInput.current?.click()} disabled={scanning || busy}><Paperclip />Atașează factură</Button>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-label="Fișier factură" className="hidden" onChange={e => { const selected = e.target.files?.[0]; if (selected) void scan(selected); e.target.value = ''; }} />
      <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={scanning || busy}><ScanLine />Scanează factură cu AI</Button>
      {scanning && <><span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Se citește factura…</span><Button type="button" variant="ghost" onClick={() => { controller.current?.abort(); setScanning(false); }}><Square />Oprește</Button></>}
    </div>
    {scanError && <div role="alert" className="grid gap-2 text-sm text-destructive"><p>{scanError}</p>{paused && file && <Button type="button" variant="outline" onClick={() => void scan(file, true)}>Reia după restabilirea accesului</Button>}</div>}
    <div className={file ? 'grid min-w-0 items-start gap-6 lg:grid-cols-2' : ''}>
      {file && <div className="min-w-0 lg:sticky lg:top-0"><p className="mb-2 break-all text-sm text-muted-foreground">{file.name}</p>{preview && (file.type === 'application/pdf' ? <object data={preview} type="application/pdf" aria-label="Previzualizare factură" className="h-[55dvh] w-full border"><a href={preview} target="_blank" rel="noreferrer">Deschide PDF</a></object> : <img src={preview} alt="Factura încărcată" className="max-h-[65dvh] w-full object-contain" />)}</div>}
      <form onSubmit={save} className="grid min-w-0 gap-4">
        {invoice && mode === 'complete' ? <><label className="grid gap-1.5 text-sm"><span>{names.partner}</span><Input aria-label={`Selectează ${names.partner.toLowerCase()}`} list="invoice-partners" value={invoiceParty(invoice, props.kind).name ?? ''} onChange={e => { const row = props.partners.find(p => p.name === e.target.value); changed({ ...invoice, [props.kind === 'sale' ? 'customer' : 'supplier']: row ? partyFromCatalog(row) : { ...invoiceParty(invoice, props.kind), name: e.target.value } }); }} /><datalist id="invoice-partners">{props.partners.map(p => <option key={p.id} value={p.name} />)}</datalist></label><InvoiceFields invoice={invoice} onChange={changed} />
          {warnings.length > 0 && <div role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">{warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}
          <p className="text-sm text-muted-foreground">{matched ? `Partener selectat după cod fiscal: ${matched.name}` : 'Partenerul nu a fost găsit după codul fiscal.'}</p>
          {!matched && <label className="flex items-center gap-2 text-sm"><Checkbox checked={createPartner} onCheckedChange={v => setCreatePartner(v === true)} />Creează partenerul în nomenclator</label>}
          <p className="text-sm text-muted-foreground">TVA extras din factură. Regulile contabile demo rămân neschimbate și necesită validarea unui contabil.</p>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={reviewed} onCheckedChange={v => setReviewed(v === true)} />Am verificat datele și totalurile facturii</label>
        </> : <>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5"><Label>Număr</Label><Input aria-label="Număr" value={number} onChange={e => setNumber(e.target.value)} required /></label><label className="grid gap-1.5"><Label>Data</Label><Input aria-label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} required /></label></div>
          <label className="grid gap-1.5"><Label>{names.partner}</Label><Input aria-label={names.partner} list="partners" value={partner} onChange={e => selectPartner(e.target.value)} placeholder="Alege sau scrie numele" /><datalist id="partners">{props.partners.map(p => <option key={p.id} value={p.name} />)}</datalist></label>
          <label className="grid gap-1.5"><Label>Total, {invoice?.currency ?? 'MDL'}</Label><Input aria-label={`Total, ${invoice?.currency ?? 'MDL'}`} inputMode="decimal" value={total} readOnly={!!invoice?.lines.length} onChange={e => { setTotal(e.target.value); setReviewed(false); }} placeholder="0,00" /></label>
          {invoice && <label className="flex items-start gap-2 text-sm"><Checkbox checked={reviewed} onCheckedChange={v => setReviewed(v === true)} />Am verificat datele și totalurile facturii</label>}
        </>}
        {!file && existing?.attachment && <InvoiceAttachment attachment={existing.attachment} />}
        {invoice && mode === 'complete' && invoice.currency !== 'MDL' && <p className="text-sm font-medium">Echivalent contabil: {((invoiceMdlTotal(invoice) ?? 0) / 100).toFixed(2)} MDL</p>}
        <label className="grid gap-1.5"><Label>Descriere</Label><Input aria-label="Descriere" value={description} onChange={e => setDescription(e.target.value)} placeholder="Servicii de consultanță" /></label>
        <DialogFooter><Button type="button" variant="ghost" onClick={props.onClose} disabled={busy}>Renunță</Button><Button type="submit" disabled={busy || scanning || (!!invoice && !reviewed)}>{busy ? 'Se salvează…' : 'Salvează ciorna'}</Button></DialogFooter>
      </form>
    </div>
  </DialogContent></Dialog>;
}