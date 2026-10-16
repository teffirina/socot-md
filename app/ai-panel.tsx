"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AiSearchResult, AiProposal } from "../lib/ai";
import { can } from "../lib/permissions";
const money = (n: number) =>
  (n / 100).toLocaleString("ro-MD", { style: "currency", currency: "MDL" });
export default function AiPanel({
  demo,
  role,
  navigate,
}: {
  demo: boolean;
  role: string;
  navigate: (view: string) => void;
}) {
  const [configured, setConfigured] = useState(false);
  const [checking, setChecking] = useState(!demo);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!demo)
      api("/ai/status")
        .then((r) => {
          if (active) setConfigured(r.configured);
        })
        .catch(() => {
          if (active)
            setError(
              "Serverul nu este disponibil. AI necesită o conexiune la internet.",
            );
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    return () => {
      active = false;
    };
  }, [demo]);
  async function search() {
    setError("");
    setBusy(true);
    setResult(null);
    setProposal(null);
    try {
      setResult(await api("/ai/search", { question }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Căutarea nu a reușit.");
    } finally {
      setBusy(false);
    }
  }
  async function inspect(id: string) {
    setBusy(true);
    setError("");
    setProposal(null);
    try {
      setProposal(await api("/ai/proposal", { id }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Propunerea nu este disponibilă.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel ai-panel" aria-label="Asistent AI">
      <h2>Asistent AI pentru contabil</h2>
      <p>
        Caută documente în română, apoi verifică propunerea Dt/Ct bazată pe
        regulile aprobate ale firmei.
      </p>
      <p className="footnote">
        Întrebarea se trimite serviciului OpenAI. Evită datele personale și
        secretele în întrebare. Documentele găsite și regulile contabile rămân
        pe serverul Socot. AI nu modifică documente și nu postează înregistrări.
      </p>
      {demo ? (
        <p role="status">
          AI este disponibil în contul conectat, după configurarea serverului.
          Modul demo nu trimite date către AI.
        </p>
      ) : checking ? (
        <p role="status">Se verifică disponibilitatea AI…</p>
      ) : (
        !configured && (
          <p role="status">
            AI nu este configurat sau serverul nu este disponibil.
            Contactează administratorul pentru activare.
          </p>
        )
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && configured && !demo) void search();
        }}
      >
        <label htmlFor="ai-question">Ce documente cauți?</label>
        <textarea
          id="ai-question"
          rows={3}
          minLength={3}
          maxLength={1000}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Arată facturile de vânzare neachitate din septembrie 2026"
          disabled={demo || !configured || busy}
        />
        <button
          disabled={demo || !configured || busy || question.trim().length < 3}
        >
          {busy ? "Se procesează…" : "Caută documente"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div aria-live="polite" aria-busy={busy}>
        {result && (
          <>
            <h3>{result.documents.length} documente găsite</h3>
            <p>
              Filtre interpretate:{" "}
              {result.filters.customer
                ? `partener: ${result.filters.customer}; `
                : ""}
              {result.filters.sourceRef
                ? `referință: ${result.filters.sourceRef}; `
                : ""}
              {result.filters.kind === "sale"
                ? "vânzări"
                : result.filters.kind === "expense"
                  ? "cheltuieli"
                  : "toate tipurile"}
              ;{" "}
              {result.filters.unpaid ? "cu sold neachitat" : "toate soldurile"};{" "}
              {result.filters.from || "de la început"} —{" "}
              {result.filters.to || "până în prezent / viitor"}.
            </p>
            <p className="footnote">
              Verifică filtrele interpretate. Rezultatele provin din documentele
              sincronizate pe server; ciornele și modificările locale
              nesincronizate nu sunt incluse.
            </p>
            {result.hasMore && (
              <p>
                Sunt afișate primele 50 de documente. Restrânge perioada sau
                partenerul.
              </p>
            )}
            {!result.documents.length ? (
              <p>Nu există documente pentru filtrele de mai sus.</p>
            ) : (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Document / partener</th>
                      <th>Data</th>
                      <th>Total</th>
                      <th>Neachitat</th>
                      <th>Verificare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.documents.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.sourceRef || d.id}
                          <br />
                          {d.customer}
                        </td>
                        <td>{d.date}</td>
                        <td>{money(d.total)}</td>
                        <td>{money(d.total - d.paid)}</td>
                        <td>
                          {can(role, "journal.read") ? (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => void inspect(d.id)}
                            >
                              Document și propunere Dt/Ct
                            </button>
                          ) : (
                            <span>Consultă documentul în Documente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {proposal && (
          <section
            className="ai-proposal"
            aria-label="Document-sursă și propunere contabilă"
          >
            <h3>
              Document-sursă:{" "}
              {proposal.document.sourceRef || proposal.document.id}
            </h3>
            <p>
              {proposal.document.customer} · {proposal.document.date} ·{" "}
              {proposal.document.kind === "expense" ? "Cheltuială" : "Vânzare"}{" "}
              · {money(proposal.document.total)}
            </p>
            <p>
              Propunere pentru valoarea inițială a documentului, conform regulii
              „{proposal.rule.name}”, versiunea {proposal.rule.version}. Nu
              reprezintă o nouă înregistrare și nu include propuneri pentru
              plăți sau TVA separat.
            </p>
            <p>Sursa regulii: {proposal.rule.source}</p>
            <ul>
              {proposal.entries.map((e, i) => (
                <li key={i}>
                  Dt {e.debit} → Ct {e.credit}: {money(e.amount)}
                </li>
              ))}
            </ul>
            <p>
              {proposal.existing.length
                ? "Documentul are deja articole contabile. Verifică articolele existente înainte de aprobare, pentru a evita dublarea."
                : "Nu există articole contabile pentru acest document. Previzualizarea nu creează articole."}
            </p>
            {proposal.existing.length > 0 && (
              <ul>
                {proposal.existing.map((e) => (
                  <li key={e.id}>
                    Dt {e.debit} → Ct {e.credit}: {money(e.amount)} ·{" "}
                    {e.state === "posted" ? "postat" : "propus"}
                  </li>
                ))}
              </ul>
            )}
            <button
              className="secondary"
              onClick={() => navigate("Contabilitate")}
            >
              Deschide Contabilitate pentru verificare
            </button>
            <button className="secondary" onClick={() => setProposal(null)}>
              Închide propunerea
            </button>
          </section>
        )}
      </div>
    </section>
  );
}
