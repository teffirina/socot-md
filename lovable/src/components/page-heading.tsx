import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-4xl font-medium">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "warning" | "positive" | "negative" }) {
  const toneClass = tone === "accent" ? "bg-accent text-accent-foreground" : tone === "warning" ? "bg-warning/25" : "bg-card";
  const valueClass = tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : "";
  return (
    <article className={`rounded-2xl border p-5 shadow-soft ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className={`mt-3 break-words font-display text-3xl tabular ${valueClass}`}>{value}</p>
    </article>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{children}</div>;
}
