import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useBrandReviews(brandId: string | null, timeFilter: string = "all") {
  return useQuery({
    queryKey: ["brand-reviews", brandId, timeFilter],
    queryFn: async () => {
      if (!brandId) return [];

      let query = supabase
        .from("reviews")
        .select("id, content, rating, title, review_date, created_at")
        .eq("brand_id", brandId)
        .eq("is_approved", true)
        .not("content", "is", null);

      if (timeFilter !== "all") {
        let dateThreshold: Date;

        switch (timeFilter) {
          case "1month":
            dateThreshold = new Date();
            dateThreshold.setMonth(dateThreshold.getMonth() - 1);
            break;
          case "3months":
            dateThreshold = new Date();
            dateThreshold.setMonth(dateThreshold.getMonth() - 3);
            break;
          case "6months":
            dateThreshold = new Date();
            dateThreshold.setMonth(dateThreshold.getMonth() - 6);
            break;
          case "1year":
            dateThreshold = new Date();
            dateThreshold.setFullYear(dateThreshold.getFullYear() - 1);
            break;
          default:
            dateThreshold = new Date(0);
        }

        const thresholdISO = dateThreshold.toISOString();
        query = query.or(`review_date.gte.${thresholdISO},and(review_date.is.null,created_at.gte.${thresholdISO})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    },
    enabled: !!brandId,
  });
}
