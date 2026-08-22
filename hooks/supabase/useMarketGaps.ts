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
      // Get recent price_history to determine active packages (seen in last 7 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const { data, error } = await (supabase as any)
        .from("price_history")
        .select(`
          price,
          date_recorded,
          package_kcal_ranges!price_history_package_kcal_range_id_fkey!inner (
            packages!inner (
              id, name,
              brands!inner ( name, logo_url, country )
            ),
            kcal_ranges!inner ( kcal_from, kcal_to, kcal_label )
          )
        `)
        .gte("date_recorded", cutoffStr)
        .order("date_recorded", { ascending: false })
        .limit(100000);

      if (error) throw error;
      if (!data || data.length === 0)
        return { matrix: {} as GapMatrix, unclassifiedCount: 0, unclassifiedNames: [] as string[] };

      // Dedupe: per (package, kcal_bucket) keep latest price per brand
      const seen = new Map<string, { brandName: string; brandLogo: string | null; packageName: string; price: number; dietTags: string[]; bucket: KcalBucket }>();
      const unclassifiedNames = new Set<string>();

      for (const row of data as any[]) {
        const pkg = row.package_kcal_ranges?.packages;
        const brand = pkg?.brands;
        const kr = row.package_kcal_ranges?.kcal_ranges;
        if (!pkg || !brand || !kr) continue;

        if (selectedCountry === "Czechy" && brand.country !== "Czechy") continue;
        if (selectedCountry !== "Czechy" && brand.country === "Czechy") continue;
        if (isTestPackage(pkg.name)) continue;

        const bucket = toKcalBucket(kr.kcal_from, kr.kcal_to);
        const key = `${pkg.id}|${bucket}`;

        if (seen.has(key)) continue; // already have latest for this combo

        const dietTags = classifyDiet(pkg.name);
        if (dietTags.length === 1 && dietTags[0] === "Inne") unclassifiedNames.add(pkg.name);

        seen.set(key, {
          brandName: brand.name, brandLogo: brand.logo_url ?? null,
          packageName: pkg.name, price: row.price, dietTags, bucket,
        });
      }

      // Build matrix: dietType × kcalBucket
      const matrix: GapMatrix = {};
      for (const dt of DIET_TYPES) {
        matrix[dt] = {};
        for (const kb of KCAL_BUCKETS) {
          matrix[dt][kb] = { brandCount: 0, brands: [], minPrice: null, maxPrice: null };
        }
      }

      for (const entry of seen.values()) {
        for (const tag of entry.dietTags) {
          const cell = matrix[tag]?.[entry.bucket];
          if (!cell) continue;

          // Count unique brands per cell
          if (!cell.brands.some(b => b.brandName === entry.brandName && b.packageName === entry.packageName)) {
            cell.brands.push({
              brandName: entry.brandName, brandLogo: entry.brandLogo,
              packageName: entry.packageName, price: entry.price,
            });
          }

          if (cell.minPrice === null || entry.price < cell.minPrice) cell.minPrice = entry.price;
          if (cell.maxPrice === null || entry.price > cell.maxPrice) cell.maxPrice = entry.price;
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
