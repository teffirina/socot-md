import { describe, expect, it } from "vitest";
import { buildReconciliation } from "./reconciliation";
import type { Doc } from "./documents";

const doc = (over: Partial<Doc>): Doc => ({
  id: "d1", company_id: "c1", kind: "sale", number: "V-1", date: "2026-10-01",
  partner_id: null, partner_name: "Client A", category: "", description: "",
  total: 0, paid: 0, status: "confirmed", created_by: "u1", created_at: "", invoice_details: null, ...over,
});

describe("buildReconciliation", () => {
  const docs = [
    doc({ id: "d1", number: "V-1", date: "2026-10-02", total: 100000 }),
    doc({ id: "d2", number: "V-2", date: "2026-10-10", total: 50000 }),
    doc({ id: "d3", number: "V-3", date: "2026-09-15", total: 99900 }), // în afara perioadei
    doc({ id: "d4", number: "V-4", date: "2026-10-05", total: 70000, partner_name: "Alt client" }),
    doc({ id: "d5", number: "V-5", date: "2026-10-06", total: 80000, status: "draft" }),
  ];
  const payments = [
    { date: "2026-10-08", amount: 40000, document_id: "d1", documents: { number: "V-1" } },
    { date: "2026-10-20", amount: 10000, document_id: "d1", documents: { number: "V-1" } }, // după perioadă
    { date: "2026-10-09", amount: 5000, document_id: "d4", documents: { number: "V-4" } }, // alt client
  ];

  it("pune vânzările la credit și încasările la debit, doar în perioadă și pentru clientul ales", () => {
    const r = buildReconciliation(docs, payments, "Client A", "2026-10-01", "2026-10-15");
    expect(r.rows).toHaveLength(3);
    expect(r.rulajCredit).toBe(150000);
    expect(r.rulajDebit).toBe(40000);
    expect(r.soldFinal).toBe(110000);
    expect(r.rows.map((x) => x.date)).toEqual(["2026-10-02", "2026-10-08", "2026-10-10"]);
  });

  it("fără perioadă include toate documentele confirmate ale clientului", () => {
    const r = buildReconciliation(docs, payments, "Client A");
    expect(r.rulajCredit).toBe(249900);
    expect(r.rulajDebit).toBe(50000);
    expect(r.soldFinal).toBe(199900);
  });

  it("ignoră ciornele", () => {
    const r = buildReconciliation(docs, [], "Client A", "2026-10-01", "2026-10-31");
    expect(r.rows.some((x) => x.document.includes("V-5"))).toBe(false);
  });
});
