import test from "node:test";
import assert from "node:assert/strict";
import {
  makeBook,
  writeSpreadsheet,
  restoreSpreadsheet,
} from "../lib/socot-sheets";
import {
  buildPivot,
  chartSvg,
  pivotSheet,
  pivotConfig,
  type PivotConfig,
} from "../lib/sheet-analysis";
function fixture() {
  const book = makeBook("Test", [
    ["Partener", "Categorie", "Total"],
    ["A", "Birou", "10"],
    ["A", "Birou", "20"],
    ["A", "Transport", "90"],
    ["B", "Birou", "-5"],
    ["B", "Transport", "0"],
  ]);
  const config: PivotConfig = {
    sourceSheetId: book.sheetOrder[0],
    row: 0,
    column: 1,
    value: 2,
    operation: "sum",
  };
  return { book, config };
}
test("pivot cross tab aggregates negative values and correct margins without editing the source", () => {
  const { book, config } = fixture(),
    before = JSON.stringify(book),
    p = buildPivot(book, config);
  assert.deepEqual(p.grid, [
    ["Partener", "Birou", "Transport", "Total"],
    ["A", 30, 90, 120],
    ["B", -5, 0, -5],
    ["Total general", 25, 90, 115],
  ]);
  assert.equal(p.sourceRows, 5);
  assert.equal(JSON.stringify(book), before);
});
test("pivot averages are weighted over source rows, not averages of aggregates", () => {
  const { book, config } = fixture(),
    p = buildPivot(book, { ...config, operation: "average" });
  assert.equal(p.grid[1][3], 40);
  assert.equal(p.grid[3][3], 23);
  assert.equal(p.grid[3][1], 25 / 3);
});
test("count includes rows with missing amounts; numeric calculations fail with actionable row", () => {
  const { book, config } = fixture();
  book.sheets[config.sourceSheetId].cellData![2][2] = { v: "" };
  assert.throws(() => buildPivot(book, config), /rândul 3/);
  const p = buildPivot(book, { ...config, operation: "count" });
  assert.equal(p.grid[3][3], 5);
  book.sheets[config.sourceSheetId].cellData![2][2] = {
    f: "=1/0",
    v: "#DIV/0!",
  };
  assert.throws(() => buildPivot(book, config), /formulă/);
});
test("pivot configuration validates fields and bounds and preserves refresh metadata in snapshots", () => {
  const { book, config } = fixture();
  assert.equal(pivotConfig({}), null);
  assert.throws(() => buildPivot(book, { ...config, column: 0 }), /diferite/);
  const sheet = pivotSheet(buildPivot(book, config), config);
  book.sheets.pivot = { ...sheet, name: "Centralizare" };
  book.sheetOrder.push("pivot");
  assert.deepEqual(
    restoreSpreadsheet(JSON.stringify(book)).sheets.pivot.custom?.socotPivot,
    config,
  );
});
test("chart output escapes labels and supports negative and all zero results", () => {
  const { book, config } = fixture();
  book.sheets[config.sourceSheetId].cellData![1][0] = {
    v: "<script>alert(1)</script>",
  };
  const svg = chartSvg(buildPivot(book, { ...config, column: -1 }));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("#bf6849"));
  assert.ok(
    !chartSvg({
      title: "Zero",
      sourceRows: 1,
      grid: [],
      series: [{ label: "Zero", value: 0 }],
    }).includes("NaN"),
  );
});
test("pivot outputs export as normal Excel cells, retaining text labels that look like formulas", async () => {
  const { book, config } = fixture();
  book.sheets[config.sourceSheetId].cellData![1][0] = { v: "=2+2", t: 1 };
  const pivot = buildPivot(book, config);
  const data = pivotSheet(pivot, config);
  assert.equal(data.cellData![1][0].f, undefined);
  assert.equal(data.cellData![1][0].v, "=2+2");
  book.sheets.pivot = { ...data, name: "Centralizare" };
  book.sheetOrder.push("pivot");
  assert.ok((await writeSpreadsheet(book)).length > 0);
});
test("missing cross-tab observations remain empty for averages, rather than an invented zero", () => {
  const b = makeBook("Missing", [
    ["Partener", "Categorie", "Total"],
    ["A", "Birou", "10"],
    ["B", "Transport", "20"],
  ]);
  const p = buildPivot(b, {
    sourceSheetId: b.sheetOrder[0],
    row: 0,
    column: 1,
    value: 2,
    operation: "average",
  });
  assert.equal(p.grid[1][2], "");
  assert.equal(p.grid[2][1], "");
  assert.equal(p.grid[3][3], 15);
});
