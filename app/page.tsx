"use client";
import AssistantDrawer from "./assistant-drawer";
import SocotSheetsPanel from "./socot-sheets-panel";
import DocumentsPanel from "./documents-panel";
import ModuleWorkspace from "./module-workspace";
import {
  workspaces,
  workspaceParent,
} from "../lib/workspaces";
import {
  catalogNames,
  catalogKinds,
  canReadCatalog,
  type CatalogKind,
} from "../lib/catalog";
import CatalogPanel from "./catalog-panel";
import packageInfo from "../package.json";
import ExpensesPanel from "./expenses-panel";
import CompanyPanel from "./company-panel";
import { can } from "../lib/permissions";
import LedgerPanel from "./ledger-panel";
import ReconciliationPanel from "./reconciliation-panel";
import TutorialButton from "./tutorial";
import HomeDashboard from "./home-dashboard";
import SideNav from "./side-nav";
import NewMenu from "./new-menu";
import { todayLine } from "../lib/dashboard";
import CompliancePanel from "./compliance-panel";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { desktop, readValue, writeValue, type Snapshot } from "../lib/storage";
import { SyncEngine } from "../lib/sync";
import { totals, type Invoice } from "../lib/domain";
const money = (v: number) =>
  new Intl.NumberFormat("ro-MD", { style: "currency", currency: "MDL" }).format(
    v / 100,
  );
