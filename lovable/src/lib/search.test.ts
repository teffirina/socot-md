import { describe, expect, it } from "vitest";
import { buildSearchResults, filterSearchResults, type SearchData } from "./search";

const data: SearchData = {
  documents: [
    { id: "sale", kind: "sale", number: "F-001", partner_name: "Ștefan SRL", description: "Consultanță", category: "Servicii", date: "2026-10-17", total: 123456, status: "draft" },
    { id: "expense", kind: "expense", number: "C-001", partner_name: "Furnizor", description: "Chirie", category: "", date: "2026-10-17", total: 50000, status: "confirmed" },
  ],
  catalog: [
    { id: "partner", kind: "partner", code: "P-1", name: "Ștefan SRL", details: { idno: "1234567890123" } },
    { id: "contract", kind: "contract", code: "CT-1", name: "Contract consultanță", details: { partner: "Ștefan SRL" } },
  ],
  payments: [
    { id: "receipt", date: "2026-10-17", amount: 10000, documents: { number: "F-001", partner_name: "Ștefan SRL", kind: "sale" } },
    { id: "payment", date: "2026-10-17", amount: 20000, documents: { number: "C-001", partner_name: "Furnizor", kind: "expense" } },
  ],
  journal: [{ id: "entry", date: "2026-10-17", amount: 123456, debit: "221", credit: "611", operation: "sale", state: "proposed", documents: { number: "F-001", partner_name: "Ștefan SRL" } }],
};

describe("universal search", () => {
  const results = buildSearchResults(data, "admin");
  it("searches all required real record types", () => {
    expect(new Set(results.map((r) => r.type))).toEqual(new Set(["sale", "expense", "receipt", "payment", "partner", "contract", "entry", "account"]));
  });
  it("finds names without accents and matches relevant details", () => {
    expect(filterSearchResults(results, "stefan").map((r) => r.id)).toContain("partner");
    expect(filterSearchResults(results, "consultanta", "Documente").map((r) => r.id)).toEqual(["sale"]);
    expect(filterSearchResults(results, "1234567890123").map((r) => r.id)).toEqual(["partner"]);
  });
  it("finds document numbers and sums with comma or decimal point", () => {
    expect(filterSearchResults(results, "F-001").map((r) => r.id)).toContain("sale");
    expect(filterSearchResults(results, "1 234,56").map((r) => r.id)).toEqual(["sale", "entry"]);
    expect(filterSearchResults(results, "1234.56").map((r) => r.id)).toEqual(["sale", "entry"]);
  });
  it("filters by required categories and record types", () => {
    expect(filterSearchResults(results, "stefan", "Parteneri").map((r) => r.id)).toEqual(["partner", "contract"]);
    expect(filterSearchResults(results, "F-001", "all", "receipt").map((r) => r.id)).toEqual(["receipt"]);
  });
  it("does not expose accounting to director or operator", () => {
    for (const role of ["director", "operator"]) expect(buildSearchResults(data, role).some((r) => r.group === "Contabilitate")).toBe(false);
  });
  it("respects catalog-only access for cashier and warehouse", () => {
    for (const role of ["cashier", "warehouse"]) expect(buildSearchResults(data, role).map((r) => r.id)).toEqual(["partner", "contract"]);
  });
  it("returns no results for an unknown role or empty query", () => {
    expect(buildSearchResults(data, "unknown")).toEqual([]);
    expect(filterSearchResults(results, " ")).toEqual([]);
  });
  it("keeps the exact record identifier for direct navigation", () => {
    expect(filterSearchResults(results, "CT-1")[0]).toMatchObject({ id: "contract", type: "contract", group: "Parteneri" });
    expect(filterSearchResults(results, "Creante", "Contabilitate", "account")[0]).toMatchObject({ id: "221", type: "account" });
  });
});