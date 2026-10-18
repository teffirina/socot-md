import type { CatalogEntry } from "./catalog";

// Straight-line depreciation of fixed assets, proposed month by month.
// Each month's proposal is "what should be depreciated by the end of this
// month" minus "what the user already accepted", so a change of cost, residual
// value or useful life, or a rejected month, is caught up automatically.

export type Decision = {
  amount: number;
  decision: "accepted" | "rejected";
  debit: string;
  credit: string;
  at: string;
};
/** month (YYYY-MM) → asset id → decision */
export type DepreciationRegister = Record<string, Record<string, Decision>>;

export type AssetPlan = {
  id: string;
  code: string;
  name: string;
  start: string; // first month depreciated, YYYY-MM
  base: number; // bani: cost minus residual value
  cost: number;
  lifeMonths: number;
  /** accumulated before Socot, e.g. in 1C */
  opening: number;
  debit: string;
  credit: string;
};

export type Proposal = {
  asset: AssetPlan;
  month: string;
  /** what the plan alone gives for this month */
  regular: number;
  /** what is proposed now, including catch-up or correction */
  amount: number;
  /** accepted in earlier months */
  booked: number;
  /** remaining to depreciate after this proposal */
  remaining: number;
  note: string;
  decision?: Decision;
};

export const defaultDebit = "713";
export const defaultCredit = "124";

const lei = (v: string | undefined) =>
  v && /^\d+(\.\d{1,6})?$/.test(v) ? Math.round(Number(v) * 100) : NaN;

export function nextMonth(month: string, add = 1) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + add, 1)).toISOString().slice(0, 7);
}

export const monthsBetween = (from: string, to: string) => {
  const [a, b] = [from, to].map((s) => s.split("-").map(Number));
  return (b[0] - a[0]) * 12 + (b[1] - a[1]);
};

/** Reads the asset card; returns the reason when it can't be depreciated. */
export function assetPlan(asset: CatalogEntry): AssetPlan | string {
  const d = asset.details;
  const cost = lei(d.cost);
  const residual = d.residual ? lei(d.residual) : 0;
  const life = Number(d.lifeMonths);
  const opening = d.openingDepreciation ? lei(d.openingDepreciation) : 0;
  if (!d.inServiceDate) return "Lipsește data punerii în funcțiune.";
  if (!(cost > 0)) return "Lipsește valoarea de intrare.";
  if (!Number.isInteger(life) || life < 1 || life > 1200)
    return "Lipsește durata de utilizare în luni.";
  if (!(residual >= 0) || residual >= cost)
    return "Valoarea reziduală trebuie să fie mai mică decât valoarea de intrare.";
  if (!(opening >= 0) || opening > cost - residual)
    return "Uzura acumulată la preluare depășește valoarea amortizabilă.";
  return {
    id: asset.id,
    code: asset.code,
    name: asset.name,
    // Depreciation starts in the month after the asset is put into service.
    start: nextMonth(d.inServiceDate.slice(0, 7)),
    base: cost - residual,
    cost,
    lifeMonths: life,
    opening,
    debit: d.expenseAccount?.trim() || defaultDebit,
    credit: d.depreciationAccount?.trim() || defaultCredit,
  };
}

/** Accumulated depreciation the plan expects by the end of `month`. */
export function expectedBy(plan: AssetPlan, month: string) {
  const k = Math.min(plan.lifeMonths, monthsBetween(plan.start, month) + 1);
  if (k <= 0) return 0;
  return Math.round((plan.base * k) / plan.lifeMonths);
}

export function bookedBefore(
  register: DepreciationRegister,
  assetId: string,
  month: string,
) {
  let sum = 0;
  for (const [m, rows] of Object.entries(register))
    if (m < month && rows[assetId]?.decision === "accepted")
      sum += rows[assetId].amount;
  return sum;
}

export function proposals(
  assets: CatalogEntry[],
  register: DepreciationRegister,
  month: string,
) {
  const ready: Proposal[] = [];
  const incomplete: { asset: CatalogEntry; reason: string }[] = [];
  for (const asset of assets) {
    if (asset.kind !== "asset" || !asset.active) continue;
    const plan = assetPlan(asset);
    if (typeof plan === "string") {
      incomplete.push({ asset, reason: plan });
      continue;
    }
    if (month < plan.start) continue;
    const booked = plan.opening + bookedBefore(register, plan.id, month);
    const regular =
      expectedBy(plan, month) - expectedBy(plan, nextMonth(month, -1));
    const amount = expectedBy(plan, month) - booked;
    const decision = register[month]?.[plan.id];
    if (!amount && !decision && booked >= plan.base) continue;
    const note =
      amount === regular
        ? ""
        : amount < 0
          ? "Corecție: s-a amortizat mai mult decât prevede planul actual."
          : regular === 0
            ? "Recuperare: amortizare rămasă din lunile anterioare."
            : amount > regular
              ? booked === 0 && !Object.values(register).some((r) => r[plan.id])
                ? "Include lunile anterioare. Dacă uzura a fost calculată deja în 1C, completează în fișă „Uzura acumulată la preluare”."
                : "Include lunile respinse sau nerecalculate anterior."
              : "Ajustat după modificarea fișei.";
    ready.push({
      asset: plan,
      month,
      regular,
      amount: decision ? decision.amount : amount,
      booked,
      remaining: plan.base - booked - (decision ? decision.amount : amount),
      note,
      decision,
    });
  }
  return { ready, incomplete };
}

export function decide(
  register: DepreciationRegister,
  proposal: Proposal,
  decision: Decision["decision"] | null,
  at = new Date().toISOString(),
): DepreciationRegister {
  const month = { ...(register[proposal.month] ?? {}) };
  if (decision)
    month[proposal.asset.id] = {
      amount: proposal.amount,
      decision,
      debit: proposal.asset.debit,
      credit: proposal.asset.credit,
      at,
    };
  else delete month[proposal.asset.id];
  // Later months were proposed from the old figures, so they are reviewed again.
  const next: DepreciationRegister = { [proposal.month]: month };
  for (const [m, rows] of Object.entries(register))
    if (m < proposal.month) next[m] = rows;
    else if (m > proposal.month) {
      const { [proposal.asset.id]: _dropped, ...rest } = rows;
      next[m] = rest;
    }
  return next;
}
