import { pageMeta } from "@/lib/page-meta";
import { recordSearch } from "@/lib/search";
import { RecordFocus, focusedRecordClass } from "@/components/record-focus";
import { createFileRoute, notFound, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership } from "@/lib/company";
import { catalogQuery } from "@/lib/documents";
import { catalogFields, catalogKinds, catalogNames, validateCatalog, type CatalogKind } from "@/lib/catalog";
import { can } from "@/lib/permissions";
import { Empty, PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/nomenclatoare/$kind")({
  validateSearch: recordSearch,
  loader: async ({ params, context }) => {
    if (!catalogKinds.includes(params.kind as CatalogKind)) throw notFound();
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(catalogQuery(m.company.id, params.kind));
  },
  head: ({ params }) => pageMeta(`${catalogNames[params.kind as CatalogKind] ?? "Nomenclator"} — Socot`, `Date de referință: ${catalogNames[params.kind as CatalogKind] ?? "Nomenclator"}.`),
  component: CatalogPage,
});

export function CatalogBackButton() {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <Button variant="ghost" className="mb-2 text-success" disabled={!canGoBack} onClick={() => router.history.back()} data-t="catalog-back">
      <ArrowLeft aria-hidden="true" />
      Înapoi
    </Button>
  );
}

function CatalogPage() {
  const { record } = Route.useSearch();
  const kind = Route.useParams().kind as CatalogKind;
  const { role, company } = useMembership();
  const editable = can(role, "catalog");
  const qc = useQueryClient();
  const { data: rows } = useSuspenseQuery(catalogQuery(company.id, kind));
  const fields = catalogFields[kind];
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});

  async function add(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const err = validateCatalog(kind, code, name, details);
    if (err) return void toast.error(err);
    const { error } = await supabase.from("catalog_entries").insert({ company_id: company.id, kind, code: code.trim(), name: name.trim(), details });
    if (error) return void toast.error(error.code === "23505" ? "Codul există deja." : error.message);
    setCode("");
    setName("");
    setDetails({});
    qc.invalidateQueries({ queryKey: ["catalog", company.id, kind] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("catalog_entries").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["catalog", company.id, kind] });
  }

  return (
    <>
      <RecordFocus record={record} ready={rows} />
      <CatalogBackButton />
      <PageHeading title={catalogNames[kind]} />
      {editable && (
        <form onSubmit={add} className="mb-8 grid gap-3 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-4" data-t="catalog-form">
          <div className="grid gap-1.5">
            <Label>Cod</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Denumire</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label>{f.label}</Label>
              <Input placeholder={f.placeholder} value={details[f.key] ?? ""} onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })} />
            </div>
          ))}
          <div className="flex items-end">
            <Button type="submit">Adaugă</Button>
          </div>
        </form>
      )}
      {rows.length === 0 ? (
        <Empty>Nicio înregistrare încă.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft" data-t="catalog-table">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Cod</th>
                <th className="p-3">Denumire</th>
                {fields.map((f) => <th key={f.key} className="p-3">{f.label}</th>)}
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = r.details as Record<string, string>;
                return (
                  <tr key={r.id} id={`record-${r.id}`} tabIndex={r.id === record ? -1 : undefined} className={`border-b last:border-0 ${focusedRecordClass(r.id === record)}`}>
                    <td className="p-3 font-medium">{r.code}</td>
                    <td className="p-3">{r.name}</td>
                    {fields.map((f) => <td key={f.key} className="p-3">{d?.[f.key]}</td>)}
                    <td className="p-3 text-right">
                      {editable && <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Șterge</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
