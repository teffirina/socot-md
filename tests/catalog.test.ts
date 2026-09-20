import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogSchema,
  validateCatalogChange,
  validateDocumentReferences,
  type CatalogEntry,
} from "../lib/catalog";
import { SyncEngine } from "../lib/sync";
import type { Snapshot } from "../lib/storage";
import { ApiError } from "../lib/api";
const partner: CatalogEntry = {
  id: crypto.randomUUID(),
  kind: "partner",
  code: "F001",
  name: "Furnizor exemplu",
  active: true,
  version: 0,
  details: { role: "furnizor" },
};
const operation = (entry: CatalogEntry) => ({
  id: crypto.randomUUID(),
  entry,
  baseVersion: entry.version,
  reason: "Configurare demonstrativă",
});
test("catalog validates references, duplicate codes, immutable identity and version conflicts", () => {
  const saved = validateCatalogChange([], operation(partner));
  assert.throws(
    () =>
      validateCatalogChange(
        [saved],
        operation({ ...partner, id: crypto.randomUUID(), code: "f001" }),
      ),
    /Cod deja/,
  );
  assert.throws(
    () => validateCatalogChange([saved], operation(partner)),
    /CONFLICT/,
  );
  assert.throws(
    () => validateCatalogChange([saved], operation({ ...saved, code: "X" })),
    /permanente/,
  );
  const contract: CatalogEntry = {
    ...partner,
    id: crypto.randomUUID(),
    kind: "contract",
    code: "CT01",
    details: { partnerId: crypto.randomUUID(), validFrom: "2026-01-01" },
  };
  assert.throws(
    () => validateCatalogChange([saved], operation(contract)),
    /Referința/,
  );
  assert.equal(
    catalogSchema.safeParse({ ...partner, details: { password: "bad" } })
      .success,
    false,
  );
});
test("document references require correct active partner and contract date", () => {
  const saved = { ...partner, version: 1 };
  const contract: CatalogEntry = {
    ...saved,
    id: crypto.randomUUID(),
    kind: "contract",
    code: "CT01",
    details: {
      partnerId: saved.id,
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    },
  };
  const doc = {
    customer: saved.name,
    kind: "expense",
    partnerId: saved.id,
    contractId: contract.id,
    date: "2026-09-20",
  };
  assert.doesNotThrow(() => validateDocumentReferences([saved, contract], doc));
  assert.throws(
    () =>
      validateDocumentReferences([saved, contract], {
        ...doc,
        date: "2027-01-01",
      }),
    /Contractul/,
  );
  assert.throws(
    () =>
      validateDocumentReferences([{ ...saved, active: false }, contract], doc),
    /Partener/,
  );
  assert.throws(
    () =>
      validateDocumentReferences([saved, contract], { ...doc, kind: "sale" }),
    /Partener/,
  );
});
test("catalog queue survives restart, lost acknowledgement and conflict confirmation", async () => {
  let disk: Snapshot = { invoices: [], pending: [] };
  let online = false,
    lost = true,
    conflict = false;
  let saved: CatalogEntry | null = null;
  const seen = new Map<string, CatalogEntry>();
  const deps = {
    read: async () => structuredClone(disk),
    write: async (_s: string, v: Snapshot) => {
      disk = structuredClone(v);
    },
    api: async (path: string, body?: any): Promise<any> => {
      if (!online) throw Error("offline");
      if (path === "/health") return {};
      if (path === "/invoices") return [];
      if (!body) return saved ? [saved] : [];
      if (seen.has(body.id)) return seen.get(body.id);
      if (conflict)
        throw new ApiError(409, {
          current: { ...saved, version: 2, name: "Server" },
        });
      saved = { ...body.entry, version: body.baseVersion + 1 };
      seen.set(body.id, saved!);
      if (lost) {
        lost = false;
        throw Error("lost ack");
      }
      return saved;
    },
  };
  let e = new SyncEngine("test", false, () => {}, deps);
  await e.load();
  await e.saveCatalog(partner, "Configurare demonstrativă");
  assert.equal(disk.catalogPending?.length, 1);
  e = new SyncEngine("test", false, () => {}, deps);
  await e.load();
  online = true;
  await e.sync();
  assert.equal(disk.catalogPending?.length, 1);
  await e.sync();
  assert.equal(disk.catalogPending?.length, 0);
  assert.equal(seen.size, 1);
  conflict = true;
  await e.saveCatalog(
    { ...disk.catalog![0], name: "Local" },
    "Corectare denumire partener",
  );
  assert.equal(disk.catalogPending?.[0].conflict?.name, "Server");
  await e.sync();
  assert.equal(seen.size, 1);
  conflict = false;
  await e.resolveCatalog(disk.catalogPending![0].id, true);
  assert.equal(disk.catalog![0].version, 3);
  assert.equal(disk.catalog![0].name, "Local");
});
