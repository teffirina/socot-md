import test from "node:test";
import assert from "node:assert/strict";
import { accountDrill, assembleDrill, invoiceChanges } from "../lib/drilldown";

const e = (
  id: string,
  date: string,
  debit: string,
  credit: string,
  amount: number,
  state = "posted",
) => ({
  id,
  invoiceId: `00000000-0000-4000-8000-00000000000${id}`,
  debit,
  credit,
  amount,
  effectiveDate: date,
  state,
});
const entries = [
  e("1", "2026-09-10", "221", "611", 1000),
  e("2", "2026-10-05", "221", "611", 500),
  e("3", "2026-10-07", "242", "221", 300),
  e("4", "2026-10-08", "221", "611", 999, "proposed"),
  e("5", "2026-11-01", "221", "611", 50),
];

test("fiecare celulă a balanței se descompune în articolele ei", () => {
  const from = "2026-10-01",
    to = "2026-10-31";
  const opening = accountDrill(entries, "221", "opening", from, to);
  assert.equal(opening.steps.at(-1)!.amount, 1000);
  assert.deepEqual(
    opening.entries.map((x) => x.id),
    ["1"],
  );
  const debit = accountDrill(entries, "221", "debit", from, to);
  assert.equal(debit.steps.at(-1)!.amount, 500);
  assert.deepEqual(
    debit.entries.map((x) => x.id),
    ["2"],
  );
  const credit = accountDrill(entries, "221", "credit", from, to);
  assert.equal(credit.steps.at(-1)!.amount, 300);
  const closing = accountDrill(entries, "221", "closing", from, to);
  assert.deepEqual(
    closing.steps.map((s) => s.amount),
    [1000, 500, 300, 1200],
  );
});

test("documentele aduc calculul, articolele și istoricul lor", () => {
  const inv = {
    id: entries[1].invoiceId,
    customer: "Alfa",
    total: 500,
    paid: 200,
    version: 2,
    date: "2026-10-05",
  };
  const d = assembleDrill(
    { kind: "documents", invoiceIds: [inv.id] },
    entries,
    [inv],
    [
      {
        at: "2026-10-06T10:00:00Z",
        who: "Contabil",
        invoiceId: inv.id,
        what: "Document modificat",
        changes: invoiceChanges({ ...inv, paid: 0 }, inv),
      },
      {
        at: "2026-10-06T10:00:00Z",
        who: "x",
        invoiceId: "other",
        what: "",
        changes: [],
      },
    ],
  );
  assert.deepEqual(
    d.steps.map((s) => s.amount),
    [500, 200, 300],
  );
  assert.deepEqual(
    d.entries.map((x) => x.id),
    ["2"],
  );
  assert.equal(d.history.length, 1);
  assert.deepEqual(d.history[0].changes, [
    { field: "Achitat", before: "0,00", after: "2,00" },
  ]);
});
