"use client";
import { useEffect, useState } from "react";
import { accountSchema, demoAccounts, type Account } from "../lib/company";
import { initialCompliance } from "../lib/compliance";
import { api } from "../lib/api";
import { can } from "../lib/permissions";
import type { Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
export default function AccountsPanel({
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
  const [accounts, setAccounts] = useState<Account[]>(
      demo ? (snapshot.accounts ?? demoAccounts) : [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(false);
  async function load() {
    if (!demo)
      setAccounts(
        (await api("/accounts")).map((r: { data: Account }) => r.data),
      );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [demo]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const code = String(f.get("code"));
      const account = accountSchema.parse({
        code,
        name: f.get("name"),
        class: Number(code[0]),
        type: f.get("type"),
        balanceNature: f.get("balanceNature"),
        currency: f.get("currency"),
        analytics: String(f.get("analytics"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        parentCode: f.get("parentCode") || null,
        validFrom: f.get("validFrom"),
        validTo: null,
        source: f.get("source"),
        directPosting: f.get("directPosting") === "on",
        active: true,
      });
      if (account.parentCode === account.code)
        throw Error("Un cont nu poate fi propriul părinte.");
      if (demo) {
        if (accounts.some((a) => a.code === code))
          throw Error("Cod deja existent.");
        if (
          account.parentCode &&
          !accounts.some((a) => a.code === account.parentCode)
        )
          throw Error("Contul părinte lipsește.");
        const next = [...accounts, account];
        const c = snapshot.compliance ?? initialCompliance();
        await engine.commit({
          ...engine.state,
          accounts: next,
          compliance: {
            ...c,
            audit: [
              {
                id: crypto.randomUUID(),
                actor: "Utilizator demo",
                action: "account.created",
                objectId: code,
                reason: account.source,
                at: new Date().toISOString(),
              },
              ...c.audit,
            ],
          },
        });
        setAccounts(next);
      } else {
        await api("/accounts", account);
        await load();
      }
      setForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <h3>Plan de conturi · configurare avansată</h3>
      <p className="muted">
        Conturi și analitice validate de contabil. Lista demonstrativă nu
        reprezintă planul național complet.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(demo || can(role, "accounts.manage")) && (
        <button disabled={busy} onClick={() => setForm(!form)}>
          {form ? "Închide formularul" : "＋ Cont / subcont"}
        </button>
      )}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cod</th>
              <th>Denumire</th>
              <th>Natură sold</th>
              <th>Monedă</th>
              <th>Analitice</th>
            </tr>
          </thead>
          <tbody>
            {[...accounts]
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((a) => (
                <tr key={a.code}>
                  <td>{a.code}</td>
                  <td>{a.name}</td>
                  <td>
                    {
                      { debit: "Debitor", credit: "Creditor", mixed: "Mixt" }[
                        a.balanceNature
                      ]
                    }
                  </td>
                  <td>{a.currency}</td>
                  <td>{a.analytics.join(", ")}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {form && (
        <form onSubmit={save}>
          <label>
            Cod
            <input name="code" pattern="[0-9]{3,8}" required />
          </label>
          <label>
            Denumire
            <input name="name" minLength={2} maxLength={150} required />
          </label>
          <label>
            Cont părinte
            <select name="parentCode">
              <option value="">Fără părinte</option>
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tip
            <select name="type">
              {[
                ["asset", "Activ"],
                ["liability", "Datorie / capital"],
                ["income", "Venit"],
                ["expense", "Cheltuială"],
                ["management", "Gestiune"],
                ["off_balance", "Extrabilanțier"],
              ].map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Natura soldului
            <select name="balanceNature">
              <option value="debit">Debitor</option>
              <option value="credit">Creditor</option>
              <option value="mixed">Mixt</option>
            </select>
          </label>
          <label>
            Monedă
            <select name="currency">
              <option>MDL</option>
              <option>EUR</option>
              <option>USD</option>
            </select>
          </label>
          <label>
            Analitice, separate prin virgulă
            <input name="analytics" maxLength={400} />
          </label>
          <label>
            Valabil din
            <input type="date" name="validFrom" required />
          </label>
          <label>
            Temei / sursă
            <input name="source" minLength={10} maxLength={500} required />
          </label>
          <label>
            <input type="checkbox" name="directPosting" defaultChecked />
            Permite postare directă
          </label>
          <button disabled={busy}>Confirmă contul</button>
        </form>
      )}
    </div>
  );
}
