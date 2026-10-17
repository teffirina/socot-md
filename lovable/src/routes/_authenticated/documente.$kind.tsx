import { PayDialog } from "@/components/payment-dialog";
import { InvoicePrintDialog } from "@/components/invoice-print";
import { Printer } from "lucide-react";
import { DocumentCreateDialog } from "@/components/document-create-dialog";
import { InvoiceFields } from "@/components/invoice-fields";
import { readInvoice, paymentStatus } from "@/lib/invoice";
import { InvoiceAttachment } from "@/components/invoice-attachment";
import { pageMeta } from "@/lib/page-meta";
import { recordSearch } from "@/lib/search";
import { RecordFocus, focusedRecordClass } from "@/components/record-focus";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership } from "@/lib/company";
import { catalogQuery, documentsQuery, kindNames, type Doc, type DocKind } from "@/lib/documents";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { Empty, PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/documente/$kind")({
  validateSearch: recordSearch,
  loader: async ({ params, context }) => {
    if (params.kind !== "sale" && params.kind !== "expense") throw notFound();
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await Promise.all([
      context.queryClient.ensureQueryData(documentsQuery(m.company.id)),
      context.queryClient.ensureQueryData(catalogQuery(m.company.id, "partner")),
    ]);
  },
  head: ({ params }) => pageMeta(`${params.kind === "sale" ? "Vânzări" : "Cumpărări"} — Socot`, `Gestionează documentele de ${params.kind === "sale" ? "vânzare" : "cumpărare"} ale firmei.`),
  component: DocumentsPage,
});


