import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReconciliation,
  paymentsFromLedger,
  reconciliationSchema,
} from "../lib/reconciliation";
import type { Invoice } from "../lib/domain";

const inv = (o: Partial<Invoice>): Invoice => ({
  id: "00000000-0000-4000-8000-000000000001",
  customer: "Client A",
  total: 0,
  paid: 0,
  version: 1,
  date: "2026-10-01",
  ...o,
});
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const D = "00000000-0000-4000-8000-00000000000d";
const invoices = [
  inv({ id: A, date: "2026-10-02", total: 100000, sourceRef: "V-1" }),
  inv({ id: B, date: "2026-10-10", total: 50000 }),
  inv({ id: C, date: "2026-09-15", total: 99900 }),
  inv({ id: D, date: "2026-10-05", total: 70000, customer: "Alt client" }),
  inv({ id: "00000000-0000-4000-8000-00000000000e", date: "2026-10-06", total: 80000, kind: "expense" }),
];

test("încasările se deduc din jurnal, fără articolul de emitere", () => {
  const p = paymentsFromLedger([
    { id: "1", invoiceId: A, operationId: "op1", amount: 100000, effectiveDate: "2026-10-02" },
    { id: "2", invoiceId: A, operationId: "op2", amount: 30000, effectiveDate: "2026-10-08" },
    { id: "3", invoiceId: A, operationId: "op2", amount: 10000, effectiveDate: "2026-10-08" },
    { id: "4", invoiceId: D, amount: 70000, effectiveDate: "2026-10-05" },
    { id: "5", invoiceId: D, amount: 5000, effectiveDate: "2026-10-09" },
  ]);
  assert.deepEqual(p, [
    { invoiceId: A, date: "2026-10-08", amount: 40000 },
    { invoiceId: D, date: "2026-10-09", amount: 5000 },
  ]);
});

test("vânzările la credit, încasările la debit, doar pentru client și perioadă", () => {
  const payments = [
    { invoiceId: A, date: "2026-10-08", amount: 40000 },
    { invoiceId: A, date: "2026-10-20", amount: 10000 },
    { invoiceId: C, date: "2026-09-30", amount: 9900 },
    { invoiceId: D, date: "2026-10-09", amount: 5000 },
  ];
  const r = buildReconciliation(invoices, payments, "Client A", "2026-10-01", "2026-10-15");
  assert.deepEqual(r.rows.map((x) => x.date), ["2026-10-02", "2026-10-08", "2026-10-10"]);
  assert.equal(r.rows[0].document, "Factura V-1");
  assert.equal(r.rulajCredit, 150000);
  assert.equal(r.rulajDebit, 40000);
  assert.equal(r.soldInitial, 90000);
  assert.equal(r.soldFinal, 200000);
});

test("fără perioadă include toate vânzările clientului și ignoră cheltuielile", () => {
  const r = buildReconciliation(invoices, [], "Client A");
  assert.equal(r.soldInitial, 0);
  assert.equal(r.rulajCredit, 249900);
  assert.equal(r.soldFinal, 249900);
});

test("perioada inversată este respinsă", () => {
  assert.throws(() =>
    reconciliationSchema.parse({ customer: "Client A", from: "2026-10-31", to: "2026-10-01" }),
  );
});
