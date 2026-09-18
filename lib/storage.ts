import type { ComplianceState } from "./compliance";
import type { Invoice, Pending } from "./domain";
export type Snapshot = {
  invoices: Invoice[];
  pending: Pending[];
  compliance?: ComplianceState;
  ledger?: {
    id: string;
    invoiceId: string;
    debit: string;
    credit: string;
    amount: number;
    effectiveDate?: string;
    ruleId?: string;
    ruleVersion?: number;
    state?: "proposed" | "posted";
  }[];
};
export const desktop = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("socot-minimal", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readValue<T>(scope: string): Promise<T | null> {
  if (desktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const s = await invoke<string | null>("local_read", { scope });
    return s ? JSON.parse(s) : null;
  }
  scope = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"}|${scope}`;
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("state", "readonly");
    const r = t.objectStore("state").get(scope);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => d.close();
  });
}
export async function writeValue(scope: string, state: unknown) {
  if (desktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("local_write", { scope, payload: JSON.stringify(state) });
    return;
  }
  scope = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"}|${scope}`;
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("state", "readwrite", { durability: "strict" });
    t.objectStore("state").put(state, scope);
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const read = (scope: string) => readValue<Snapshot>(scope);
export const write = (scope: string, state: Snapshot) =>
  writeValue(scope, state);
