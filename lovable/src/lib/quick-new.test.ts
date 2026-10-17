import { describe, expect, it } from "vitest";
import { availableQuickOperations, payableDocuments } from "./quick-new";
import type { Doc } from "./documents";

const doc: Doc = { id: "one", company_id: "company", created_at: "2026-10-17", created_by: "user", date: "2026-10-17", invoice_details: null, description: "", kind: "sale", number: "V-1", paid: 2500, partner_id: null, partner_name: "Client", status: "confirmed", total: 10000, category: "" };
describe("universal creation rules", () => {
  it("shows only implemented operations for writers", () => {
    expect(availableQuickOperations("operator").map(item => item.id)).toEqual(["sale", "purchase", "expense", "receipt", "payment"]);
    expect(availableQuickOperations("admin").map(item => item.id)).toEqual(["sale", "purchase", "expense", "receipt", "payment"]);
  });
  it("does not offer state changes to read-only or unavailable roles", () => {
    for (const role of ["director", "auditor", "cashier", "warehouse", "unknown"]) expect(availableQuickOperations(role)).toEqual([]);
  });
  it("offers only confirmed unpaid documents of the selected company and operation", () => {
    expect(payableDocuments([doc, { ...doc, id: "draft", status: "draft" }, { ...doc, id: "paid", paid: 10000 }, { ...doc, id: "other", company_id: "other" }, { ...doc, id: "expense", kind: "expense" }], "company", "sale").map(row => row.id)).toEqual(["one"]);
  });
  it("payment uses purchase documents and not sales", () => {
    expect(payableDocuments([doc, { ...doc, id: "purchase", kind: "expense" }], "company", "expense").map(row => row.id)).toEqual(["purchase"]);
  });
});