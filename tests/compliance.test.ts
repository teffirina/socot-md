import test from "node:test";
import assert from "node:assert/strict";
import {
  demoRules,
  approveRule,
  selectRule,
  assertPeriodOpen,
  reportTransition,
  UnconfiguredAuthorityAdapter,
  type Report,
} from "../lib/compliance";
test("o versiune nouă nu schimbă regulile documentelor istorice", () => {
  const old = structuredClone(demoRules[0]);
  const next = {
    ...old,
    id: "new",
    version: 2,
    debit: "222",
    validFrom: "2027-01-01",
    status: "draft" as const,
    approvedBy: null,
  };
  const rules = approveRule([old, next], "new", "Contabil");
  assert.equal(selectRule(rules, "sale", "2026-12-31", true).version, 1);
  assert.equal(selectRule(rules, "sale", "2027-01-01", true).version, 2);
  assert.equal(rules[0].validTo, null);
});
test("regulile demo nu sunt acceptate implicit în producție", () => {
  assert.throws(() => selectRule(demoRules, "sale", "2026-09-18"), /Nu există/);
});
test("nu aprobă o versiune retroactivă sau cu număr duplicat", () => {
  assert.throws(
    () =>
      approveRule(
        [
          ...demoRules,
          {
            ...demoRules[0],
            id: "new",
            version: 2,
            validFrom: "1999-01-01",
            status: "draft",
            approvedBy: null,
          },
        ],
        "new",
        "Contabil",
      ),
    /după/,
  );
});
test("perioada închisă blochează doar datele din luna închisă", () => {
  const periods = [
    {
      month: "2026-09",
      closed: true,
      reason: "Închidere verificată",
      changedBy: "Contabil",
    },
  ];
  assert.throws(() => assertPeriodOpen(periods, "2026-09-18"), /închisă/);
  assert.doesNotThrow(() => assertPeriodOpen(periods, "2026-10-01"));
});
test("un raport exportat nu devine acceptat fără transmitere și recipisă", () => {
  const report: Report = {
    id: "r",
    status: "generated",
    createdAt: "2026-09-18",
    rows: [],
    sourceIds: [],
  };
  const exported = reportTransition(report, "exported");
  assert.throws(
    () => reportTransition(exported, "accepted", "fake"),
    /nepermisă/,
  );
  assert.throws(() => reportTransition(exported, "sent"), /oficială/);
});
test("adaptorul neconfigurat nu simulează transmiterea", async () => {
  await assert.rejects(
    () =>
      new UnconfiguredAuthorityAdapter().send({
        id: "r",
        status: "exported",
        createdAt: "2026-09-18",
        rows: [],
        sourceIds: [],
      }),
    /netransmisă/,
  );
});
test("expirarea versiunii noi nu reactivează automat o versiune înlocuită", () => {
  const rules = [
    ...demoRules,
    {
      ...demoRules[0],
      id: "limited",
      version: 2,
      validFrom: "2027-01-01",
      validTo: "2027-01-31",
    },
  ];
  assert.throws(
    () => selectRule(rules, "sale", "2027-02-01", true),
    /Nu există/,
  );
});
