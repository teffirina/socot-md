"use client";
import { useEffect, useState } from "react";
import { companySchema, demoCompany, type Company } from "../lib/company";
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
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const manage = demo || can(role, "company.manage");
  async function load() {
    if (demo) return;
    const result = await api("/company");
    setData(result.data);
    setVersion(result.version);
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
  return (
    <section className="panel settings compliance">
      <p className="eyebrow">ÎNTREPRINDERE</p>
      <h2>Identitatea și politica firmei</h2>
      <div className="controls">
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
      ) : (
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
      )}
    </section>
  );
}