function DocumentsPage() {
  const { record } = Route.useSearch();
  const kind = Route.useParams().kind as DocKind;
  const names = kindNames[kind];
  const { role, company } = useMembership();
  const writable = can(role, "write");
  const qc = useQueryClient();
  const { data: allDocs } = useSuspenseQuery(documentsQuery(company.id));
  const { data: partners } = useSuspenseQuery(catalogQuery(company.id, "partner"));
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [verifying, setVerifying] = useState<Doc | null>(null);
  const [paying, setPaying] = useState<Doc | null>(null);
  const [printing, setPrinting] = useState<Doc | null>(null);

  const docs = useMemo(
    () => allDocs.filter((d) => d.kind === kind && (d.id === record || (d.partner_name + d.number).toLowerCase().includes(query.toLowerCase()))),
    [allDocs, kind, query, record],
  );
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["journal"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  const confirm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("confirm_document", { _doc: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document confirmat. Articolul contabil a fost propus.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ciorna a fost ștearsă.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <RecordFocus record={record} ready={docs} />
      <PageHeading
        eyebrow={kind === "sale" ? "Vânzări" : "Cumpărări"}
        title={kind === 'sale' ? 'Facturi de vânzare' : 'Facturi de cumpărare'}
        subtitle="Salvează → Verifică → Înregistrează. Model contabil demonstrativ, de validat de un contabil."
        actions={writable && <span data-t="doc-new"><Button onClick={() => setCreating(true)}>Document nou</Button></span>}
      />
      <div className="mb-4" data-t="doc-search">
        <Input placeholder={`Caută după ${names.partner.toLowerCase()} sau număr`} value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm bg-card" />
      </div>
      {docs.length === 0 ? (
        <Empty>Niciun document încă.{writable && " Apasă „Document nou” pentru a începe."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft" data-t="doc-table">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Nr.</th>
                <th className="p-3">Data</th>
                <th className="p-3">{names.partner}</th>
                <th className="p-3 text-right">Total, MDL</th>
                <th className="p-3 text-right">Achitat</th>
                <th className="p-3 text-right">Rest</th>
                <th className="p-3">Statutul plății</th>
                <th className="p-3">Stare</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} id={`record-${d.id}`} tabIndex={d.id === record ? -1 : undefined} className={`border-b last:border-0 ${focusedRecordClass(d.id === record)}`}>
                  <td className="p-3 font-medium">{d.number}</td>
                  <td className="p-3 tabular">{d.date}</td>
                  <td className="p-3">
                    {d.partner_name}
                    {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  </td>
                  <td className="p-3 text-right tabular">{money(d.total)}{(() => { const i = readInvoice(d.invoice_details); return i && i.currency !== 'MDL' ? <p className="text-xs text-muted-foreground">{((i.total ?? 0) / 100).toFixed(2)} {i.currency}</p> : null; })()}</td>
                  <td className="p-3 text-right tabular">{money(d.paid)}</td>
                  <td className="p-3 text-right tabular">{money(d.total - d.paid)}</td>
                  <td className="p-3">{paymentStatus(d.total, d.paid)}</td>
                  <td className="p-3">
                    {d.status === "draft" ? (
                      <Badge variant="outline">Ciornă</Badge>
                    ) : d.paid >= d.total ? (
                      <Badge className="bg-success text-success-foreground">Achitat</Badge>
                    ) : (
                      <Badge className="bg-accent text-accent-foreground">Confirmat</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewing(d)}>Factură</Button>
                      <Button size="sm" variant="outline" data-t={d.id === docs[0]?.id ? "doc-print" : undefined} onClick={() => setPrinting(d)}><Printer />Tipărește</Button>
                      {writable && <>
                        {d.status === "draft" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditing(d)}>Modifică</Button>
                            {can(role, 'journal.post') && <Button size="sm" onClick={() => setVerifying(d)} disabled={confirm.isPending}>Verifică</Button>}
                            <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)}>
                              Șterge
                            </Button>
                          </>
                        )}
                        {d.status === "confirmed" && d.paid < d.total && (
                          <Button size="sm" variant="outline" onClick={() => setPaying(d)}>
                            {kind === "sale" ? "Încasare" : "Plată"}
                          </Button>
                        )}
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <DocumentCreateDialog
          kind={kind}
          companyId={company.id}
          partners={partners}
          documents={allDocs}
          nextNumber={`${kind === "sale" ? "V" : "C"}-${String(allDocs.filter((d) => d.kind === kind).length + 1).padStart(4, "0")}`}
          onClose={() => setCreating(false)}
          onDone={refresh}
        />
      )}
      {editing && <DocumentCreateDialog kind={kind} companyId={company.id} partners={partners} documents={allDocs} nextNumber={editing.number} editing={editing} onClose={() => setEditing(null)} onDone={refresh} />}
      {(viewing || verifying) && (() => { const doc = verifying ?? viewing; if (!doc) return null; const invoice = readInvoice(doc.invoice_details); return <Dialog open onOpenChange={open => { if (!open) { setViewing(null); setVerifying(null); } }}><DialogContent className="top-[5dvh] block max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl translate-y-0 space-y-4 overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-2xl">{verifying ? 'Verifică factura' : 'Factura'} {doc.number}</DialogTitle></DialogHeader>{invoice ? <><InvoiceAttachment attachment={invoice.attachment} /><InvoiceFields invoice={invoice} readOnly onChange={() => {}} /></> : <p>{doc.date} · {doc.partner_name} · {money(doc.total)}</p>}<div className="grid gap-2 border-t pt-4 text-sm sm:grid-cols-3"><p>Achitat: {money(doc.paid)}</p><p>Rest: {money(doc.total-doc.paid)}</p><p>{paymentStatus(doc.total, doc.paid)}</p></div>{verifying && <><p className="text-sm text-muted-foreground">Înregistrare propusă: {kind === 'sale' ? '221 / 611' : '713 / 521'} · {money(doc.total)}. Model demonstrativ fără separarea TVA în conturi, de validat de contabil.</p><DialogFooter><Button variant="ghost" onClick={() => setVerifying(null)}>Renunță</Button><Button disabled={confirm.isPending} onClick={() => confirm.mutate(doc.id, { onSuccess: () => setVerifying(null) })}>Confirmă verificarea și înregistrează</Button></DialogFooter></>}</DialogContent></Dialog>; })()}
      {paying && <PayDialog doc={paying} onClose={() => setPaying(null)} onDone={refresh} />}
      {printing && <InvoicePrintDialog doc={printing} onClose={() => setPrinting(null)} />}
    </>
  );
}
