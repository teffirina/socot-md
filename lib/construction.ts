// Objects under construction: costs gather on the object month by month.
// An own investment (121) is put into service as a fixed asset (123); a
// contract for a client recognises revenue by stage of completion. Every
// figure is recomputed from the cost list, so a late or corrected cost
// changes the proposals automatically.

export type ConstructionObject = {
  id: string;
  name: string;
  kind: "own" | "contract";
  /** estimated total cost, bani */
  budget: number;
  /** contract price without VAT, bani (contracts only) */
  price?: number;
  /** debit account for costs: 121 for own investments, 811 for contracts */
  account: string;
  /** receivable account for contract revenue */
  receivable?: string;
  /** set when an own investment is put into service */
  commissioned?: { date: string; assetId?: string };
};

export type ConstructionCost = {
  id: string;
  objectId: string;
  date: string;
  label: string;
  amount: number;
  /** account credited: 211 materials, 521 suppliers, 531 wages… */
  credit: string;
};

export type Decision = {
  amount: number;
  decision: "accepted" | "rejected";
  at: string;
};

export type ConstructionRegister = {
  objects: ConstructionObject[];
  costs: ConstructionCost[];
  /** month → entry key → decision */
  decisions: Record<string, Record<string, Decision>>;
};

export const ownAccount = "121";
export const assetAccount = "123";
export const contractAccount = "811";
export const revenueAccount = "611";
export const defaultReceivable = "221";

const monthEnd = (month: string) => `${month}-31`;

export function costTo(
  register: ConstructionRegister,
  objectId: string,
  month: string,
) {
  return register.costs
    .filter((c) => c.objectId === objectId && c.date <= monthEnd(month))
    .reduce((a, c) => a + c.amount, 0);
}

/** Stage of completion in basis points (10000 = 100%). */
export function completion(o: ConstructionObject, cost: number) {
  if (o.budget <= 0) return 0;
  return Math.min(10000, Math.round((cost * 10000) / o.budget));
}

export function revenueTo(
  o: ConstructionObject,
  register: ConstructionRegister,
  month: string,
) {
  if (o.kind !== "contract" || !o.price) return 0;
  const cost = costTo(register, o.id, month);
  return Math.round((o.price * Math.min(cost, o.budget)) / o.budget);
}

export type Entry = {
  key: string;
  month: string;
  objectId: string;
  debit: string;
  credit: string;
  amount: number;
  label: string;
};

/** Entries the current data gives for one month. */
export function monthEntries(
  register: ConstructionRegister,
  month: string,
): Entry[] {
  const out: Entry[] = [];
  const sums = new Map<string, Entry>();
  for (const c of register.costs) {
    if (!c.date.startsWith(month)) continue;
    const o = register.objects.find((x) => x.id === c.objectId);
    if (!o) continue;
    const key = `cost|${o.id}|${o.account}|${c.credit}`;
    const e = sums.get(key) ?? {
      key,
      month,
      objectId: o.id,
      debit: o.account,
      credit: c.credit,
      amount: 0,
      label: `Costuri acumulate pe ${o.name}`,
    };
    e.amount += c.amount;
    sums.set(key, e);
  }
  out.push(...sums.values());
  for (const o of register.objects) {
    if (o.kind === "contract") {
      const before = revenueTo(o, register, previousMonth(month));
      const now = revenueTo(o, register, month);
      if (now !== before)
        out.push({
          key: `revenue|${o.id}`,
          month,
          objectId: o.id,
          debit: o.receivable || defaultReceivable,
          credit: revenueAccount,
          amount: now - before,
          label: `Venit după stadiul de execuție, ${o.name}`,
        });
    }
    if (o.kind === "own" && o.commissioned?.date.startsWith(month))
      out.push({
        key: `commission|${o.id}`,
        month,
        objectId: o.id,
        debit: assetAccount,
        credit: o.account,
        amount: costTo(register, o.id, month),
        label: `Dare în exploatare, ${o.name}`,
      });
  }
  return out;
}

export function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

export type EntryStatus = Entry & { decision?: Decision; difference: number };

/** Months with entries or decisions, newest first, with recalculated differences. */
export function review(register: ConstructionRegister) {
  const months = new Set([
    ...register.costs.map((c) => c.date.slice(0, 7)),
    ...register.objects.flatMap((o) =>
      o.commissioned ? [o.commissioned.date.slice(0, 7)] : [],
    ),
    ...Object.keys(register.decisions),
  ]);
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const current = monthEntries(register, month);
      const decided = register.decisions[month] ?? {};
      const rows: EntryStatus[] = current.map((e) => {
        const decision = decided[e.key];
        return {
          ...e,
          decision,
          difference:
            decision?.decision === "accepted" ? e.amount - decision.amount : 0,
        };
      });
      // An accepted entry whose source vanished must be reversed.
      for (const [key, decision] of Object.entries(decided))
        if (
          !current.some((e) => e.key === key) &&
          decision.decision === "accepted"
        )
          rows.push({
            key,
            month,
            objectId: key.split("|")[1],
            debit: key.split("|")[2] ?? "",
            credit: key.split("|")[3] ?? "",
            amount: 0,
            label: "Articol acceptat care nu mai are acoperire",
            decision,
            difference: -decision.amount,
          });
      return { month, rows };
    });
}

export function decide(
  register: ConstructionRegister,
  row: Pick<EntryStatus, "month" | "key" | "amount">,
  decision: Decision["decision"] | null,
  at = new Date().toISOString(),
): ConstructionRegister {
  const month = { ...(register.decisions[row.month] ?? {}) };
  if (decision) month[row.key] = { amount: row.amount, decision, at };
  else delete month[row.key];
  return {
    ...register,
    decisions: { ...register.decisions, [row.month]: month },
  };
}

/** "1 234,56" lei into bani. */
export function parseLei(text: string) {
  const s = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s))
    throw Error("Sumă invalidă (cel mult 2 zecimale).");
  return Math.round(Number(s) * 100);
}
