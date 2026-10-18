import test from "node:test";
import assert from "node:assert/strict";
import { catalogSchema, type CatalogEntry } from "../lib/catalog";
import {
  assetPlan,
  decide,
  expectedBy,
  proposals,
  type DepreciationRegister,
} from "../lib/depreciation";

const asset = (details: Record<string, string>): CatalogEntry =>
  catalogSchema.parse({
    id: "6f1c1a52-2b7e-4b8a-9a43-0c1f0c3a1b11",
    kind: "asset",
    code: "MF-1",
    name: "Laptop",
    version: 1,
    active: true,
    details,
  });

const laptop = asset({
  inServiceDate: "2026-01-15",
  cost: "10000",
  residual: "1000",
  lifeMonths: "36",
});

test("uzura liniară începe luna următoare punerii în funcțiune", () => {
  const plan = assetPlan(laptop);
  assert.ok(typeof plan !== "string");
  assert.equal(plan.start, "2026-02");
  assert.equal(expectedBy(plan, "2026-01"), 0);
  assert.equal(expectedBy(plan, "2026-02"), 25000);
  assert.equal(expectedBy(plan, "2028-12"), 875000);
  assert.equal(expectedBy(plan, "2029-01"), 900000);
  assert.equal(expectedBy(plan, "2030-01"), 900000);
  const { ready } = proposals([laptop], {}, "2026-02");
  assert.equal(ready[0].amount, 25000);
  assert.equal(ready[0].asset.debit, "713");
  assert.equal(ready[0].asset.credit, "124");
});

test("rotunjirea nu pierde bani pe toată durata", () => {
  const odd = asset({
    inServiceDate: "2026-01-01",
    cost: "100",
    lifeMonths: "3",
  });
  let register: DepreciationRegister = {};
  let sum = 0;
  for (const month of ["2026-02", "2026-03", "2026-04"]) {
    const p = proposals([odd], register, month).ready[0];
    sum += p.amount;
    register = decide(register, p, "accepted", "t");
  }
  assert.equal(sum, 10000);
  assert.equal(proposals([odd], register, "2026-05").ready.length, 0);
});

test("o lună respinsă se recuperează automat luna următoare", () => {
  let register = decide(
    {},
    proposals([laptop], {}, "2026-02").ready[0],
    "rejected",
    "t",
  );
  const march = proposals([laptop], register, "2026-03").ready[0];
  assert.equal(march.amount, 50000);
  assert.match(march.note, /respinse/);
  register = decide(register, march, "accepted", "t");
  assert.equal(proposals([laptop], register, "2026-04").ready[0].amount, 25000);
});

test("schimbarea valorii recalculează diferența", () => {
  let register: DepreciationRegister = {};
  for (const m of ["2026-02", "2026-03"])
    register = decide(
      register,
      proposals([laptop], register, m).ready[0],
      "accepted",
      "t",
    );
  const bigger = asset({ ...laptop.details, cost: "19000" });
  const april = proposals([bigger], register, "2026-04").ready[0];
  // 18000 lei over 36 months: 3 months = 1500 lei, 500 already accepted.
  assert.equal(april.amount, 100000);
  assert.match(april.note, /lunile|Ajustat/);
  const smaller = asset({ ...laptop.details, cost: "1900", residual: "100" });
  const fix = proposals([smaller], register, "2026-04").ready[0];
  assert.ok(fix.amount < 0);
  assert.match(fix.note, /Corecție/);
});

test("o nouă decizie pe o lună trimite lunile următoare la reverificare", () => {
  let register: DepreciationRegister = {};
  for (const m of ["2026-02", "2026-03"])
    register = decide(
      register,
      proposals([laptop], register, m).ready[0],
      "accepted",
      "t",
    );
  register = decide(
    register,
    proposals([laptop], register, "2026-02").ready[0],
    null,
  );
  assert.deepEqual(register["2026-03"], {});
  assert.equal(proposals([laptop], register, "2026-02").ready[0].amount, 25000);
});

test("fișele incomplete spun ce lipsește", () => {
  const { incomplete } = proposals([asset({})], {}, "2026-02");
  assert.match(incomplete[0].reason, /data punerii/);
  assert.match(
    assetPlan(
      asset({
        inServiceDate: "2026-01-01",
        cost: "10",
        residual: "10",
        lifeMonths: "5",
      }),
    ) as string,
    /reziduală/,
  );
});

test("uzura calculată deja în 1C nu se mai propune o dată", () => {
  const fromOneC = asset({ ...laptop.details, openingDepreciation: "500" });
  const p = proposals([fromOneC], {}, "2026-04").ready[0];
  // 3 months × 250 lei expected, 500 lei already in 1C.
  assert.equal(p.amount, 25000);
  assert.equal(p.booked, 50000);
  assert.match(
    proposals([laptop], {}, "2026-04").ready[0].note,
    /Uzura acumulată la preluare/,
  );
  assert.match(
    assetPlan(
      asset({ ...laptop.details, openingDepreciation: "99999" }),
    ) as string,
    /depășește/,
  );
});
