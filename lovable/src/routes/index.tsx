import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Socot — spațiul financiar al afacerii tale" },
      { name: "description", content: "Facturi, încasări, plăți și articole contabile într-o aplicație simplă, în limba română." },
      { property: "og:title", content: "Socot — spațiul financiar al afacerii tale" },
      { property: "og:description", content: "Facturi, încasări, plăți și articole contabile într-o aplicație simplă, în limba română." },
    ],
  }),
  component: Landing,
});

export function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-2xl font-semibold ${className}`}>
      <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0"><path d="M62 29H38A10.5 10.5 0 0 0 38 50H54A10.5 10.5 0 0 1 54 71H30" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/><circle cx="76" cy="71" r="6.5" fill="currentColor"/></svg>
      Socot
    </span>
  );
}

function Landing() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground">
        <Mark />
        <div className="relative z-10 max-w-lg py-16">
          <p className="eyebrow !text-accent">Un spațiu pentru afacerea ta</p>
          <h1 className="mt-4 font-display text-5xl font-medium leading-[1.05]">
            Cifrele firmei, <em className="text-accent">în ordine</em>, fără bătăi de cap.
          </h1>
          <p className="mt-6 text-lg opacity-80">
            Documente de vânzare și cumpărare, încasări, datorii și articole contabile — totul într-un singur loc, în română.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-24 bottom-[-6rem] size-[28rem] rounded-full bg-hero opacity-80 blur-sm" />
        <p className="relative z-10 text-sm opacity-60">Model demonstrativ de contabilitate. Necesită validarea unui contabil.</p>
      </section>
      <section className="flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Bine ai venit</p>
          <h2 className="mt-3 font-display text-3xl">Intră în Socot</h2>
          <p className="mt-2 text-muted-foreground">Spațiul tău financiar, la îndemână.</p>
          <div className="mt-8 grid gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Autentificare</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signup" }}>
                Creează cont și întreprindere
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
