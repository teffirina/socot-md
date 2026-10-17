import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Doc = Tables<"documents">;
export type DocKind = "sale" | "expense";

export const kindNames: Record<DocKind, { plural: string; single: string; partner: string; pay: string }> = {
  sale: { plural: "Documente de vânzare", single: "Vânzare", partner: "Client", pay: "Înregistrează încasarea" },
  expense: { plural: "Documente de cumpărare", single: "Cumpărare", partner: "Furnizor", pay: "Înregistrează plata" },
};

export const documentsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["documents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const journalQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["journal", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, documents(number, partner_name)")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const paymentsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["payments", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, documents(number, partner_name, kind)")
        .eq("company_id", companyId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const catalogQuery = (companyId: string, kind: string) =>
  queryOptions({
    queryKey: ["catalog", companyId, kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_entries")
        .select("*")
        .eq("company_id", companyId)
        .eq("kind", kind)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

export type DocumentPeriod = { from?: string; to?: string };

export const profitTone = (profit: number): "positive" | "negative" | "default" =>
  profit > 0 ? "positive" : profit < 0 ? "negative" : "default";

export function summarize(docs: Doc[], period: DocumentPeriod = {}) {
  const confirmed = docs.filter((d) => d.status === "confirmed" && (!period.from || d.date >= period.from) && (!period.to || d.date <= period.to));
  const sum = (k: DocKind, f: (d: Doc) => number) => confirmed.filter((d) => d.kind === k).reduce((a, d) => a + f(d), 0);
  const sales = sum("sale", (d) => d.total);
  const expenses = sum("expense", (d) => d.total);
  return {
    sales,
    grossProfit: sales - expenses,
    receivable: sum("sale", (d) => d.total - d.paid),
    expenses,
    payable: sum("expense", (d) => d.total - d.paid),
    drafts: docs.filter((d) => d.status === "draft").length,
  };
}

export const operationNames: Record<string, string> = {
  sale: "Vânzare",
  receipt: "Încasare",
  expense: "Cheltuială",
  payment: "Plată",
};
