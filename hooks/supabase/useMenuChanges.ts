import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { classifyDiet, isTestPackage } from "@/lib/dietClassification";

export interface MenuChangeEvent {
  packageId: string;
  packageName: string;
  brandName: string;
  brandLogo: string | null;
  dietTags: string[];
  eventType: "new" | "removed";
  eventDate: string; // first_seen or last_seen
  kcalCount: number;
  minPrice: number;
  maxPrice: number;
}

export function useMenuChanges() {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["menu-changes", selectedCountry],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
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
            kcal_ranges!inner ( kcal_label )
          )
        `)
        .order("date_recorded", { ascending: false })
        .limit(100000);

      if (error) throw error;
      if (!data || data.length === 0) return { events: [], unclassifiedCount: 0, unclassifiedNames: [] as string[] };

      // Group by package: first_seen, last_seen, kcal count, price range
      const pkgMap = new Map<string, {
        packageId: string; packageName: string; brandName: string; brandLogo: string | null;
        firstSeen: string; lastSeen: string;
        kcalLabels: Set<string>; prices: number[];
      }>();

      for (const row of data as any[]) {
        const pkg = row.package_kcal_ranges?.packages;
        const brand = pkg?.brands;
        const kr = row.package_kcal_ranges?.kcal_ranges;
        if (!pkg || !brand || !kr) continue;

        if (selectedCountry === "Czechy" && brand.country !== "Czechy") continue;
        if (selectedCountry !== "Czechy" && brand.country === "Czechy") continue;
        if (isTestPackage(pkg.name)) continue;

        const key = pkg.id;
        const existing = pkgMap.get(key);
        const d = row.date_recorded as string;

        if (existing) {
          if (d < existing.firstSeen) existing.firstSeen = d;
          if (d > existing.lastSeen) existing.lastSeen = d;
          existing.kcalLabels.add(kr.kcal_label);
          existing.prices.push(row.price);
        } else {
          pkgMap.set(key, {
            packageId: pkg.id, packageName: pkg.name,
            brandName: brand.name, brandLogo: brand.logo_url ?? null,
            firstSeen: d, lastSeen: d,
            kcalLabels: new Set([kr.kcal_label]),
            prices: [row.price],
          });
        }
      }

      // Global oldest date (start of monitoring)
      let globalOldest = "9999-12-31";
      for (const p of pkgMap.values()) {
        if (p.firstSeen < globalOldest) globalOldest = p.firstSeen;
      }

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const days90ago = new Date(today); days90ago.setDate(days90ago.getDate() - 90);
      const days90Str = days90ago.toISOString().split("T")[0];
      const days7ago = new Date(today); days7ago.setDate(days7ago.getDate() - 7);
      const days7Str = days7ago.toISOString().split("T")[0];

      // Global oldest + 7 days threshold to exclude initial monitoring data
      const globalOldestDate = new Date(globalOldest);
      globalOldestDate.setDate(globalOldestDate.getDate() + 7);
      const globalThreshold = globalOldestDate.toISOString().split("T")[0];

      const events: MenuChangeEvent[] = [];
      const unclassifiedNames = new Set<string>();

      for (const p of pkgMap.values()) {
        const dietTags = classifyDiet(p.packageName);
        if (dietTags.length === 1 && dietTags[0] === "Inne") unclassifiedNames.add(p.packageName);

        const minPrice = Math.min(...p.prices);
        const maxPrice = Math.max(...p.prices);

        // NOWOŚĆ: first_seen > globalThreshold AND first_seen within last 90 days
        if (p.firstSeen > globalThreshold && p.firstSeen >= days90Str) {
          events.push({
            packageId: p.packageId, packageName: p.packageName,
            brandName: p.brandName, brandLogo: p.brandLogo,
            dietTags, eventType: "new", eventDate: p.firstSeen,
            kcalCount: p.kcalLabels.size, minPrice, maxPrice,
          });
        }

        // WYCOFANY: last_seen < today - 7 days
        if (p.lastSeen < days7Str) {
          events.push({
            packageId: p.packageId, packageName: p.packageName,
            brandName: p.brandName, brandLogo: p.brandLogo,
            dietTags, eventType: "removed", eventDate: p.lastSeen,
            kcalCount: p.kcalLabels.size, minPrice, maxPrice,
          });
        }
      }

      events.sort((a, b) => b.eventDate.localeCompare(a.eventDate));

      return {
        events,
        unclassifiedCount: unclassifiedNames.size,
        unclassifiedNames: Array.from(unclassifiedNames).sort(),
      };
    },
  });
}
