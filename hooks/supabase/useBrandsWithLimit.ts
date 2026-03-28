'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { useUserBrands } from "@/hooks/useUserBrands";

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  country: string;
  is_active: boolean;
}

export function useBrandsWithLimit() {
  const { selectedCountry } = useCountry();
  const { assignedBrandIds } = useUserBrands();

  return useQuery({
    queryKey: ["brands-with-limit", selectedCountry, assignedBrandIds],
    queryFn: async () => {
      let query = (supabase as any)
        .from("brands")
        .select("id, name, logo_url, website_url, country, is_active")
        .eq("is_active", true)
        .eq("country", selectedCountry)
        .order("name");

      if (assignedBrandIds.length > 0) {
        query = query.in("id", assignedBrandIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Brand[];
    },
  });
}
