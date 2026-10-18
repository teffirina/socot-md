import test from "node:test";
import assert from "node:assert/strict";
import { SyncEngine } from "../lib/sync";
import { ApiError } from "../lib/api";
import type { Snapshot } from "../lib/storage";
import type { Invoice } from "../lib/domain";
const invoice: Invoice = {
  id: "12ba4c18-1b5e-4afa-845d-6807728c36bc",
  customer: "Socot client fictiv",
  total: 10000,
  paid: 0,
  version: 0,
  date: "2026-09-17",
};
function harness() {
  let disk: Snapshot | null = null;
  let online = false;
  let saved: Invoice | null = null;
  let calls = 0;
  let conflict = false;
  let lostAck = false;
  const seen = new Map<string, Invoice>();
  const deps = {
    read: async () => structuredClone(disk),
    write: async (_scope: string, s: Snapshot) => {
      disk = structuredClone(s);
    },
    api: async (path: string, body?: any): Promise<any> => {
      if (!online) throw new Error("offline");
      if (path === "/health") return { ok: true };
      if (path === "/catalog") return [];
      if (path === "/invoices") return saved ? [saved] : [];
      if (path === "/tasks") return [];
      calls++;
      if (seen.has(body.id)) return seen.get(body.id);
      if (conflict)
        throw new ApiError(409, {
          current: { ...invoice, paid: 2000, version: 3 },
        });
      saved = { ...body.invoice, version: body.baseVersion + 1 };
      seen.set(body.id, saved!);
      if (lostAck) {
        lostAck = false;
        throw new Error("connection interrupted after commit");
      }
      return saved;
    },
  };
  const engine = () => new SyncEngine("company:user", false, () => {}, deps);
  return {
    engine,
    setOnline: () => (online = true),
    setConflict: (v: boolean) => (conflict = v),
    loseAck: () => (lostAck = true),
    calls: () => calls,
    disk: () => disk,
  };
}
test("coada supraviețuiește restartului și se sincronizează la revenire", async () => {
  const h = harness();
  let e = h.engine();
  await e.load();
  await e.enqueue(invoice);
  assert.equal(h.disk()?.pending.length, 1);
  e = h.engine();
  await e.load();
  assert.equal(e.state.pending.length, 1);
  h.setOnline();
  await e.sync();
  assert.equal(h.disk()?.pending.length, 0);
  assert.equal(e.state.invoices[0].total, 10000);
});
test("răspuns pierdut: retry folosește același ID fără dublare", async () => {
  const h = harness();
  h.setOnline();
  h.loseAck();
  let e = h.engine();
  await e.load();
  await e.enqueue(invoice);
  const id = e.state.pending[0].id;
  e = h.engine();
  await e.load();
  assert.equal(e.state.pending[0].id, id);
  await e.sync();
  assert.equal(e.state.pending.length, 0);
  assert.equal(e.state.invoices[0].version, 1);
  assert.equal(h.calls(), 2);
});
test("conflictul oprește retry până la decizia utilizatorului", async () => {
  const h = harness();
  h.setOnline();
  h.setConflict(true);
  const e = h.engine();
  await e.load();
  await e.enqueue(invoice);
  assert.equal(e.state.pending[0].conflict?.version, 3);
  await e.sync();
  assert.equal(h.calls(), 1);
  h.setConflict(false);
  await e.resolve(e.state.pending[0].id, false);
  assert.equal(e.state.pending.length, 0);
});
test("eșecul discului nu anunță o salvare reușită", async () => {
  const e = new SyncEngine("c:u", false, () => {}, {
    read: async () => null,
    write: async () => {
      throw new Error("disk full");
    },
    api: async () => {
      throw new Error("must not send");
    },
  });
  await e.load();
  await assert.rejects(() => e.enqueue(invoice), /disk full/);
  assert.equal(e.state.pending.length, 0);
});
test("apelurile simultane nu trimit aceeași operațiune în paralel", async () => {
  const h = harness();
  const e = h.engine();
  await e.load();
  await e.enqueue(invoice);
  h.setOnline();
  await Promise.all([e.sync(), e.sync(), e.sync()]);
  assert.equal(h.calls(), 1);
});
test("confirmarea locală pe o versiune nouă rămâne un nou act explicit", async () => {
  const h = harness();
  h.setOnline();
  h.setConflict(true);
  const e = h.engine();
  await e.load();
  await e.enqueue({ ...invoice, paid: 3000, version: 1 });
  const oldId = e.state.pending[0].id;
  h.setConflict(false);
  await e.resolve(oldId, true);
  assert.equal(e.state.pending.length, 0);
  assert.equal(e.state.invoices[0].version, 4);
  assert.equal(e.state.invoices[0].paid, 3000);
});
