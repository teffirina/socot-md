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
    <section className="ai-panel" aria-label="Asistent AI">
      <p className="ai-intro">
        Întreabă despre facturi și solduri. Socot caută în documentele firmei și
        îți arată propunerea Dt/Ct după regulile aprobate. Sugestiile sunt de
        verificat de contabil.
      </p>
      {demo ? (
        <p role="status" className="ai-note">
          AI lucrează în contul conectat, după ce cheia AI este pusă pe server.
          Modul demonstrativ nu trimite date către AI.
        </p>
      ) : checking ? (
        <p role="status" className="ai-note">
          Se verifică disponibilitatea AI…
        </p>
      ) : (
        !configured && (
          <p role="status" className="ai-note">
            AI nu este configurat pe server. Pune cheia în fișierul .env și
            repornește Socot.
          </p>
        )
      )}
      {!result && !proposal && (
        <div className="ai-suggestions">
          {[
            "Arată-mi facturile neachitate din luna curentă.",
            "Care sunt cheltuielile din luna curentă?",
            "Facturile de vânzare din ultimele 30 de zile.",
            "Ce avem de plătit furnizorilor?",
          ].map((q) => (
            <button
              key={q}
              type="button"
              className="secondary"
              onClick={() => setQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && configured && !demo) void search();
        }}
      >
        <label htmlFor="ai-question" className="sr-only">
          Întrebarea ta
        </label>
        <textarea
          id="ai-question"
          rows={3}
          minLength={3}
          maxLength={1000}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="De exemplu: cât avem de încasat de la clientul X?"
          disabled={demo || !configured || busy}
        />
        <button
          disabled={demo || !configured || busy || question.trim().length < 3}
        >
          {busy ? "Se procesează…" : "Întreabă"}
        </button>
      </form>
      <p className="footnote">
        Întrebarea se trimite serviciului OpenAI; evită datele personale în ea.
        AI nu modifică documente și nu postează înregistrări.
      </p>
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
              <ul className="ai-results">
                {result.documents.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong>{d.customer}</strong>
                      <small>
                        {d.date} ·{" "}
                        {d.kind === "expense" ? "Cumpărare" : "Vânzare"}
                        {d.sourceRef ? ` · ${d.sourceRef}` : ""}
                      </small>
                    </div>
                    <div className="ai-amounts">
                      <span>{money(d.total)}</span>
                      {d.paid < d.total && (
                        <small>Neachitat {money(d.total - d.paid)}</small>
                      )}
                    </div>
                    {can(role, "journal.read") && (
                      <button
                        className="textbutton"
                        disabled={busy}
                        onClick={() => void inspect(d.id)}
                      >
                        Propunere Dt/Ct
                      </button>
                    )}
                  </li>
                ))}
              </ul>
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
