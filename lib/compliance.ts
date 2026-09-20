import { z } from "zod";
import initialRules from "../config/demo-rules.json";
export const ruleSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.enum(["sale", "receipt", "expense", "payment"]),
    version: z.number().int().positive(),
    name: z.string().trim().min(3).max(150),
    debit: z.string().regex(/^\d{3,8}$/),
    credit: z.string().regex(/^\d{3,8}$/),
    validFrom: z.iso.date(),
    validTo: z.iso.date().nullable(),
    status: z.enum(["draft", "approved"]),
    source: z.string().trim().min(10).max(500),
    approvedBy: z.string().nullable(),
    demo: z.boolean(),
  })
  .strict()
  .refine(
    (r) => r.validTo === null || r.validTo >= r.validFrom,
    "Interval de valabilitate invalid",
  )
  .refine(
    (r) => r.debit !== r.credit,
    "Debit și credit trebuie să fie diferite",
  );
export type Rule = z.infer<typeof ruleSchema>;
export const demoRules = initialRules.map((r) => ruleSchema.parse(r));
export type Period = {
  month: string;
  closed: boolean;
  reason: string;
  changedBy: string;
};
export type ComplianceAudit = {
  id: string;
  action: string;
  reason: string;
  at: string;
  actor: string;
  objectId: string;
};
export type Report = {
  id: string;
  status: "generated" | "exported" | "sent" | "accepted" | "rejected";
  createdAt: string;
  sourceIds: string[];
  rows: { id: string; customer: string; total: number; paid: number }[];
  receiptId?: string;
};
export type ComplianceState = {
  rules: Rule[];
  periods: Period[];
  reports: Report[];
  audit: ComplianceAudit[];
};
export const initialCompliance = (): ComplianceState => ({
  rules: structuredClone(demoRules),
  periods: [],
  reports: [],
  audit: [],
});
export function selectRule(
  rules: Rule[],
  kind: Rule["kind"],
  date: string,
  allowDemo = false,
) {
  const matches = rules
    .filter(
      (r) =>
        r.kind === kind &&
        r.status === "approved" &&
        r.validFrom <= date &&
        (!r.demo || allowDemo),
    )
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  if (!matches.length || (matches[0].validTo && matches[0].validTo < date))
    throw new Error("Nu există o regulă aprobată pentru data operațiunii.");
  if (matches.length > 1 && matches[0].validFrom === matches[1].validFrom)
    throw new Error(
      "Reguli suprapuse: este necesară corectarea configurației.",
    );
  return matches[0];
}
export function approveRule(rules: Rule[], id: string, actor: string): Rule[] {
  const rule = rules.find((r) => r.id === id);
  if (!rule || rule.status !== "draft")
    throw new Error("Regula nu este o ciornă.");
  const approved = rules.filter(
    (r) => r.id !== id && r.kind === rule.kind && r.status === "approved",
  );
  if (
    approved.some(
      (r) => r.validFrom >= rule.validFrom || r.version >= rule.version,
    )
  )
    throw new Error(
      "Noua versiune trebuie să înceapă după versiunile deja aprobate și să aibă un număr mai mare.",
    );
  return rules.map((r) =>
    r.id === id ? { ...r, status: "approved", approvedBy: actor } : r,
  );
}
export function assertPeriodOpen(periods: Period[], date: string) {
  if (periods.some((p) => p.month === date.slice(0, 7) && p.closed))
    throw new Error(
      "Perioada contabilă este închisă. Contabilul trebuie să verifice și să autorizeze redeschiderea.",
    );
}
export function reportTransition(
  report: Report,
  next: Report["status"],
  receiptId?: string,
): Report {
  const permitted: Record<Report["status"], Report["status"][]> = {
    generated: ["exported"],
    exported: ["sent"],
    sent: ["accepted", "rejected"],
    accepted: [],
    rejected: [],
  };
  if (!permitted[report.status].includes(next))
    throw new Error("Tranziție de raportare nepermisă.");
  if (["sent", "accepted", "rejected"].includes(next) && !receiptId)
    throw new Error("Este necesară confirmarea oficială a adaptorului.");
  return { ...report, status: next, ...(receiptId ? { receiptId } : {}) };
}
export interface AuthorityAdapter {
  send(report: Report): Promise<{ receiptId: string }>;
  status(receiptId: string): Promise<"sent" | "accepted" | "rejected">;
}
export class UnconfiguredAuthorityAdapter implements AuthorityAdapter {
  async send(_report: Report): Promise<{ receiptId: string }> {
    throw new Error("Integrare neconfigurată — netransmisă.");
  }
  async status(_receiptId: string): Promise<"sent" | "accepted" | "rejected"> {
    throw new Error("Nu există confirmare oficială.");
  }
}
