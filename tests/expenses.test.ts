import test from "node:test";
import assert from "node:assert/strict";
import { applyOperation, invoiceSchema, journal } from "../lib/domain";
import { SyncEngine } from "../lib/sync";
import type { Snapshot } from "../lib/storage";
const expense = invoiceSchema.parse({
  id: crypto.randomUUID(),
  kind: "expense",
  category: "Chirie",
  customer: "Furnizor test",
  date: "2026-09-19",
  total: 150000,
  paid: 0,
  version: 0,
});
test("cheltuială și plată parțială au sens contabil distinct de vânzare", () => {
  const issued = applyOperation(null, {
    id: crypto.randomUUID(),
    invoice: expense,
    baseVersion: 0,
  });
  assert.deepEqual(journal(null, issued), {
    debit: "713",
    credit: "521",
    amount: 150000,
  });
  const paid = applyOperation(issued, {
    id: crypto.randomUUID(),
    invoice: { ...issued, paid: 50000 },
    baseVersion: 1,
  });
  assert.deepEqual(journal(issued, paid), {
    debit: "521",
    credit: "242",
    amount: 50000,
  });
  assert.throws(() =>
    applyOperation(issued, {
      id: crypto.randomUUID(),
      invoice: { ...issued, kind: "sale" },
      baseVersion: 1,
    }),
  );
  assert.throws(() => invoiceSchema.parse({ ...paid, paid: 150001 }));
  assert.throws(
    () =>
      applyOperation(paid, {
        id: crypto.randomUUID(),
        invoice: { ...paid, paid: 60000 },
        baseVersion: 1,
      }),
    /CONFLICT/,
  );
});
test("cheltuială offline persistă după restart și sincronizare fără a pierde profilul", async () => {
  let disk: Snapshot = {
    invoices: [],
    pending: [],
    company: { name: "Profile retained" } as any,
  };
  let online = false;
  const deps = {
    read: async () => structuredClone(disk),
    write: async (_s: string, v: Snapshot) => {
      disk = structuredClone(v);
    },
    api: async (path: string, body?: any): Promise<any> => {
      if (!online) throw Error("offline");
      if (path === "/health") return {};
      if (path === "/catalog") return [];
      if (path === "/invoices") return [{ ...expense, version: 1 }];
      return { ...body.invoice, version: 1 };
    },
  };
  let e = new SyncEngine("test", false, () => {}, deps);
  await e.load();
  await e.enqueue(expense);
  assert.equal(disk.pending[0].invoice.kind, "expense");
  e = new SyncEngine("test", false, () => {}, deps);
  await e.load();
  online = true;
  await e.sync();
  assert.equal(disk.pending.length, 0);
  assert.equal(disk.invoices[0].kind, "expense");
  assert.equal((disk.company as any).name, "Profile retained");
});
