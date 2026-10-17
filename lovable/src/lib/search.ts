import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { accounts } from "./accounts";
import { can } from "./permissions";
import { money } from "./money";

export type SearchGroup = "Documente" | "Parteneri" | "Contabilitate";
export type SearchType = "sale" | "expense" | "receipt" | "payment" | "partner" | "contract" | "entry" | "account";
export const searchTypes: Record<SearchType, string> = {
  sale: "Facturi / venituri", expense: "Cheltuieli", receipt: "Încasări", payment: "Plăți",
  partner: "Parteneri", contract: "Contracte", entry: "Articole contabile", account: "Conturi contabile",
};
export type SearchResult = {
  id: string; group: SearchGroup; type: SearchType; title: string; detail: string; text: string;
  amount?: number; kind?: string;
};
export type SearchDocument = Pick<Tables<"documents">, "id" | "kind" | "number" | "partner_name" | "description" | "category" | "date" | "total" | "status">;
export type SearchPayment = Pick<Tables<"payments">, "id" | "date" | "amount"> & { documents: { number: string; partner_name: string; kind: string } | null };
export type SearchEntry = Pick<Tables<"journal_entries">, "id" | "date" | "amount" | "debit" | "credit" | "operation" | "state"> & { documents: { number: string; partner_name: string } | null };
export type SearchCatalog = Pick<Tables<"catalog_entries">, "id" | "kind" | "code" | "name" | "details">;
export type SearchData = { documents: SearchDocument[]; catalog: SearchCatalog[]; payments: SearchPayment[]; journal: SearchEntry[] };

export function normalizeSearch(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro");
}

export function buildSearchResults(data: SearchData, role: string): SearchResult[] {
  const results: SearchResult[] = [];
  if (can(role, "read")) {
    for (const d of data.documents) {
      if (d.kind !== "sale" && d.kind !== "expense") continue;
      const detail = `${searchTypes[d.kind]} · ${d.date} · ${money(d.total, "code")} · ${d.status === "draft" ? "Ciornă" : "Confirmat"}${d.description ? ` · ${d.description}` : ""}${d.category ? ` · ${d.category}` : ""}`;
      results.push({ id: d.id, type: d.kind, kind: d.kind, group: "Documente", title: `${d.number} · ${d.partner_name}`, detail, text: `${d.number} ${d.partner_name} ${d.description} ${d.category} ${detail}`, amount: d.total });
    }
    for (const p of data.payments) {
      const type = p.documents?.kind === "sale" ? "receipt" : "payment";
      const title = `${searchTypes[type]} · ${p.documents?.number ?? ""} · ${p.documents?.partner_name ?? ""}`;
      const detail = `${p.date} · ${money(p.amount, "code")}`;
      results.push({ id: p.id, type, group: "Documente", title, detail, text: `${title} ${detail}`, amount: p.amount });
    }
  }
  // Catalog SELECT is allowed to every company member, independently of editing permissions.
  if (["admin", "director", "chief_accountant", "accountant", "cashier", "warehouse", "operator", "auditor"].includes(role)) {
    for (const c of data.catalog) {
      if (c.kind !== "partner" && c.kind !== "contract") continue;
      const detail = `${searchTypes[c.kind]} · ${c.code} · ${Object.values(c.details ?? {}).map(String).join(" · ")}`;
      results.push({ id: c.id, type: c.kind, kind: c.kind, group: "Parteneri", title: c.name, detail, text: `${c.name} ${detail}` });
    }
  }
  if (can(role, "journal.read")) {
    for (const e of data.journal) {
      const title = `${e.documents?.number ?? "Articol contabil"} · ${e.documents?.partner_name ?? ""}`;
      const detail = `${e.date} · Dt ${e.debit} / Ct ${e.credit} · ${money(e.amount, "code")} · ${e.state === "posted" ? "Postat" : "Propus"}`;
      results.push({ id: e.id, type: "entry", group: "Contabilitate", title, detail, text: `${title} ${detail} ${e.operation} ${accounts[e.debit] ?? ""} ${accounts[e.credit] ?? ""}`, amount: e.amount });
    }
    const codes = new Set([...Object.keys(accounts), ...data.journal.flatMap((e) => [e.debit, e.credit])]);
    for (const code of codes) {
      const title = `${code} · ${accounts[code] ?? "Cont contabil"}`;
      results.push({ id: code, type: "account", group: "Contabilitate", title, detail: "Cont contabil", text: title });
    }
  }
  return results;
}

export function filterSearchResults(results: SearchResult[], query: string, group: SearchGroup | "all" = "all", type: SearchType | "all" = "all") {
  const terms = normalizeSearch(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const compact = query.replace(/\s/g, "").replace(",", ".");
  return results.filter((r) => {
    if (group !== "all" && r.group !== group || type !== "all" && r.type !== type) return false;
    const text = normalizeSearch(r.text);
    const amountMatch = r.amount !== undefined && /^\d+(\.\d{1,2})?$/.test(compact) && r.amount === Math.round(Number(compact) * 100);
    return amountMatch || terms.every((term) => text.includes(term));
  });
}

// Pagination avoids the Data API's default row cap. Every page is still company-scoped and RLS-protected.
async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < 500) return all;
  }
}

export const universalSearchQuery = (companyId: string, role: string) => queryOptions({
  queryKey: ["universal-search", companyId, role],
  queryFn: async () => {
    const read = can(role, "read");
    const [documents, catalog, payments, journal] = await Promise.all([
      read ? pages<SearchDocument>((from, to) => supabase.from("documents").select("id, kind, number, partner_name, description, category, date, total, status").eq("company_id", companyId).order("id").range(from, to)) : [],
      pages<SearchCatalog>((from, to) => supabase.from("catalog_entries").select("id, kind, code, name, details").eq("company_id", companyId).in("kind", ["partner", "contract"]).order("id").range(from, to)),
      read ? pages<SearchPayment>((from, to) => supabase.from("payments").select("id, date, amount, documents(number, partner_name, kind)").eq("company_id", companyId).order("id").range(from, to)) : [],
      can(role, "journal.read") ? pages<SearchEntry>((from, to) => supabase.from("journal_entries").select("id, date, amount, debit, credit, operation, state, documents(number, partner_name)").eq("company_id", companyId).order("id").range(from, to)) : [],
    ]);
    return buildSearchResults({ documents, catalog, payments, journal }, role);
  },
  staleTime: 0,
});

export const recordSearch = (search: Record<string, unknown>): { record?: string; account?: string } => ({
  ...(typeof search["record"] === "string" ? { record: search["record"] } : {}),
  ...(typeof search["account"] === "string" ? { account: search["account"] } : {}),
});