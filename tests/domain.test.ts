import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOperation,
  invoiceSchema,
  journal,
  totals,
  type Invoice,
} from "../lib/domain";
const invoice: Invoice = {
  id: "12ba4c18-1b5e-4afa-845d-6807728c36bc",
  customer: "Socot client fictiv",
  total: 600000,
  paid: 0,
  version: 0,
  date: "2026-09-17",
};
test("factură → articol echilibrat → plată parțială → creanță", () => {
  const created = applyOperation(null, {
    id: crypto.randomUUID(),
    invoice,
    baseVersion: 0,
  });
  const sale = journal(null, created);
  assert.deepEqual(sale, { debit: "221", credit: "611", amount: 600000 });
  const paid = applyOperation(created, {
    id: crypto.randomUUID(),
    invoice: { ...created, paid: 200000 },
    baseVersion: 1,
  });
  assert.deepEqual(journal(created, paid), {
    debit: "242",
    credit: "221",
    amount: 200000,
  });
  assert.deepEqual(totals([paid]), {
    sales: 600000,
    paid: 200000,
    due: 400000,
  });
});
test("refuză conflictul de versiune și scăderea încasării", () => {
  assert.throws(
    () =>
      applyOperation(
        { ...invoice, version: 2 },
        { id: crypto.randomUUID(), invoice, baseVersion: 1 },
      ),
    /CONFLICT/,
  );
  assert.throws(
    () =>
      applyOperation(
        { ...invoice, paid: 100, version: 1 },
        { id: crypto.randomUUID(), invoice, baseVersion: 1 },
      ),
    /încasări/,
  );
});
test("refuză sume fracționare, plăți excedentare și clienți goi", () => {
  for (const bad of [
    { total: 0 },
    { total: 1.2 },
    { paid: 700000 },
    { customer: "" },
  ])
    assert.equal(
      invoiceSchema.safeParse({ ...invoice, ...bad }).success,
      false,
    );
});
import { demoData } from "../lib/demo";
test("datele demonstrative au documente și jurnal echilibrat pentru trei luni", () => {
  const s = demoData();
  assert.equal(s.invoices.length, 6);
  assert.equal(new Set(s.invoices.map((i) => i.date.slice(0, 7))).size, 3);
  const sale = s
    .ledger!.filter((j) => j.debit === "221")
    .reduce((a, j) => a + j.amount, 0);
  const paid = s
    .ledger!.filter((j) => j.debit === "242")
    .reduce((a, j) => a + j.amount, 0);
  assert.equal(sale, totals(s.invoices).sales);
  assert.equal(paid, totals(s.invoices).paid);
});
