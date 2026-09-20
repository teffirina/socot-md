"use client";
import { useEffect, useState } from "react";
import { can } from "../lib/permissions";
import { api } from "../lib/api";
import {
  initialCompliance,
  approveRule,
  ruleSchema,
  reportTransition,
  type ComplianceState,
  type Rule,
  type Report,
} from "../lib/compliance";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
export default function CompliancePanel({
  demo,
  role,
  snapshot,
  engine,
}: {
  demo: boolean;
  role: string;
  snapshot: Snapshot;
  engine: SyncEngine;
}) {
  const [remote, setRemote] = useState<
      (ComplianceState & { ledger?: Snapshot["ledger"] }) | null
    >(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Reguli"),
    [reason, setReason] = useState("");
  const data = demo ? (snapshot.compliance ?? initialCompliance()) : remote;
  const ledger = demo ? snapshot.ledger : remote?.ledger;
  async function refresh() {
    if (!demo) setRemote(await api("/compliance"));
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [demo]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function requireReason() {
    if (reason.trim().length < 10)
      throw new Error(
        "Scrie un motiv de minimum 10 caractere în câmpul de confirmare.",
      );
  }
  async function local(
    action: string,
    objectId: string,
    next: ComplianceState,
  ) {
    await engine.configure({
      ...next,
      audit: [
        {
          id: crypto.randomUUID(),
          action,
          objectId,
          reason: reason || "Operațiune demonstrativă",
          actor: "Utilizator demo",
          at: new Date().toISOString(),
        },
        ...next.audit,
      ],
    });
  }
  async function addRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const rule = ruleSchema.parse({
        id: crypto.randomUUID(),
        kind: f.get("kind"),
        version: Number(f.get("version")),
        name: f.get("name"),
        debit: f.get("debit"),
        credit: f.get("credit"),
        validFrom: f.get("validFrom"),
        validTo: f.get("validTo") || null,
        status: "draft",
        source: f.get("source"),
        approvedBy: null,
        demo,
      });
      if (demo) {
        if (
          data!.rules.some(
            (r) => r.kind === rule.kind && r.version === rule.version,
          )
        )
          throw new Error("Versiunea există deja.");
        await local("rule.created", rule.id, {
          ...data!,
          rules: [...data!.rules, rule],
        });
      } else await api("/rules", rule);
    });
  }
  async function approve(rule: Rule) {
    await run(async () => {
      requireReason();
      if (demo)
        await local("rule.approved", rule.id, {
          ...data!,
          rules: approveRule(data!.rules, rule.id, "Utilizator demo"),
        });
      else await api("/rules/approve", { id: rule.id, reason });
    });
  }
  async function period(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      requireReason();
      const month = String(f.get("month"));
      const closed = f.get("state") === "closed";
      if (demo) {
        if (
          closed &&
          ledger?.some(
            (j) => j.state === "proposed" && j.effectiveDate?.startsWith(month),
          )
        )
          throw new Error(
            "Aprobă articolele contabile din această perioadă înainte de închidere.",
          );
        await local(closed ? "period.closed" : "period.reopened", month, {
          ...data!,
          periods: [
            ...data!.periods.filter((p) => p.month !== month),
            { month, closed, reason, changedBy: "Utilizator demo" },
          ],
        });
      } else await api("/periods", { month, closed, reason });
    });
  }
  async function post(id: string) {
    await run(async () => {
      requireReason();
      if (demo) {
        const entry = ledger!.find((j) => j.id === id)!;
        if (
          data!.periods.some(
            (p) => p.closed && entry.effectiveDate?.startsWith(p.month),
          )
        )
          throw new Error("Perioada este închisă.");
        await engine.commit({
          ...snapshot,
          ledger: ledger!.map((j) =>
            j.id === id ? { ...j, state: "posted" } : j,
          ),
          compliance: {
            ...data!,
            audit: [
              {
                id: crypto.randomUUID(),
                action: "journal.posted",
                objectId: id,
                reason,
                actor: "Utilizator demo",
                at: new Date().toISOString(),
              },
              ...data!.audit,
            ],
          },
        });
      } else await api("/journal/approve", { id, reason });
    });
  }
  async function generate() {
    await run(async () => {
      if (demo) {
        const report: Report = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          status: "generated",
          sourceIds: snapshot.invoices
            .filter((i) => i.kind !== "expense")
            .map((i) => i.id),
          rows: snapshot.invoices
            .filter((i) => i.kind !== "expense")
            .map(({ id, customer, total, paid }) => ({
              id,
              customer,
              total,
              paid,
            })),
        };
        await local("report.generated", report.id, {
          ...data!,
          reports: [report, ...data!.reports],
        });
      } else await api("/reports", {});
    });
  }
  async function exportReport(report: Report) {
    await run(async () => {
      const next = demo
        ? report.status === "generated"
          ? reportTransition(report, "exported")
          : report
        : await api("/reports/export", { id: report.id });
      if (demo)
        await local("report.exported", report.id, {
          ...data!,
          reports: data!.reports.map((r) => (r.id === report.id ? next : r)),
        });
      const cell = (s: unknown) =>
        '"' +
        String(s)
          .replace(/^[=+@-]/, "'")
          .replaceAll('"', '""') +
        '"';
      const csv = [
        ["Socot document", "Client", "Total MDL", "Încasat MDL", "Creanță MDL"],
        ...next.rows.map((r: Report["rows"][number]) => [
          r.id,
          r.customer,
          r.total / 100,
          r.paid / 100,
          (r.total - r.paid) / 100,
        ]),
      ]
        .map((row) => row.map(cell).join(","))
        .join("\n");
      const url = URL.createObjectURL(
        new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `Socot-raport-${report.id.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  return (
    <section className="panel settings compliance">
      <p className="eyebrow">NUCLEUL CONTABIL SOCOT</p>
      <h2>Reguli clare. Istoric păstrat.</h2>
      <p className="muted">
        {demo
          ? "Configurație demonstrativă, fără validare fiscală."
          : "Aprobarea unei configurații este responsabilitatea contabilului desemnat."}{" "}
        Versiunile aprobate se păstrează; o versiune nouă se aplică de la data
        sa de intrare în vigoare. Operațiunile vechi își păstrează versiunea.
      </p>
      <div className="controls">
        {["Reguli", "Perioade", "Jurnal", "Raportare", "Audit"].map((t) => (
          <button
            className={tab === t ? "" : "secondary"}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <p>Se încarcă configurația…</p>
      ) : (
        <>
          {["Reguli", "Perioade", "Jurnal"].includes(tab) && (
            <label>
              Motivul aprobării sau al modificării
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ce ai verificat și de ce aprobi această operațiune?"
                maxLength={500}
              />
            </label>
          )}
          {tab === "Reguli" && (
            <>
              <div className="rulelist">
                {data.rules.map((r) => (
                  <article key={r.id}>
                    <strong>{r.name}</strong>
                    <p>
                      v{r.version} ·{" "}
                      {
                        {
                          sale: "Vânzare",
                          receipt: "Încasare",
                          expense: "Cheltuială",
                          payment: "Plată furnizor",
                        }[r.kind]
                      }{" "}
                      · D {r.debit} / C {r.credit}
                    </p>
                    <small>
                      {r.validFrom} — {r.validTo ?? "până la înlocuire"} ·{" "}
                      {r.status === "approved" ? "Aprobată" : "Ciornă"}
                      {r.demo ? " · DEMO" : ""}
                    </small>
                    <p className="footnote">
                      Sursă: {r.source}
                      <br />
                      Aprobat de: {r.approvedBy ?? "—"}
                    </p>
                    {r.status === "draft" && (
                      <button
                        disabled={busy || (!demo && !can(role, "rule.approve"))}
                        onClick={() => approve(r)}
                      >
                        Confirmă aprobarea versiunii
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <details>
                <summary>Adaugă o versiune de regulă</summary>
                <form onSubmit={addRule}>
                  <fieldset
                    disabled={!demo && !can(role, "rule.create")}
                    style={{ border: 0, padding: 0 }}
                  >
                    <div className="formgrid">
                      <label>
                        Denumire
                        <input name="name" required minLength={3} />
                      </label>
                      <label>
                        Tip
                        <select name="kind">
                          <option value="sale">Vânzare</option>
                          <option value="receipt">Încasare</option>
                          <option value="expense">Cheltuială</option>
                          <option value="payment">Plată furnizor</option>
                        </select>
                      </label>
                      <label>
                        Versiune
                        <input
                          name="version"
                          type="number"
                          required
                          min="1"
                          defaultValue={2}
                        />
                      </label>
                      <label>
                        Debit
                        <input name="debit" required pattern="[0-9]{3,8}" />
                      </label>
                      <label>
                        Credit
                        <input name="credit" required pattern="[0-9]{3,8}" />
                      </label>
                      <label>
                        Valabilă de la
                        <input name="validFrom" type="date" required />
                      </label>
                      <label>
                        Valabilă până la (opțional)
                        <input name="validTo" type="date" />
                      </label>
                    </div>
                    <label>
                      Sursa și referința verificată
                      <input
                        name="source"
                        required
                        minLength={10}
                        maxLength={500}
                      />
                    </label>
                    <button disabled={busy}>Salvează ciorna regulii</button>
                  </fieldset>
                </form>
              </details>
            </>
          )}
          {tab === "Perioade" && (
            <>
              <p>
                Închiderea blochează operațiunile pentru luna selectată.
                Redeschiderea necesită motiv și se auditează.
              </p>
              {data.periods.map((p) => (
                <p key={p.month}>
                  <strong>{p.month}</strong> ·{" "}
                  {p.closed ? "Închisă" : "Deschisă"} · {p.reason}
                </p>
              ))}
              <form onSubmit={period}>
                <fieldset
                  disabled={!demo && !can(role, "period.close")}
                  style={{ border: 0, padding: 0 }}
                >
                  <div className="formgrid">
                    <label>
                      Luna
                      <input name="month" type="month" required />
                    </label>
                    <label>
                      Acțiune
                      <select name="state">
                        <option value="closed">Închide perioada</option>
                        <option
                          value="open"
                          disabled={!demo && !can(role, "period.reopen")}
                        >
                          Redeschide perioada
                        </option>
                      </select>
                    </label>
                  </div>
                  <button disabled={busy}>
                    Confirmă modificarea perioadei
                  </button>
                </fieldset>
              </form>
            </>
          )}
          {tab === "Jurnal" && (
            <>
              <p>
                Articolele noi sunt propuse pentru verificare. Postarea cere
                confirmare explicită.
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>SURSĂ / DATĂ</th>
                      <th>DEBIT</th>
                      <th>CREDIT</th>
                      <th>SUMĂ MDL</th>
                      <th>REGULĂ</th>
                      <th>STARE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger?.map((j) => (
                      <tr key={j.id}>
                        <td>
                          {j.invoiceId.slice(0, 8)}
                          <small>
                            {j.effectiveDate ?? "document demonstrativ vechi"}
                          </small>
                        </td>
                        <td>{j.debit}</td>
                        <td>{j.credit}</td>
                        <td>{(j.amount / 100).toFixed(2)}</td>
                        <td>
                          {j.ruleVersion ? `v${j.ruleVersion}` : "model demo"}
                        </td>
                        <td>
                          {j.state === "proposed" ? (
                            <button
                              disabled={
                                busy || (!demo && !can(role, "journal.post"))
                              }
                              onClick={() => post(j.id)}
                            >
                              Aprobă și postează
                            </button>
                          ) : j.state === "posted" ? (
                            "Postat"
                          ) : (
                            "Model demonstrativ"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "Raportare" && (
            <>
              <p>
                Generat → Exportat → Transmis → Acceptat. Exportul nu înseamnă
                transmitere sau acceptare.
              </p>
              <p className="notice">
                Integrare oficială neconfigurată — netransmisă. Raportul de
                creanțe este intern, nu declarație fiscală.
              </p>
              <button
                disabled={busy || (!demo && !can(role, "report.generate"))}
                onClick={generate}
              >
                Generează situația creanțelor
              </button>
              {data.reports.map((r) => (
                <article className="reportcard" key={r.id}>
                  <strong>Socot · Creanțe · {r.createdAt.slice(0, 10)}</strong>
                  <p>
                    {r.status === "generated"
                      ? "Generat"
                      : r.status === "exported"
                        ? "Exportat"
                        : r.status}{" "}
                    · {r.sourceIds.length} documente sursă
                  </p>
                  <button
                    className="secondary"
                    disabled={busy || (!demo && !can(role, "report.generate"))}
                    onClick={() => exportReport(r)}
                  >
                    Exportă CSV
                  </button>
                  <details>
                    <summary>Documente sursă și sume</summary>
                    {r.rows.map((row) => (
                      <p key={row.id}>
                        {row.customer} · {row.id.slice(0, 8)} · creanță{" "}
                        {((row.total - row.paid) / 100).toFixed(2)} MDL
                      </p>
                    ))}
                  </details>
                </article>
              ))}
            </>
          )}
          {tab === "Audit" && (
            <>
              <p>
                {demo
                  ? "Istoric local demonstrativ."
                  : "Jurnal append-only protejat prin trigger PostgreSQL împotriva UPDATE/DELETE de către API. Administratorul bazei de date necesită politici separate."}
              </p>
              {data.audit.map((a) => (
                <article className="reportcard" key={a.id}>
                  <strong>{a.action}</strong>
                  <p>
                    {a.at} · {a.actor} · {a.objectId}
                  </p>
                  <p>{a.reason}</p>
                </article>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
