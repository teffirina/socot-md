"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { dashboardMoney } from "../lib/dashboard";
import { can } from "../lib/permissions";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
import {
  missingItems,
  nextActor,
  statusNames,
  type DocumentTask,
  type TaskStatus,
} from "../lib/tasks";

type Side = "accountant" | "entrepreneur";
const pill: Record<TaskStatus, string> = {
  todo: "warning",
  needs_info: "danger",
  answered: "warning",
  done: "success",
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("ro-MD", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Tasks the person on this side has to act on now. */
export function tasksFor(tasks: DocumentTask[] | undefined, side: Side) {
  return (tasks ?? []).filter((t) => nextActor(t) === side);
}

export function sideOf(role: string | undefined): Side {
  return can(role, "journal.post") ? "accountant" : "entrepreneur";
}

// The entrepreneur's documents waiting for the accountant, and the
// accountant's questions waiting for the entrepreneur, in one list.
export default function TasksPanel({
  engine,
  snapshot,
  role,
  demo,
  navigate,
}: {
  engine: SyncEngine;
  snapshot: Snapshot;
  role: string;
  demo: boolean;
  navigate: (view: string) => void;
}) {
  const [demoSide, setDemoSide] = useState<Side>("accountant");
  const side = demo ? demoSide : sideOf(role);
  const [filter, setFilter] = useState<"mine" | "all">("mine");
  const [open, setOpen] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remoteLedger, setRemoteLedger] = useState<Snapshot["ledger"]>();
  const journal = demo || can(role, "journal.read");
  useEffect(() => {
    if (demo || !journal) return;
    let live = true;
    api("/compliance")
      .then((c) => live && setRemoteLedger(c.ledger))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [demo, journal, snapshot.tasks]);
  const ledger = demo ? snapshot.ledger : remoteLedger;

  const all = snapshot.tasks ?? [];
  const mine = tasksFor(all, side);
  const shown = filter === "mine" ? mine : all;
  const by = side === "accountant" ? "Contabil (demo)" : "Antreprenor (demo)";

  async function act(
    task: DocumentTask,
    action: "request" | "answer" | "confirm",
  ) {
    setBusy(true);
    setError("");
    try {
      await engine.taskAction(
        {
          id: task.id,
          action,
          baseVersion: task.version,
          items: action === "request" ? items : [],
          text: action === "confirm" ? "" : text,
        },
        by,
      );
      setItems([]);
      setText("");
      setOpen(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="home-panel tasks" data-t="tasks">
      <div className="home-panel-head">
        <div>
          <p className="eyebrow">Între antreprenor și contabil</p>
          <h2>Sarcini pe documente</h2>
        </div>
        {demo && (
          <label className="tasks-side">
            Vezi ca
            <select
              value={demoSide}
              onChange={(e) => {
                setDemoSide(e.target.value as Side);
                setOpen(null);
              }}
            >
              <option value="accountant">Contabil</option>
              <option value="entrepreneur">Antreprenor</option>
            </select>
          </label>
        )}
      </div>
      <p className="muted">
        {side === "accountant"
          ? "Fiecare document adăugat de antreprenor ajunge aici. Ceri ce lipsește sau confirmi înregistrarea, iar articolele propuse se postează."
          : "Documentele tale ajung la contabil. Când îți cere ceva, răspunzi aici, iar contabilul confirmă înregistrarea."}
      </p>
      <div className="tasks-filter" role="tablist">
        <button
          role="tab"
          aria-selected={filter === "mine"}
          className={filter === "mine" ? "active" : ""}
          onClick={() => setFilter("mine")}
        >
          De făcut de tine ({mine.length})
        </button>
        <button
          role="tab"
          aria-selected={filter === "all"}
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Toate ({all.length})
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!shown.length && (
        <p className="muted">
          {filter === "mine"
            ? "Nimic de făcut acum."
            : "Încă nu sunt sarcini. Apar când antreprenorul adaugă un document."}
        </p>
      )}
      <ul className="tasks-list">
        {shown.map((t) => {
          const turn = nextActor(t) === side;
          const invoice = snapshot.invoices.find((i) => i.id === t.invoiceId);
          const proposed = (ledger ?? []).filter(
            (j) => j.invoiceId === t.invoiceId && j.state === "proposed",
          );
          const expanded = open === t.id;
          return (
            <li key={t.id} className={`tasks-item${turn ? " turn" : ""}`}>
              <button
                className="tasks-head"
                aria-expanded={expanded}
                onClick={() => {
                  setOpen(expanded ? null : t.id);
                  setItems([]);
                  setText("");
                  setError("");
                }}
              >
                <span>
                  <strong>{t.ref}</strong>
                  <small className="muted">
                    Adăugat de {t.createdBy}, {when(t.createdAt)}
                  </small>
                </span>
                <span className={`status-pill ${pill[t.status]}`}>
                  {statusNames[t.status]}
                </span>
              </button>
              {expanded && (
                <div className="tasks-body">
                  <ol className="tasks-history">
                    {t.messages.map((m) => (
                      <li key={m.id} className={`tasks-msg ${m.kind}`}>
                        <small className="muted">
                          {m.by} · {when(m.at)}
                        </small>
                        {m.kind === "confirmed" && (
                          <p>Înregistrare confirmată.</p>
                        )}
                        {m.items.length > 0 && (
                          <p>
                            Lipsește:{" "}
                            {m.items.map((x) => (
                              <span key={x} className="tasks-chip">
                                {x}
                              </span>
                            ))}
                          </p>
                        )}
                        {m.text && <p>{m.text}</p>}
                      </li>
                    ))}
                  </ol>
                  {invoice && (
                    <button
                      className="textbutton"
                      onClick={() =>
                        navigate(
                          invoice.kind === "expense"
                            ? "documents:expense"
                            : "documents:sale",
                        )
                      }
                    >
                      Deschide documentul
                    </button>
                  )}
                  {turn && side === "accountant" && (
                    <div className="tasks-actions">
                      <div className="tasks-confirm">
                        <h3>Confirmă înregistrarea</h3>
                        {proposed.length ? (
                          <ul>
                            {proposed.map((j) => (
                              <li key={j.id}>
                                Dt {j.debit} · Ct {j.credit}{" "}
                                <span className="num">
                                  {dashboardMoney(j.amount, false)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">
                            Nu sunt articole propuse de postat; confirmarea
                            închide doar sarcina.
                          </p>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => void act(t, "confirm")}
                        >
                          {proposed.length
                            ? `Confirmă și postează ${proposed.length === 1 ? "1 articol" : `${proposed.length} articole`}`
                            : "Confirmă"}
                        </button>
                      </div>
                      <fieldset className="tasks-request" disabled={busy}>
                        <legend>Sau cere ce lipsește</legend>
                        {missingItems.map((x) => (
                          <label key={x} className="tasks-check">
                            <input
                              type="checkbox"
                              checked={items.includes(x)}
                              onChange={(e) =>
                                setItems(
                                  e.target.checked
                                    ? [...items, x]
                                    : items.filter((y) => y !== x),
                                )
                              }
                            />
                            {x}
                          </label>
                        ))}
                        <label>
                          Mesaj pentru antreprenor
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                          />
                        </label>
                        <button
                          className="secondary"
                          onClick={() => void act(t, "request")}
                        >
                          Trimite cererea
                        </button>
                      </fieldset>
                    </div>
                  )}
                  {turn && side === "entrepreneur" && (
                    <fieldset className="tasks-request" disabled={busy}>
                      <legend>Răspunde contabilului</legend>
                      <label>
                        Răspunsul tău
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                      </label>
                      <p className="footnote">
                        Un document lipsă îl adaugi cu „+ Nou”, de exemplu
                        scanat cu telefonul, și scrii aici ce ai trimis.
                      </p>
                      <button onClick={() => void act(t, "answer")}>
                        Trimite răspunsul
                      </button>
                    </fieldset>
                  )}
                  {!turn && t.status !== "done" && (
                    <p className="muted">
                      {nextActor(t) === "accountant"
                        ? "Așteaptă contabilul."
                        : "Așteaptă răspunsul antreprenorului."}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
