import type { Invoice } from "./domain";
import type { Kind } from "./import-1c";

// Checks shown before an import is confirmed: totals against the file and
// against 1C, and what each partner's open balance becomes.

export type Balance = {
  key: string;
  partner: string;
  kind: Kind;
  /** open amount (total − paid) already in Socot, bani */
  before: number;
  imported: number;
  after: number;
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function partnerBalances(existing: Invoice[], incoming: Invoice[]) {
  const map = new Map<string, Balance>();
  const at = (i: Invoice) => {
    const kind: Kind = i.kind ?? "sale";
    const key = `${kind}|${norm(i.customer)}`;
    let b = map.get(key);
    if (!b) {
      b = { key, partner: i.customer, kind, before: 0, imported: 0, after: 0 };
      map.set(key, b);
    }
    return b;
  };
  const touched = new Set(incoming.map((i) => at(i).key));
  for (const i of existing) {
    const key = `${i.kind ?? "sale"}|${norm(i.customer)}`;
    if (touched.has(key)) at(i).before += i.total - i.paid;
  }
  for (const i of incoming) at(i).imported += i.total;
  return [...map.values()]
    .filter((b) => touched.has(b.key))
    .map((b) => ({ ...b, after: b.before + b.imported }))
    .sort((a, b) => b.imported - a.imported);
}

export type TotalsCheck = {
  /** every readable row of the file, duplicates included */
  rows: number;
  importing: number;
  duplicates: number;
  errors: number;
  /** difference between the file's own total row and its rows, or null */
  fileDifference: number | null;
  /** difference between the total typed from 1C and the file rows, or null */
  typedDifference: number | null;
};

export function checkTotals(
  items: { total: number; status: "new" | "duplicate" | "error" }[],
  controlTotal: number | null,
  typed: number | null,
): TotalsCheck {
  const sum = (s: string) =>
    items.filter((i) => i.status === s).reduce((a, i) => a + i.total, 0);
  const rows = items.reduce((a, i) => a + i.total, 0);
  return {
    rows,
    importing: sum("new"),
    duplicates: sum("duplicate"),
    errors: items.filter((i) => i.status === "error").length,
    fileDifference: controlTotal === null ? null : controlTotal - rows,
    typedDifference: typed === null ? null : typed - rows,
  };
}
