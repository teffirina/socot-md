import { describe, expect, it } from "vitest";
import { dashboardDate, dashboardMoney, demoExpenses, demoMonths } from "./dashboard-demo";

describe("Dashboard numeric rules", () => {
  it("formats bani with spaces, comma and trailing MDL", () => {
    expect(dashboardMoney(600000)).toBe("6 000,00 MDL");
  });
  it("uses a true minus for negative values", () => {
    expect(dashboardMoney(-125000, false)).toBe("−1 250,00");
  });
  it("formats calendar dates as day.month.year", () => {
    expect(dashboardDate("2026-10-15")).toBe("15.10.2026");
  });
  it("keeps the six-month demo profit consistent with revenues minus expenses", () => {
    expect(demoMonths.map(m => m.sales-m.expenses)).toEqual([26,33,10,26,36,45]);
    expect(demoMonths.reduce((s,m)=>s+m.profit,0)).toBe(176);
  });
  it("keeps demo expense totals at 97000 MDL", () => {
    expect(demoExpenses.reduce((sum,[,amount])=>sum+amount,0)).toBe(9700000);
  });
});