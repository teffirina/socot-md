"use client";
import { useEffect, useState } from "react";
import { dashboardMoney } from "../lib/dashboard";
import {
  decide,
  proposals,
  type DepreciationRegister,
  type Proposal,
} from "../lib/depreciation";
import { readValue, writeValue, type Snapshot } from "../lib/storage";
import type { SyncEngine } from "../lib/sync";
import { exportWorkbook } from "../lib/workbook";

const money = (bani: number) => dashboardMoney(bani, false);

// Monthly depreciation proposals; the user accepts or rejects each line.
export default function DepreciationPanel({
  engine,
  snapshot,
  writable,
  navigate,
}: {
  engine: SyncEngine;
  snapshot: Snapshot;
  writable: boolean;
  navigate: (view: string) => void;
}) {
  const key = `${engine.scope}:depreciation-v1`;
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [register, setRegister] = useState<DepreciationRegister | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    readValue<DepreciationRegister>(key)
      .then((r) => live && setRegister(r ?? {}))
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [key]);
  if (!register) return null;
  const { ready, incomplete } = proposals(
    snapshot.catalog ?? [],
    register,
    month,
  );
  const open = ready.filter((p) => !p.decision && p.amount !== 0);
  const accepted = Object.entries(register)
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([m, rows]) =>
      Object.entries(rows)
        .filter(([, d]) => d.decision === "accepted")
        .map(([id, d]) => ({
          month: m,
          name:
            snapshot.catalog?.find((a) => a.id === id)?.name ?? "Mijloc fix",
          ...d,
        })),
    );

  async function save(next: DepreciationRegister) {
    setError("");
    try {
      await writeValue(key, next);
      setRegister(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const set = (p: Proposal, d: "accepted" | "rejected" | null) =>
    save(decide(register, p, d));

  async function download() {
    const bytes = await exportWorkbook([
      ["Luna", "Mijloc fix", "Debit", "Credit", "Suma"],
      ...accepted.map((a) => [
        a.month,
        a.name,
        a.debit,
        a.credit,
        (a.amount / 100).toFixed(2),
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Socot-uzura.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="home-panel depreciation" data-t="depreciation">
      <div className="home-panel-head">
        <div>
          <p className="eyebrow">Calcul automat</p>
          <h2>Uzura mijloacelor fixe</h2>
        </div>
        <label className="depreciation-month">
          Luna
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </div>
      <p className="muted">
        Socot calculează uzura liniară din fișa fiecărui mijloc fix, începând cu
        luna de după punerea în funcțiune. Dacă schimbi valoarea sau durata, ori
        respingi o lună, diferența apare automat în luna următoare. Nimic nu se
        înregistrează fără acordul tău.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {ready.length ? (
        <div className="tablewrap">
          <table className="home-table">
            <thead>
              <tr>
                <th>MIJLOC FIX</th>
                <th className="right">VALOARE</th>
                <th className="right">AMORTIZAT ANTERIOR</th>
                <th className="right">PROPUS</th>
                <th>ARTICOL</th>
                <th className="right">RĂMÂNE</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ready.map((p) => (
                <tr key={p.asset.id}>
                  <td>
                    <strong>{p.asset.name}</strong>
                    <small className="num">{p.asset.code}</small>
                  </td>
                  <td className="num right">{money(p.asset.cost)}</td>
                  <td className="num right">{money(p.booked)}</td>
                  <td className="num right">
                    <strong>{money(p.amount)}</strong>
                    {p.note && <small>{p.note}</small>}
                  </td>
                  <td className="num">
                    {p.amount < 0
                      ? `Dt ${p.asset.credit} · Ct ${p.asset.debit}`
                      : `Dt ${p.asset.debit} · Ct ${p.asset.credit}`}
                  </td>
                  <td className="num right">{money(p.remaining)}</td>
                  <td className="depreciation-actions">
                    {p.decision ? (
                      <>
                        <span
                          className={`status-pill ${p.decision.decision === "accepted" ? "success" : "muted"}`}
                        >
                          {p.decision.decision === "accepted"
                            ? "Acceptat"
                            : "Respins"}
                        </span>
                        {writable && (
                          <button
                            className="textbutton"
                            onClick={() => void set(p, null)}
                          >
                            Schimbă
                          </button>
                        )}
                      </>
                    ) : p.amount === 0 ? (
                      <span className="muted">Nimic de calculat</span>
                    ) : (
                      writable && (
                        <>
                          <button onClick={() => void set(p, "accepted")}>
                            Acceptă
                          </button>
                          <button
                            className="secondary"
                            onClick={() => void set(p, "rejected")}
                          >
                            Respinge
                          </button>
                        </>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          Nu există uzură de calculat pentru această lună.
        </p>
      )}
      <div className="depreciation-foot">
        {writable && open.length > 1 && (
          <button
            onClick={() =>
              void save(
                open.reduce((r, p) => decide(r, p, "accepted"), register),
              )
            }
          >
            Acceptă toate ({money(open.reduce((s, p) => s + p.amount, 0))} MDL)
          </button>
        )}
        {accepted.length > 0 && (
          <button className="secondary" onClick={() => void download()}>
            Descarcă articolele acceptate (.xlsx)
          </button>
        )}
      </div>
      {incomplete.length > 0 && (
        <div className="depreciation-incomplete">
          <p className="eyebrow">Fișe de completat</p>
          <ul>
            {incomplete.map(({ asset, reason }) => (
              <li key={asset.id}>
                <strong>{asset.name}</strong> · {reason}
              </li>
            ))}
          </ul>
          <button
            className="textbutton"
            onClick={() => navigate("catalog:asset")}
          >
            Deschide registrul mijloacelor fixe →
          </button>
        </div>
      )}
      <p className="footnote">
        Uzura acceptată se păstrează în registrul de uzură din acest profil și
        se descarcă în Excel. Încă nu se postează automat în registrul contabil
        general.
      </p>
    </section>
  );
}
