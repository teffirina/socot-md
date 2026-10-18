import { z } from "zod";
import {
  itemKey,
  valuate,
  type Entry,
  type Movement,
  type StockDecisions,
  type StockMethod,
  type Valued,
} from "./stock";

// Month-end production costing: materials are issued from stock, the month's
// indirect costs (energy, workshop wages, machine depreciation…) are spread
// over that month's production, and finished products enter account 216 at
// full cost. Any upstream change re-runs the whole calculation.

export const reportSchema = z
  .object({
    id: z.string().min(1).max(60),
    seq: z.number().int().nonnegative(),
    date: z.iso.date(),
    product: z.string().trim().min(1).max(120),
    /** thousandths of a unit */
    quantity: z.number().int().positive(),
    materials: z
      .array(
        z
          .object({
            item: z.string().trim().min(1).max(120),
            account: z.string().regex(/^\d{3,8}$/),
            quantity: z.number().int().positive(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export type ProductionReport = z.infer<typeof reportSchema>;

export const overheadSchema = z
  .object({
    id: z.string().min(1).max(60),
    label: z.string().trim().min(1).max(80),
    amount: z.number().int().positive(),
  })
  .strict();
export type Overhead = z.infer<typeof overheadSchema>;

export const allocationBases = ["materials", "quantity"] as const;
export type AllocationBase = (typeof allocationBases)[number];
export const allocationNames: Record<AllocationBase, string> = {
  materials: "proporțional cu costul materialelor",
  quantity: "proporțional cu cantitatea produsă",
};

export const productAccount = "216";
export const overheadAccount = "821";

export type ReportCost = {
  report: ProductionReport;
  materials: number;
  overhead: number;
  total: number;
  unit: number;
};

/** Splits `amount` by weights, rounding so the parts add up exactly. */
export function allocate(amount: number, weights: number[]) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / sum);
  const parts = raw.map(Math.floor);
  let left = amount - parts.reduce((a, p) => a + p, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (!left) break;
    parts[i]++;
    left--;
  }
  return parts;
}

export function expand(
  reports: ProductionReport[],
  outputCost: Map<string, number>,
): Movement[] {
  // Semi-finished goods made by another report are taken from 216.
  const products = new Set(reports.map((r) => itemKey(r.product)));
  return reports.flatMap((r) => [
    ...r.materials.map((m, i) => ({
      id: `${r.id}:m${i}`,
      seq: r.seq,
      date: r.date,
      type: "production" as const,
      item: m.item,
      quantity: m.quantity,
      account: products.has(itemKey(m.item)) ? productAccount : m.account,
      note: `Pentru ${r.product}`,
    })),
    {
      id: `${r.id}:out`,
      seq: r.seq,
      date: r.date,
      type: "output" as const,
      item: r.product,
      quantity: r.quantity,
      cost: outputCost.get(r.id) ?? 0,
      account: productAccount,
    },
  ]);
}

export function costProduction(
  movements: Movement[],
  reports: ProductionReport[],
  overheads: Record<string, Overhead[]>,
  base: AllocationBase,
  method: StockMethod,
) {
  let outputCost = new Map<string, number>();
  let result = valuate([...movements, ...expand(reports, outputCost)], method);
  let costs: ReportCost[] = [];
  // A product made this month may be a material of another report, so the
  // costs are re-run until they no longer change.
  for (let pass = 0; pass < 20; pass++) {
    const byId = new Map(result.valued.map((v) => [v.id, v]));
    const materials = reports.map((r) =>
      r.materials.reduce(
        (a, _, i) => a + (byId.get(`${r.id}:m${i}`)?.value ?? 0),
        0,
      ),
    );
    const overhead = new Array(reports.length).fill(0);
    const months = new Set(reports.map((r) => r.date.slice(0, 7)));
    for (const month of months) {
      const idx = reports
        .map((r, i) => (r.date.startsWith(month) ? i : -1))
        .filter((i) => i >= 0);
      const total = (overheads[month] ?? []).reduce((a, o) => a + o.amount, 0);
      const weights = idx.map((i) =>
        base === "materials" ? materials[i] : reports[i].quantity,
      );
      // Without material costs, fall back to quantities so nothing is lost.
      const parts = allocate(
        total,
        weights.some(Boolean) ? weights : idx.map((i) => reports[i].quantity),
      );
      idx.forEach((i, k) => (overhead[i] = parts[k]));
    }
    costs = reports.map((report, i) => {
      const total = materials[i] + overhead[i];
      return {
        report,
        materials: materials[i],
        overhead: overhead[i],
        total,
        unit: Math.round((total * 1000) / report.quantity),
      };
    });
    const next = new Map(costs.map((c) => [c.report.id, c.total]));
    if ([...next].every(([id, v]) => outputCost.get(id) === v)) break;
    outputCost = next;
    result = valuate([...movements, ...expand(reports, outputCost)], method);
  }
  // Overheads of a month without production stay on 821 and are flagged.
  const extra: Record<string, Entry[]> = {};
  const idle: string[] = [];
  for (const [month, list] of Object.entries(overheads)) {
    const allocated = costs
      .filter((c) => c.report.date.startsWith(month))
      .reduce((a, c) => a + c.overhead, 0);
    if (allocated)
      extra[month] = [
        { debit: "811", credit: overheadAccount, amount: allocated },
      ];
    else if (list.length) idle.push(month);
  }
  return { ...result, costs, extra, idle } as {
    valued: Valued[];
    balances: ReturnType<typeof valuate>["balances"];
    costs: ReportCost[];
    extra: Record<string, Entry[]>;
    idle: string[];
  };
}

/** Everything the Depozit and Producție screens keep in the profile. */
export type StockRegister = {
  method: StockMethod;
  movements: Movement[];
  decisions: StockDecisions;
  productions?: ProductionReport[];
  overheads?: Record<string, Overhead[]>;
  base?: AllocationBase;
};

export const stockKey = (scope: string) => `${scope}:stock-v1`;

export const runRegister = (r: StockRegister) =>
  costProduction(
    r.movements,
    r.productions ?? [],
    r.overheads ?? {},
    r.base ?? "materials",
    r.method,
  );

export function demoRegister(): StockRegister {
  const day = (monthsAgo: number, d: number) => {
    const x = new Date();
    x.setUTCDate(d);
    x.setUTCMonth(x.getUTCMonth() - monthsAgo);
    return x.toISOString().slice(0, 10);
  };
  const rows: [string, Movement["type"], string, string, number, number?][] = [
    [day(1, 3), "receipt", "Hârtie A4, top", "217", 100, 6500],
    [day(1, 12), "receipt", "Hârtie A4, top", "217", 50, 3750],
    [day(1, 20), "sale", "Hârtie A4, top", "217", 80],
    [day(0, 2), "receipt", "Hârtie A4, top", "217", 40, 3200],
    [day(0, 1), "receipt", "Lemn de stejar, m²", "211", 30, 9000],
    [day(0, 1), "receipt", "Lac pentru mobilă, l", "211", 10, 1500],
    [day(0, 6), "sale", "Hârtie A4, top", "217", 60],
  ];
  return {
    method: "fifo",
    decisions: {},
    base: "materials",
    movements: rows.map(([date, type, item, account, q, lei], seq) => ({
      id: `demo-${seq}`,
      seq,
      date,
      type,
      item,
      quantity: q * 1000,
      cost: lei === undefined ? undefined : lei * 100,
      account,
    })),
    productions: [
      {
        id: "demo-p1",
        seq: 100,
        date: day(0, 8),
        product: "Masă de birou",
        quantity: 4000,
        materials: [
          { item: "Lemn de stejar, m²", account: "211", quantity: 8000 },
          { item: "Lac pentru mobilă, l", account: "211", quantity: 2000 },
        ],
      },
      {
        id: "demo-p2",
        seq: 101,
        date: day(0, 9),
        product: "Raft de perete",
        quantity: 10000,
        materials: [
          { item: "Lemn de stejar, m²", account: "211", quantity: 5000 },
          { item: "Lac pentru mobilă, l", account: "211", quantity: 1000 },
        ],
      },
    ],
    overheads: {
      [day(0, 1).slice(0, 7)]: [
        { id: "demo-o1", label: "Energie electrică secție", amount: 120000 },
        { id: "demo-o2", label: "Salarii muncitori", amount: 600000 },
      ],
    },
  };
}
