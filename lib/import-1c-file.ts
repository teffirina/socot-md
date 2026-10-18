import { checkXlsxArchive, parseDelimited, type Grid } from "./workbook";
import { MAX_1C_ROWS } from "./import-1c";

export const MAX_1C_BYTES = 4_000_000;

// 1C saves CSV/TXT in UTF-8 or Windows-1251; Excel lists may keep merged title rows.
export async function gridFrom1CFile(
  bytes: ArrayBuffer,
  name: string,
): Promise<Grid> {
  if (bytes.byteLength > MAX_1C_BYTES)
    throw Error("Fișierul depășește 4 MB. Împarte lista pe perioade.");
  if (/\.xls$/i.test(name))
    throw Error(
      "Formatul .xls vechi nu este acceptat. În 1C alege „Salvează ca” → Excel 2007 (.xlsx) sau CSV.",
    );
  if (/\.(csv|txt|tsv)$/i.test(name)) {
    const raw = new Uint8Array(bytes);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      text = new TextDecoder("windows-1251").decode(raw);
    }
    const sample = text.slice(0, 4000);
    const delimiter = ["\t", ";", ","].reduce((a, b) =>
      sample.split(b).length > sample.split(a).length ? b : a,
    );
    return parseDelimited(text, delimiter, MAX_1C_ROWS + 40, 60);
  }
  if (!/\.xlsx$/i.test(name))
    throw Error("Alege un fișier .xlsx sau .csv salvat din 1C.");
  checkXlsxArchive(bytes);
  const ExcelJS = await import("exceljs");
  const book = new (ExcelJS.default ?? ExcelJS).Workbook();
  await book.xlsx.load(bytes);
  const ws = book.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) throw Error("Fișierul Excel este gol.");
  if (ws.rowCount > MAX_1C_ROWS + 40 || ws.columnCount > 60)
    throw Error(`Maximum ${MAX_1C_ROWS} rânduri și 60 de coloane.`);
  return Array.from({ length: ws.rowCount }, (_, r) =>
    Array.from({ length: ws.columnCount }, (_, c) => {
      const cell = ws.getCell(r + 1, c + 1);
      if (cell.isMerged && cell.master !== cell) return "";
      const v = cell.value;
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === "object") {
        if ("richText" in v) return v.richText.map((t) => t.text).join("");
        if ("result" in v) {
          const res = v.result;
          return res instanceof Date
            ? res.toISOString().slice(0, 10)
            : String(res ?? "");
        }
        if ("text" in v) return String(v.text);
        return "";
      }
      return String(v);
    }),
  );
}
