import test from "node:test";
import assert from "node:assert/strict";
import { ruleSchema, demoRules } from "../lib/compliance";
import { ledgerReport, accountCard } from "../lib/ledger-report";
test("regulile păstrează subconturile și resping codurile malformate", () => {
  const rule = ruleSchema.parse({
    ...demoRules[0],
    debit: "221.1",
    credit: "611.2",
  });
  assert.equal(rule.debit, "221.1");
  for (const code of ["221.", "221..1", "221,1", "22.1", "221.a", "221.12345"])
    assert.equal(ruleSchema.safeParse({ ...rule, debit: code }).success, false);
  assert.equal(
    ruleSchema.safeParse({ ...rule, credit: "221.1" }).success,
    false,
  );
});
test("balanța și fișa nu amestecă subconturile cu contul sintetic", () => {
  const report = ledgerReport(
    [
      {
        id: "a",
        invoiceId: "i",
        debit: "221.1",
        credit: "611.2",
        amount: 10000,
        effectiveDate: "2026-10-01",
        state: "posted",
      },
      {
        id: "b",
        invoiceId: "i",
        debit: "221.2",
        credit: "611.2",
        amount: 3000,
        effectiveDate: "2026-10-02",
        state: "posted",
      },
      {
        id: "c",
        invoiceId: "i",
        debit: "221.1",
        credit: "534.4",
        amount: 2000,
        effectiveDate: "2026-10-01",
        state: "proposed",
      },
    ],
    "2026-10-01",
    "2026-10-31",
  );
  assert.equal(report.accounts.find((a) => a.code === "221.1")?.closing, 10000);
  assert.equal(accountCard(report, "221.1").length, 1);
  assert.equal(accountCard(report, "221").length, 0);
  assert.equal(report.excluded, 1);
  assert.equal(
    report.accounts.reduce((s, a) => s + a.closing, 0),
    0,
  );
});
