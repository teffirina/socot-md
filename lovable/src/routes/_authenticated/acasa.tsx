import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, useMembership } from "@/lib/company";
import { catalogQuery, documentsQuery, summarize, type DocKind } from "@/lib/documents";
import { dashboardMoney, dashboardDate, demoDocuments } from "@/lib/dashboard-demo";
import { DashboardCharts } from "@/components/dashboard-charts";
import { UniversalSearch } from "@/components/universal-search";
import { QuickNew } from "@/components/quick-new";
import { DocumentCreateDialog } from "@/components/document-create-dialog";
import { Plus, ArrowRight, ArrowUpRight } from "lucide-react";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/acasa")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await Promise.all([context.queryClient.ensureQueryData(documentsQuery(m.company.id)),context.queryClient.ensureQueryData(catalogQuery(m.company.id,"partner"))]);
  },
  head: () => ({ meta: [
    { title: "Acasă — Socot" },
    { name: "description", content: "Privirea de ansamblu a firmei: vânzări, cheltuieli și profit brut în MDL pentru perioada aleasă." },
    { property: "og:title", content: "Acasă — Socot" },
    { property: "og:description", content: "Indicatorii financiari ai firmei și profitul brut pentru perioada aleasă." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Home,
});

function Home() {
  const { role, company } = useMembership();
  const { data: docs } = useSuspenseQuery(documentsQuery(company.id));
  const { data: partners } = useSuspenseQuery(catalogQuery(company.id, "partner"));
  const [demo, setDemo] = useState(true);
  const [creating, setCreating] = useState(false);
  const [kind] = useState<DocKind>("sale");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qc = useQueryClient();
  const invalidPeriod = Boolean(from && to && from > to);
  const s = summarize(docs, { from, to });
  const rows = demo ? demoDocuments : docs.slice(0,6).map(d => ({date:dashboardDate(d.date),name:d.number,partner:d.partner_name,accounts:d.kind === "sale" ? "Dt 221 · Ct 611" : "Dt 713 · Ct 521",amount:d.total,state:d.status === "draft" ? "Ciornă" : "Contabilizat"}));
  const balances = demo ? [
    ["BANCĂ",18426050,"Extras importat la 09:40"], ["CASĂ",831500,"Ultima operație: 16.10.2026"],
    ["DE ÎNCASAT",4682000,"2 facturi cu restanță"], ["DE PLĂTIT",1840000,"Scadență: 25.10.2026"],
  ] as const : [["VÂNZĂRI CONFIRMATE",s.sales,"Documente confirmate"],["CHELTUIELI CONFIRMATE",s.expenses,"Documente confirmate"],["DE ÎNCASAT",s.receivable,"Soldul documentelor"],["DE PLĂTIT",s.payable,"Soldul documentelor"]] as const;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-5 lg:pr-[150px]">
      <div><p className="eyebrow">Sâmbătă, 17.10.2026 · Perioada: octombrie</p><h1 className="mt-2 font-display text-[34px] font-medium leading-10">Acasă</h1></div>
      <div className="flex min-w-0 flex-wrap items-center gap-3" data-t="home-actions">
        {demo && <span className="rounded-full bg-warning-foreground px-3 py-1 text-xs font-medium text-warning">Date demonstrative</span>}
        <UniversalSearch/>
        <QuickNew key={company.id}/>
        {can(role,"write") && <Button onClick={()=>setCreating(true)}><Plus/>Document nou</Button>}
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex gap-1 rounded-lg border p-1" role="group" aria-label="Sursa datelor" data-t="home-source"><Button size="sm" variant={demo ? "secondary" : "ghost"} aria-pressed={demo} onClick={()=>setDemo(true)}>Exemplu demonstrativ</Button><Button size="sm" variant={!demo ? "secondary" : "ghost"} aria-pressed={!demo} onClick={()=>setDemo(false)}>Datele firmei</Button></div>
      {!demo && <div className="flex flex-wrap items-center gap-2"><Label htmlFor="profit-from">De la</Label><Input id="profit-from" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-40 bg-card"/><Label htmlFor="profit-to">Până la</Label><Input id="profit-to" type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-40 bg-card"/>{(from||to) && <Button variant="ghost" onClick={()=>{setFrom("");setTo("");}}>Toată perioada</Button>}</div>}
    </div>
    <section className="dashboard-balances" aria-label="Solduri" data-t="home-balances">
      {balances.map(([label,value,note],i)=><article key={label} className="rounded-xl border bg-card p-5"><p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-3 font-display text-[22px] font-semibold tabular">{dashboardMoney(value)}</p><p className={`mt-2 text-xs ${demo && i===2 ? "text-destructive" : "text-muted-foreground"}`}>{note}</p></article>)}
    </section>
    <section className="dashboard-panel" data-t="home-flux"><h2>Fluxul documentelor</h2><div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <Link to="/documente/$kind" params={{kind:"sale"}} className="flex items-center gap-3 text-sm">Documente <strong className="font-display text-[22px]">{demo ? 24 : docs.length}</strong></Link><ArrowRight className="size-4 text-success"/>
      <Link to="/documente/$kind" params={{kind:"expense"}} className="flex items-center gap-3 text-sm">Verificare <strong className="font-display text-[22px]">{demo ? 6 : s.drafts}</strong></Link><ArrowRight className="size-4 text-success"/>
      <Link to="/contabilitate" className="flex items-center gap-3 text-sm">Înregistrare <strong className="font-display text-[22px]">{demo ? 17 : docs.filter(d=>d.status==="confirmed").length}</strong></Link><ArrowRight className="size-4 text-success"/>
      <div><Link to="/contabilitate" hash="rulaje" className="text-sm font-medium">Balanța · octombrie</Link><p className="mt-1 flex items-center gap-2 text-xs text-success"><span className="size-1.5 rounded-full bg-success"/>{demo ? "Se închide" : "Rulaje pe conturi"}</p></div>
    </div></section>
    {demo ? <DashboardCharts/> : <section className="dashboard-panel bg-highlight"><h2>Profit brut</h2>{invalidPeriod ? <p role="alert" className="mt-3 text-destructive">Data de început trebuie să fie înaintea datei de sfârșit.</p> : <p className={`mt-3 font-display text-[22px] font-semibold tabular ${s.grossProfit > 0 ? "text-success" : s.grossProfit < 0 ? "text-destructive" : ""}`}>{dashboardMoney(s.grossProfit)}</p>}<p className="mt-2 text-sm text-muted-foreground">Venituri confirmate − cheltuieli confirmate</p></section>}
    <div className="flex flex-wrap gap-5">
      <section className="dashboard-panel min-w-0 flex-[999_1_620px] !p-0" data-t="home-docs">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6"><h2>Documente recente</h2><Link to="/contabilitate" className="flex items-center gap-1 text-sm font-medium text-success">Vezi registrul <ArrowUpRight className="size-4"/></Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[13px]"><thead className="border-y text-[10px] tracking-[0.1em] text-muted-foreground"><tr>{["DATA","DOCUMENT","CONTURI","SUMA, MDL","STARE"].map((c,i)=><th key={c} className={`px-5 py-3 font-semibold ${i===3 ? "text-right" : ""}`}>{c}</th>)}</tr></thead><tbody>{rows.map((d,i)=><tr key={i} className="border-b last:border-0"><td className="whitespace-nowrap px-5 py-4 font-mono text-[11px]">{d.date}</td><td className="px-5 py-4"><p className="whitespace-nowrap font-medium">{d.name}</p><p className="mt-1 text-xs text-muted-foreground">{d.partner}</p></td><td className="whitespace-nowrap px-5 py-4 font-mono text-[11px]">{d.accounts}</td><td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular">{dashboardMoney(d.amount,false)}</td><td className="px-5 py-4"><span className={`status-pill ${d.state === "Contabilizat" ? "bg-success-foreground text-success" : d.state === "Verificat" ? "bg-verified-background text-verified" : d.state === "Restanță" ? "bg-overdue-background text-destructive" : "bg-warning-foreground text-warning"}`}>{d.state}</span></td></tr>)}</tbody></table>{!rows.length && <p className="p-6 text-sm text-muted-foreground">Încă nu ai documente.</p>}</div>
      </section>
      <section className="dashboard-panel min-w-0 flex-[1_1_260px] bg-highlight"><h2>Ce urmează</h2><div className="mt-4 divide-y divide-highlight-border">
        {demo ? [["25.10.2026","Achită 5 facturi către furnizori","18 400,00 MDL în total"],["31.10.2026","Verifică 6 documente în așteptare","Apoi le poți înregistra"],["31.10.2026","Închide luna și generează balanța","Raportul nu se transmite automat la SFS."]].map(([date,title,note])=><div key={title} className="py-4"><p className="font-mono text-xs text-success">{date}</p><p className="mt-2 text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>) : <><div className="py-4"><Link to="/documente/$kind" params={{kind:"expense"}} className="text-sm font-medium text-success">Verifică documentele de cumpărare</Link><p className="mt-2 text-xs text-muted-foreground">{s.drafts} ciorne în așteptare</p></div><div className="py-4"><Link to="/banca" className="text-sm font-medium text-success">Înregistrează încasări și plăți</Link></div><div className="py-4"><Link to="/nomenclatoare/$kind" params={{kind:"partner"}} className="text-sm font-medium text-success">Clienți și furnizori</Link></div></>}
      </div></section>
    </div>
    <p className="text-xs text-muted-foreground">Model contabil demonstrativ — necesită validarea unui contabil.{demo ? " Sumele afișate sunt exemple, nu soldurile firmei." : ""}</p>
    {creating && <DocumentCreateDialog kind={kind} companyId={company.id} partners={partners} nextNumber={String(docs.filter(d=>d.kind===kind).length+1).padStart(6,"0")} documents={docs} onClose={()=>setCreating(false)} onDone={()=>{setCreating(false);void qc.invalidateQueries({queryKey:["documents"]});void qc.invalidateQueries({queryKey:["catalog"]});}}/>}
  </div>;
}
