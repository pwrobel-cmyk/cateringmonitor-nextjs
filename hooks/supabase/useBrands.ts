'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  country: string;
  is_active: boolean;
}

export function useBrands() {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["brands", selectedCountry],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brands")
        .select("id, name, logo_url, website_url, country, is_active")
        .eq("is_active", true)
        .eq("country", selectedCountry)
        .order("name");

      if (error) throw error;
      return (data || []) as Brand[];
    },
  });
}
