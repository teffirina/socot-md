import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptMonth,
  changes,
  computePay,
  entries,
  missingSettings,
  takeCorrection,
  type PayrollRegister,
} from "../lib/payroll";

// Rates here are test values only, not the law.
const register = (): PayrollRegister => ({
  settings: {
    incomeTax: 1000,
    employeeHealth: 1000,
    employerSocial: 2000,
    exemption: 0,
    nightSupplement: 5000,
    overtimeRate: 20000,
    employerSickDays: 5,
  },
  employees: [
    {
      id: "ana",
      name: "Ana",
      salaries: [{ from: "2026-01", amount: 1_760_000 }],
      secondJob: 220_000,
    },
  ],
  timesheets: {},
  accepted: {},
  corrections: {},
});

test("salariul lunii: zile lucrate, noapte, ore suplimentare, cumul, primă", () => {
  const r = register();
  r.timesheets["2026-01"] = {
    ana: {
      normDays: 22,
      workedDays: 11,
      nightHours: 8,
      overtimeHours: 2,
      bonus: 100_000,
    },
  };
  const p = computePay(r, r.employees[0], "2026-01");
  // hourly = 17600 / 176 = 100 lei
  assert.equal(p.base, 880_000);
  assert.equal(p.night, 40_000);
  assert.equal(p.overtime, 40_000);
  assert.equal(p.secondJob, 110_000);
  assert.equal(p.gross, 1_170_000);
  assert.equal(p.health, 117_000);
  assert.equal(p.tax, 105_300);
  assert.equal(p.net, 947_700);
  assert.equal(p.social, 234_000);
});

test("concediul medical folosește media celor 6 luni anterioare", () => {
  const r = register();
  r.employees[0].secondJob = 0;
  for (const m of ["2026-01", "2026-02"])
    r.timesheets[m] = { ana: { normDays: 22, workedDays: 22 } };
  r.timesheets["2026-03"] = {
    ana: { normDays: 22, workedDays: 14, sickDays: 8, sickPercent: 9000 },
  };
  const p = computePay(r, r.employees[0], "2026-03");
  // average 800 lei/day × 90% = 720 lei; 5 days employer, 3 days social insurance
  assert.equal(p.sickEmployer, 360_000);
  assert.equal(p.sickSocial, 216_000);
  assert.equal(p.social, Math.round((p.gross - 576_000) * 0.2));
});

test("un concediu medical adus târziu se recalculează în luna curentă", () => {
  let r = register();
  r.employees[0].secondJob = 0;
  for (const m of ["2026-01", "2026-02", "2026-03"])
    r.timesheets[m] = { ana: { normDays: 22, workedDays: 22 } };
  r = acceptMonth(acceptMonth(r, "2026-02", "t"), "2026-03", "t");
  assert.equal(changes(r, "2026-02"), null);
  // In March the employee brings a sick note for 4 days of February.
  r.timesheets["2026-02"] = {
    ana: { normDays: 22, workedDays: 18, sickDays: 4, sickPercent: 10000 },
  };
  const diff = changes(r, "2026-02")!;
  assert.equal(diff.ana.base, -320_000);
  assert.equal(diff.ana.sickEmployer, 320_000);
  r = takeCorrection(r, "2026-02", "2026-03", "t");
  assert.equal(changes(r, "2026-02"), null);
  const march = entries(r, "2026-03");
  const social = march.find((e) => e.label.startsWith("Contribuții"))!;
  // Contributions fall because sick pay is not subject to them.
  assert.equal(social.amount, 352_000 - 64_000);
});

test("fără cote completate, Socot spune ce lipsește", () => {
  assert.equal(missingSettings({}).length, 7);
  assert.deepEqual(missingSettings(register().settings), []);
});
