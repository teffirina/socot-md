import type { ICellData, IWorksheetData } from "@univerjs/core";
import { plainCell, usedSize, type SheetBook } from "./socot-sheets";
import { numberValue } from "./workbook";
export type PivotConfig = {
  sourceSheetId: string;
  row: number;
  column: number;
  value: number;
  operation: "sum" | "count" | "average";
};
export type PivotResult = {
  grid: (string | number)[][];
  series: { label: string; value: number }[];
  sourceRows: number;
  title: string;
};
const operations = { sum: "Sumă", count: "Număr de rânduri", average: "Medie" };
export function pivotConfig(value: unknown): PivotConfig | null {
  if (!value || typeof value !== "object") return null;
  const c = value as PivotConfig;
  return typeof c.sourceSheetId === "string" &&
    [c.row, c.column, c.value].every(Number.isInteger) &&
    c.row >= 0 &&
    c.column >= -1 &&
    c.value >= 0 &&
    ["sum", "count", "average"].includes(c.operation)
    ? c
    : null;
}
export function sheetHeaders(s: Partial<IWorksheetData>) {
  const { cols } = usedSize(s);
  return Array.from(
    { length: Math.min(cols, 256) },
    (_, c) => plainCell(s.cellData?.[0]?.[c]).trim() || `Coloana ${c + 1}`,
  );
}
function valueText(book: SheetBook, cell?: ICellData) {
  if (cell?.f && (cell.v == null || /^#/.test(plainCell(cell))))
    throw Error(
      "O formulă din câmpurile selectate nu are un rezultat valid. Recalculează și corectează foaia sursă.",
    );
  const style = typeof cell?.s === "string" ? book.styles[cell.s] : cell?.s;
  if (
    typeof cell?.v === "number" &&
    /[dy]/i.test(style?.n?.pattern?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "")
  ) {
    const time = Date.UTC(1899, 11, 30) + Math.round(cell.v * 86400000);
    if (
      !Number.isFinite(time) ||
      time < Date.UTC(1900, 0, 1) ||
      time > Date.UTC(9999, 11, 31)
    )
      throw Error("Dată invalidă în sursă.");
    return new Date(time).toISOString().slice(0, 10);
  }
  return plainCell(cell).trim();
}
type Stat = { sum: number; correction: number; count: number };
const empty = (): Stat => ({ sum: 0, correction: 0, count: 0 });
function add(s: Stat, n: number) {
  const y = n - s.correction,
    t = s.sum + y;
  s.correction = t - s.sum - y;
  s.sum = t;
  s.count++;
  if (!Number.isFinite(t)) throw Error("Totalul depășește limita numerică.");
}
function result(s: Stat | undefined, op: PivotConfig["operation"]) {
  return !s
    ? 0
    : op === "count"
      ? s.count
      : op === "average"
        ? s.sum / s.count
        : s.sum;
}
export function buildPivot(book: SheetBook, config: PivotConfig): PivotResult {
  if (!pivotConfig(config))
    throw Error("Configurație de centralizare invalidă.");
  const s = book.sheets[config.sourceSheetId];
  if (!s) throw Error("Foaia sursă nu mai există.");
  const { rows, cols } = usedSize(s),
    headers = sheetHeaders(s);
  if (rows < 2)
    throw Error("Sursa trebuie să conțină antet și cel puțin un rând de date.");
  if (rows > 10001 || cols > 256)
    throw Error(
      "Centralizarea acceptă maximum 10.000 rânduri de date și 256 coloane.",
    );
  if (
    config.row >= cols ||
    config.column >= cols ||
    (config.operation !== "count" && config.value >= cols)
  )
    throw Error("Alege câmpuri existente în foaia sursă.");
  if (config.row === config.column)
    throw Error("Alege câmpuri diferite pentru rânduri și coloane.");
  const groups = new Map<string, Map<string, Stat>>(),
    rowTotals = new Map<string, Stat>(),
    columnTotals = new Map<string, Stat>(),
    grand = empty();
  let sourceRows = 0;
  for (let r = 1; r < rows; r++) {
    const row = s.cellData?.[r];
    if (
      !row ||
      Object.values(row).every((c) => !c || (!c.f && !plainCell(c).trim()))
    )
      continue;
    const label = valueText(book, row[config.row]),
      column =
        config.column < 0 ? "Total" : valueText(book, row[config.column]);
    let n = 0;
    if (config.operation !== "count") {
      const raw = valueText(book, row[config.value]);
      if (!raw)
        throw Error(
          `Lipsește valoarea numerică în rândul ${r + 1}. Completeaz-o sau folosește numărarea rândurilor.`,
        );
      try {
        n =
          typeof row[config.value]?.v === "number"
            ? (row[config.value].v as number)
            : numberValue(raw);
      } catch {
        throw Error(
          `Valoare nenumerică în rândul ${r + 1}: ${headers[config.value]}.`,
        );
      }
    }
    if (!groups.has(label)) groups.set(label, new Map());
    const group = groups.get(label)!;
    if (!group.has(column)) group.set(column, empty());
    if (!rowTotals.has(label)) rowTotals.set(label, empty());
    if (!columnTotals.has(column)) columnTotals.set(column, empty());
    if (groups.size > 500 || columnTotals.size > 30)
      throw Error(
        "Prea multe categorii: maximum 500 rânduri și 30 coloane în centralizare.",
      );
    add(group.get(column)!, n);
    add(rowTotals.get(label)!, n);
    add(columnTotals.get(column)!, n);
    add(grand, n);
    sourceRows++;
  }
  if (!sourceRows) throw Error("Foaia nu conține date de centralizat.");
  const keys = [...columnTotals.keys()],
    heading =
      operations[config.operation] +
      (config.operation === "count" ? "" : ` · ${headers[config.value]}`);
  const show = (v: string) => v || "(necompletat)";
  const grid: (string | number)[][] = [
    [
      headers[config.row],
      ...keys.map((k) => (config.column < 0 ? heading : show(k))),
      ...(config.column < 0 ? [] : ["Total"]),
    ],
  ];
  const series = [];
  for (const [key, group] of groups) {
    const total = result(rowTotals.get(key), config.operation);
    grid.push([
      show(key),
      ...keys.map((k) =>
        config.operation === "average" && !group.has(k)
          ? ""
          : result(group.get(k), config.operation),
      ),
      ...(config.column < 0 ? [] : [total]),
    ]);
    series.push({ label: show(key), value: total });
  }
  grid.push([
    "Total general",
    ...keys.map((k) => result(columnTotals.get(k), config.operation)),
    ...(config.column < 0 ? [] : [result(grand, config.operation)]),
  ]);
  return {
    grid,
    series,
    sourceRows,
    title: `${heading} după ${headers[config.row]}`,
  };
}
export function pivotSheet(
  pivot: PivotResult,
  config: PivotConfig,
): Partial<IWorksheetData> {
  const cellData: IWorksheetData["cellData"] = {};
  pivot.grid.forEach((row, r) =>
    row.forEach((v, c) => {
      (cellData[r] ??= {})[c] = {
        v,
        t: typeof v === "number" ? 2 : 1,
        s:
          r === 0
            ? { bl: 1, bg: { rgb: "#173d36" }, cl: { rgb: "#ffffff" } }
            : r === pivot.grid.length - 1
              ? { bl: 1 }
              : typeof v === "number"
                ? {
                    n: {
                      pattern: config.operation === "count" ? "0" : "#,##0.00",
                    },
                  }
                : undefined,
      };
    }),
  );
  return {
    cellData,
    defaultColumnWidth: 140,
    columnData: { 0: { w: 240 } },
    freeze: { startRow: 1, startColumn: -1, xSplit: 0, ySplit: 1 },
    custom: {
      socotPivot: { ...config },
      generatedAt: new Date().toISOString(),
    },
  };
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function chartSvg(pivot: PivotResult): string {
  const data = pivot.series.slice(0, 40),
    width = 960,
    height = 110 + data.length * 32;
  const min = Math.min(0, ...data.map((d) => d.value)),
    max = Math.max(0, ...data.map((d) => d.value)),
    range = max - min || 1;
  const x = (v: number) => 280 + (v / range) * 550 - (min / range) * 550,
    zero = x(0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(pivot.title)}"><rect width="100%" height="100%" fill="white"/><text x="20" y="30" font-family="Arial" font-size="18" fill="#173d36">${escape(pivot.title)}</text><text x="20" y="52" font-family="Arial" font-size="12" fill="#617770">${pivot.sourceRows} rânduri sursă${pivot.series.length > 40 ? " · primele 40 de categorii" : ""}</text><line x1="${zero}" x2="${zero}" y1="65" y2="${height - 25}" stroke="#a5b8b0"/>${data
    .map((d, i) => {
      const y = 72 + i * 32;
      return `<text x="20" y="${y + 16}" font-family="Arial" font-size="12" fill="#173d36">${escape(d.label.length > 32 ? d.label.slice(0, 31) + "…" : d.label)}</text><rect x="${Math.min(zero, x(d.value))}" y="${y}" width="${Math.abs(x(d.value) - zero)}" height="22" rx="3" fill="${d.value < 0 ? "#bf6849" : "#21715e"}"/><text x="850" y="${y + 16}" font-family="Arial" font-size="12" fill="#173d36">${escape(new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(d.value))}</text>`;
    })
    .join("")}</svg>`;
}
