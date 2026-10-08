import type {
  IWorkbookData,
  IWorksheetData,
  ICellData,
  IStyleData,
} from "@univerjs/core";
import type { Cell, Workbook } from "exceljs";
import { checkXlsxArchive, parseDelimited, type Grid } from "./workbook";
export type SheetBook = IWorkbookData;
export const BOOK_LIMIT = 4_500_000;
export function makeBook(name = "Registru nou", grid?: Grid): SheetBook {
  const id = crypto.randomUUID(),
    sheet = crypto.randomUUID();
  const cellData: IWorksheetData["cellData"] = {};
  grid?.forEach((row, r) =>
    row.forEach((v, c) => {
      (cellData[r] ??= {})[c] = v.startsWith("=") ? { f: v } : { v, t: 1 };
    }),
  );
  return {
    id,
    name,
    appVersion: "1.0.3",
    locale: "enUS" as IWorkbookData["locale"],
    styles: {},
    sheetOrder: [sheet],
    sheets: {
      [sheet]: {
        id: sheet,
        name: "Foaia 1",
        rowCount: 1000,
        columnCount: 52,
        cellData,
        defaultColumnWidth: 110,
        defaultRowHeight: 24,
        showGridlines: 1,
      },
    },
  };
}
export function templateBook() {
  const b = makeBook("Cheltuieli — registru de lucru");
  const s = b.sheets[b.sheetOrder[0]];
  s.name = "Cheltuieli";
  s.cellData = {
    0: {
      0: { v: "Partener" },
      1: { v: "Data" },
      2: { v: "Total MDL" },
      3: { v: "Descriere" },
      4: { v: "Cantitate" },
      5: { v: "Preț unitar" },
    },
    1: {
      0: { v: "" },
      1: { v: new Date().toISOString().slice(0, 10), t: 1 },
      2: { f: "=ROUND(E2*F2,2)" },
      3: { v: "" },
      4: { v: 1, t: 2 },
      5: { v: 0, t: 2 },
    },
  };
  for (const cell of Object.values(s.cellData[0]))
    cell.s = { bl: 1, bg: { rgb: "#173d36" }, cl: { rgb: "#ffffff" } };
  s.columnData = {
    0: { w: 220 },
    1: { w: 120 },
    2: { w: 130 },
    3: { w: 250 },
    4: { w: 110 },
    5: { w: 120 },
  };
  s.freeze = { startRow: 1, startColumn: -1, xSplit: 0, ySplit: 1 };
  return b;
}
export function plainCell(c?: ICellData): string {
  if (c?.p?.body?.dataStream)
    return c.p.body.dataStream.replace(/[\r\n]+$/, "");
  return c?.v == null ? "" : String(c.v);
}
export function usedSize(s: Partial<IWorksheetData>) {
  let rows = 0,
    cols = 0;
  for (const [r, row] of Object.entries(s.cellData ?? {}))
    for (const [c, cell] of Object.entries(row as Record<string, ICellData>)) {
      if (cell && (cell.f || plainCell(cell))) {
        rows = Math.max(rows, Number(r) + 1);
        cols = Math.max(cols, Number(c) + 1);
      }
    }
  return { rows, cols };
}
export function accountingGrid(
  s: Partial<IWorksheetData>,
  book?: SheetBook,
): Grid {
  const { rows, cols } = usedSize(s);
  if (rows < 2 || rows > 501 || cols > 26)
    throw Error(
      "Pentru verificarea contabilă: antet și 1–500 rânduri, cel mult 26 coloane. Copiază intervalul dorit într-o foaie separată.",
    );
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = s.cellData?.[r]?.[c];
      const value = plainCell(cell);
      if (cell?.f && (cell.v == null || /^#/.test(value)))
        throw Error(
          `Formula din rândul ${r + 1}, coloana ${c + 1} nu are un rezultat valid. Corecteaz-o înainte de verificare.`,
        );
      const style =
        typeof cell?.s === "string" ? book?.styles[cell.s] : cell?.s;
      const fmt = style?.n?.pattern?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "";
      if (typeof cell?.v === "number" && /[dy]/i.test(fmt)) {
        const time = Date.UTC(1899, 11, 30) + Math.round(cell.v * 86400000);
        if (
          Number.isFinite(time) &&
          time >= Date.UTC(1900, 0, 1) &&
          time <= Date.UTC(9999, 11, 31)
        )
          return new Date(time).toISOString().slice(0, 10);
        throw Error(`Dată invalidă în rândul ${r + 1}.`);
      }
      return value;
    }),
  );
}
const rgb = (color: { argb?: string } | undefined) =>
  color?.argb ? "#" + color.argb.slice(-6) : undefined;
