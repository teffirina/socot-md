import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Company = Tables<"companies">;
export type Membership = { role: string; company: Company };

export const membershipQuery = queryOptions({
  queryKey: ["membership"],
  queryFn: async (): Promise<Membership> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, companies(*)")
      .limit(1)
      .single();
    if (error) throw error;
    return { role: data.role, company: data.companies as unknown as Company };
  },
});

export const useMembership = () => useSuspenseQuery(membershipQuery).data;
