import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDelimited,
  checkXlsxArchive,
  calculate,
  prepareRow,
  suggestMapping,
} from "../lib/workbook";
import { applyOperation } from "../lib/domain";
import ExcelJS from "exceljs";
test("CSV preserves escaped quotes, quoted delimiters and newlines, rejects malformed input", () => {
  assert.deepEqual(
    parseDelimited(
      '\uFEFFPartener;Data;Total\r\n"Firma; \"\"A\"\"\nSRL";22.09.2026;12,50',
    ),
    [
      ["Partener", "Data", "Total"],
      ['Firma; "A"\nSRL', "22.09.2026", "12,50"],
    ],
  );
  assert.throws(() => parseDelimited('a;b\n"incomplet'), /neînchise/);
  assert.throws(
    () => parseDelimited(Array.from({ length: 503 }, () => "x").join("\n")),
    /500|mare/,
  );
});
test("safe formula arithmetic, ranges, cycles, unsupported functions and zero division", () => {
  const grid = [
    ["2", "3", "=SUM(A1:B1)*2+1"],
    ["=C1/2", "=SUM(A1;B1;4)", "=A2+B2"],
  ];
  assert.equal(calculate(grid, 0, 2), 11);
  assert.equal(calculate(grid, 1, 2), 14.5);
  for (const formula of [
    "=A1",
    "=1/0",
    '=INDIRECT("A2")',
    '=fetch("x")',
    "=SUM(A1:Z999999)",
    "=1e3",
  ])
    assert.throws(() => calculate([[formula]], 0, 0));
});
test("staged rows produce validated cents and immutable provenance only on explicit apply", () => {
  const grid = parseDelimited(
    "Partener;Data;Total\nSocot Test;22.09.2026;=12.5*2",
  );
  const before = JSON.stringify(grid),
    id = crypto.randomUUID();
  const doc = prepareRow(
    grid,
    1,
    suggestMapping(grid[0]),
    id,
    "hash:sheet:2",
    "expense",
  );
  assert.equal(doc.total, 2500);
  assert.equal(
    prepareRow(
      [grid[0], ["Socot", "2026-09-22", "1.005"]],
      1,
      suggestMapping(grid[0]),
      id,
      "hash",
      "sale",
    ).total,
    101,
  );
  assert.equal(
    prepareRow(
      [grid[0], ["Socot", "2026-09-22", "4.004999999"]],
      1,
      suggestMapping(grid[0]),
      id,
      "hash",
      "sale",
    ).total,
    400,
  );
  assert.equal(doc.date, "2026-09-22");
  assert.equal(JSON.stringify(grid), before);
  const created = applyOperation(null, {
    id: crypto.randomUUID(),
    invoice: doc,
    baseVersion: 0,
  });
  assert.equal(created.sourceRef, "hash:sheet:2");
  assert.throws(
    () =>
      applyOperation(created, {
        id: crypto.randomUUID(),
        invoice: { ...created, sourceRef: "other", paid: 1 },
        baseVersion: 1,
      }),
    /încasări/,
  );
  assert.throws(() =>
    prepareRow(
      [grid[0], ["Socot", "31.02.2026", "1"]],
      1,
      suggestMapping(grid[0]),
      id,
      "hash",
      "sale",
    ),
  );
});
test("XLSX dependency round trip preserves formulas separately from stale cached results", async () => {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Test");
  sheet.addRow(["Partener", "Data", "Total"]);
  sheet.addRow([
    "Socot",
    new Date("2026-09-22T00:00:00Z"),
    { formula: "10*3", result: 999 },
  ]);
  const loaded = new ExcelJS.Workbook();
  const bytes = await book.xlsx.writeBuffer();
  checkXlsxArchive(new Uint8Array(bytes).buffer);
  assert.throws(() => checkXlsxArchive(new ArrayBuffer(12)), /invalid/);
  await loaded.xlsx.load(bytes);
  assert.equal(loaded.worksheets[0].getCell("C2").formula, "10*3");
  assert.equal(calculate([["=10*3"]], 0, 0), 30);
});
