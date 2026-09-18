import test from "node:test";
import assert from "node:assert/strict";
import { ledgerReport, accountCard, type Entry } from "../lib/ledger-report";
const entry = (
  id: string,
  date: string,
  debit: string,
  credit: string,
  amount: number,
  state = "posted",
): Entry => ({
  id,
  invoiceId: id,
  effectiveDate: date,
  debit,
  credit,
  amount,
  state,
});
test("balanța separă soldul inițial, rulajul și exclude articolele nepostate", () => {
  const rows = [
    entry("a", "2026-08-01", "221", "611", 10000),
    entry("b", "2026-09-01", "242", "221", 4000),
    entry("c", "2026-09-02", "221", "611", 7000, "proposed"),
    entry("d", "2026-10-01", "242", "221", 3000),
  ];
  const r = ledgerReport(rows, "2026-09-01", "2026-09-30");
  assert.deepEqual(
    r.accounts.find((a) => a.code === "221"),
    { code: "221", opening: 10000, debit: 0, credit: 4000, closing: 6000 },
  );
  assert.equal(r.excluded, 1);
  assert.equal(
    r.accounts.reduce((n, a) => n + a.closing, 0),
    0,
  );
  assert.equal(accountCard(r, "221")[0].balance, 6000);
  assert.equal(r.movements.length, 1);
});
test("limitele perioadei sunt incluse și rândurile fără dată nu produc solduri", () => {
  const r = ledgerReport(
    [
      entry("a", "2026-09-01", "221", "611", 100),
      entry("b", "2026-09-30", "242", "221", 100),
      { ...entry("c", "2026-09-20", "221", "611", 500), effectiveDate: null },
    ],
    "2026-09-01",
    "2026-09-30",
  );
  assert.equal(r.movements.length, 2);
  assert.equal(r.excluded, 1);
  assert.equal(r.accounts.find((a) => a.code === "221")?.closing, 0);
});
test("refuză intervale inversate și sume contabile invalide", () => {
  assert.throws(() => ledgerReport([], "2026-10-01", "2026-09-01"));
  assert.throws(() =>
    ledgerReport(
      [entry("a", "2026-09-01", "221", "611", 1.5)],
      "2026-09-01",
      "2026-09-30",
    ),
  );
});
