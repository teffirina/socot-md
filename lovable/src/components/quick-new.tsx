import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, ChevronDown, FilePlus2, FileMinus2, Receipt, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useMembership } from "@/lib/company";
import { catalogQuery, documentsQuery, type Doc } from "@/lib/documents";
import type { Tables } from "@/integrations/supabase/types";
import { availableQuickOperations, payableDocuments, type QuickOperation } from "@/lib/quick-new";
import { money } from "@/lib/money";
import { DocumentCreateDialog } from "./document-create-dialog";
import { PayDialog } from "./payment-dialog";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

const icons = { sale: FilePlus2, purchase: FileMinus2, expense: Receipt, receipt: ArrowDownLeft, payment: ArrowUpRight };

export function QuickNew() {
  const { company, role } = useMembership();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const operations = availableQuickOperations(role);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{ companyId: string; operation: QuickOperation; documents: Doc[]; partners: Tables<"catalog_entries">[] } | null>(null);
  const [paying, setPaying] = useState<Doc | null>(null);
  const [query, setQuery] = useState("");
  if (!operations.length) return null;
  const active = session?.companyId === company.id ? session : null;

  async function open(operation: QuickOperation) {
    setBusy(true);
    try {
      const [documents, partners] = await Promise.all([
        qc.fetchQuery(documentsQuery(company.id)),
        qc.ensureQueryData(catalogQuery(company.id, "partner")),
      ]);
      setPaying(null); setQuery(""); setSession({ companyId: company.id, operation, documents, partners });
    } catch { toast.error("Datele nu au putut fi încărcate. Încearcă din nou."); }
    finally { setBusy(false); }
  }
  const refresh = () => {
    for (const key of ["documents", "journal", "payments", "catalog"]) void qc.invalidateQueries({ queryKey: [key, company.id] });
    if (active) void navigate({ to: "/documente/$kind", params: { kind: active.operation.kind } });
  };
  const close = () => { setSession(null); setPaying(null); };
  const payment = active?.operation.id === "receipt" || active?.operation.id === "payment";
  const eligible = active ? payableDocuments(active.documents, company.id, active.operation.kind).filter(doc => `${doc.number} ${doc.partner_name}`.toLocaleLowerCase("ro").includes(query.toLocaleLowerCase("ro"))) : [];

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="secondary" disabled={busy} className="shrink-0 rounded-lg border border-highlight-border" aria-label="Nou"> <Plus />{busy ? "Se deschide…" : "Nou"}<ChevronDown className="size-3.5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-2rem)] rounded-lg p-2 shadow-none">
        {["Vânzări și cumpărări", "Bancă și casă"].map((group, index) => <DropdownMenuGroup key={group}>
          {index > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-xs text-muted-foreground">{group}</DropdownMenuLabel>
          {operations.filter(item => item.group === group).map(item => { const Icon = icons[item.id]; return <DropdownMenuItem key={item.id} className="min-h-10 gap-3 rounded-md" onSelect={() => void open(item)}><Icon className="text-success" />{item.label}</DropdownMenuItem>; })}
        </DropdownMenuGroup>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {active && !payment && <DocumentCreateDialog key={`${company.id}-${active.operation.id}`} kind={active.operation.kind} companyId={company.id} documents={active.documents} partners={active.partners} nextNumber={`${active.operation.kind === "sale" ? "V" : "C"}-${String(active.documents.filter(doc => doc.kind === active.operation.kind).length + 1).padStart(4, "0")}`} onClose={close} onDone={refresh} />}
    {active && payment && !paying && <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{active.operation.label}</DialogTitle><DialogDescription>Alege factura confirmată cu rest de {active.operation.kind === "sale" ? "încasat" : "plătit"}.</DialogDescription></DialogHeader>
      <Input aria-label="Caută factura" placeholder="Număr sau partener" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="divide-y">{eligible.map(doc => <Button key={doc.id} variant="ghost" className="h-auto min-h-14 w-full justify-between gap-3 whitespace-normal rounded-none py-3 text-left" onClick={() => setPaying(doc)}><span className="min-w-0 break-words">{doc.number}<span className="block text-xs font-normal text-muted-foreground">{doc.partner_name}</span></span><span className="shrink-0 tabular">{money(doc.total - doc.paid)}</span></Button>)}{!eligible.length && <p className="py-4 text-sm text-muted-foreground">Nu există facturi confirmate cu rest care corespund selecției.</p>}</div>
    </DialogContent></Dialog>}
    {active && payment && paying && <PayDialog key={paying.id} doc={paying} onClose={close} onDone={refresh} />}
  </>;
}