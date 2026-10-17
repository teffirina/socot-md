import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, FileText, Search, Users, BookOpen, LoaderCircle } from "lucide-react";
import { useMembership } from "@/lib/company";
import { filterSearchResults, normalizeSearch, searchTypes, universalSearchQuery, type SearchGroup, type SearchResult, type SearchType } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = normalizeSearch(query.trim()).split(/\s+/).filter(Boolean);
  const normalized = normalizeSearch(text);
  const matched = Array.from(text, (_, i) => terms.some((term) => {
    let start = normalized.indexOf(term);
    while (start >= 0) {
      if (i >= start && i < start + term.length) return true;
      start = normalized.indexOf(term, start + 1);
    }
    return false;
  }));
  const parts: { text: string; mark: boolean }[] = [];
  Array.from(text).forEach((char, i) => {
    const mark = matched[i] ?? false;
    const last = parts.at(-1);
    if (last?.mark === mark) last.text += char;
    else parts.push({ text: char, mark });
  });
  return <>{parts.map((part, i) => part.mark ? <mark key={i} className="rounded-sm bg-accent text-accent-foreground">{part.text}</mark> : <span key={i}>{part.text}</span>)}</>;
}

export function UniversalSearch() {
  const { company, role } = useMembership();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<SearchGroup | "all">("all");
  const [type, setType] = useState<SearchType | "all">("all");
  const search = useQuery({ ...universalSearchQuery(company.id, role), enabled: open, refetchInterval: open ? 15000 : false });
  const results = useMemo(() => filterSearchResults(search.data ?? [], query, group, type), [search.data, query, group, type]);
  const groups: SearchGroup[] = ["Documente", "Parteneri", "Contabilitate"];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => qc.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (!["documents", "catalog", "payments", "journal"].includes(String(event.query.queryKey[0]))) return;
    if (event.action.type === "invalidate" || event.action.type === "success") {
      void qc.invalidateQueries({ queryKey: ["universal-search", company.id] });
    }
  }), [qc, company.id]);

  function select(r: SearchResult) {
    setOpen(false);
    if (r.type === "sale" || r.type === "expense") {
      void navigate({ to: "/documente/$kind", params: { kind: r.type }, search: { record: r.id } });
    } else if (r.type === "partner" || r.type === "contract") {
      void navigate({ to: "/nomenclatoare/$kind", params: { kind: r.type }, search: { record: r.id } });
    } else if (r.type === "receipt" || r.type === "payment") {
      void navigate({ to: "/banca", search: { record: r.id } });
    } else {
      void navigate({ to: "/contabilitate", search: r.type === "account" ? { account: r.id } : { record: r.id } });
    }
  }

  return <>
    <Button variant="outline" aria-label="Căutare universală" onClick={() => setOpen(true)} className="h-11 min-w-0 flex-1 justify-start gap-2 bg-card text-muted-foreground sm:max-w-[240px]">
      <Search className="size-4 shrink-0" />
      <span className="truncate">Caută document, client, cont</span>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="top-[12%] w-[calc(100%-2rem)] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Căutare universală</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput aria-label="Caută în Socot" placeholder="Denumire, număr, sumă…" value={query} onValueChange={setQuery} className="h-14 pr-10" />
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <Select value={group} onValueChange={(v) => setGroup(v as SearchGroup | "all")}>
              <SelectTrigger className="w-40" aria-label="Categoria rezultatelor"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Toate categoriile</SelectItem>{groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as SearchType | "all")}>
              <SelectTrigger className="w-44" aria-label="Tipul înregistrării"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Toate tipurile</SelectItem>{Object.entries(searchTypes).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
            {search.isFetching && <LoaderCircle className="ml-auto size-4 animate-spin text-muted-foreground" aria-label="Se caută" />}
          </div>
          <CommandList className="max-h-[55vh] min-h-24 p-2" aria-label="Rezultatele căutării">
            {search.isError ? <div role="alert" className="p-5 text-sm text-destructive">Căutarea nu este disponibilă momentan. <Button variant="ghost" size="sm" onClick={() => void search.refetch()}>Reîncearcă</Button></div> : !query.trim() ? <p className="p-5 text-sm text-muted-foreground">Căutare universală</p> : search.isPending ? <p role="status" className="p-5 text-sm text-muted-foreground">Se caută…</p> : !results.length ? <p role="status" className="p-5 text-sm text-muted-foreground">Niciun rezultat pentru „{query}”.</p> : groups.map((g) => {
              const items = results.filter((r) => r.group === g);
              if (!items.length) return null;
              const Icon = g === "Documente" ? FileText : g === "Parteneri" ? Users : BookOpen;
              return <CommandGroup key={g} heading={`${g} · ${items.length}`}>
                {items.slice(0, 100).map((r) => <CommandItem key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => select(r)} className="gap-3 p-3">
                  <Icon className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium"><Highlight text={r.title} query={query} /></p>
                    <p className="mt-1 break-words text-xs text-muted-foreground"><Highlight text={r.detail} query={query} /></p>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </CommandItem>)}
                {items.length > 100 && <p className="px-3 py-2 text-xs text-muted-foreground">100 din {items.length} rezultate</p>}
              </CommandGroup>;
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  </>;
}