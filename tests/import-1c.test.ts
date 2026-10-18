import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { amount1C, date1C, kindFromText, read1C } from "../lib/import-1c";
import { gridFrom1CFile } from "../lib/import-1c-file";

test("jurnalul de documente 1C în rusă, cu rânduri de titlu și total", () => {
  const result = read1C([
    ["Журнал документов", "", "", "", ""],
    ["Период: 01.10.2026 - 31.10.2026", "", "", "", ""],
    ["Дата", "Документ", "Контрагент", "Сумма", "Валюта"],
    [
      "05.10.2026 12:00:00",
      "Реализация товаров и услуг 0000-000123 от 05.10.2026",
      "Alfa SRL",
      "1 234,56",
      "MDL",
    ],
    [
      "06.10.2026 0:00:00",
      "Поступление товаров и услуг ЦБ-000045 от 06.10.2026",
      "Beta SA",
      "500",
      "MDL",
    ],
    ["07.10.2026", "Поступление товаров и услуг", "Gamma", "100", "USD"],
    ["Итого", "", "", "1 834,56", ""],
  ]);
  assert.equal(result.type, "documents");
  if (result.type !== "documents") return;
  assert.equal(result.header, 2);
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows[0], {
    line: 4,
    number: "0000-000123",
    date: "2026-10-05",
    partner: "Alfa SRL",
    total: 123456,
    kind: "sale",
  });
  assert.equal(result.rows[1].kind, "expense");
  assert.equal(result.rows[1].number, "ЦБ-000045");
  assert.match(result.rows[2].error!, /USD/);
});

test("lista de livrări 1C în română ia tipul din antetul coloanei", () => {
  const result = read1C([
    ["Data", "Număr", "Cumpărător", "Suma TVA", "Suma"],
    ["01.09.2026", "AA0001", "Delta SRL", "200,00", "1.200,00"],
    ["02.09.2026", "AA0002", "", "0", "10"],
  ]);
  assert.equal(result.type, "documents");
  if (result.type !== "documents") return;
  assert.equal(result.defaultKind, "sale");
  assert.equal(result.rows[0].total, 120000);
  assert.equal(result.rows[0].number, "AA0001");
  assert.match(result.rows[1].error!, /Contragentul/);
});

test("lista de contragenți 1C devine parteneri", () => {
  const result = read1C([
    ["Контрагенты"],
    ["Код", "Наименование", "Фискальный код", "Адрес"],
    ["000001", "Alfa SRL", "1003600012345", "Chișinău"],
    ["000002", "Beta", "123", ""],
  ]);
  assert.equal(result.type, "partners");
  if (result.type !== "partners") return;
  assert.equal(result.rows[0].idno, "1003600012345");
  assert.equal(result.rows[0].address, "Chișinău");
  assert.equal(result.rows[1].idno, "");
});

test("fără antet recunoscut primești o explicație", () => {
  assert.throws(
    () =>
      read1C([
        ["a", "b"],
        ["1", "2"],
      ]),
    /antetul 1C/,
  );
});

test("sume, date și tipuri în formatele din 1C", () => {
  assert.equal(amount1C("1,234.50"), 123450);
  assert.equal(amount1C("12 345"), 1234500);
  assert.equal(amount1C("99,9 lei"), 9990);
  assert.throws(() => amount1C("abc"));
  assert.equal(date1C("5.1.26"), "2026-01-05");
  assert.equal(date1C("2026-02-03"), "2026-02-03");
  assert.throws(() => date1C("31.02.2026"));
  assert.equal(kindFromText("Intrarea mărfurilor și serviciilor"), "expense");
  assert.equal(kindFromText("Livrarea mărfurilor"), "sale");
  assert.equal(kindFromText("Plată"), null);
});

test("CSV din 1C în Windows-1251, cu titlu fără separatori", async () => {
  const text = "Журнал\r\nДата;Контрагент;Сумма\r\n05.10.2026;Альфа;10,50\r\n";
  const map: Record<string, number> = {
    Ж: 0xc6,
    у: 0xf3,
    р: 0xf0,
    н: 0xed,
    а: 0xe0,
    л: 0xeb,
    Д: 0xc4,
    т: 0xf2,
    К: 0xca,
    о: 0xee,
    г: 0xe3,
    е: 0xe5,
    С: 0xd1,
    м: 0xec,
    А: 0xc0,
    ь: 0xfc,
    ф: 0xf4,
  };
  const bytes = Uint8Array.from(text, (ch) => map[ch] ?? ch.charCodeAt(0));
  const grid = await gridFrom1CFile(bytes.buffer, "jurnal.csv");
  const result = read1C(grid);
  assert.equal(result.type, "documents");
  if (result.type === "documents") {
    assert.equal(result.rows[0].partner, "Альфа");
    assert.equal(result.rows[0].total, 1050);
  }
});

test("Excel din 1C cu titlu îmbinat și dată ca dată", async () => {
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet("TDSheet");
  ws.addRow(["Реализация товаров и услуг", "", ""]);
  ws.mergeCells("A1:C1");
  ws.addRow(["Дата", "Контрагент", "Сумма"]);
  ws.addRow([new Date(Date.UTC(2026, 9, 5)), "Alfa SRL", 250.5]);
  const bytes = await book.xlsx.writeBuffer();
  const grid = await gridFrom1CFile(
    new Uint8Array(bytes as ArrayBuffer).buffer,
    "lista.xlsx",
  );
  const result = read1C(grid);
  assert.equal(result.type, "documents");
  if (result.type === "documents")
    assert.deepEqual(
      [result.rows[0].date, result.rows[0].total],
      ["2026-10-05", 25050],
    );
  await assert.rejects(gridFrom1CFile(new ArrayBuffer(8), "vechi.xls"), /xlsx/);
});
