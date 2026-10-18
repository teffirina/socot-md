"use client";
import { useState } from "react";
import {
  catalogNames,
  catalogKinds,
  catalogFields,
  catalogSchema,
  canReadCatalog,
  type CatalogKind,
  type CatalogEntry,
} from "../lib/catalog";
import { can } from "../lib/permissions";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
export default function CatalogPanel({
  snapshot,
  engine,
  demo,
  role,
  initialKind = "partner",
}: {
  snapshot: Snapshot;
  engine: SyncEngine;
  demo: boolean;
  role: string;
  initialKind?: CatalogKind;
}) {
  const [kind, setKind] = useState<CatalogKind>(
      demo || canReadCatalog(role, initialKind) ? initialKind : "partner",
    ),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<CatalogEntry | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const entries = snapshot.catalog ?? [],
    pending = snapshot.catalogPending ?? [];
  const manage =
    demo ||
    (can(role, "invoice.write") &&
      canReadCatalog(role, kind) &&
      (!["vat", "exchange_rate"].includes(kind) || can(role, "rule.create")));
  const rows = entries
    .filter(
      (e) =>
        e.kind === kind &&
        `${e.name} ${e.code}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const entry = catalogSchema.parse({
        ...edit,
        code: f.get("code"),
        name: f.get("name"),
        active: f.get("active") === "on",
        details: Object.fromEntries(
          catalogFields[kind].map((field) => [
            field.key,
            String(f.get(field.key) ?? ""),
          ]),
        ),
      });
      await engine.saveCatalog(entry, String(f.get("reason")));
      setEdit(null);
    });
  }
  return (
    <section className="panel settings">
      <p className="eyebrow">DATE COMUNE</p>
      <h2>Nomenclatoare</h2>
      <p className="muted">
        Definește o singură dată datele de referință. Arhivarea le păstrează în
        istoric.
      </p>
      <div className="controls">
        <label>
          Registru
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as CatalogKind);
              setEdit(null);
              setQuery("");
              setError("");
            }}
          >
            {catalogKinds
              .filter((k) => demo || canReadCatalog(role, k))
              .map((k) => (
                <option value={k} key={k}>
                  {catalogNames[k]}
                </option>
              ))}
          </select>
        </label>
        <label>
          Căutare
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cod sau denumire"
          />
        </label>
        {manage && (
          <button
            disabled={busy}
            onClick={() => {
              setError("");
              setEdit({
                id: crypto.randomUUID(),
                kind,
                code: "",
                name: "",
                active: true,
                version: 0,
                details: {},
              });
            }}
          >
            ＋ Adaugă
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pending.length > 0 && (
        <div className="notice">
          <h3>Modificări locale de sincronizat</h3>
          {pending.map((p) => (
            <div key={p.id}>
              <strong>{p.entry.name}</strong>
              <p>{p.reason}</p>
              {p.error ? (
                <>
                  <p>{p.error}</p>
                  <button
                    disabled={busy}
                    onClick={() => run(() => engine.discardCatalog(p.id))}
                  >
                    Retrage modificarea respinsă
                  </button>
                </>
              ) : p.conflict !== undefined ? (
                <>
                  <p>
                    Conflict. Local: {p.entry.name} (
                    {p.entry.active ? "activ" : "arhivat"}). Server:{" "}
                    {p.conflict?.name ?? "lipsește"} (
                    {p.conflict?.active ? "activ" : "arhivat"}).
                  </p>
                  <details>
                    <summary>Compară toate câmpurile</summary>
                    <pre>
                      {JSON.stringify(
                        { local: p.entry, server: p.conflict },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => engine.resolveCatalog(p.id, false))
                    }
                  >
                    Păstrează serverul
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => run(() => engine.resolveCatalog(p.id, true))}
                  >
                    Confirmă versiunea locală
                  </button>
                </>
              ) : (
                <p>Salvat local; așteaptă sincronizarea.</p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cod</th>
              <th>Denumire</th>
              <th>Stare</th>
              <th>Detalii</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td>{r.active ? "Activ" : "Arhivat"}</td>
                <td>
                  {catalogFields[kind].map((f) =>
                    r.details[f.key] ? (
                      <div key={f.key}>
                        {f.label}:{" "}
                        {f.ref
                          ? (entries.find((e) => e.id === r.details[f.key])
                              ?.name ?? "Referință indisponibilă")
                          : r.details[f.key]}
                      </div>
                    ) : null,
                  )}
                </td>
                <td>
                  {manage && (
                    <button
                      className="secondary"
                      disabled={
                        busy || pending.some((p) => p.entry.id === r.id)
                      }
                      onClick={() => {
                        setError("");
                        setEdit(r);
                      }}
                    >
                      Editează
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="muted">Nu există înregistrări pentru selecția curentă.</p>
      )}
      {["vat", "exchange_rate"].includes(kind) && (
        <p className="notice">
          Valorile se introduc pe baza unei surse verificate. Salvarea în
          nomenclator nu activează automat calculul fiscal sau valutar în
          documente.
        </p>
      )}
      {kind === "employee" && (
        <p className="footnote">
          Registru de identificare; calculul salariilor este un modul distinct,
          încă neimplementat.
        </p>
      )}
      {kind === "asset" && (
        <p className="footnote">
          Completează data punerii în funcțiune, valoarea de intrare și durata
          în luni: uzura lunară se propune automat în secțiunea Active.
        </p>
      )}
      {edit && (
        <div className="modalback">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-title"
          >
            <h2 id="catalog-title">
              {edit.version ? "Editează" : "Adaugă"} · {catalogNames[kind]}
            </h2>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <form key={edit.id} onSubmit={save}>
              <label>
                Cod
                <input
                  name="code"
                  required
                  maxLength={40}
                  readOnly={edit.version > 0}
                  defaultValue={edit.code}
                />
              </label>
              <label>
                Denumire
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  defaultValue={edit.name}
                />
              </label>
              {catalogFields[kind].map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.ref ? (
                    <select
                      name={f.key}
                      defaultValue={edit.details[f.key] ?? ""}
                      required={f.required}
                    >
                      <option value="">Selectează…</option>
                      {entries
                        .filter(
                          (e) =>
                            e.kind === f.ref &&
                            (e.active || edit.details[f.key] === e.id),
                        )
                        .map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.code} · {e.name}
                            {e.active ? "" : " (arhivat)"}
                          </option>
                        ))}
                    </select>
                  ) : f.options ? (
                    <select
                      name={f.key}
                      defaultValue={edit.details[f.key] ?? ""}
                      required={f.required}
                    >
                      <option value="">Selectează…</option>
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={f.key}
                      type={f.type ?? "text"}
                      step={f.type === "number" ? "0.000001" : undefined}
                      required={f.required}
                      maxLength={500}
                      defaultValue={edit.details[f.key] ?? ""}
                    />
                  )}
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={edit.active}
                />
                Activ
              </label>
              <label>
                Motivul modificării
                <input name="reason" required minLength={10} maxLength={500} />
              </label>
              <p className="footnote">
                Codul și tipul rămân permanente. Debifează Activ pentru
                arhivare.
              </p>
              <div className="controls">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEdit(null)}
                >
                  Renunță
                </button>
                <button disabled={busy}>Confirmă salvarea</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
