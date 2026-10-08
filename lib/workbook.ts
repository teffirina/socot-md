import { invoiceSchema, type Invoice } from "./domain";
export type Grid = string[][];
export type Mapping = { customer: number; date: number; total: number };
export const MAX_ROWS = 501,
  MAX_COLS = 26;
export function parseDelimited(text: string, delimiter?: string): Grid {
  text = text.replace(/^\uFEFF/, "");
  delimiter ??= text.split(/\r?\n/)[0].includes("\t")
    ? "\t"
    : text.split(/\r?\n/)[0].includes(";")
      ? ";"
      : ",";
  const rows: Grid = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (!value || quoted) quoted = !quoted;
      else throw new Error("Ghilimele CSV incorecte.");
    } else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
      row.push(value);
      value = "";
      if (c !== delimiter) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
    } else value += c;
    if (rows.length > MAX_ROWS || row.length > MAX_COLS || value.length > 2000)
      throw new Error(
        "Limită: 500 rânduri, 26 coloane, 2000 caractere/celulă.",
      );
  }
  if (quoted) throw new Error("Ghilimele CSV neînchise.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  if (rows.length > MAX_ROWS || rows.some((r) => r.length > MAX_COLS))
    throw new Error("Tabel prea mare.");
  return rows;
}
export function numberValue(s: string): number {
  s = s
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))
    throw new Error("Număr invalid");
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("Număr invalid");
  return n;
}
// Small explicit grammar: no eval, functions, external links, macros or cached Excel results.
export function calculate(
  grid: Grid,
  row: number,
  col: number,
  path = new Set<string>(),
  budget = { left: 2000 },
): number {
  if (--budget.left < 0 || path.size > 50)
    throw new Error("Formula este prea complexă");
  const key = `${row}:${col}`;
  if (path.has(key)) throw new Error("Referință circulară");
  if (row < 0 || row >= grid.length || col < 0 || col >= MAX_COLS)
    throw new Error("Referință în afara tabelului");
  const raw = grid[row]?.[col] ?? "";
  if (!raw.startsWith("=")) return raw.trim() ? numberValue(raw) : 0;
  path = new Set(path).add(key);
  const input = raw.slice(1).toUpperCase().replace(/\s/g, "");
  const tokens =
    input.match(/SUM|\$?[A-Z]\$?\d+|\d+(?:\.\d+)?|[()+*/,:;\-]/g) ?? [];
  if (tokens.join("") !== input || !tokens.length)
    throw new Error("Formulă nesuportată");
  let p = 0;
  const ref = (s: string) => {
    const m = /^\$?([A-Z])\$?(\d+)$/.exec(s);
    if (!m) throw new Error("Referință invalidă");
    return [Number(m[2]) - 1, m[1].charCodeAt(0) - 65];
  };
  const cell = (s: string) => {
    const [r, c] = ref(s);
    return calculate(grid, r, c, path, budget);
  };
  function atom(): number {
    if (tokens[p] === "-" || tokens[p] === "+") {
      const sign = tokens[p++];
      return (sign === "-" ? -1 : 1) * atom();
    }
    if (tokens[p] === "(") {
      p++;
      const n = expression();
      if (tokens[p++] !== ")") throw new Error("Lipsește paranteza");
      return n;
    }
    if (tokens[p] === "SUM") {
      p++;
      if (tokens[p++] !== "(") throw new Error("SUM necesită paranteze");
      let n = 0;
      do {
        if (/^\$?[A-Z]\$?\d+$/.test(tokens[p] ?? "") && tokens[p + 1] === ":") {
          const [r, c] = ref(tokens[p++]);
          p++;
          const [r2, c2] = ref(tokens[p++]);
          if (r2 < r || c2 < c || r2 >= grid.length || c2 >= MAX_COLS)
            throw new Error("Interval invalid");
          for (let y = r; y <= r2; y++)
            for (let x = c; x <= c2; x++)
              n += calculate(grid, y, x, path, budget);
        } else n += expression();
        if (![";", ","].includes(tokens[p])) break;
        p++;
      } while (p < tokens.length);
      if (tokens[p++] !== ")") throw new Error("SUM invalid");
      return n;
    }
    const token = tokens[p++];
    if (/^\$?[A-Z]\$?\d+$/.test(token ?? "")) return cell(token);
    if (!/^\d+(?:\.\d+)?$/.test(token ?? ""))
      throw new Error("Formulă invalidă");
    return Number(token);
  }
  function product(): number {
    let n = atom();
    while (["*", "/"].includes(tokens[p])) {
      const op = tokens[p++],
        b = atom();
      if (op === "/" && b === 0) throw new Error("Împărțire la zero");
      n = op === "*" ? n * b : n / b;
    }
    return n;
  }
  function expression(): number {
    let n = product();
    while (["+", "-"].includes(tokens[p])) {
      const op = tokens[p++],
        b = product();
      n = op === "+" ? n + b : n - b;
    }
    return n;
  }
  const result = expression();
  if (p !== tokens.length || !Number.isFinite(result))
    throw new Error("Formulă invalidă");
  return result;
}
export function suggestMapping(header: string[]): Mapping {
  const find = (pattern: RegExp) =>
    header.findIndex((h) =>
      pattern.test(
        h
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .trim()
          .toLowerCase(),
      ),
    );
  return {
    customer: find(/^(client|furnizor|partener|customer)$/),
    date: find(/^(data|date)$/),
    total: find(/^(total(?: mdl)?|suma|amount)$/),
  };
}
export function prepareRow(
  grid: Grid,
  row: number,
  mapping: Mapping,
  id: string,
  sourceRef: string,
  kind: "sale" | "expense",
): Invoice {
  if (
    new Set(Object.values(mapping)).size !== 3 ||
    Object.values(mapping).some((v) => v < 0)
  )
    throw new Error("Alege trei coloane distincte.");
  const rawDate = grid[row][mapping.date]?.trim() ?? "";
  const date = /^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)
    ? rawDate.split(".").reverse().join("-")
    : rawDate;
  if (!grid[row][mapping.total]?.trim()) throw new Error("Suma lipsește.");
  const [coefficient, exponent = "0"] = calculate(grid, row, mapping.total)
    .toString()
    .split("e");
  const cents = Math.round(Number(`${coefficient}e${Number(exponent) + 2}`));
  return invoiceSchema.parse({
    id,
    sourceRef,
    kind,
    customer: grid[row][mapping.customer] ?? "",
    date,
    total: cents,
    paid: 0,
    version: 0,
  });
}
export function duplicateKey(i: Invoice) {
  return `${i.kind ?? "sale"}|${i.customer.trim().toLocaleLowerCase()}|${i.date}|${i.total}`;
}

