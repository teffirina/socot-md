import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { membershipQuery, useMembership } from "@/lib/company";
import { documentsQuery, type DocKind } from "@/lib/documents";
import { money } from "@/lib/money";
import { Empty, PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { ReconciliationActDialog } from "@/components/reconciliation-act";

export const Route = createFileRoute("/_authenticated/rapoarte")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(documentsQuery(m.company.id));
  },
  head: () => pageMeta("Rapoarte — Socot", "Vezi creanțele și datoriile firmei, grupate pe parteneri."),
  component: Reports,
});

function Reports() {
  const { company } = useMembership();
  const { data: docs } = useSuspenseQuery(documentsQuery(company.id));
  const [kind, setKind] = useState<DocKind>("sale");
  const [actOpen, setActOpen] = useState(false);

  const rows = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; count: number }>();
    for (const d of docs.filter((x) => x.kind === kind && x.status === "confirmed")) {
      const r = map.get(d.partner_name) ?? { total: 0, paid: 0, count: 0 };
      r.total += d.total;
      r.paid += d.paid;
      r.count++;
      map.set(d.partner_name, r);
    }
    return [...map.entries()].sort((a, b) => b[1].total - b[1].paid - (a[1].total - a[1].paid));
  }, [docs, kind]);

  function exportCsv() {
    const csv = ["Partener;Documente;Total;Achitat;Rest", ...rows.map(([n, r]) => `${n};${r.count};${r.total / 100};${r.paid / 100};${(r.total - r.paid) / 100}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = kind === "sale" ? "creante.csv" : "datorii.csv";
    a.click();
  }

  return (
    <>
      <PageHeading
        eyebrow="Rapoarte"
        title={kind === "sale" ? "Situația creanțelor" : "Datorii față de furnizori"}
        subtitle="Documente confirmate, grupate pe partener."
        actions={
          <span className="flex flex-wrap gap-2" data-t="report-actions">
            <Button variant={kind === "sale" ? "default" : "outline"} onClick={() => setKind("sale")}>Creanțe</Button>
            <Button variant={kind === "expense" ? "default" : "outline"} onClick={() => setKind("expense")}>Datorii</Button>
            <Button variant="ghost" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
            {kind === "sale" && <Button variant="outline" data-t="report-act" onClick={() => setActOpen(true)}>Act de verificare</Button>}
          </span>
        }
      />
      {actOpen && <ReconciliationActDialog onClose={() => setActOpen(false)} />}
      {rows.length === 0 ? (
        <Empty>Nu există documente confirmate.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft" data-t="report-table">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Partener</th>
                <th className="p-3 text-right">Documente</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Achitat</th>
                <th className="p-3 text-right">Rest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, r]) => (
                <tr key={name} className="border-b last:border-0">
                  <td className="p-3 font-medium">{name}</td>
                  <td className="p-3 text-right tabular">{r.count}</td>
                  <td className="p-3 text-right tabular">{money(r.total)}</td>
                  <td className="p-3 text-right tabular">{money(r.paid)}</td>
                  <td className="p-3 text-right font-semibold tabular">{money(r.total - r.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
