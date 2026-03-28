import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export function useReviewsTimeline() {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["reviews-timeline", selectedCountry],
    queryFn: async () => {
      let query: any = supabase
        .from("reviews")
        .select(`
          review_date,
          brand_id,
          brands!inner (
            id,
            name,
            country
          )
        `)
        .eq("is_approved", true);

      if (selectedCountry === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      const { data, error } = await query.order("review_date", { ascending: false });

      if (error) throw error;

      const timelineMap = new Map<string, Map<string, number>>();
      const allDates = new Set<string>();

      data?.forEach((review: any) => {
        const brandName = review.brands?.name || "Unknown";
        const date = review.review_date?.split('T')[0];

        if (!date) return;

        allDates.add(date);

        if (!timelineMap.has(brandName)) {
          timelineMap.set(brandName, new Map());
        }

        const brandMap = timelineMap.get(brandName)!;
        brandMap.set(date, (brandMap.get(date) || 0) + 1);
      });

      const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));
      const brands = Array.from(timelineMap.keys()).sort();

      return {
        brands,
        dates: sortedDates,
        timelineMap,
      };
    },
  });
}
