"use client";
import { useEffect, useState } from "react";
import {
  companySchema,
  demoCompany,
  accountSchema,
  demoAccounts,
  accountClasses,
  type Company,
  type Account,
} from "../lib/company";
import { can } from "../lib/permissions";
import { api } from "../lib/api";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
const fields: [keyof Company, string][] = [
  ["name", "Denumirea completă"],
  ["shortName", "Denumirea prescurtată"],
  ["legalForm", "Forma juridică"],
  ["idno", "IDNO"],
  ["vatCode", "Cod TVA"],
  ["legalAddress", "Adresa juridică"],
  ["businessAddress", "Adresa activității"],
  ["phone", "Telefon"],
  ["email", "E-mail"],
  ["iban", "IBAN"],
  ["bank", "Banca"],
  ["bic", "BIC/SWIFT"],
  ["director", "Conducător"],
  ["chiefAccountant", "Contabil-șef"],
  ["taxRegime", "Regim fiscal"],
  ["reportingPeriod", "Perioada de raportare"],
];
export default function CompanyPanel({
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
  const [data, setData] = useState<Company | null>(
      demo ? (snapshot.company ?? demoCompany) : null,
    ),
    [version, setVersion] = useState(0),
    [accounts, setAccounts] = useState<Account[]>(
      demo ? (snapshot.accounts ?? demoAccounts) : [],
    ),
    [tab, setTab] = useState("Profil"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const manage = demo || can(role, "company.manage"),
    manageAccounts = demo || can(role, "accounts.manage");
  async function load() {
    if (demo) return;
    const result = await api("/company");
    setData(result.data);
    setVersion(result.version);
    if (can(role, "journal.read"))
      setAccounts(
        (await api("/accounts")).map((r: { data: Account }) => r.data),
      );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [demo]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice("Modificarea a fost salvată.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const value = companySchema.parse({
        ...data,
        ...Object.fromEntries(
          fields.map(([key]) => [key, String(f.get(key) ?? "")]),
        ),
        currency: f.get("currency"),
        vatRegistered: f.get("vatRegistered") === "on",
        accountingPolicy: f.get("accountingPolicy"),
        effectiveFrom: f.get("effectiveFrom"),
      });
      const reason = String(f.get("reason"));
      if (reason.trim().length < 10)
        throw new Error("Explică modificarea în minimum 10 caractere.");
      if (demo) {
        await engine.commit({ ...snapshot, company: value });
        setData(value);
      } else {
        const result = await api("/company", {
          data: value,
          baseVersion: version,
          reason,
        });
        setVersion(result.version);
        setData(result.data);
      }
    });
  }
  async function addAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const account = accountSchema.parse({
        code: f.get("code"),
        name: f.get("name"),
        class: Number(f.get("class")),
        type: f.get("type"),
        balanceNature: f.get("balanceNature"),
        currency: "MDL",
        analytics: String(f.get("analytics"))
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        parentCode: String(f.get("parentCode")) || null,
        validFrom: f.get("validFrom"),
        validTo: null,
        source: f.get("source"),
        directPosting: f.get("directPosting") === "on",
        active: true,
      });
      if (demo) {
        if (accounts.some((a) => a.code === account.code))
          throw new Error("Codul există deja.");
        if (
          account.parentCode &&
          !accounts.some((a) => a.code === account.parentCode)
        )
          throw new Error("Contul părinte nu există.");
        const next = [...accounts, account];
        await engine.commit({ ...snapshot, accounts: next });
        setAccounts(next);
      } else {
        await api("/accounts", account);
        await load();
      }
    });
  }
  return (
    <section className="panel settings compliance">
      <p className="eyebrow">ÎNTREPRINDERE</p>
      <h2>Identitatea și politica firmei</h2>
      <div className="controls">
        <button
          className={tab === "Profil" ? "" : "secondary"}
          onClick={() => setTab("Profil")}
        >
          Profil
        </button>
        {(demo || can(role, "journal.read")) && (
          <button
            className={tab === "Conturi" ? "" : "secondary"}
            onClick={() => setTab("Conturi")}
          >
            Plan de conturi
          </button>
        )}
        <button
          className="secondary"
          onClick={() => run(load)}
          disabled={demo || busy}
        >
          Reîncarcă profilul
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!data ? (
        <p>Se încarcă profilul…</p>
      ) : tab === "Profil" ? (
        <form key={version} onSubmit={save}>
          <fieldset
            disabled={!manage || busy}
            style={{ border: 0, padding: 0 }}
          >
            {[
              {
                title: "1. Identitatea firmei",
                keys: ["name", "shortName", "legalForm", "idno", "vatCode"],
              },
              {
                title: "2. Adrese și contact",
                keys: ["legalAddress", "businessAddress", "phone", "email"],
              },
              { title: "3. Date bancare", keys: ["iban", "bank", "bic"] },
              {
                title: "4. Responsabili și regim fiscal",
                keys: [
                  "director",
                  "chiefAccountant",
                  "taxRegime",
                  "reportingPeriod",
                ],
              },
            ].map((group) => (
              <section className="form-section" key={group.title}>
                <h3>{group.title}</h3>
                <div className="formgrid">
                  {fields
                    .filter(([key]) => group.keys.includes(key))
                    .map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          name={key}
                          defaultValue={String(data[key])}
                          required={["name", "shortName"].includes(key)}
                          maxLength={250}
                        />
                      </label>
                    ))}
                </div>
              </section>
            ))}
            <h3>5. Politică și confirmare</h3>
            <div className="formgrid">
              <label>
                Moneda funcțională
                <select name="currency" defaultValue={data.currency}>
                  <option>MDL</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </label>
              <label>
                Politica se aplică de la
                <input
                  type="date"
                  name="effectiveFrom"
                  defaultValue={data.effectiveFrom}
                  required
                />
              </label>
            </div>
            <label className="checklabel">
              <input
                type="checkbox"
                name="vatRegistered"
                defaultChecked={data.vatRegistered}
              />
              Plătitor TVA
            </label>
            <label>
              Politică contabilă
              <textarea
                name="accountingPolicy"
                defaultValue={data.accountingPolicy}
                maxLength={4000}
                rows={4}
              />
            </label>
            <label>
              Motivul modificării
              <input name="reason" minLength={10} maxLength={500} required />
            </label>
            {manage && <button>Confirmă salvarea profilului</button>}
          </fieldset>
          <p className="footnote">
            Setările nu constituie validare contabilă sau fiscală. Operațiunile
            istorice și regulile aprobate nu se recalculează prin schimbarea
            profilului.
          </p>
        </form>
      ) : (
        <>
          <p className="notice">
            Plan demonstrativ — necesită validare profesională. Clasele sunt
            disponibile pentru configurare; nu se pretinde încărcarea completă a
            planului național.
          </p>
          <input
            aria-label="Caută cont"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută după cod sau denumire"
          />
          {accountClasses.map((name, i) => (
            <details key={name} open={accounts.some((a) => a.class === i + 1)}>
              <summary>
                {i + 1}. {name}
              </summary>
              {accounts
                .filter(
                  (a) =>
                    a.class === i + 1 &&
                    `${a.code} ${a.name}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((a) => (
                  <article className="reportcard" key={a.code}>
                    <strong>
                      {a.code} · {a.name}
                    </strong>
                    <p>
                      {a.balanceNature} · {a.currency} ·{" "}
                      {a.active ? "Activ" : "Inactiv"} · din {a.validFrom}
                    </p>
                    <small>{a.source}</small>
                  </article>
                ))}
            </details>
          ))}
          {manageAccounts && (
            <details>
              <summary>Adaugă cont sau subcont</summary>
              <form onSubmit={addAccount}>
                <div className="formgrid">
                  <label>
                    Cod
                    <input name="code" pattern="[0-9]{3,8}" required />
                  </label>
                  <label>
                    Denumire
                    <input name="name" required minLength={2} />
                  </label>
                  <label>
                    Clasa
                    <select name="class">
                      {accountClasses.map((n, i) => (
                        <option value={i + 1} key={n}>
                          {i + 1}. {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tip
                    <select name="type">
                      {[
                        "asset",
                        "liability",
                        "income",
                        "expense",
                        "management",
                        "off_balance",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Natura soldului
                    <select name="balanceNature">
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                      <option value="mixed">Mixt</option>
                    </select>
                  </label>
                  <label>
                    Cont părinte (opțional)
                    <input name="parentCode" />
                  </label>
                  <label>
                    Valabil de la
                    <input name="validFrom" type="date" required />
                  </label>
                  <label>
                    Analitice (separate prin virgulă)
                    <input name="analytics" />
                  </label>
                </div>
                <label>
                  Sursa și justificarea
                  <input name="source" required minLength={10} />
                </label>
                <label className="checklabel">
                  <input name="directPosting" type="checkbox" />
                  Permite postare directă
                </label>
                <button disabled={busy}>Adaugă contul</button>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
