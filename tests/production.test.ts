import test from "node:test";
import assert from "node:assert/strict";
import {
  allocate,
  costProduction,
  type ProductionReport,
} from "../lib/production";
import { monthEntries, type Movement } from "../lib/stock";

const receipt = (
  seq: number,
  item: string,
  q: number,
  lei: number,
): Movement => ({
  id: `r${seq}`,
  seq,
  date: "2026-03-01",
  type: "receipt",
  item,
  quantity: q * 1000,
  cost: lei * 100,
  account: "211",
});
const stock = [receipt(1, "Lemn", 100, 5000), receipt(2, "Lac", 10, 1000)];
const report = (
  id: string,
  product: string,
  q: number,
  materials: [string, number][],
  date = "2026-03-20",
): ProductionReport => ({
  id,
  seq: 10,
  date,
  product,
  quantity: q * 1000,
  materials: materials.map(([item, quantity]) => ({
    item,
    account: "211",
    quantity: quantity * 1000,
  })),
});

test("repartizarea păstrează exact suma", () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
  assert.deepEqual(allocate(10, [0, 0]), [0, 0]);
});

test("costul produsului = materiale + cheltuieli indirecte repartizate", () => {
  const reports = [
    report("a", "Masă", 2, [
      ["Lemn", 20],
      ["Lac", 2],
    ]), // 1000 + 200 lei
    report("b", "Scaun", 4, [["Lemn", 12]]), // 600 lei
  ];
  const overheads = {
    "2026-03": [
      { id: "e", label: "Energie", amount: 90000 },
      { id: "s", label: "Salarii secție", amount: 90000 },
    ],
  };
  const r = costProduction(stock, reports, overheads, "materials", "fifo");
  // 1800 lei of overheads split 1200:600.
  assert.deepEqual(
    r.costs.map((c) => [c.materials, c.overhead, c.total, c.unit]),
    [
      [120000, 120000, 240000, 120000],
      [60000, 60000, 120000, 30000],
    ],
  );
  assert.deepEqual(monthEntries(r.valued, "2026-03", r.extra["2026-03"]), [
    { debit: "216", credit: "811", amount: 360000 },
    { debit: "811", credit: "211", amount: 180000 },
    { debit: "811", credit: "821", amount: 180000 },
  ]);
  const byQuantity = costProduction(
    stock,
    reports,
    overheads,
    "quantity",
    "fifo",
  );
  assert.deepEqual(
    byQuantity.costs.map((c) => c.overhead),
    [60000, 120000],
  );
});

test("un semifabricat produs în aceeași lună intră cu costul lui complet", () => {
  const reports = [
    report("blat", "Blat", 1, [["Lemn", 10]]),
    report("masa", "Masă", 1, [
      ["Blat", 1],
      ["Lac", 1],
    ]),
  ];
  const r = costProduction(
    stock,
    reports,
    { "2026-03": [{ id: "e", label: "Energie", amount: 60000 }] },
    "materials",
    "fifo",
  );
  const [blat, masa] = r.costs;
  assert.equal(masa.materials, blat.total + 10000);
  assert.equal(blat.overhead + masa.overhead, 60000);
  const product = r.balances.find((b) => b.item === "Masă")!;
  assert.equal(product.value, masa.total);
});

test("o corecție a prețului materialului recalculează produsul", () => {
  const reports = [report("a", "Masă", 1, [["Lemn", 10]])];
  const before = costProduction(stock, reports, {}, "materials", "fifo")
    .costs[0];
  const edited = [{ ...stock[0], cost: 700000 }, stock[1]];
  const after = costProduction(edited, reports, {}, "materials", "fifo")
    .costs[0];
  assert.equal(before.total, 50000);
  assert.equal(after.total, 70000);
});

test("cheltuielile unei luni fără producție sunt semnalate", () => {
  const r = costProduction(
    stock,
    [],
    { "2026-04": [{ id: "e", label: "Energie", amount: 100 }] },
    "materials",
    "fifo",
  );
  assert.deepEqual(r.idle, ["2026-04"]);
});
