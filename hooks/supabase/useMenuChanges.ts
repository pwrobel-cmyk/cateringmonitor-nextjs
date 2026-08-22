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
      const { data, error } = await (supabase as any).rpc("get_package_lifecycle");

      if (error) throw error;
      if (!data || data.length === 0)
        return { events: [], globalOldest: "", unclassifiedCount: 0, unclassifiedNames: [] as string[] };

      // Country filter
      const filtered = (data as any[]).filter((row) => {
        if (selectedCountry === "Czechy") return row.country === "Czechy";
        return row.country !== "Czechy";
      });

      // Global oldest date (start of monitoring)
      let globalOldest = "9999-12-31";
      for (const row of filtered) {
        if (row.first_seen < globalOldest) globalOldest = row.first_seen;
      }

      const today = new Date();
      const days7ago = new Date(today);
      days7ago.setDate(days7ago.getDate() - 7);
      const days7Str = days7ago.toISOString().split("T")[0];

      // Global oldest + 3 days threshold to exclude initial monitoring data
      const globalOldestDate = new Date(globalOldest);
      globalOldestDate.setDate(globalOldestDate.getDate() + 3);
      const globalThreshold = globalOldestDate.toISOString().split("T")[0];

      const events: MenuChangeEvent[] = [];
      const unclassifiedNames = new Set<string>();

      for (const row of filtered) {
        if (isTestPackage(row.package_name)) continue;

        const dietTags = classifyDiet(row.package_name);
        if (dietTags.length === 1 && dietTags[0] === "Inne") unclassifiedNames.add(row.package_name);

        // NOWOŚĆ: first_seen > globalThreshold (no time limit)
        if (row.first_seen > globalThreshold) {
          events.push({
            packageId: row.package_id,
            packageName: row.package_name,
            brandName: row.brand_name,
            brandLogo: row.brand_logo ?? null,
            dietTags,
            eventType: "new",
            eventDate: row.first_seen,
            kcalCount: Number(row.kcal_count),
            minPrice: Number(row.min_price),
            maxPrice: Number(row.max_price),
          });
        }

        // WYCOFANY: last_seen < today - 7 days
        if (row.last_seen < days7Str) {
          events.push({
            packageId: row.package_id,
            packageName: row.package_name,
            brandName: row.brand_name,
            brandLogo: row.brand_logo ?? null,
            dietTags,
            eventType: "removed",
            eventDate: row.last_seen,
            kcalCount: Number(row.kcal_count),
            minPrice: Number(row.min_price),
            maxPrice: Number(row.max_price),
          });
        }
      }

      events.sort((a, b) => b.eventDate.localeCompare(a.eventDate));

      return {
        events,
        globalOldest,
        unclassifiedCount: unclassifiedNames.size,
        unclassifiedNames: Array.from(unclassifiedNames).sort(),
      };
    },
  });
}
