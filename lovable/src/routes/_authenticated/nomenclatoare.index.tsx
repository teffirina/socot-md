import { pageMeta } from "@/lib/page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { catalogKinds, catalogNames } from "@/lib/catalog";
import { PageHeading } from "@/components/page-heading";

export const Route = createFileRoute("/_authenticated/nomenclatoare/")({
  head: () => pageMeta("Nomenclatoare — Socot", "Gestionează datele de referință folosite în documente."),
  component: () => (
    <>
      <PageHeading eyebrow="Organizare" title="Nomenclatoare" subtitle="Datele de referință folosite în documente." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-t="catalog-grid">
        {catalogKinds.map((k) => (
          <Link key={k} to="/nomenclatoare/$kind" params={{ kind: k }} className="rounded-xl border bg-card p-4 font-semibold shadow-soft transition hover:border-success hover:text-success">
            {catalogNames[k]} →
          </Link>
        ))}
      </div>
    </>
  ),
});
