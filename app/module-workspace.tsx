"use client";
import { useState } from "react";
import { normalizeSearch, type WorkspaceDefinition } from "../lib/workspaces";
import type { Snapshot } from "../lib/storage";
export default function ModuleWorkspace({
  module,
  snapshot,
  journalAccess,
  personnelAccess,
  navigate,
}: {
  module: WorkspaceDefinition;
  snapshot: Snapshot;
  journalAccess: boolean;
  personnelAccess: boolean;
  navigate: (target: string) => void;
}) {
  const [search, setSearch] = useState("");
  const kind =
    module.title === "Cumpărări"
      ? "expense"
      : module.title === "Vânzări"
        ? "sale"
        : null;
  const docs = snapshot.invoices.filter(
    (d) => kind && (d.kind ?? "sale") === kind,
  );
  const drafts = (snapshot.drafts ?? []).filter((d) => d.kind === kind);
  const due = docs.reduce((sum, d) => sum + d.total - d.paid, 0);
  const groups = module.groups
    .map((g) => ({
      ...g,
      actions: g.actions.filter(
        (a) =>
          (!a.journal || journalAccess) &&
          (a.target !== "catalog:employee" || personnelAccess) &&
          normalizeSearch(a.title + " " + a.description).includes(
            normalizeSearch(search),
          ),
      ),
    }))
    .filter((g) => g.actions.length);
  return (
    <div className="module-workspace">
      <section className="module-intro">
        <div>
          <span className="module-symbol" aria-hidden="true">
            {module.icon}
          </span>
          <p className="eyebrow">SPAȚIU DE LUCRU</p>
          <h2>
            {module.title === "Cumpărări"
              ? "Tot ce primești. Tot ce ai de plătit."
              : module.title === "Vânzări"
                ? "De la document la încasare."
                : module.title}
          </h2>
          <p>{module.subtitle}</p>
        </div>
        {kind && (
          <dl className="module-totals">
            <div>
              <dt>Ciorne locale</dt>
              <dd>{drafts.length}</dd>
            </div>
            <div>
              <dt>Documente confirmate</dt>
              <dd>{docs.length}</dd>
            </div>
            <div>
              <dt>{kind === "sale" ? "De încasat" : "De plată"}</dt>
              <dd>
                {(due / 100).toLocaleString("ro-MD", {
                  style: "currency",
                  currency: "MDL",
                })}
              </dd>
            </div>
          </dl>
        )}
      </section>
      {kind && (
        <p className="footnote">
          Indicatori din documentele descărcate pe acest dispozitiv; registrul
          online este limitat la 200 de documente. Ciornele și operațiunile în
          așteptare nu sunt incluse în sumele confirmate.
        </p>
      )}
      {!!module.steps.length && (
        <ol className="module-steps" aria-label="Ordinea de lucru">
          {module.steps.map((step, i) => (
            <li key={step}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      <label className="module-search">
        Găsește o funcție disponibilă
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Documente, plăți, parteneri…"
          type="search"
        />
      </label>
      <div className="module-groups">
        {groups.map((group) => (
          <section className="module-group" key={group.title}>
            <h3>{group.title}</h3>
            {group.actions.map((action) => (
              <button
                className="module-action"
                key={action.title}
                onClick={() => navigate(action.target)}
              >
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </section>
        ))}
      </div>
      {!groups.length && (
        <p role="status" className="empty">
          Nicio funcție disponibilă pentru această căutare.
        </p>
      )}
      <details className="module-coverage">
        <summary>
          Ce mai trebuie implementat în {module.title.toLocaleLowerCase("ro")} (
          {module.pending.length})
        </summary>
        <p>
          Aceste operațiuni nu sunt încă disponibile în Socot. Lista este
          rezultatul analizei demo-ului și va fi completată cu verificarea
          formularelor și calculelor.
        </p>
        <ul>
          {module.pending.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
