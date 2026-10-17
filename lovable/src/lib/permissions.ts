// Mirrors public.has_perm() in the database; the database is the source of truth.
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
export type Permission = "read" | "write" | "company" | "journal.read" | "journal.post" | "catalog";

const grants: Record<Role, Permission[]> = {
  admin: ["read", "write", "company", "journal.read", "journal.post", "catalog"],
  director: ["read"],
  chief_accountant: ["read", "write", "journal.read", "journal.post", "catalog"],
  accountant: ["read", "write", "journal.read", "journal.post", "catalog"],
  cashier: [],
  warehouse: [],
  operator: ["read", "write", "catalog"],
  auditor: ["read", "journal.read"],
};

export const can = (role: string | null | undefined, permission: Permission) =>
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
