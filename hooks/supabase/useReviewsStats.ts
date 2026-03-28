import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useReviewsStats() {
  return useQuery({
    queryKey: ["reviews-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_reviews_stats");

      if (error) throw error;

      const statsByBrand: Record<string, {
        avg: number;
        total: number;
        distribution: number[];
        brandName: string;
      }> = {};

      data?.forEach((row: any) => {
        statsByBrand[row.brand_name] = {
          avg: parseFloat(row.avg_rating) || 0,
          total: parseInt(row.total_reviews) || 0,
          distribution: [
            parseInt(row.rating_1) || 0,
            parseInt(row.rating_2) || 0,
            parseInt(row.rating_3) || 0,
            parseInt(row.rating_4) || 0,
            parseInt(row.rating_5) || 0,
          ],
          brandName: row.brand_name
        };
      });

      return statsByBrand;
    },
  });
}
