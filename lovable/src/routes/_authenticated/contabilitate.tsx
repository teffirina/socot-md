import { pageMeta } from "@/lib/page-meta";
import { recordSearch } from "@/lib/search";
import { accounts } from "@/lib/accounts";
import { RecordFocus, focusedRecordClass } from "@/components/record-focus";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership } from "@/lib/company";
import { journalQuery, operationNames } from "@/lib/documents";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { Empty, PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/contabilitate")({
  validateSearch: recordSearch,
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (can(m.role, "journal.read")) await context.queryClient.ensureQueryData(journalQuery(m.company.id));
  },
  head: () => pageMeta("Contabilitate — Socot", "Consultă operațiunile și articolele contabile ale firmei."),
  component: Ledger,
});

function Ledger() {
  const { role, company } = useMembership();
  if (!can(role, "journal.read")) return <Empty>Rolul tău nu are acces la contabilitate.</Empty>;
  return <LedgerInner companyId={company.id} canPost={can(role, "journal.post")} />;
}

function LedgerInner({ companyId, canPost }: { companyId: string; canPost: boolean }) {
  const { record, account } = Route.useSearch();
  const qc = useQueryClient();
  const { data: entries } = useSuspenseQuery(journalQuery(companyId));
  const post = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("post_entry", { _entry: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Articolul a fost postat.");
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balances = useMemo(() => {
    const b: Record<string, { debit: number; credit: number }> = {};
    for (const e of entries.filter((x) => x.state === "posted")) {
      (b[e.debit] ??= { debit: 0, credit: 0 }).debit += e.amount;
      (b[e.credit] ??= { debit: 0, credit: 0 }).credit += e.amount;
    }
    if (account && (accounts[account] || entries.some((e) => e.debit === account || e.credit === account))) b[account] ??= { debit: 0, credit: 0 };
    return Object.entries(b).sort(([a], [c]) => a.localeCompare(c));
  }, [entries, account]);

  return (
    <>
      <RecordFocus record={record ?? account} ready={balances} />
      <PageHeading
        eyebrow="Evidență"
        title="Contabilitate"
        subtitle="Articolele propuse din documente. Model demonstrativ, fără TVA — necesită validarea unui contabil."
      />
      {balances.length > 0 && (
        <section id="rulaje" className="mb-10">
          <h2 className="mb-3 font-display text-xl">Rulaje pe conturi (postate)</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map(([acc, v]) => (
              <div key={acc} id={`record-${acc}`} tabIndex={acc === account ? -1 : undefined} className={`rounded-xl border bg-card p-4 shadow-soft ${focusedRecordClass(acc === account)}`}>
                <p className="font-semibold">
                  {acc} <span className="font-normal text-muted-foreground">{accounts[acc]}</span>
                </p>
                <p className="mt-2 text-sm tabular">
                  Dt {money(v.debit)} · Ct {money(v.credit)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      <h2 className="mb-3 font-display text-xl">Jurnalul operațiunilor</h2>
      {entries.length === 0 ? (
        <Empty>Articolele apar aici după confirmarea documentelor.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft" data-t="journal-table">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Operațiune</th>
                <th className="p-3">Document</th>
                <th className="p-3">Debit</th>
                <th className="p-3">Credit</th>
                <th className="p-3 text-right">Suma</th>
                <th className="p-3">Stare</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} id={`record-${e.id}`} tabIndex={e.id === record ? -1 : undefined} className={`border-b last:border-0 ${focusedRecordClass(e.id === record)}`}>
                  <td className="p-3 tabular">{e.date}</td>
                  <td className="p-3">{operationNames[e.operation]}</td>
                  <td className="p-3">
                    {e.documents?.number} · {e.documents?.partner_name}
                  </td>
                  <td className="p-3 font-medium">{e.debit}</td>
                  <td className="p-3 font-medium">{e.credit}</td>
                  <td className="p-3 text-right tabular">{money(e.amount)}</td>
                  <td className="p-3">
                    {e.state === "posted" ? (
                      <Badge className="bg-success text-success-foreground">Postat</Badge>
                    ) : canPost ? (
                      <Button size="sm" variant="outline" onClick={() => post.mutate(e.id)} disabled={post.isPending}>
                        Postează
                      </Button>
                    ) : (
                      <Badge variant="outline">Propus</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
