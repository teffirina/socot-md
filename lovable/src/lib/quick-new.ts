import { can } from "./permissions";
import type { Doc, DocKind } from "./documents";

export const quickOperations = [
  { id: "sale", label: "Factură de vânzare", group: "Vânzări și cumpărări", kind: "sale" },
  { id: "purchase", label: "Factură de cumpărare", group: "Vânzări și cumpărări", kind: "expense" },
  { id: "expense", label: "Cheltuială nouă", group: "Vânzări și cumpărări", kind: "expense" },
  { id: "receipt", label: "Încasare", group: "Bancă și casă", kind: "sale" },
  { id: "payment", label: "Plată", group: "Bancă și casă", kind: "expense" },
] as const;
export type QuickOperation = typeof quickOperations[number];
export const availableQuickOperations = (role: string) => can(role, "write") ? quickOperations : [];
export const payableDocuments = (docs: Doc[], companyId: string, kind: DocKind) =>
  docs.filter(doc => doc.company_id === companyId && doc.kind === kind && doc.status === "confirmed" && doc.paid < doc.total);