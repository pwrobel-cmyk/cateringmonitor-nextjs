import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import {
  classifyDiet, isTestPackage, toKcalBucket,
  DIET_TYPES, KCAL_BUCKETS, type KcalBucket, type DietType,
} from "@/lib/dietClassification";

export interface GapCellBrand {
  brandName: string;
  brandLogo: string | null;
  packageName: string;
  price: number;
}

export interface GapCell {
  brandCount: number;
  brands: GapCellBrand[];
  minPrice: number | null;
  maxPrice: number | null;
}

export type GapMatrix = Record<string, Record<number, GapCell>>;

export function useMarketGaps() {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["market-gaps", selectedCountry],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_active_package_prices");

      if (error) throw error;
      if (!data || data.length === 0)
        return { matrix: {} as GapMatrix, unclassifiedCount: 0, unclassifiedNames: [] as string[] };

      const unclassifiedNames = new Set<string>();

      // Build matrix: dietType × kcalBucket
      const matrix: GapMatrix = {};
      for (const dt of DIET_TYPES) {
        matrix[dt] = {};
        for (const kb of KCAL_BUCKETS) {
          matrix[dt][kb] = { brandCount: 0, brands: [], minPrice: null, maxPrice: null };
        }
      }

      // Dedupe key: package_id + bucket
      const seen = new Set<string>();

      for (const row of data as any[]) {
        // Country filter
        if (selectedCountry === "Czechy" && row.country !== "Czechy") continue;
        if (selectedCountry !== "Czechy" && row.country === "Czechy") continue;
        if (isTestPackage(row.package_name)) continue;

        const bucket = toKcalBucket(row.kcal_from, row.kcal_to);
        const dedupeKey = `${row.package_id}|${bucket}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const dietTags = classifyDiet(row.package_name);
        if (dietTags.length === 1 && dietTags[0] === "Inne") unclassifiedNames.add(row.package_name);

        const price = Number(row.price);

        for (const tag of dietTags) {
          const cell = matrix[tag]?.[bucket];
          if (!cell) continue;

          if (!cell.brands.some(b => b.brandName === row.brand_name && b.packageName === row.package_name)) {
            cell.brands.push({
              brandName: row.brand_name,
              brandLogo: row.brand_logo ?? null,
              packageName: row.package_name,
              price,
            });
          }

          if (cell.minPrice === null || price < cell.minPrice) cell.minPrice = price;
          if (cell.maxPrice === null || price > cell.maxPrice) cell.maxPrice = price;
        }
      }

      // Set brandCount = unique brand names per cell
      for (const dt of DIET_TYPES) {
        for (const kb of KCAL_BUCKETS) {
          const cell = matrix[dt][kb];
          const uniqueBrands = new Set(cell.brands.map(b => b.brandName));
          cell.brandCount = uniqueBrands.size;
          cell.brands.sort((a, b) => a.price - b.price);
        }
      }

      return {
        matrix,
        unclassifiedCount: unclassifiedNames.size,
        unclassifiedNames: Array.from(unclassifiedNames).sort(),
      };
    },
  });
}
