"use client";
import { useState } from "react";
import type { CatalogEntry } from "../lib/catalog";
export default function PartnerFields({
  entries,
  expense = false,
}: {
  entries: CatalogEntry[];
  expense?: boolean;
}) {
  const [id, setId] = useState("");
  const partner = entries.find((e) => e.id === id);
  return (
    <>
      <label>
        {expense ? "Furnizor din nomenclator" : "Client din nomenclator"}
        <select
          name="partnerId"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Introducere liberă (document simplificat)</option>
          {entries
            .filter(
              (e) =>
                e.kind === "partner" &&
                e.active &&
                [expense ? "furnizor" : "client", "ambele"].includes(
                  e.details.role,
                ),
            )
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        {expense ? "Furnizor" : "Client"}
        <input
          key={id}
          name={expense ? "supplier" : "customer"}
          defaultValue={partner?.name ?? ""}
          readOnly={!!partner}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        Contract
        <select key={id + "contract"} name="contractId" defaultValue="">
          <option value="">Fără contract selectat</option>
          {entries
            .filter(
              (e) =>
                e.kind === "contract" && e.active && e.details.partnerId === id,
            )
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.name}
              </option>
            ))}
        </select>
      </label>
    </>
  );
}