function importStyle(cell: Cell): IStyleData {
  const { font, fill, alignment, border, numFmt } = cell;
  const style: IStyleData = {
    ff: font?.name,
    fs: font?.size,
    bl: font?.bold ? 1 : 0,
    it: font?.italic ? 1 : 0,
    ul: { s: font?.underline ? 1 : 0 },
    st: { s: font?.strike ? 1 : 0 },
    n: numFmt ? { pattern: numFmt } : undefined,
  };
  if (rgb(font?.color)) style.cl = { rgb: rgb(font.color)! };
  if (fill?.type === "pattern" && rgb(fill.fgColor))
    style.bg = { rgb: rgb(fill.fgColor)! };
  style.ht =
    ({ left: 1, center: 2, right: 3, justify: 4 } as const)[
      alignment?.horizontal as "left"
    ] ?? 0;
  style.vt =
    ({ top: 1, middle: 2, bottom: 3 } as const)[alignment?.vertical as "top"] ??
    0;
  style.tb = alignment?.wrapText ? 3 : 1;
  style.bd = {};
  for (const [side, key] of [
    ["top", "t"],
    ["bottom", "b"],
    ["left", "l"],
    ["right", "r"],
  ] as const)
    if (border?.[side])
      style.bd[key] = {
        s: 1,
        cl: { rgb: rgb(border[side]?.color) ?? "#000000" },
      };
  return style;
}
async function excelBook(): Promise<Workbook> {
  const m = await import("exceljs");
  return new (m.default ?? m).Workbook();
}
export async function readSpreadsheet(
  bytes: ArrayBuffer,
  name: string,
): Promise<{ book: SheetBook; warnings: string[] }> {
  if (bytes.byteLength > 2_000_000)
    throw Error("Limita de import este 2 MB. Împarte fișierele mai mari.");
  if (/\.(csv|tsv)$/i.test(name))
    return {
      book: makeBook(
        name,
        parseDelimited(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      ),
      warnings: [],
    };
  if (!/\.xlsx$/i.test(name))
    throw Error(
      "Alege un fișier XLSX, CSV sau TSV. XLS și macrocomenzile XLSM nu sunt acceptate.",
    );
  checkXlsxArchive(bytes);
  const x = await excelBook();
  await x.xlsx.load(bytes);
  if (!x.worksheets.length || x.worksheets.length > 20)
    throw Error("Registrul trebuie să conțină 1–20 foi.");
  const b = makeBook(name.replace(/\.xlsx$/i, ""));
  b.sheetOrder = [];
  b.sheets = {};
  const warnings = new Set<string>();
  warnings.add(
    "Importul păstrează celule, formule, formatarea de bază, îmbinări și dimensiuni. Graficele, imaginile, tabelele pivot, regulile avansate și legăturile externe nu sunt convertite. Originalul rămâne disponibil.",
  );
  for (const ws of x.worksheets) {
    if (ws.rowCount > 10000 || ws.columnCount > 256)
      throw Error("Limita pe foaie: 10.000 rânduri și 256 coloane.");
    const id = crypto.randomUUID(),
      cellData: IWorksheetData["cellData"] = {};
    let cells = 0;
    ws.eachRow((row, r) =>
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (++cells > 100000)
          throw Error(
            "Prea multe celule pentru importul local (100.000/foaie).",
          );
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const data: ICellData = { s: importStyle(cell) },
          v = cell.value;
        if (cell.formula) {
          data.f = "=" + cell.formula;
        } else if (v instanceof Date) {
          data.v = (v.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
          data.t = 2;
        } else if (typeof v === "number") {
          data.v = v;
          data.t = 2;
        } else if (typeof v === "boolean") {
          data.v = v ? 1 : 0;
          data.t = 3;
        } else {
          data.v = cell.text;
          data.t = 1;
        }
        (cellData[r - 1] ??= {})[c - 1] = data;
      }),
    );
    const s: Partial<IWorksheetData> = {
      id,
      name: ws.name,
      hidden: ws.state === "visible" ? 0 : 1,
      rowCount: Math.max(1000, ws.rowCount + 50),
      columnCount: Math.max(52, ws.columnCount),
      cellData,
      columnData: {},
      rowData: {},
      mergeData: [],
    };
    (ws.columns ?? []).forEach((col, c) => {
      s.columnData![c] = { w: (col.width ?? 15) * 7, hd: col.hidden ? 1 : 0 };
    });
    ws.eachRow((row, r) => {
      if (row.height || row.hidden)
        s.rowData![r - 1] = {
          h: ((row.height ?? 18) * 4) / 3,
          hd: row.hidden ? 1 : 0,
        };
    });
    for (const range of ws.model.merges ?? []) {
      const [a, z] = range.split(":");
      const start = ws.getCell(a),
        end = ws.getCell(z);
      s.mergeData!.push({
        startRow: Number(start.row) - 1,
        endRow: Number(end.row) - 1,
        startColumn: Number(start.col) - 1,
        endColumn: Number(end.col) - 1,
      });
    }
    const freeze = (ws.views ?? []).find((v) => v.state === "frozen");
    if (freeze?.state === "frozen")
      s.freeze = {
        xSplit: freeze.xSplit ?? 0,
        ySplit: freeze.ySplit ?? 0,
        startRow: freeze.ySplit ?? -1,
        startColumn: freeze.xSplit ?? -1,
      };
    b.sheets[id] = s;
    b.sheetOrder.push(id);
  }
  if (new TextEncoder().encode(JSON.stringify(b)).length > BOOK_LIMIT)
    throw Error(
      "Registrul convertit depășește limita de salvare locală (4,5 MB).",
    );
  return { book: b, warnings: [...warnings] };
}
function resolvedStyle(
  b: SheetBook,
  s: Partial<IWorksheetData>,
  cell: ICellData,
): IStyleData {
  const resolve = (v: IStyleData | string | null | undefined | void) =>
    typeof v === "string" ? (b.styles[v] ?? {}) : (v ?? {});
  return {
    ...resolve(b.defaultStyle),
    ...resolve(s.defaultStyle),
    ...resolve(cell.s),
  };
}
export async function writeSpreadsheet(b: SheetBook) {
  const x = await excelBook();
  x.creator = "Socot";
  x.calcProperties.fullCalcOnLoad = true;
  for (const id of b.sheetOrder) {
    const s = b.sheets[id],
      ws = x.addWorksheet(s.name ?? "Foaie");
    if (s.hidden) ws.state = "hidden";
    for (const [r, row] of Object.entries(s.cellData ?? {}))
      for (const [c, data] of Object.entries(
        row as Record<string, ICellData>,
      )) {
        if (!data) continue;
        const cell = ws.getCell(Number(r) + 1, Number(c) + 1);
        if (data.f)
          cell.value = {
            formula: data.f.replace(/^=/, ""),
            result: typeof data.v === "number" ? data.v : undefined,
          };
        else if (data.t === 3) cell.value = Boolean(data.v);
        else cell.value = data.p ? plainCell(data) : (data.v ?? null);
        const style = resolvedStyle(b, s, data);
        const color = (
          v: { rgb?: string | null | void } | null | undefined | void,
        ) => (v?.rgb ? { argb: "FF" + v.rgb.replace("#", "") } : undefined);
        cell.font = {
          name: style.ff ?? "Arial",
          size: style.fs ?? 11,
          bold: style.bl === 1,
          italic: style.it === 1,
          underline: style.ul?.s === 1,
          strike: style.st?.s === 1,
          color: color(style.cl),
        };
        if (style.bg?.rgb)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: color(style.bg),
          };
        if (style.n) cell.numFmt = style.n.pattern;
        cell.alignment = {
          horizontal: (
            { 1: "left", 2: "center", 3: "right", 4: "justify" } as const
          )[style.ht as 1],
          vertical: ({ 1: "top", 2: "middle", 3: "bottom" } as const)[
            style.vt as 1
          ],
          wrapText: style.tb === 3,
        };
        for (const [side, key] of [
          ["top", "t"],
          ["bottom", "b"],
          ["left", "l"],
          ["right", "r"],
        ] as const)
          if (style.bd?.[key])
            cell.border = {
              ...cell.border,
              [side]: { style: "thin", color: color(style.bd[key]!.cl) },
            };
      }
    for (const [c, d] of Object.entries(s.columnData ?? {})) {
      const col = ws.getColumn(Number(c) + 1);
      if (d.w) col.width = d.w / 7;
      col.hidden = d.hd === 1;
    }
    for (const [r, d] of Object.entries(s.rowData ?? {})) {
      const row = ws.getRow(Number(r) + 1);
      if (d.h) row.height = (d.h * 3) / 4;
      row.hidden = d.hd === 1;
    }
    for (const m of s.mergeData ?? [])
      ws.mergeCells(
        m.startRow + 1,
        m.startColumn + 1,
        m.endRow + 1,
        m.endColumn + 1,
      );
    if (s.freeze)
      ws.views = [
        { state: "frozen", xSplit: s.freeze.xSplit, ySplit: s.freeze.ySplit },
      ];
  }
  return new Uint8Array(await x.xlsx.writeBuffer());
}
export function safeDownload(bytes: Blob, name: string) {
  const url = URL.createObjectURL(bytes),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function restoreSpreadsheet(text: string): SheetBook {
  if (new TextEncoder().encode(text).length > BOOK_LIMIT)
    throw Error("Copia depășește 4,5 MB.");
  const b = JSON.parse(text) as SheetBook;
  if (
    !b ||
    typeof b.name !== "string" ||
    !Array.isArray(b.sheetOrder) ||
    b.sheetOrder.length < 1 ||
    b.sheetOrder.length > 20 ||
    !b.sheets ||
    !b.styles
  )
    throw Error("Copie Socot invalidă.");
  for (const id of b.sheetOrder) {
    const s = b.sheets[id];
    if (!s || typeof s.name !== "string" || !s.cellData)
      throw Error("Foaie invalidă în copie.");
    const { rows, cols } = usedSize(s);
    if (rows > 10000 || cols > 256)
      throw Error("Copia depășește limitele de 10.000 rânduri și 256 coloane.");
  }
  return { ...b, id: crypto.randomUUID(), name: b.name + " (restaurat)" };
}
export function printableSheet(b: SheetBook, id: string) {
  const s = b.sheets[id],
    { rows, cols } = usedSize(s);
  if (rows > 1000 || cols > 52)
    throw Error(
      "Pentru imprimare selectează o foaie cu cel mult 1.000 rânduri și 52 coloane.",
    );
  const escape = (v: string) =>
    v.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(b.name)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#222}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:5px;white-space:pre-wrap}tr{break-inside:avoid}h1{font-size:18px}</style></head><body><h1>${escape(b.name)} · ${escape(s.name ?? "")}</h1><table>`;
  for (let r = 0; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) {
      const merge = s.mergeData?.find(
        (m) =>
          r >= m.startRow &&
          r <= m.endRow &&
          c >= m.startColumn &&
          c <= m.endColumn,
      );
      if (merge && (r !== merge.startRow || c !== merge.startColumn)) continue;
      const cell = s.cellData?.[r]?.[c] ?? {},
        style = resolvedStyle(b, s, cell);
      const color = (v: string | null | void) =>
        v && /^#[\da-f]{6}$/i.test(v) ? v : "";
      const css = `font-weight:${style.bl === 1 ? "bold" : "normal"};font-style:${style.it === 1 ? "italic" : "normal"};color:${color(style.cl?.rgb)};background:${color(style.bg?.rgb)};text-align:${({ 1: "left", 2: "center", 3: "right" } as const)[style.ht as 1] ?? "left"}`;
      html += `<td style="${css}"${merge ? ` rowspan="${merge.endRow - r + 1}" colspan="${merge.endColumn - c + 1}"` : ""}>${escape(printCell(cell, style))}</td>`;
    }
    html += "</tr>";
  }
  return html + "</table></body></html>";
}

function printCell(cell: ICellData, style: IStyleData): string {
  const fmt = style.n?.pattern?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "";
  if (typeof cell.v === "number" && /[dy]/i.test(fmt)) {
    const time = Date.UTC(1899, 11, 30) + Math.round(cell.v * 86400000);
    if (
      Number.isFinite(time) &&
      time >= Date.UTC(1900, 0, 1) &&
      time <= Date.UTC(9999, 11, 31)
    )
      return new Date(time).toISOString().slice(0, 10);
  }
  return plainCell(cell);
}
