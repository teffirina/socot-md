import { z } from "zod";
export const allocationSchema = z
  .array(
    z
      .object({
        debit: z.string().regex(/^\d{3,8}(?:\.\d{1,4}){0,3}$/),
        credit: z.string().regex(/^\d{3,8}(?:\.\d{1,4}){0,3}$/),
        weight: z.number().int().positive().max(10000),
      })
      .strict()
      .refine((x) => x.debit !== x.credit, "Debit și credit identice"),
  )
  .min(2)
  .max(20)
  .refine(
    (rows) => rows.reduce((sum, row) => sum + row.weight, 0) === 10000,
    "Repartizarea trebuie să totalizeze 100%.",
  );
export type Allocation = z.infer<typeof allocationSchema>;
// Largest remainder allocation; integer bani, deterministic tie break by line order.
export function allocatePosting(amount: number, allocation: Allocation) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000)
    throw Error("Sumă contabilă invalidă.");
  const rows = allocationSchema
    .parse(allocation)
    .map((row, index) => ({
      ...row,
      index,
      amount: Math.floor((amount * row.weight) / 10000),
      remainder: (amount * row.weight) % 10000,
    }));
  let remainder = amount - rows.reduce((sum, row) => sum + row.amount, 0);
  for (const row of [...rows].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )) {
    if (remainder-- <= 0) break;
    row.amount++;
  }
  return rows
    .filter((row) => row.amount > 0)
    .map(({ debit, credit, amount }) => ({ debit, credit, amount }));
}
export function parseAllocation(text: string): Allocation | undefined {
  if (!text.trim()) return undefined;
  return allocationSchema.parse(
    text
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const cells = line.trim().split(/\s*;\s*/);
        if (cells.length !== 3 || !/^\d{1,3}([.,]\d{1,2})?$/.test(cells[2]))
          throw Error("Folosește Debit;Credit;Procent pe fiecare rând.");
        const [whole, fraction = ""] = cells[2].replace(",", ".").split(".");
        return {
          debit: cells[0],
          credit: cells[1],
          weight: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
        };
      }),
  );
}
export function postingGroup<
  T extends {
    id: string;
    operationId?: string;
    invoiceId: string;
    effectiveDate?: string | null;
    state?: string;
    amount: number;
  },
>(entries: T[], id: string): T[] {
  const selected = entries.find((e) => e.id === id);
  if (!selected) throw Error("Articolul nu există.");
  const group = selected.operationId
    ? entries.filter((e) => e.operationId === selected.operationId)
    : [selected];
  if (
    group.some(
      (e) =>
        e.invoiceId !== selected.invoiceId ||
        !e.effectiveDate ||
        e.effectiveDate !== selected.effectiveDate ||
        e.state !== "proposed" ||
        !Number.isSafeInteger(e.amount) ||
        e.amount <= 0,
    )
  )
    throw Error(
      "Grup contabil inconsistent sau deja postat. Verifică toate articolele.",
    );
  return group;
}