export default function Page() {
  const [session, setSession] = useState<{
      id: string;
      companyId: string;
      role: string;
    } | null>(null),
    [demo, setDemo] = useState(false),
    [state, setState] = useState<Snapshot>({ invoices: [], pending: [] }),
    [status, setStatus] = useState("Neconectat"),
    [error, setError] = useState(""),
    [view, setViewState] = useState("Acasă"),
    [navQuery, setNavQuery] = useState(""),
    [menuOpen, setMenuOpen] = useState(false),
    [documentDirty, setDocumentDirty] = useState(false),
    [pendingNavigation, setPendingNavigation] = useState<string | null>(null),
    [reportView, setReportView] = useState("Creanțe"),
    [newDocument, setNewDocument] = useState<{
      kind: "sale" | "expense";
      file?: File;
    }>(),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [update, setUpdate] = useState<any>(null),
    [native, setNative] = useState(false),
    [payment, setPayment] = useState<Invoice | null>(null),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false);
  const engine = useRef<SyncEngine | null>(null);
  function setView(next: string) {
    if (next === view) return;
    if (documentDirty) {
      setPendingNavigation(next);
      return;
    }
    setDocumentDirty(false);
    setViewState(next);
    setMenuOpen(false);
    setQuery("");
  }
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, menuOpen]);
  const scopedKind =
    view === "documents:sale"
      ? "sale"
      : view === "documents:expense"
        ? "expense"
        : undefined;
  const catalogKind =
    view.startsWith("catalog:") &&
    catalogKinds.includes(view.slice(8) as CatalogKind)
      ? (view.slice(8) as CatalogKind)
      : undefined;
  const title = scopedKind
    ? scopedKind === "sale"
      ? "Documente de vânzare"
      : "Documente de cumpărare"
    : catalogKind
      ? catalogNames[catalogKind]
      : view === "Cheltuieli"
        ? "Datorii și plăți furnizori"
        : view === "Acasă"
          ? "Privire de ansamblu"
          : view;

  const sales = state.invoices.filter((i) => i.kind !== "expense");
  const sum = totals(sales);
  const writable = demo || can(session?.role, "invoice.write");
  async function start(
    user: { id: string; companyId: string; role: string },
    isDemo = false,
  ) {
    setError("");
    const e = new SyncEngine(
      isDemo ? "demo-v1" : `${user.companyId}:${user.id}`,
      isDemo,
      (s, status) => {
        setState({ ...s });
        setStatus(status);
      },
    );
    await e.load();
    await writeValue("last-profile", { user, isDemo });
    engine.current = e;
    setDemo(isDemo);
    setSession(user);
    await e.sync();
  }
  useEffect(() => {
    setNative(desktop());
    let release: (() => void) | undefined;
    let disposed = false;
    const boot = async () => {
      try {
        const cached = await readValue<{
          user: { id: string; companyId: string; role: string };
          isDemo: boolean;
        }>("last-profile");
        if (cached?.isDemo) {
          await start(cached.user, true);
        } else {
          try {
            const r = await api("/me");
            await start(r.user);
          } catch (e) {
            if (cached && !(e instanceof ApiError && e.status === 401))
              await start(cached.user, false);
          }
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setReady(true);
      }
    };
    if (desktop()) {
      void boot();
    } else if (navigator.locks) {
      void navigator.locks.request(
        "socot-single-window",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            setBlocked(true);
            setReady(true);
            return;
          }
          if (disposed) return;
          await boot();
          await new Promise<void>((resolve) => {
            release = resolve;
            if (disposed) resolve();
          });
        },
      );
    } else {
      setBlocked(true);
      setReady(true);
    }
    return () => {
      disposed = true;
      release?.();
    };
  }, []);
  useEffect(() => {
    const run = () => engine.current?.sync();
    const timer = setInterval(run, 15000);
    window.addEventListener("online", run);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", run);
    };
  }, []);
  useEffect(() => {
    if (!native) return;
    import("@tauri-apps/plugin-updater")
      .then(({ check }) => check())
      .then(setUpdate)
      .catch(() => {});
  }, [native]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const result = await api("/login", {
        email: f.get("email"),
        password: f.get("password"),
      });
      await start(result.user);
    });
  }
  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payment) return;
    const invoice = payment;
    const f = new FormData(e.currentTarget);
    const cents = Math.round(Number(f.get("amount")) * 100);
    if (
      !Number.isFinite(cents) ||
      cents <= 0 ||
      cents > invoice.total - invoice.paid
    ) {
      setError("Introdu o sumă pozitivă, cel mult egală cu restul de plată.");
      return;
    }
    await action(async () => {
      await engine.current!.enqueue({ ...invoice, paid: invoice.paid + cents });
      setPayment(null);
    });
  }
  async function logout() {
    if (documentDirty) {
      setError("Salvează sau închide ciorna deschisă înainte de deconectare.");
      return;
    }
    if (
      state.pending.length +
      (state.catalogPending?.length ?? 0) +
      (state.drafts?.length ?? 0)
    ) {
      setError(
        "Există ciorne sau operațiuni nesincronizate. Confirmă ciornele și rezolvă operațiunile înainte de deconectare.",
      );
      return;
    }
    await action(async () => {
      if (!demo) {
        await api("/logout", {});
        await writeValue(engine.current!.scope, { invoices: [], pending: [] });
      }
      await writeValue("last-profile", null);
      engine.current = null;
      setSession(null);
      setState({ invoices: [], pending: [] });
      setDemo(false);
    });
  }
  function exportCsv() {
    const rows = [
      ["Socot", "Client", "Data", "Total MDL", "Încasat MDL"],
      ...sales.map((i) => [
        i.id,
        i.customer,
        i.date,
        i.total / 100,
        i.paid / 100,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map(
            (c) =>
              '"' +
              String(c)
                .replace(/^[=+@-]/, "'")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Socot-facturi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ready || blocked)
    return (
      <main className="loginform">
        <div className="brand">
          <img src="/mark.svg" alt="" />
          Socot
        </div>
        <h2>{blocked ? "Socot este deja deschis" : "Se deschide Socot…"}</h2>
        {blocked && (
          <p>
            Folosește prima filă Socot sau închide-o și reîncarcă această
            pagină. Este necesar un browser cu suport Web Locks.
          </p>
        )}
      </main>
    );
  if (session && !demo && !can(session.role, "invoice.read"))
    return (
      <main className="loginform">
        <div className="brand">
          <img src="/mark.svg" alt="" />
          Socot
        </div>
        <h2>Acces limitat pentru acest rol</h2>
        <p>
          Modulele asociate rolului tău nu sunt încă disponibile în această
          versiune. Administratorul poate verifica drepturile contului.
        </p>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} onClick={logout}>
          Deconectare
        </button>
      </main>
    );
  if (!session)
    return (
      <main className="login">
        <section className="story">
          <div className="brand">
            <img src="/mark.svg" alt="" />
            Socot<span>finanțe cu sens</span>
          </div>
          <div>
            <p className="eyebrow">UN SPAȚIU PENTRU AFACEREA TA</p>
            <h1>
              Mai multă claritate.
              <br />
              Mai mult echilibru.
            </h1>
            <p>
              Facturi, încasări și o perspectivă limpede asupra banilor. Într-un
              singur loc.
            </p>
            <div className="art">
              <div className="orb" />
              <div className="paper">
                <small>SOCOT / ÎN ECHILIBRU</small>
                <strong>Totul se leagă.</strong>
                <span>Vânzare → Încasare → Claritate</span>
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
          <small>Creat pentru afaceri din Moldova · MDL</small>
        </section>
        <section className="loginform">
          <p className="eyebrow">BINE AI VENIT</p>
          <h2>Intră în Socot</h2>
          <p className="muted">Spațiul tău financiar, la îndemână.</p>
          <form onSubmit={login}>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="nume@companie.md"
              />
            </label>
            <label>
              Parolă
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button disabled={busy}>Conectare →</button>
          </form>
          <div className="divider">sau explorează</div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              action(() =>
                start({ id: "demo", companyId: "demo", role: "admin" }, true),
              )
            }
          >
            Deschide demonstrația {native ? "SQLite" : "în browser"}
          </button>
          <p className="footnote">
            Date fictive, salvate pe acest dispozitiv.{" "}
            {native ? "Bază SQLite criptată." : "Stocare IndexedDB în browser."}{" "}
            Fără cont și fără transmitere către server.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  return (
    <div className={`shell socot-organized ${menuOpen ? "menu-open" : ""}`}>
      <aside className="socot-sidebar" id="socot-navigation">
        <div className="brand">
          <img src="/mark.svg" alt="" />
          Socot
        </div>
        <div className="company">
          <span className="avatar">
            {(demo ? (state.company?.name ?? "Socot") : "Compania").charAt(0)}
          </span>
          <div>
            <strong>
              {demo
                ? (state.company?.name ?? "Socot Atelier SRL")
                : "Compania mea"}
            </strong>
            <small>{demo ? "Companie demonstrativă" : session.role}</small>
          </div>
        </div>
        <label className="nav-search" data-t="menu-search">
          Caută în meniu
          <input
            type="search"
            placeholder="Cumpărări, salarii…"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
          />
        </label>
        <SideNav
          active={workspaceParent(view)}
          query={navQuery}
          journal={demo || can(session.role, "journal.read")}
          go={setView}
        />
        <div className="asidebottom">
          <span className="pill">
            {native ? "DESKTOP" : "WEB"} · {packageInfo.version}
          </span>

          <button className="textbutton" onClick={logout}>
            Deconectare ↗
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="workspace-location">
            <button
              className="menu-toggle secondary"
              aria-expanded={menuOpen}
              aria-controls="socot-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ☰ Meniu
            </button>
            <span>
              Socot <span className="slash">/</span> {title}
            </span>
          </div>
          <div className="header-actions">
            <TutorialButton view={view} userId={session.id} />
            {(demo || can(session.role, "invoice.read")) && (
              <AssistantDrawer
                key={`${demo}-${session.companyId}-${session.role}`}
                demo={demo}
                invoices={state.invoices}
                role={session.role}
                company={demo ? (state.company?.name ?? "demonstrative") : "tale"}
                navigate={setView}
              />
            )}
          </div>
          <div className="connection" role="status">
            <i className={status.startsWith("Offline") ? "offline" : ""} />
            {demo
              ? native
                ? "Demo local · SQLite"
                : "Demo local · browser"
              : status}
            {status.startsWith("Sesiune expirată") && (
              <button className="textbutton" onClick={() => setSession(null)}>
                Reautentificare
              </button>
            )}
          </div>
        </header>
        <main className="content">
          {workspaceParent(view) !== view && (
            <button
              className="textbutton workspace-back"
              onClick={() => setView(workspaceParent(view))}
            >
              ← {workspaceParent(view)}
            </button>
          )}
          <div className="heading">
            <div>
              <p className="eyebrow">
                {view === "Acasă"
                  ? `${todayLine(new Date().toISOString().slice(0, 10))}${demo ? " · Demonstrație" : ""}`
                  : demo
                    ? "SOCOT ATELIER SRL · DEMONSTRAȚIE"
                    : "SPAȚIUL TĂU FINANCIAR"}
              </p>
              <h1>{view === "Acasă" ? "Acasă" : title}</h1>
              <p className="muted">
                {(
                  {
                    Acasă:
                      "Solduri, documente recente și lucrurile de rezolvat.",
                    Documente:
                      "Pregătește, verifică și urmărește documentele într-un singur loc.",
                    "Spațiu de lucru":
                      "Pregătește datele înainte de înregistrarea contabilă.",
                    Vânzări:
                      "Facturi, clienți și încasări într-un singur registru.",
                    Cheltuieli: "Furnizori, cheltuieli și sume de plată.",
                    Rapoarte: "Alege raportul, perioada și nivelul de detaliu.",
                    Contabilitate:
                      "Verifică articolele, regulile și perioadele contabile.",
                    Întreprindere:
                      "Datele firmei, contactele și politica contabilă.",
                    Setări: "Conexiune, stocare locală și actualizări.",
                    Nomenclatoare:
                      "Date de referință comune pentru documentele firmei.",
                  } as Record<string, string>
                )[view] ??
                  workspaces[view]?.subtitle ??
                  (scopedKind
                    ? "Pregătește documentul, verifică-l și confirmă-l separat."
                    : "Date comune pentru documentele firmei.")}
              </p>
            </div>
            {writable && (
              <NewMenu
                onNew={(kind) => {
                  setNewDocument({ kind });
                  setView(`documents:${kind}`);
                }}
                onScan={(kind, file) => {
                  setNewDocument({ kind, file });
                  setView(`documents:${kind}`);
                }}
              />
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {update && (
            <div className="notice">
              O versiune nouă Socot este disponibilă.{" "}
              <button
                disabled={
                  busy ||
                  documentDirty ||
                  state.pending.length > 0 ||
                  (state.catalogPending?.length ?? 0) > 0
                }
                onClick={() =>
                  action(async () => {
                    await update.downloadAndInstall();
                    const { relaunch } =
                      await import("@tauri-apps/plugin-process");
                    await relaunch();
                  })
                }
              >
                Instalează actualizarea semnată
              </button>
            </div>
          )}
          {state.pending.length > 0 && (
            <section className="notice">
              <strong>{state.pending.length} operațiuni păstrate local</strong>
              <p>
                Se trimit automat când API-ul devine disponibil. Nu închide
                contul înainte de sincronizare.
              </p>
              {state.pending.map((p) => (
                <div key={p.id} className="pending">
                  <span>
                    {p.invoice.customer} · {money(p.invoice.total)}
                    {p.error && ` — ${p.error}`}
                  </span>
                  {p.error && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        action(() => engine.current!.discardRejected(p.id))
                      }
                    >
                      Anulează operațiunea respinsă
                    </button>
                  )}
                  {p.conflict !== undefined && (
                    <>
                      <p>
                        Conflict: achitat local {money(p.invoice.paid)} / server{" "}
                        {money(p.conflict?.paid ?? 0)}. Alege explicit
                        versiunea.
                      </p>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(() => engine.current!.resolve(p.id, false))
                        }
                      >
                        Păstrează serverul
                      </button>{" "}
                      <button
                        disabled={busy}
                        onClick={() =>
                          action(() => engine.current!.resolve(p.id, true))
                        }
                      >
                        Confirmă încasarea locală
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button
                className="secondary"
                onClick={() => engine.current?.sync()}
              >
                Reîncearcă sincronizarea
              </button>
            </section>
          )}
          {workspaces[view] && (
            <ModuleWorkspace
              key={view}
              module={workspaces[view]}
              snapshot={state}
              journalAccess={demo || can(session.role, "journal.read")}
              personnelAccess={demo || canReadCatalog(session.role, "employee")}
              navigate={setView}
            />
          )}
          {view === "Rapoarte" && (
            <div
              className="report-switch"
              role="group"
              aria-label="Tip raport"
              data-t="report-switch"
            >
              {[
                "Creanțe",
                "Act de verificare",
                ...(demo || can(session.role, "journal.read")
                  ? ["Balanță și conturi"]
                  : []),
              ].map((t) => (
                <button
                  key={t}
                  aria-pressed={reportView === t}
                  className={reportView === t ? "selected" : ""}
                  onClick={() => setReportView(t)}
                >
                  <strong>{t}</strong>
                  <small>
                    {t === "Creanțe"
                      ? "Facturi și sume de încasat"
                      : t === "Act de verificare"
                        ? "Decontări reciproce cu un client"
                        : "Solduri, rulaje și documente sursă"}
                  </small>
                </button>
              ))}
            </div>
          )}
          {view === "Acasă" && (
            <HomeDashboard
              snapshot={state}
              today={new Date().toISOString().slice(0, 10)}
              writable={writable}
              busy={busy}
              canJournal={demo || can(session.role, "journal.read")}
              go={setView}
              onPay={setPayment}
            />
          )}
          {(view === "Încasări clienți" ||
            (view === "Rapoarte" && reportView === "Creanțe")) && (
            <>
              <section className="metrics">
                {[
                  ["Vânzări înregistrate", sum.sales, "↗"],
                  ["Încasări", sum.paid, "↓"],
                  ["De încasat", sum.due, "◷"],
                ].map(([label, value, icon]) => (
                  <article key={label}>
                    <div>
                      {label}
                      <span>{icon}</span>
                    </div>
                    <strong>{money(Number(value))}</strong>
                    <small>Din documentele salvate · MDL</small>
                  </article>
                ))}
              </section>
              <section className="panel">
                <div className="panelhead">
                  <div>
                    <h2>
                      {view === "Rapoarte"
                        ? "Situația creanțelor"
                        : "Facturi de vânzare"}
                    </h2>
                    <p className="muted">
                      {sales.length} documente ·{" "}
                      {demo
                        ? "Socot demonstrativ"
                        : "ultimele 200 de documente"}
                    </p>
                  </div>
                  <div className="controls">
                    <input
                      aria-label="Caută client"
                      placeholder="Caută un client…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="secondary" onClick={exportCsv}>
                      Export CSV ↗
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        action(async () => {
                          if (native) {
                            const { invoke } =
                              await import("@tauri-apps/api/core");
                            await invoke("print_document");
                          } else window.print();
                        })
                      }
                    >
                      Imprimă / PDF
                    </button>
                  </div>
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>DOCUMENT / CLIENT</th>
                        <th>DATA</th>
                        <th>TOTAL</th>
                        <th>DE ÎNCASAT</th>
                        <th>STARE</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sales
                        .filter((i) =>
                          i.customer
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .slice()
                        .sort((a, b) => b.date.localeCompare(a.date))
                                                .map((i) => (
                          <tr key={i.id}>
                            <td>
                              <strong>{i.customer}</strong>
                              {i.sourceRef && (
                                <small title={i.sourceRef}>
                                  Import · {i.sourceRef.slice(0, 12)}… · rând{" "}
                                  {i.sourceRef.split(":").at(-1)}
                                </small>
                              )}
                              <small>
                                Socot · {i.id.slice(0, 8).toUpperCase()}
                              </small>
                            </td>
                            <td>{i.date}</td>
                            <td>{money(i.total)}</td>
                            <td>{money(i.total - i.paid)}</td>
                            <td>
                              <span
                                className={`badge ${i.paid === i.total ? "paid" : ""}`}
                              >
                                {i.paid === i.total
                                  ? "Achitată"
                                  : i.paid
                                    ? "Parțial achitată"
                                    : "Emisă"}
                              </span>
                            </td>
                            <td>
                              {writable && i.paid < i.total && (
                                <button
                                  className="textbutton"
                                  disabled={
                                    busy ||
                                    state.pending.some(
                                      (p) => p.invoice.id === i.id,
                                    )
                                  }
                                  onClick={() => setPayment(i)}
                                >
                                  Încasează ↗
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!sales.length && (
                  <div className="empty">
                    <span>▤</span>
                    <h3>Aici începe ordinea.</h3>
                    <p>
                      Adaugă prima factură pentru a vedea vânzările și
                      creanțele.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
          {view === "Rapoarte" && reportView === "Act de verificare" && (
            <ReconciliationPanel demo={demo} snapshot={state} />
          )}
          {view === "Rapoarte" &&
            reportView === "Balanță și conturi" &&
            (demo || can(session.role, "journal.read")) && (
              <LedgerPanel demo={demo} snapshot={state} />
            )}
          {(view === "Documente" || !!scopedKind) && (
            <DocumentsPanel
              key={view}
              aiScan={writable}
              demo={demo}
              start={newDocument?.kind === scopedKind ? newDocument : undefined}
              onStarted={() => setNewDocument(undefined)}
              scopeKind={scopedKind}
              onEditingChange={setDocumentDirty}
              snapshot={state}
              engine={engine.current!}
              writable={writable}
              journalAccess={demo || can(session.role, "journal.read")}
              navigate={setView}
            />
          )}
          {view === "Spațiu de lucru" && (
            <SocotSheetsPanel
              key={engine.current!.scope}
              engine={engine.current!}
              snapshot={state}
              writable={writable}
            />
          )}
          {view === "Cheltuieli" && (
            <ExpensesPanel
              onDraft={() => setView("documents:expense")}
              snapshot={state}
              engine={engine.current!}
              writable={writable}
            />
          )}
          {(view === "Nomenclatoare" || !!catalogKind) && (
            <CatalogPanel
              key={view}
              initialKind={catalogKind}
              snapshot={state}
              engine={engine.current!}
              demo={demo}
              role={session.role}
            />
          )}
          {view === "Întreprindere" && (
            <CompanyPanel
              demo={demo}
              role={session.role}
              snapshot={state}
              engine={engine.current!}
            />
          )}
          {view === "Contabilitate" && (
            <CompliancePanel
              role={session.role}
              demo={demo}
              snapshot={state}
              engine={engine.current!}
            />
          )}
          {view === "Setări" && (
            <section className="panel settings">
              <h2>Socot pe dispozitivul tău</h2>
              <p>
                Versiunea {packageInfo.version} · Identificator md.socot.desktop
              </p>
              <h3>Conexiune și date locale</h3>
              <p>
                Sincronizare automată la 15 secunde și la revenirea conexiunii.
                Sunt păstrate cel mult 200 de facturi și operațiunile în
                așteptare. Operațiunile confirmate sunt eliminate din coadă.
              </p>
              <p>
                {native
                  ? "SQLite criptat AES-GCM; cheia și sesiunea API sunt păstrate în stocarea securizată a sistemului."
                  : "Browser: IndexedDB pentru facturi și coadă; sesiune în cookie HttpOnly. Folosește un profil de browser personal."}
              </p>
              <h3>Actualizări</h3>
              <p>
                Buildul local demonstrativ nu are un canal de distribuție activ.
                Release-urile configurate verifică automat actualizările semnate
                la pornire.
              </p>
              <button
                className="secondary"
                disabled={!native || busy}
                onClick={() =>
                  action(async () => {
                    const { check } =
                      await import("@tauri-apps/plugin-updater");
                    const next = await check();
                    setUpdate(next);
                    setError(
                      next ? "" : "Nu există o actualizare disponibilă.",
                    );
                  })
                }
              >
                Verifică actualizări
              </button>
              <h3>Model contabil demonstrativ</h3>
              <p>
                Vânzare: debit 221 / credit 611. Încasare: debit 242 / credit
                221. Model simplificat fără TVA, produse sau stocuri; necesită
                validare contabilă înainte de utilizare reală.
              </p>
            </section>
          )}
          <p className="legalnote">
            Socot automatizează evidența și pregătirea documentelor.
            Corectitudinea tratamentului contabil și fiscal trebuie verificată
            de persoana responsabilă.
          </p>
          <footer>
            Socot · Claritate pentru fiecare zi.
            <span>
              {demo
                ? "Date demonstrative · Nu reprezintă factură fiscală"
                : "MDL · ro-MD"}
            </span>
          </footer>
        </main>
      </div>
      {pendingNavigation && (
        <div className="modalback">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-document-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPendingNavigation(null);
            }}
          >
            <h2 id="leave-document-title">Ai o ciornă deschisă</h2>
            <p>
              Modificările nesalvate se vor pierde dacă treci la altă secțiune.
              Poți continua editarea și salva ciorna înainte de a pleca.
            </p>
            <div className="controls">
              <button
                autoFocus
                className="secondary"
                onClick={() => setPendingNavigation(null)}
              >
                Continuă editarea
              </button>
              <button
                onClick={() => {
                  setViewState(pendingNavigation);
                  setDocumentDirty(false);
                  setPendingNavigation(null);
                  setMenuOpen(false);
                  setQuery("");
                }}
              >
                Părăsește fără salvare
              </button>
            </div>
          </section>
        </div>
      )}
      {payment && (
        <div className="modalback">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
          >
            <p className="eyebrow">ÎNCASARE SOCOT</p>
            <h2 id="payment-title">Înregistrează încasarea</h2>
            <p>{payment.customer}</p>
            <p className="muted">
              Rest de plată: {money(payment.total - payment.paid)}
            </p>
            <form onSubmit={pay}>
              <label>
                Suma încasată (MDL)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max={(payment.total - payment.paid) / 100}
                  step="0.01"
                  required
                  autoFocus
                />
              </label>
              <p className="footnote">
                Confirmarea înregistrează plata și reduce creanța.
              </p>
              <div className="controls">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPayment(null)}
                >
                  Renunță
                </button>
                <button disabled={busy}>Confirmă încasarea</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
