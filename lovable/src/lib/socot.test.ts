import { describe, expect, it } from "vitest";
import { parseMoney } from "./money";
import { can } from "./permissions";
import { profitTone, summarize, type Doc } from "./documents";
import { money } from "./money";

describe("parseMoney", () => {
  it("converts lei with comma to bani", () => expect(parseMoney("1 234,56")).toBe(123456));
  it("rejects more than two decimals", () => expect(parseMoney("1.234")).toBeNull());
});

const document = (kind: "sale" | "expense", total: number, date = "2026-10-17", status = "confirmed"): Doc => ({
  id: `${kind}-${total}`, company_id: "company", created_at: date, created_by: "user", date,
  invoice_details: null, description: "", kind, number: "1", paid: 0, partner_id: null, partner_name: "Partener", status, total, category: "",
});

describe("gross profit", () => {
  it("subtracts total expenses from total revenue in bani", () => {
    expect(summarize([document("sale", 150050), document("expense", 40025)]).grossProfit).toBe(110025);
  });
  it("uses confirmed totals, not payments or drafts, like the existing indicators", () => {
    expect(summarize([{ ...document("sale", 150050), paid: 50000 }, document("sale", 99999, "2026-10-17", "draft")]).grossProfit).toBe(150050);
  });
  it("includes period boundaries and excludes documents outside them", () => {
    const docs = [document("sale", 10000, "2026-10-01"), document("expense", 3000, "2026-10-31"), document("sale", 99999, "2026-09-30"), document("expense", 88888, "2026-11-01")];
    expect(summarize(docs, { from: "2026-10-01", to: "2026-10-31" }).grossProfit).toBe(7000);
  });
  it("recalculates after adding, changing, and deleting documents", () => {
    const sale = document("sale", 10000);
    const expense = document("expense", 3000);
    const docs = [sale, expense];
    expect(summarize(docs).grossProfit).toBe(7000);
    expect(summarize([...docs, document("sale", 2000)]).grossProfit).toBe(9000);
    expect(summarize([sale, { ...expense, total: 5000 }]).grossProfit).toBe(5000);
    expect(summarize([sale]).grossProfit).toBe(10000);
  });
  it("selects positive and negative semantic tones, with neutral zero", () => {
    expect(profitTone(1)).toBe("positive");
    expect(profitTone(-1)).toBe("negative");
    expect(profitTone(0)).toBe("default");
  });
  it("formats profit in MDL", () => expect(money(110025, "code")).toBe(new Intl.NumberFormat("ro-MD", { style: "currency", currency: "MDL", currencyDisplay: "code" }).format(1100.25)));
});

describe("permissions", () => {
  it("director can read but not modify documents", () => {
    expect(can("director", "read")).toBe(true);
    expect(can("director", "write")).toBe(false);
  });
  it("auditor cannot post journal entries", () => expect(can("auditor", "journal.post")).toBe(false));
  it("invoice registration is restricted to accountants and administrators, not operators", () => {
    expect(can('operator', 'journal.post')).toBe(false);
    expect(can('accountant', 'journal.post')).toBe(true);
    expect(can('chief_accountant', 'journal.post')).toBe(true);
    expect(can('admin', 'journal.post')).toBe(true);
  });
  it("cashier has no access yet", () => expect(can("cashier", "read")).toBe(false));
});
