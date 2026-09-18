export const roles = [
  "admin",
  "director",
  "chief_accountant",
  "accountant",
  "cashier",
  "warehouse",
  "operator",
  "auditor",
] as const;
export type Role = (typeof roles)[number];
export type Permission =
  | "invoice.read"
  | "invoice.write"
  | "company.manage"
  | "journal.read"
  | "journal.post"
  | "rule.create"
  | "rule.approve"
  | "period.close"
  | "period.reopen"
  | "report.generate"
  | "accounts.manage";
const grants: Record<Role, Permission[]> = {
  admin: [
    "invoice.read",
    "invoice.write",
    "company.manage",
    "journal.read",
    "journal.post",
    "rule.create",
    "rule.approve",
    "period.close",
    "period.reopen",
    "report.generate",
    "accounts.manage",
  ],
  director: ["invoice.read"],
  chief_accountant: [
    "invoice.read",
    "invoice.write",
    "journal.read",
    "journal.post",
    "rule.create",
    "rule.approve",
    "period.close",
    "period.reopen",
    "report.generate",
    "accounts.manage",
  ],
  accountant: [
    "invoice.read",
    "invoice.write",
    "journal.read",
    "journal.post",
    "rule.create",
    "period.close",
    "report.generate",
  ],
  cashier: [],
  warehouse: [],
  operator: ["invoice.read", "invoice.write"],
  auditor: ["invoice.read", "journal.read"],
};
export const can = (role: string | undefined, permission: Permission) =>
  !!role && !!grants[role as Role]?.includes(permission);
export const roleNames: Record<Role, string> = {
  admin: "Administrator",
  director: "Director",
  chief_accountant: "Contabil-șef",
  accountant: "Contabil",
  cashier: "Casier",
  warehouse: "Gestionar",
  operator: "Operator",
  auditor: "Auditor",
};
