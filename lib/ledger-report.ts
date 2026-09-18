import { z } from "zod";
export const intervalSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(
    (v) => v.from <= v.to,
    "Data de început trebuie să fie înainte de sfârșit.",
  );
export type Entry = {
  id: string;
  invoiceId: string;
  debit: string;
  credit: string;
  amount: number;
  effectiveDate?: string | null;
  state?: string;
  ruleVersion?: number | null;
};
export function ledgerReport(entries: Entry[], from: string, to: string) {
  intervalSchema.parse({ from, to });
  const accounts = new Map<
    string,
    {
      code: string;
      opening: number;
      debit: number;
      credit: number;
      closing: number;
    }
  >();
  const movements: Entry[] = [];
  let excluded = 0;
  for (const e of entries) {
    if (e.state !== "posted" || !e.effectiveDate) {
      excluded++;
      continue;
    }
    if (e.effectiveDate > to) continue;
    if (!Number.isSafeInteger(e.amount) || e.amount <= 0)
      throw new Error("Articol contabil invalid.");
    for (const [code, sign] of [
      [e.debit, 1],
      [e.credit, -1],
    ] as const) {
      const a = accounts.get(code) ?? {
        code,
        opening: 0,
        debit: 0,
        credit: 0,
        closing: 0,
      };
      if (e.effectiveDate < from) a.opening += sign * e.amount;
      else if (sign === 1) a.debit += e.amount;
      else a.credit += e.amount;
      a.closing = a.opening + a.debit - a.credit;
      if (
        ![a.opening, a.debit, a.credit, a.closing].every(Number.isSafeInteger)
      )
        throw new Error("Limita numerică a raportului a fost depășită.");
      accounts.set(code, a);
    }
    if (e.effectiveDate >= from) movements.push(e);
  }
  return {
    from,
    to,
    excluded,
    accounts: [...accounts.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
    movements: movements.sort(
      (a, b) =>
        a.effectiveDate!.localeCompare(b.effectiveDate!) ||
        a.id.localeCompare(b.id),
    ),
  };
}
export type LedgerReport = ReturnType<typeof ledgerReport>;
export function accountCard(report: LedgerReport, code: string) {
  let balance = report.accounts.find((a) => a.code === code)?.opening ?? 0;
  return report.movements
    .filter((e) => e.debit === code || e.credit === code)
    .map((e) => {
      const debit = e.debit === code ? e.amount : 0;
      const credit = e.credit === code ? e.amount : 0;
      balance += debit - credit;
      return { ...e, debitAmount: debit, creditAmount: credit, balance };
    });
}
