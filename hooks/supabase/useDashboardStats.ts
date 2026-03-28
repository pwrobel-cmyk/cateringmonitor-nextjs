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
      const [priceChanges, brandsCount, packagesCount, discountsCount] =
        await Promise.all([
          (supabase as any).rpc("get_price_changes"),
          (supabase as any)
            .from("brands")
            .select("*", { count: "exact", head: true })
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
          (supabase as any)
            .from("discounts")
            .select("id, brand_id, brands!inner(country)", {
              count: "exact",
              head: true,
            })
            .eq("is_active", true)
            .eq("brands.country", selectedCountry),
        ]);

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
        averagePrice,
        priceChange: 0,
        activeBrands: brandsCount.count ?? 0,
        activePackages: packagesCount.count ?? 0,
        activeDiscounts: discountsCount.count ?? 0,
      } as DashboardStats;
    },
  });
}
