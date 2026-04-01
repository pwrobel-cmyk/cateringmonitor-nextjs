'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export interface DashboardStats {
  biggestChange: {
    brand_name: string;
    package_name: string;
    new_price: number;
    change_percentage: number;
  } | null;
  averagePrice: number;
  priceChange: number;
  activeBrands: number;
  activePackages: number;
  activeDiscounts: number;
}

export function useDashboardStats() {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["dashboard-stats", selectedCountry],
    queryFn: async () => {
      const now = new Date().toISOString();

      const [priceChanges, brandsResult, packagesCount, activeDiscounts] =
        await Promise.all([
          (supabase as any).rpc("get_price_changes"),
          (supabase as any)
            .from("brands")
            .select("id", { count: "exact" })
            .eq("is_active", true)
            .eq("country", selectedCountry),
          (supabase as any)
            .from("packages")
            .select("id, brand_id, brands!inner(country, is_active)", {
              count: "exact",
              head: true,
            })
            .eq("is_active", true)
            .eq("brands.country", selectedCountry)
            .eq("brands.is_active", true),
          Promise.resolve(null), // placeholder, replaced below
        ]);

      const assignedBrandIds: string[] = (brandsResult.data || []).map((b: any) => b.id);
      const brandsCount = { count: brandsResult.count };

      const { data: discountsData } = assignedBrandIds.length > 0
        ? await (supabase as any)
            .from('discounts')
            .select('id')
            .in('brand_id', assignedBrandIds)
            .eq('is_active', true)
            .lte('valid_from', now)
            .or(`valid_until.gte.${now},valid_until.is.null`)
        : { data: [] };

      const activeDiscountsCount = discountsData?.length || 0;

      const today = new Date();
      const last7Days = new Date(today);
      last7Days.setDate(today.getDate() - 7);
      const last14Days = new Date(today);
      last14Days.setDate(today.getDate() - 14);
      const last8Days = new Date(today);
      last8Days.setDate(today.getDate() - 8);

      const countryFilter = selectedCountry === "Czechy" ? "Czechy" : "Polska";

      const [recentData, previousData] = await Promise.all([
        (supabase as any).rpc('get_average_price_by_country_range', {
          p_country: countryFilter,
          p_start_date: last7Days.toISOString().split('T')[0],
          p_end_date: today.toISOString().split('T')[0],
        }),
        (supabase as any).rpc('get_average_price_by_country_range', {
          p_country: countryFilter,
          p_start_date: last14Days.toISOString().split('T')[0],
          p_end_date: last8Days.toISOString().split('T')[0],
        }),
      ]);

      const recentAvg = recentData.data?.[0]?.average_price ? Number(recentData.data[0].average_price) : 0;
      const previousAvg = previousData.data?.[0]?.average_price ? Number(previousData.data[0].average_price) : 0;
      const priceChange = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

      const changes = (priceChanges.data || []).filter(
        (r: any) => r.country === selectedCountry
      );

      const biggest =
        changes.length > 0
          ? changes.reduce((max: any, r: any) =>
              r.change_percent > max.change_percent ? r : max
            )
          : null;

      const prices = changes.map((r: any) => r.new_price).filter((p: number) => p > 0);
      const averagePrice =
        prices.length > 0
          ? prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length
          : 0;

      return {
        biggestChange: biggest
          ? {
              brand_name: biggest.brand_name,
              package_name: biggest.package_name,
              new_price: biggest.new_price,
              change_percentage: biggest.change_percent,
            }
          : null,
        averagePrice: recentAvg || averagePrice,
        priceChange,
        activeBrands: brandsCount.count ?? 0,
        activePackages: packagesCount.count ?? 0,
        activeDiscounts: activeDiscountsCount,
      } as DashboardStats;
    },
  });
}
