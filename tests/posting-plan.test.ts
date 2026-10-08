import test from "node:test";
import assert from "node:assert/strict";
import {
  allocatePosting,
  parseAllocation,
  postingGroup,
} from "../lib/posting-plan";
import { journalEntries, journal, type Invoice } from "../lib/domain";
import { demoRules } from "../lib/compliance";
const allocation = parseAllocation("713.1;521.1;60\n713.2;521.1;40")!;
test("repartizarea conservă fiecare ban inclusiv la valori mici", () => {
  for (const amount of [1, 2, 3, 99, 101, 12345, 100000000]) {
    const rows = allocatePosting(amount, allocation);
    assert.equal(
      rows.reduce((sum, r) => sum + r.amount, 0),
      amount,
    );
    assert.ok(
      rows.every((r) => Number.isSafeInteger(r.amount) && r.amount > 0),
    );
  }
  assert.deepEqual(
    allocatePosting(101, allocation).map((r) => r.amount),
    [61, 40],
  );
  assert.equal(parseAllocation(""), undefined);
  assert.throws(() => parseAllocation("713;521;60\n714;521;39"));
  assert.throws(() => parseAllocation("713;521;60.001\n714;521;39.999"));
});
test("motorul păstrează regula simplă și repartizează după versiunea aprobată", () => {
  const invoice: Invoice = {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "expense",
    customer: "Test",
    total: 101,
    paid: 0,
    version: 1,
    date: "2026-10-07",
  };
  const rules = demoRules.map((r) =>
    r.kind === "expense" ? { ...r, allocations: allocation } : r,
  );
  assert.equal(journalEntries(null, invoice).length, 1);
  assert.deepEqual(
    journalEntries(null, invoice, rules).map((r) => r.amount),
    [61, 40],
  );
  assert.throws(() => journal(null, invoice, rules), /mai multe/);
  assert.throws(
    () => journalEntries(null, invoice, rules, invoice.date, false),
    /aprobată/,
  );
  // A payment uses its own rule and only the increment paid.
  assert.equal(
    journalEntries(invoice, { ...invoice, paid: 20 }, rules)[0].amount,
    20,
  );
});
test("postarea selectează tot grupul și respinge stările mixte sau datele incompatibile", () => {
  const rows = [1, 2].map((n) => ({
    id: String(n),
    operationId: "op",
    invoiceId: "invoice",
    effectiveDate: "2026-10-07",
    state: "proposed",
    amount: 10,
  }));
  assert.equal(postingGroup(rows, "1").length, 2);
  assert.throws(() =>
    postingGroup([rows[0], { ...rows[1], state: "posted" }], "1"),
  );
  assert.throws(() =>
    postingGroup([rows[0], { ...rows[1], effectiveDate: "2026-09-30" }], "1"),
  );
  assert.throws(() =>
    postingGroup([rows[0], { ...rows[1], invoiceId: "other" }], "1"),
  );
  assert.equal(
    postingGroup(
      rows.map(({ operationId, ...e }) => e),
      "1",
    ).length,
    1,
  );
});
