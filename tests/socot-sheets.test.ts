import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  makeBook,
  templateBook,
  readSpreadsheet,
  writeSpreadsheet,
  accountingGrid,
} from "../lib/socot-sheets";
test("spreadsheet round trip preserves multiple sheets, formulas, text IDs, formats and merges", async () => {
  const x = new ExcelJS.Workbook(),
    a = x.addWorksheet("Document"),
    b = x.addWorksheet("Calcule");
  a.getCell("A1").value = "Socot";
  a.mergeCells("A1:C1");
  a.getCell("A1").font = { bold: true, size: 16 };
  a.getCell("A2").value = "00123";
  a.getCell("B2").value = 12.5;
  a.getCell("B2").numFmt = "#,##0.00";
  a.getCell("C2").value = { formula: "B2*2", result: 999 };
  a.getColumn(1).width = 24;
  b.getCell("A1").value = { formula: "SUM(Document!B2:C2)", result: 0 };
  const bytes = new Uint8Array(await x.xlsx.writeBuffer());
  const { book, warnings } = await readSpreadsheet(
    bytes.buffer,
    "Document.xlsx",
  );
  assert.equal(book.sheetOrder.length, 2);
  assert.ok(warnings.length);
  const sheet = book.sheets[book.sheetOrder[0]];
  assert.equal(sheet.cellData?.[1]?.[0]?.v, "00123");
  assert.equal(sheet.cellData?.[1]?.[2]?.f, "=B2*2");
  assert.equal(
    sheet.cellData?.[1]?.[2]?.v,
    undefined,
    "never trusts stale cached formula results",
  );
  const output = await writeSpreadsheet(book),
    loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(output.buffer);
  assert.equal(loaded.worksheets.length, 2);
  assert.equal(loaded.worksheets[0].getCell("A2").value, "00123");
  assert.equal(loaded.worksheets[0].getCell("A1").font.bold, true);
  assert.equal(loaded.worksheets[0].getCell("B2").numFmt, "#,##0.00");
  assert.equal(loaded.worksheets[0].getCell("C2").formula, "B2*2");
  assert.deepEqual(loaded.worksheets[0].model.merges, ["A1:C1"]);
});
test("accounting handoff blocks unresolved/error formulas and keeps valid calculated values", () => {
  const b = templateBook(),
    s = b.sheets[b.sheetOrder[0]];
  assert.throws(() => accountingGrid(s), /rezultat valid/);
  s.cellData![1][2] = { f: "=ROUND(E2*F2,2)", v: "#VALUE!" };
  assert.throws(() => accountingGrid(s), /rezultat valid/);
  s.cellData![1][2] = { f: "=ROUND(E2*F2,2)", v: 25 };
  assert.equal(accountingGrid(s)[1][2], "25");
});
test("blank workbooks are independent and unsupported files fail explicitly", async () => {
  const a = makeBook(),
    b = makeBook();
  assert.notEqual(a.id, b.id);
  assert.equal(a.sheets[a.sheetOrder[0]].rowCount, 1000);
  await assert.rejects(
    () => readSpreadsheet(new ArrayBuffer(0), "macros.xlsm"),
    /nu sunt acceptate/,
  );
});
test("backup restores as a new register and print escapes document contents", async () => {
  const { restoreSpreadsheet, printableSheet } =
    await import("../lib/socot-sheets");
  const b = makeBook("<img src=x onerror=alert(1)>", [
    ["<script>alert(1)</script>"],
  ]);
  const restored = restoreSpreadsheet(JSON.stringify(b));
  assert.notEqual(restored.id, b.id);
  assert.deepEqual(restored.sheets, b.sheets);
  const html = printableSheet(b, b.sheetOrder[0]);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.throws(() => restoreSpreadsheet("{}"), /invalidă/);
});
test("accounting handoff converts formatted Excel dates and discovers template total", async () => {
  const { suggestMapping } = await import("../lib/workbook");
  const b = templateBook(),
    s = b.sheets[b.sheetOrder[0]];
  s.cellData![1][2] = { v: 25 };
  s.cellData![1][1] = { v: 46301, t: 2, s: { n: { pattern: "yyyy-mm-dd" } } };
  const grid = accountingGrid(s, b);
  assert.equal(grid[1][1], "2026-10-06");
  assert.equal(suggestMapping(grid[0]).total, 2);
});
