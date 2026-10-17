import { pageMeta } from "@/lib/page-meta";
import { recordSearch } from "@/lib/search";
import { RecordFocus, focusedRecordClass } from "@/components/record-focus";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { membershipQuery, useMembership } from "@/lib/company";
import { paymentsQuery } from "@/lib/documents";
import { money } from "@/lib/money";
import { Empty, Metric, PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/banca")({
  validateSearch: recordSearch,
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(paymentsQuery(m.company.id));
  },
  head: () => pageMeta("Bancă și casă — Socot", "Urmărește încasările și plățile firmei."),
  component: Bank,
});

function Bank() {
  const { record } = Route.useSearch();
  const { company } = useMembership();
  const { data: payments } = useSuspenseQuery(paymentsQuery(company.id));
  const inflow = payments.filter((p) => p.documents?.kind === "sale").reduce((a, p) => a + p.amount, 0);
  const outflow = payments.filter((p) => p.documents?.kind === "expense").reduce((a, p) => a + p.amount, 0);
  return (
    <>
      <RecordFocus record={record} ready={payments} />
      <PageHeading
        eyebrow="Activitate"
        title="Bancă și casă"
        subtitle="Încasările și plățile asociate documentelor."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/nomenclatoare/$kind" params={{ kind: "bank" }}>Conturi bancare</Link></Button>
            <Button asChild variant="outline"><Link to="/nomenclatoare/$kind" params={{ kind: "cash" }}>Casierii</Link></Button>
          </>
        }
      />
      <section className="mb-10 grid gap-4 sm:grid-cols-3" data-t="bank-metrics">
        <Metric label="Încasat" value={money(inflow)} tone="accent" />
        <Metric label="Plătit" value={money(outflow)} />
        <Metric label="Sold din operațiuni" value={money(inflow - outflow)} />
      </section>
      {payments.length === 0 ? (
        <div data-t="bank-list"><Empty>Încasările și plățile apar aici după ce le înregistrezi pe documente.</Empty></div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-soft" data-t="bank-list">
          {payments.map((p) => (
            <li key={p.id} id={`record-${p.id}`} tabIndex={p.id === record ? -1 : undefined} className={`flex items-center justify-between p-4 text-sm ${focusedRecordClass(p.id === record)}`}>
              <div>
                <p className="font-medium">{p.documents?.partner_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.date} · {p.documents?.number} · {p.documents?.kind === "sale" ? "încasare" : "plată"}
                </p>
              </div>
              <span className={`tabular font-semibold ${p.documents?.kind === "sale" ? "text-success" : ""}`}>
                {p.documents?.kind === "sale" ? "+" : "−"}
                {money(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
