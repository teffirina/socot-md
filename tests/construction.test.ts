import test from "node:test";
import assert from "node:assert/strict";
import {
  completion,
  decide,
  monthEntries,
  review,
  revenueTo,
  type ConstructionRegister,
} from "../lib/construction";

const register = (): ConstructionRegister => ({
  objects: [
    {
      id: "hala",
      name: "Hală nouă",
      kind: "own",
      budget: 10_000_000,
      account: "121",
    },
    {
      id: "casa",
      name: "Casă client",
      kind: "contract",
      budget: 1_000_000,
      price: 1_500_000,
      account: "811",
    },
  ],
  costs: [
    {
      id: "1",
      objectId: "hala",
      date: "2026-01-10",
      label: "Beton",
      amount: 3_000_000,
      credit: "211",
    },
    {
      id: "2",
      objectId: "hala",
      date: "2026-02-10",
      label: "Montaj",
      amount: 2_000_000,
      credit: "521",
    },
    {
      id: "3",
      objectId: "casa",
      date: "2026-01-15",
      label: "Cărămidă",
      amount: 400_000,
      credit: "211",
    },
    {
      id: "4",
      objectId: "casa",
      date: "2026-02-15",
      label: "Manoperă",
      amount: 200_000,
      credit: "531",
    },
  ],
  decisions: {},
});

test("costurile se adună pe obiect, iar contractul are venit după stadiu", () => {
  const r = register();
  assert.equal(completion(r.objects[1], 600_000), 6000);
  assert.equal(revenueTo(r.objects[1], r, "2026-01"), 600_000);
  assert.equal(revenueTo(r.objects[1], r, "2026-02"), 900_000);
  const feb = monthEntries(r, "2026-02");
  assert.deepEqual(
    feb.map((e) => [e.debit, e.credit, e.amount]),
    [
      ["121", "521", 2_000_000],
      ["811", "531", 200_000],
      ["221", "611", 300_000],
    ],
  );
});

test("venitul nu depășește prețul când costurile trec de deviz", () => {
  const r = register();
  r.costs.push({
    id: "5",
    objectId: "casa",
    date: "2026-03-01",
    label: "Extra",
    amount: 900_000,
    credit: "211",
  });
  assert.equal(revenueTo(r.objects[1], r, "2026-03"), 1_500_000);
});

test("darea în exploatare trece tot costul acumulat în 123", () => {
  const r = register();
  r.objects[0].commissioned = { date: "2026-02-28" };
  const e = monthEntries(r, "2026-02").find((x) =>
    x.key.startsWith("commission"),
  )!;
  assert.deepEqual([e.debit, e.credit, e.amount], ["123", "121", 5_000_000]);
});

test("un cost corectat în trecut arată diferența față de ce s-a acceptat", () => {
  let r = register();
  for (const row of review(r).flatMap((m) => m.rows))
    r = decide(r, row, "accepted", "t");
  r.costs = r.costs.map((c) => (c.id === "3" ? { ...c, amount: 500_000 } : c));
  const jan = review(r).find((m) => m.month === "2026-01")!.rows;
  const cost = jan.find((x) => x.key === "cost|casa|811|211")!;
  const revenue = jan.find((x) => x.key === "revenue|casa")!;
  assert.equal(cost.difference, 100_000);
  assert.equal(revenue.difference, 150_000);
  r.costs = r.costs.filter((c) => c.id !== "4");
  const gone = review(r)
    .find((m) => m.month === "2026-02")!
    .rows.find((x) => x.key === "cost|casa|811|531")!;
  assert.equal(gone.difference, -200_000);
});
