import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface LastScrapeInfo {
  brandName: string;
  lastScrapeAt: string | null;
  pricesCount: number;
}

const SCRAPER_TO_BRAND: Record<string, string> = {
  "sytykrol": "Syty Król",
  "5pd": "5 Posiłków Dziennie",
  "afterfit": "AfterFit",
  "dob": "Diety od Brokuła",
  "fitapetit": "FitApetit",
  "bodychief": "BodyChief",
  "gastropaczka": "Gastropaczka",
  "kuchniavikinga": "Kuchnia Vikinga",
  "maczfit": "MaczFit",
};

export function useLastScrapeStats() {
  return useQuery({
    queryKey: ["last-scrape-stats"],
    queryFn: async () => {
      const brandNames = Object.values(SCRAPER_TO_BRAND);

      const { data: brands, error: brandsError } = await supabase
        .from("brands")
        .select("id, name")
        .in("name", brandNames);

      if (brandsError) throw brandsError;
      if (!brands || brands.length === 0) return {};

      const brandMap = new Map(brands.map(b => [b.id, b.name]));
      const brandIds = brands.map(b => b.id);

      const { data: packages, error: packagesError } = await supabase
        .from("packages")
        .select("id, brand_id")
        .in("brand_id", brandIds);

      if (packagesError) throw packagesError;
      if (!packages || packages.length === 0) return {};

      const packageToBrand = new Map(packages.map(p => [p.id, p.brand_id]));
      const packageIds = packages.map(p => p.id);

      const { data: pkrData, error: pkrError } = await supabase
        .from("package_kcal_ranges")
        .select("id, package_id")
        .in("package_id", packageIds);

      if (pkrError) throw pkrError;
      if (!pkrData || pkrData.length === 0) return {};

      const pkrToBrand = new Map<string, string>();
      for (const pkr of pkrData) {
        const brandId = packageToBrand.get(pkr.package_id);
        if (brandId) {
          const brandName = brandMap.get(brandId);
          if (brandName) {
            pkrToBrand.set(pkr.id, brandName);
          }
        }
      }

      const pkrIds = pkrData.map(p => p.id);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: priceHistory, error: phError } = await supabase
        .from("price_history")
        .select("package_kcal_range_id, created_at")
        .in("package_kcal_range_id", pkrIds)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (phError) throw phError;

      const brandStats: Record<string, { lastAt: string; count: number; lastDate: string }> = {};

      for (const row of priceHistory || []) {
        const brandName = pkrToBrand.get(row.package_kcal_range_id);
        if (!brandName || !row.created_at) continue;

        const thisDate = row.created_at.split('T')[0];

        if (!brandStats[brandName]) {
          brandStats[brandName] = { lastAt: row.created_at, count: 1, lastDate: thisDate };
        } else if (thisDate === brandStats[brandName].lastDate) {
          brandStats[brandName].count++;
        }
      }

      const result: Record<string, LastScrapeInfo> = {};

      for (const [scraperKey, brandName] of Object.entries(SCRAPER_TO_BRAND)) {
        const stats = brandStats[brandName];
        result[scraperKey] = {
          brandName,
          lastScrapeAt: stats?.lastAt || null,
          pricesCount: stats?.count || 0,
        };
      }

      return result;
    },
    staleTime: 60 * 1000,
  });
}
