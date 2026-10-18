import { z } from "zod";

// Stock register valued by FIFO or moving weighted average. Every change,
// including one dated in the past, re-runs the whole chain, so the cost of
// each issue and every month's entries always follow the current documents.

export const stockMethods = ["fifo", "average"] as const;
export type StockMethod = (typeof stockMethods)[number];
export const stockMethodNames: Record<StockMethod, string> = {
  fifo: "FIFO (primul intrat, primul ieșit)",
  average: "Cost mediu ponderat",
};

export const movementTypes = ["receipt", "sale", "consumption"] as const;
export type MovementType = (typeof movementTypes)[number];
export const movementNames: Record<MovementType, string> = {
  receipt: "Intrare",
  sale: "Ieșire la vânzare",
  consumption: "Consum / dare în producție",
};

export const movementSchema = z
  .object({
    id: z.string().min(1).max(60),
    seq: z.number().int().nonnegative(),
    date: z.iso.date(),
    type: z.enum(movementTypes),
    item: z.string().trim().min(1).max(120),
    /** thousandths of a unit */
    quantity: z.number().int().positive().max(1_000_000_000),
    /** bani, receipts only */
    cost: z.number().int().nonnegative().max(10_000_000_000).optional(),
    /** stock account, e.g. 217 goods or 211 materials */
    account: z.string().regex(/^\d{3,8}$/),
    note: z.string().max(200).optional(),
  })
  .strict()
  .refine((m) => m.type !== "receipt" || m.cost !== undefined, {
    message: "Intrarea are nevoie de valoare.",
  });
export type Movement = z.infer<typeof movementSchema>;

export type Valued = Movement & {
  /** bani: receipt value or computed cost of the issue */
  value: number;
  error?: string;
};

export type Balance = {
  item: string;
  account: string;
  quantity: number;
  value: number;
};

export const itemKey = (name: string) => name.trim().toLocaleLowerCase();

const order = (a: Movement, b: Movement) =>
  a.date.localeCompare(b.date) ||
  // receipts on the same day come before issues
  Number(a.type !== "receipt") - Number(b.type !== "receipt") ||
  a.seq - b.seq;

export function valuate(movements: Movement[], method: StockMethod) {
  type Layer = { quantity: number; value: number };
  const stock = new Map<
    string,
    { item: string; account: string; layers: Layer[] }
  >();
  const valued: Valued[] = [];
  for (const m of [...movements].sort(order)) {
    const key = `${itemKey(m.item)}|${m.account}`;
    let s = stock.get(key);
    if (!s)
      stock.set(
        key,
        (s = { item: m.item.trim(), account: m.account, layers: [] }),
      );
    if (m.type === "receipt") {
      if (method === "fifo")
        s.layers.push({ quantity: m.quantity, value: m.cost! });
      else {
        const all = s.layers[0] ?? { quantity: 0, value: 0 };
        s.layers = [
          { quantity: all.quantity + m.quantity, value: all.value + m.cost! },
        ];
      }
      valued.push({ ...m, value: m.cost! });
      continue;
    }
    let need = m.quantity;
    let value = 0;
    while (need > 0 && s.layers.length) {
      const layer = s.layers[0];
      if (layer.quantity <= need) {
        need -= layer.quantity;
        value += layer.value;
        s.layers.shift();
      } else {
        const part = Math.round((layer.value * need) / layer.quantity);
        layer.quantity -= need;
        layer.value -= part;
        value += part;
        need = 0;
      }
    }
    valued.push({
      ...m,
      value,
      error: need
        ? `Stoc insuficient la ${m.date}: lipsesc ${(need / 1000).toLocaleString("ro-MD")} unități.`
        : undefined,
    });
  }
  const balances: Balance[] = [...stock.values()]
    .map((s) => ({
      item: s.item,
      account: s.account,
      quantity: s.layers.reduce((a, l) => a + l.quantity, 0),
      value: s.layers.reduce((a, l) => a + l.value, 0),
    }))
    .sort((a, b) => a.item.localeCompare(b.item));
  return { valued, balances };
}

// Accounting for the cost of issues, per month.
export const costAccounts: Record<Exclude<MovementType, "receipt">, string> = {
  sale: "711",
  consumption: "811",
};

export type Entry = { debit: string; credit: string; amount: number };
/** month → "debit|credit" → accepted or rejected amount */
export type StockDecisions = Record<
  string,
  Record<
    string,
    { amount: number; decision: "accepted" | "rejected"; at: string }
  >
>;

export function monthEntries(valued: Valued[], month: string): Entry[] {
  const sums = new Map<string, number>();
  for (const v of valued)
    if (v.type !== "receipt" && v.date.startsWith(month) && v.value) {
      const k = `${costAccounts[v.type]}|${v.account}`;
      sums.set(k, (sums.get(k) ?? 0) + v.value);
    }
  return [...sums]
    .map(([k, amount]) => {
      const [debit, credit] = k.split("|");
      return { debit, credit, amount };
    })
    .sort((a, b) => (a.debit + a.credit).localeCompare(b.debit + b.credit));
}

export type EntryStatus = Entry & {
  month: string;
  decision?: StockDecisions[string][string];
  /** recalculated amount minus what was accepted */
  difference: number;
};

/** Every month with issues or decisions, newest first, with what changed. */
export function review(valued: Valued[], decisions: StockDecisions) {
  const months = new Set([
    ...valued
      .filter((v) => v.type !== "receipt")
      .map((v) => v.date.slice(0, 7)),
    ...Object.keys(decisions),
  ]);
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const current = monthEntries(valued, month);
      const keys = new Set([
        ...current.map((e) => `${e.debit}|${e.credit}`),
        ...Object.keys(decisions[month] ?? {}),
      ]);
      const rows: EntryStatus[] = [...keys].sort().map((k) => {
        const [debit, credit] = k.split("|");
        const amount =
          current.find((e) => e.debit === debit && e.credit === credit)
            ?.amount ?? 0;
        const decision = decisions[month]?.[k];
        return {
          month,
          debit,
          credit,
          amount,
          decision,
          difference:
            decision?.decision === "accepted" ? amount - decision.amount : 0,
        };
      });
      return { month, rows };
    });
}

export function decideEntry(
  decisions: StockDecisions,
  row: EntryStatus,
  decision: "accepted" | "rejected" | null,
  at = new Date().toISOString(),
): StockDecisions {
  const month = { ...(decisions[row.month] ?? {}) };
  const k = `${row.debit}|${row.credit}`;
  if (decision) month[k] = { amount: row.amount, decision, at };
  else delete month[k];
  return { ...decisions, [row.month]: month };
}

/** Parses "12,5" into thousandths and "1 234,56" lei into bani. */
export function parseQuantity(text: string) {
  const s = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(s) || !(Number(s) > 0))
    throw Error("Cantitate invalidă (cel mult 3 zecimale).");
  return Math.round(Number(s) * 1000);
}
export function parseLei(text: string) {
  const s = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s))
    throw Error("Valoare invalidă (cel mult 2 zecimale).");
  return Math.round(Number(s) * 100);
}
