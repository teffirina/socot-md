import type { Company, Account } from "./company";
import type { ComplianceState } from "./compliance";
import type { Invoice, Pending } from "./domain";
export type Snapshot = {
  invoices: Invoice[];
  pending: Pending[];
  compliance?: ComplianceState;
  company?: Company;
  accounts?: Account[];
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
async function migrateBrowserDemo(d: IDBDatabase, target: string) {
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("state", "readwrite", { durability: "strict" });
    const store = tx.objectStore("state");
    const old = store.get("demo-v1");
    old.onsuccess = () => {
      if (!old.result) return;
      const current = store.get(target);
      current.onsuccess = () => {
        const previous = old.result as Snapshot;
        const next = current.result as Snapshot | undefined;
        const unique = <T extends { id: string }>(items: T[]) => [
          ...new Map(items.map((i) => [i.id, i])).values(),
        ];
        store.put(
          {
            ...previous,
            ...next,
            invoices: unique([...previous.invoices, ...(next?.invoices ?? [])]),
            pending: unique([...previous.pending, ...(next?.pending ?? [])]),
            ledger: unique([
              ...(previous.ledger ?? []),
              ...(next?.ledger ?? []),
            ]),
          },
          target,
        );
        store.delete("demo-v1");
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
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
  if (scope.endsWith("|demo-v1")) await migrateBrowserDemo(d, scope);
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
