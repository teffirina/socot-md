import test from "node:test";
import assert from "node:assert/strict";
import {
  decideEntry,
  monthEntries,
  parseLei,
  parseQuantity,
  review,
  valuate,
  type Movement,
} from "../lib/stock";

let seq = 0;
const mv = (
  date: string,
  type: Movement["type"],
  quantity: number,
  cost?: number,
  item = "Făină",
): Movement => ({
  id: `m${++seq}`,
  seq,
  date,
  type,
  item,
  quantity: quantity * 1000,
  cost: cost === undefined ? undefined : cost * 100,
  account: "217",
});

const chain = () => [
  mv("2026-01-05", "receipt", 10, 100),
  mv("2026-01-10", "receipt", 10, 200),
  mv("2026-01-20", "sale", 15),
];

test("FIFO ia întâi loturile vechi", () => {
  const { valued, balances } = valuate(chain(), "fifo");
  assert.equal(valued[2].value, 20000); // 10 × 10 lei + 5 × 20 lei
  assert.deepEqual([balances[0].quantity, balances[0].value], [5000, 10000]);
});

test("costul mediu ponderat împarte valoarea la cantitate", () => {
  const { valued, balances } = valuate(chain(), "average");
  assert.equal(valued[2].value, 22500); // 15 × 15 lei
  assert.equal(balances[0].value, 7500);
});

test("o intrare corectată retroactiv recalculează ieșirile de după ea", () => {
  const before = valuate(chain(), "fifo").valued[2].value;
  const edited = chain();
  edited[0] = { ...edited[0], cost: 15000 };
  const after = valuate(edited, "fifo").valued.find((v) => v.type === "sale")!;
  assert.equal(before, 20000);
  assert.equal(after.value, 25000);
});

test("intrările din aceeași zi vin înaintea ieșirilor; lipsa de stoc e semnalată", () => {
  const same = [
    mv("2026-02-01", "sale", 1),
    mv("2026-02-01", "receipt", 1, 50),
  ];
  assert.equal(valuate(same, "fifo").valued[1].value, 5000);
  const short = valuate([mv("2026-02-01", "sale", 2)], "fifo").valued[0];
  assert.match(short.error!, /Stoc insuficient/);
});

test("articolele contabile lunare și diferențele după recalculare", () => {
  const movements = [...chain(), mv("2026-01-25", "consumption", 1)];
  let valued = valuate(movements, "fifo").valued;
  assert.deepEqual(monthEntries(valued, "2026-01"), [
    { debit: "711", credit: "217", amount: 20000 },
    { debit: "811", credit: "217", amount: 2000 },
  ]);
  let decisions = review(valued, {})[0].rows.reduce(
    (d, row) => decideEntry(d, row, "accepted", "t"),
    {},
  );
  // The January price is corrected in February.
  movements[1] = { ...movements[1], cost: 30000 };
  valued = valuate(movements, "fifo").valued;
  const rows = review(valued, decisions)[0].rows;
  assert.equal(rows[0].difference, 5000);
  assert.equal(rows[1].difference, 1000);
  decisions = decideEntry(decisions, rows[0], "accepted", "t");
  assert.equal(review(valued, decisions)[0].rows[0].difference, 0);
});

test("cantități și sume scrise ca în contabilitate", () => {
  assert.equal(parseQuantity("12,5"), 12500);
  assert.equal(parseLei("1 234,56"), 123456);
  assert.throws(() => parseQuantity("0"));
  assert.throws(() => parseLei("1,234"));
});