// Check the ZIP directory before XLSX decompression. Reject ZIP64/encrypted/oversized archives.
export function checkXlsxArchive(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  let end = -1;
  for (
    let i = bytes.byteLength - 22;
    i >= Math.max(0, bytes.byteLength - 65557);
    i--
  ) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.byteLength
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Arhivă XLSX invalidă.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    total = 0;
  if (
    count > 200 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  )
    throw new Error("Arhivă XLSX prea complexă.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Arhivă XLSX invalidă.");
    total += view.getUint32(offset + 24, true);
    if (total > 10_000_000 || view.getUint16(offset + 8, true) & 1)
      throw new Error("XLSX criptat sau prea mare după decomprimare (10 MB).");
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  if (offset !== end) throw new Error("Format ZIP nesuportat.");
}

export async function exportWorkbook(grid: Grid) {
    const ExcelJS = await import("exceljs");
    const book = new (ExcelJS.default ?? ExcelJS).Workbook();
    const sheet = book.addWorksheet("Socot");
    grid.forEach((row, r) =>
      row.forEach((value, c) => {
        const cell = sheet.getCell(r + 1, c + 1);
        if (r > 0 && value.startsWith("=")) {
          cell.value = {
            formula: value.slice(1),
            result: calculate(grid, r, c),
          };
        } else
          cell.value =
            r > 0 && /^(?:0|[1-9]\d*)(?:[.,]\d+)?$/.test(value)
              ? Number(value.replace(",", "."))
              : value;
      }),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 24;
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    return new Uint8Array(await book.xlsx.writeBuffer());
}
