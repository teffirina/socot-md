import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findWorkspace, type WorkspaceAction } from "@/lib/workspaces";
import { PageHeading } from "@/components/page-heading";

export const Route = createFileRoute("/_authenticated/modul/$slug")({
  loader: ({ params }) => {
    const w = findWorkspace(params.slug);
    if (!w) throw notFound();
    return w;
  },
  head: ({ loaderData }) => pageMeta(`${loaderData?.title ?? "Modul"} — Socot`, loaderData?.subtitle ?? "Spațiul de lucru al firmei în Socot."),
  component: ModulePage,
});

function ActionLink({ a }: { a: WorkspaceAction }) {
  const cls = "group block rounded-xl border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-success";
  const body = (
    <>
      <p className="font-semibold group-hover:text-success">{a.title} →</p>
      <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
    </>
  );
  if (a.to === "/documente/$kind" || a.to === "/nomenclatoare/$kind")
    return (
      <Link to={a.to} params={{ kind: a.kind }} className={cls}>
        {body}
      </Link>
    );
  return (
    <Link to={a.to} className={cls}>
      {body}
    </Link>
  );
}

function ModulePage() {
  const w = Route.useLoaderData();
  return (
    <>
      <PageHeading eyebrow="Activitate" title={w.title} subtitle={w.subtitle} />
      <ol className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {w.steps.map((s, i) => (
          <li key={s} className="rounded-xl bg-primary p-4 text-primary-foreground">
            <span className="text-xs font-bold text-accent">PASUL {i + 1}</span>
            <p className="mt-1 text-sm">{s}</p>
          </li>
        ))}
      </ol>
      <div className="space-y-8">
        {w.groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 font-display text-xl">{g.title}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {g.actions.map((a) => (
                <ActionLink key={a.title} a={a} />
              ))}
            </div>
          </section>
        ))}
        <section className="rounded-2xl border border-dashed p-6">
          <h2 className="font-display text-xl">În pregătire</h2>
          <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {w.pending.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
