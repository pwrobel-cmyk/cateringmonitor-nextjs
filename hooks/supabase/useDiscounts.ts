import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { useUserBrands } from "../useUserBrands";

export interface Discount {
  id: string;
  brand_id: string;
  percentage: number | null;
  fixed_amount: number | null;
  code: string | null;
  code_source: string[] | null;
  description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  requirements: string | null;
  exclusions_limits: string | null;
  additional_notes: string | null;
  communication_channels: string | null;
  min_days: number | null;
  is_active: boolean;
  created_at: string;
  brands: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export const useDiscounts = () => {
  const { selectedCountry } = useCountry();
  const { assignedBrandIds } = useUserBrands();

  return useQuery({
    queryKey: ["discounts", selectedCountry, assignedBrandIds],
    queryFn: async () => {
      if (assignedBrandIds.length === 0) return [];

      let query: any = supabase
        .from("discounts")
        .select(`
          *,
          brands!inner (
            id,
            name,
            logo_url,
            country
          )
        `)
        .eq("is_active", true)
        .in("brand_id", assignedBrandIds);

      if (selectedCountry === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      const { data, error } = await query.order("valid_from", { ascending: false });

      if (error) throw error;
      return data as Discount[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useDiscountStats = () => {
  const { selectedCountry } = useCountry();
  const { assignedBrandIds } = useUserBrands();

  return useQuery({
    queryKey: ["discount-stats", selectedCountry, assignedBrandIds],
    queryFn: async () => {
      if (assignedBrandIds.length === 0) {
        return { activeCount: 0, avgPercentage: 0, expiringSoon: 0 };
      }

      let query: any = supabase
        .from("discounts")
        .select(`
          percentage,
          fixed_amount,
          brand_id,
          valid_until,
          brands!inner (
            country
          )
        `)
        .eq("is_active", true)
        .in("brand_id", assignedBrandIds);

      if (selectedCountry === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      const { data, error } = await query;

      if (error) throw error;

      const activeCount = data?.length || 0;
      const avgPercentage = data
        ?.filter((d: any) => d.percentage)
        .reduce((sum: number, d: any) => sum + (d.percentage || 0), 0) / (data?.filter((d: any) => d.percentage).length || 1);

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const expiringSoon = data?.filter((d: any) => {
        if (!d.valid_until) return false;
        const validUntil = new Date(d.valid_until);
        return validUntil <= sevenDaysFromNow && validUntil >= new Date();
      }).length || 0;

      return {
        activeCount,
        avgPercentage: Math.round(avgPercentage * 10) / 10 || 0,
        expiringSoon,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};
