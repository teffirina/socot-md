import test from "node:test";
import assert from "node:assert/strict";
import {
  documentAmount,
  documentProgress,
  type DocumentDraft,
} from "../lib/document-workflow";
import { SyncEngine } from "../lib/sync";
import type { Snapshot } from "../lib/storage";
const draft: DocumentDraft = {
  id: "abfb3b7e-79dd-4fbd-8dc6-f189e66c7c1e",
  kind: "expense",
  customer: "Socot test fictiv",
  category: "Servicii",
  partnerId: null,
  contractId: null,
  total: 12345,
  date: "2026-10-03",
  revision: 0,
};
function fixture(demo = true) {
  let disk: Snapshot | null = null;
  let fail = false;
  const deps = {
    read: async () => structuredClone(disk),
    write: async (_: string, s: Snapshot) => {
      if (fail) throw Error("disk full");
      disk = structuredClone(s);
    },
    api: async (): Promise<any> => {
      throw Error("offline");
    },
  };
  return {
    create: () => new SyncEngine("test", demo, () => {}, deps),
    fail: () => {
      fail = true;
    },
    disk: () => disk,
  };
}
test("ciorna supraviețuiește restartului fără solduri sau jurnal; confirmarea creează o singură propunere", async () => {
  const f = fixture();
  let e = f.create();
  await e.load();
  const count = e.state.invoices.length,
    entries = e.state.ledger!.length;
  await e.saveDraft(draft);
  e = f.create();
  await e.load();
  assert.equal(e.state.drafts![0].revision, 1);
  assert.equal(e.state.invoices.length, count);
  assert.equal(e.state.ledger!.length, entries);
  await e.confirmDraft(draft.id, 1);
  assert.equal(e.state.drafts!.length, 0);
  assert.equal(e.state.invoices.length, count + 1);
  assert.equal(documentProgress(draft.id, e.state), "De verificat");
  await assert.rejects(e.confirmDraft(draft.id, 1));
  assert.equal(e.state.ledger!.length, entries + 1);
});
test("verificarea veche nu confirmă o ciornă modificată", async () => {
  const f = fixture(),
    e = f.create();
  await e.load();
  await e.saveDraft(draft);
  await e.saveDraft({ ...draft, total: 600, revision: 1 });
  await assert.rejects(e.confirmDraft(draft.id, 1), /modificat/);
  assert.equal(e.state.drafts![0].total, 600);
});
test("offline: trecerea ciornă → coadă este atomică și rezistă repornirii", async () => {
  const f = fixture(false);
  let e = f.create();
  await e.load();
  await e.saveDraft(draft);
  await e.confirmDraft(draft.id, 1);
  e = f.create();
  await e.load();
  assert.equal(e.state.drafts!.length, 0);
  assert.equal(e.state.pending.length, 1);
  assert.equal(e.state.pending[0].invoice.total, 12345);
  assert.equal(documentProgress(draft.id, e.state), "În sincronizare");
});
test("eroarea de disc păstrează ciorna și nu o înregistrează", async () => {
  const f = fixture(false),
    e = f.create();
  await e.load();
  await e.saveDraft(draft);
  f.fail();
  await assert.rejects(e.confirmDraft(draft.id, 1), /disk full/);
  assert.equal(e.state.drafts!.length, 1);
  assert.equal(e.state.pending.length, 0);
});
test("confirmări simultane nu dublează documentul", async () => {
  const f = fixture(),
    e = f.create();
  await e.load();
  await e.saveDraft(draft);
  const results = await Promise.allSettled([
    e.confirmDraft(draft.id, 1),
    e.confirmDraft(draft.id, 1),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(e.state.invoices.filter((i) => i.id === draft.id).length, 1);
});
test("ciorne incomplete și sume precise", async () => {
  assert.equal(documentAmount("1,01"), 101);
  assert.equal(documentAmount("0.29"), 29);
  assert.throws(() => documentAmount("1.005"));
  assert.throws(() => documentAmount("-1"));
  const f = fixture(),
    e = f.create();
  await e.load();
  await e.saveDraft({ ...draft, customer: "", total: 0 });
  await assert.rejects(e.confirmDraft(draft.id, 1));
  assert.equal(e.state.drafts!.length, 1);
});

test("confirmarea repartizată salvează atomic toate articolele și păstrează grupul după restart", async () => {
  const f = fixture();
  let e = f.create();
  await e.load();
  const compliance = e.state.compliance!;
  await e.configure({
    ...compliance,
    rules: compliance.rules.map((r) =>
      r.kind === draft.kind
        ? {
            ...r,
            allocations: [
              { debit: "713.1", credit: "521.1", weight: 6000 },
              { debit: "713.2", credit: "521.1", weight: 4000 },
            ],
          }
        : r,
    ),
  });
  await e.saveDraft(draft);
  await e.confirmDraft(draft.id, 1);
  e = f.create();
  await e.load();
  const entries = e.state.ledger!.filter((r) => r.invoiceId === draft.id);
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map((r) => r.operationId)).size, 1);
  assert.equal(new Set(entries.map((r) => r.id)).size, 2);
  assert.deepEqual(
    entries.map((r) => r.lineNo),
    [1, 2],
  );
  assert.equal(
    entries.reduce((s, r) => s + r.amount, 0),
    draft.total,
  );
  await assert.rejects(e.confirmDraft(draft.id, 1));
  assert.equal(
    e.state.ledger!.filter((r) => r.invoiceId === draft.id).length,
    2,
  );
});

test("pozițiile incomplete supraviețuiesc restartului și nu ajung în coada contabilă", async () => {
  const f = fixture(false);
  let e = f.create();
  await e.load();
  const lines = [
    {
      id: crypto.randomUUID(),
      description: "Pregătire",
      unit: "buc.",
      quantity: "1",
      price: "2500",
      vat: "20",
      priceMode: "gross" as const,
      category: "service" as const,
    },
  ];
  await e.saveDraft({ ...draft, lines, total: 1 });
  assert.equal(e.state.drafts![0].total, 250000);
  await assert.rejects(e.confirmDraft(draft.id, 1), /Confirmarea contabilă/);
  assert.equal(e.state.pending.length, 0);
  await e.saveDraft({
    ...e.state.drafts![0],
    lines: [{ ...lines[0], price: "" }],
  });
  e = f.create();
  await e.load();
  assert.equal(e.state.drafts![0].lines![0].price, "");
  assert.equal(e.state.drafts![0].total, 0);
  assert.equal(e.state.pending.length, 0);
});
