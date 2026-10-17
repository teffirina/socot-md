"use client";
import { useEffect, useRef, useState } from "react";
import DocumentLinesEditor from "./document-lines-editor";
import DocumentMovements from "./document-movements";
import {
  documentAmount,
  documentProgress,
  invoiceFromDraft,
  type DocumentDraft,
} from "../lib/document-workflow";
import { validateDocumentReferences } from "../lib/catalog";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
import { api } from "../lib/api";
import {
  draftFromScan,
  scanFileTypes,
  scanMaxBytes,
} from "../lib/invoice-scan";
const money = (v: number) =>
  (v / 100).toLocaleString("ro-MD", { style: "currency", currency: "MDL" });
export default function DocumentsPanel({
  snapshot,
  engine,
  writable,
  journalAccess,
  navigate,
  scopeKind,
  onEditingChange,
  aiScan = false,
}: {
  snapshot: Snapshot;
  engine: SyncEngine;
  writable: boolean;
  journalAccess: boolean;
  navigate: (view: string) => void;
  scopeKind?: "sale" | "expense";
  onEditingChange?: (editing: boolean) => void;
  aiScan?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocumentDraft | null>(null);
  const [review, setReview] = useState<DocumentDraft | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState(scopeKind ?? "all");
  const [stage, setStage] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanNotes, setScanNotes] = useState<string[]>([]);
  const scanInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    onEditingChange?.(!!editing);
    const guard = (event: BeforeUnloadEvent) => {
      if (editing) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [editing, onEditingChange]);
  const drafts = snapshot.drafts ?? [];
  const rows = [
    ...new Map([
      ...snapshot.invoices.map(
        (i) => [i.id, { ...i, kind: i.kind ?? "sale" }] as const,
      ),
      ...snapshot.pending.map(
        (p) =>
          [
            p.invoice.id,
            { ...p.invoice, kind: p.invoice.kind ?? "sale" },
          ] as const,
      ),
      ...drafts.map((d) => [d.id, { ...d, paid: 0, version: 0 }] as const),
    ]).values(),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const visible = rows.filter(
    (d) =>
      (!scopeKind || d.kind === scopeKind) &&
      (kind === "all" || d.kind === kind) &&
      (stage === "all" ||
        (stage === "draft"
          ? drafts.some((x) => x.id === d.id)
          : stage === "pending"
            ? snapshot.pending.some((x) => x.invoice.id === d.id)
            : !drafts.some((x) => x.id === d.id) &&
              !snapshot.pending.some((x) => x.invoice.id === d.id))) &&
      (!from || d.date >= from) &&
      (!to || d.date <= to) &&
      `${d.customer} ${d.id} ${d.category ?? ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const document = rows.find((d) => d.id === selected);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function create(kind: "sale" | "expense") {
    setError("");
    setScanNotes([]);
    setReview(null);
    setEditing({
      id: crypto.randomUUID(),
      kind,
      customer: "",
      category: "",
      partnerId: null,
      contractId: null,
      date: new Date().toISOString().slice(0, 10),
      total: 0,
      revision: 0,
    });
  }
  async function scan(file: File, scanKind: "sale" | "expense") {
    if (!scanFileTypes.includes(file.type as (typeof scanFileTypes)[number])) {
      setError("Alege o factură PDF, PNG, JPEG sau WEBP.");
      return;
    }
    if (file.size > scanMaxBytes) {
      setError("Fișierul depășește 7 MB.");
      return;
    }
    setScanNotes([]);
    await run(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768)
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const result = await api(
        "/ai/invoice-scan",
        {
          kind: scanKind,
          file: { name: file.name, type: file.type, data: btoa(binary) },
        },
        100_000,
      );
      const { draft, number, warnings } = draftFromScan(
        result.invoice,
        scanKind,
        snapshot.catalog ?? [],
        crypto.randomUUID(),
        new Date().toISOString().slice(0, 10),
      );
      setReview(null);
      setEditing(draft);
      setScanNotes([
        `Factura${number ? ` nr. ${number}` : ""} a fost citită de AI. Verifică partenerul, data și totalul înainte de a salva ciorna.`,
        ...warnings,
      ]);
    });
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !writable) return;
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await engine.saveDraft({
        ...editing,
        total: editing.lines ? 0 : documentAmount(String(form.get("total"))),
      });
      setSelected(editing.id);
      setEditing(null);
      setReview(null);
    });
  }
  function check(draft: DocumentDraft) {
    setError("");
    try {
      if (draft.lines)
        throw Error(
          "Ciorna cu poziții este disponibilă pentru pregătire și salvare. Confirmarea contabilă pe poziții, TVA și stocuri urmează să fie implementată.",
        );
      if (draft.customer.trim().length < 2 || draft.total <= 0)
        throw Error(
          "Completează partenerul și o sumă mai mare decât zero înainte de verificare.",
        );
      validateDocumentReferences(
        snapshot.catalog ?? [],
        invoiceFromDraft(draft),
      );
      setReview({ ...draft });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className={`documents-workspace ${editing ? "is-editing" : ""}`}>
      <div className="document-flow" aria-label="Etapele documentului">
        <div>
          <b>01 · Pregătire</b>
          <small>Ciorne editabile, fără efect asupra soldurilor</small>
        </div>
        <div>
          <b>02 · Verificare</b>
          <small>Partener, dată și sumă înainte de confirmare</small>
        </div>
        <div>
          <b>03 · Contabilitate</b>
          <small>Articole propuse, apoi postate separat</small>
        </div>
        <div>
          <b>04 · Rapoarte</b>
          <small>Solduri din articolele postate</small>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {editing && scanNotes.length > 0 && (
        <div className="notice" role="status">
          <strong>Scanare AI</strong>
          <ul>
            {scanNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <section className="panel">
        <div className="panelhead">
          <div>
            <h2>
              {scopeKind === "expense"
                ? "Documente de cumpărare"
                : scopeKind === "sale"
                  ? "Documente de vânzare"
                  : "Registrul documentelor"}
            </h2>
            <p className="muted">
              {drafts.filter((d) => !scopeKind || d.kind === scopeKind).length}{" "}
              ciorne ·{" "}
              {
                snapshot.pending.filter(
                  (p) => !scopeKind || (p.invoice.kind ?? "sale") === scopeKind,
                ).length
              }{" "}
              operațiuni în coadă
            </p>
          </div>
          {writable && (
            <div className="controls">
              {scopeKind !== "expense" && (
                <button
                  disabled={busy || !!editing}
                  onClick={() => create("sale")}
                >
                  ＋ Vânzare
                </button>
              )}
              {scopeKind !== "sale" && (
                <button
                  disabled={busy || !!editing}
                  className="secondary"
                  onClick={() => create("expense")}
                >
                  ＋ Cumpărare / serviciu
                </button>
              )}
              {aiScan && scopeKind && (
                <>
                  <button
                    className="secondary"
                    disabled={busy || !!editing}
                    onClick={() => scanInput.current?.click()}
                  >
                    {busy ? "Se citește factura…" : "Scanează factura (AI)"}
                  </button>
                  <input
                    ref={scanInput}
                    type="file"
                    hidden
                    accept={scanFileTypes.join(",")}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void scan(file, scopeKind);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
        <div className="document-filters">
          <label>
            Caută
            <input
              placeholder="Partener, categorie sau document…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Tip
            <select
              disabled={!!scopeKind}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="all">Toate tipurile</option>
              <option value="sale">Vânzări</option>
              <option value="expense">Cumpărări / cheltuieli</option>
            </select>
          </label>
          <label>
            Etapă
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="all">Toate etapele</option>
              <option value="draft">Ciorne</option>
              <option value="pending">În coadă / conflicte</option>
              <option value="confirmed">Confirmate</option>
            </select>
          </label>
          <label>
            De la
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Până la
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <p className="footnote">
          Ciornele rămân pe acest dispozitiv și în acest profil până la
          confirmare. Contabilizarea este disponibilă pentru documentele
          simplificate de servicii fără TVA; ciornele cu poziții sunt doar
          pentru pregătire. Registrul online include ultimele 200 de documente
          descărcate.
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Document / partener</th>
                <th>Data</th>
                <th>Tip</th>
                <th>Total</th>
                <th>Etapă</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.customer || "Partener necompletat"}</strong>
                    <small>Socot · {d.id.slice(0, 8).toUpperCase()}</small>
                  </td>
                  <td>{d.date}</td>
                  <td>{d.kind === "expense" ? "Cheltuială" : "Vânzare"}</td>
                  <td>
                    {drafts.find((x) => x.id === d.id)?.lines && !d.total
                      ? "Total de verificat"
                      : money(d.total)}
                  </td>
                  <td>
                    <span className="badge">
                      {documentProgress(d.id, snapshot)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="textbutton"
                      onClick={() => {
                        setSelected(d.id);
                        setReview(null);
                        setError("");
                      }}
                    >
                      Deschide →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="empty">
            <h3>Niciun document în această selecție</h3>
            <p>Creează o ciornă sau schimbă filtrele.</p>
          </div>
        )}
      </section>
      {document && !editing && (
        <section
          className="panel document-detail"
          aria-label="Detalii document"
        >
          <div className="panelhead">
            <div>
              <p className="eyebrow">
                SOCOT · {document.id.slice(0, 8).toUpperCase()}
              </p>
              <h2>{document.customer || "Ciornă nouă"}</h2>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setSelected(null);
                setReview(null);
              }}
            >
              Închide detaliile
            </button>
          </div>
          <div className="document-summary">
            <div>
              <small>Data documentului</small>
              <strong>{document.date}</strong>
            </div>
            <div>
              <small>Total</small>
              <strong>
                {drafts.find((d) => d.id === document.id)?.lines &&
                !document.total
                  ? "De verificat"
                  : money(document.total)}
              </strong>
            </div>
            <div>
              <small>Etapă</small>
              <strong>{documentProgress(document.id, snapshot)}</strong>
            </div>
          </div>
          {drafts.find((d) => d.id === document.id)?.lines && (
            <DocumentLinesEditor
              readonly
              lines={drafts.find((d) => d.id === document.id)!.lines!}
            />
          )}
          {writable && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setReview(null);
                setEditing({
                  id: crypto.randomUUID(),
                  kind: document.kind,
                  customer: document.customer,
                  category: document.category ?? "",
                  partnerId: document.partnerId ?? null,
                  contractId: document.contractId ?? null,
                  date: new Date().toLocaleDateString("en-CA"),
                  total: document.total,
                  ...(drafts.find((d) => d.id === document.id)?.lines
                    ? {
                        lines: drafts
                          .find((d) => d.id === document.id)!
                          .lines!.map((line) => ({
                            ...line,
                            id: crypto.randomUUID(),
                          })),
                      }
                    : {}),
                  revision: 0,
                });
              }}
            >
              Copiază într-o ciornă nouă
            </button>
          )}
          {drafts.find((d) => d.id === document.id) ? (
            <>
              <p>Ciorna nu afectează vânzările, cheltuielile sau balanța.</p>
              {writable && (
                <div className="controls">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditing({
                        ...drafts.find((d) => d.id === document.id)!,
                      });
                      setReview(null);
                    }}
                  >
                    Modifică ciorna
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      check(drafts.find((d) => d.id === document.id)!)
                    }
                  >
                    Verifică documentul
                  </button>
                </div>
              )}
              {review?.id === document.id && (
                <div className="notice">
                  <h3>Document pregătit pentru confirmare</h3>
                  <p>
                    {review.customer} · {review.date} · {money(review.total)}
                  </p>
                  <p>
                    Confirmarea înregistrează documentul și propune articolul
                    contabil. În modul online, operațiunea este păstrată în
                    coadă până la răspunsul serverului. Postarea se aprobă
                    separat în Contabilitate.
                  </p>
                  <button
                    disabled={busy || !writable}
                    onClick={() =>
                      run(async () => {
                        await engine.confirmDraft(review.id, review.revision);
                        setReview(null);
                      })
                    }
                  >
                    Confirmă documentul verificat
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p>
                Achitat: {money(document.paid)} · Rest:{" "}
                {money(document.total - document.paid)}
              </p>
              <div className="controls">
                <button
                  className="secondary"
                  onClick={() =>
                    navigate(
                      document.kind === "expense"
                        ? "Cheltuieli"
                        : "Încasări clienți",
                    )
                  }
                >
                  Deschide registrul de plăți
                </button>
                {journalAccess && (
                  <button onClick={() => navigate("Contabilitate")}>
                    Verifică articolele contabile →
                  </button>
                )}
              </div>
              {snapshot.pending
                .filter((p) => p.invoice.id === document.id)
                .map((p) => (
                  <p className="notice" key={p.id}>
                    {p.error ||
                      (p.conflict !== undefined
                        ? "Conflict de versiune: alege explicit rezolvarea în notificarea de sincronizare."
                        : "Operațiune salvată local; așteaptă sincronizarea.")}
                  </p>
                ))}
              {journalAccess && (
                <DocumentMovements
                  key={document.id}
                  id={document.id}
                  snapshot={snapshot}
                  demo={engine.demo}
                />
              )}
            </>
          )}
        </section>
      )}
      {editing && (
        <section className="panel document-editor" aria-label="Editor ciornă">
          <p className="eyebrow">
            {editing.kind === "sale" ? "VÂNZARE" : "CHELTUIALĂ"} · CIORNĂ LOCALĂ
          </p>
          <h2>{editing.revision ? "Modifică documentul" : "Document nou"}</h2>
          <form onSubmit={save}>
            <fieldset
              disabled={busy}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <div className="formgrid">
                <label>
                  Partener din nomenclator
                  <select
                    value={editing.partnerId ?? ""}
                    onChange={(e) => {
                      const partner = snapshot.catalog?.find(
                        (p) => p.id === e.target.value,
                      );
                      setEditing({
                        ...editing,
                        partnerId: partner?.id ?? null,
                        customer: partner?.name ?? "",
                        contractId: null,
                      });
                    }}
                  >
                    <option value="">Introducere liberă</option>
                    {(snapshot.catalog ?? [])
                      .filter(
                        (p) =>
                          p.kind === "partner" &&
                          p.active &&
                          [
                            editing.kind === "sale" ? "client" : "furnizor",
                            "ambele",
                          ].includes(p.details.role),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {editing.kind === "sale" ? "Client" : "Furnizor"}
                  <input
                    value={editing.customer}
                    maxLength={120}
                    readOnly={!!editing.partnerId}
                    onChange={(e) =>
                      setEditing({ ...editing, customer: e.target.value })
                    }
                  />
                </label>
                <label>
                  Contract
                  <select
                    value={editing.contractId ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        contractId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Fără contract</option>
                    {(snapshot.catalog ?? [])
                      .filter(
                        (c) =>
                          c.kind === "contract" &&
                          c.active &&
                          c.details.partnerId === editing.partnerId,
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Data
                  <input
                    type="date"
                    required
                    value={editing.date}
                    onChange={(e) =>
                      setEditing({ ...editing, date: e.target.value })
                    }
                  />
                </label>
                {!editing.lines && (
                  <label>
                    Total (MDL)
                    <input
                      name="total"
                      key={editing.id}
                      defaultValue={(editing.total / 100).toFixed(2)}
                      inputMode="decimal"
                      required
                    />
                  </label>
                )}
                {editing.kind === "expense" && (
                  <label>
                    Categorie
                    <input
                      maxLength={80}
                      value={editing.category}
                      onChange={(e) =>
                        setEditing({ ...editing, category: e.target.value })
                      }
                    />
                  </label>
                )}
              </div>
              {editing.lines ? (
                <DocumentLinesEditor
                  catalog={snapshot.catalog ?? []}
                  lines={editing.lines}
                  onChange={(lines) => setEditing({ ...editing, lines })}
                />
              ) : (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      lines: [
                        {
                          id: crypto.randomUUID(),
                          description: "",
                          unit: "buc.",
                          quantity: "1",
                          price: (editing.total / 100).toFixed(2),
                          vat: "0",
                          priceMode: "net",
                          category: "service",
                        },
                      ],
                    })
                  }
                >
                  Pregătește document cu poziții
                </button>
              )}
              {editing.lines && (
                <p className="notice">
                  Mod de pregătire: pozițiile se salvează local, dar nu pot fi
                  încă înregistrate în contabilitate. Nu afectează stocurile,
                  soldurile sau declarațiile.
                </p>
              )}
              <p className="footnote">
                Salvarea păstrează ciorna, fără înregistrări contabile.
                Verificarea și confirmarea urmează separat.
              </p>
              <div className="controls">
                <button disabled={busy || !writable}>Salvează ciorna</button>
                <button
                  disabled={busy}
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  Renunță la modificările nesalvate
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
    </div>
  );
}
