import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { format, subMonths } from "date-fns";

export interface BrandRankingData {
  month: string;
  brandName: string;
  avgRating: number;
  reviewCount: number;
  rank: number;
}

export function useBrandRankingHistory(months: number = 24, minReviews: number = 3) {
  return useQuery({
    queryKey: ["brand-ranking-history", months, minReviews],
    staleTime: 0,
    queryFn: async () => {
      const startDate = subMonths(new Date(), months);

      const { data, error } = await (supabase as any)
        .rpc("get_brand_ranking_history", {
          start_date: startDate.toISOString(),
          min_reviews: minReviews
        });

      if (error) throw error;

      const rankingData: BrandRankingData[] = (data || []).map((row: any) => ({
        month: format(new Date(row.month), "MMM yyyy"),
        brandName: row.brand_name,
        avgRating: parseFloat(row.avg_rating) || 0,
        reviewCount: parseInt(row.review_count) || 0,
        rank: parseInt(row.rank) || 0,
      }));

      const brands = [...new Set(rankingData.map(d => d.brandName))];
      const monthsArray = [...new Set(rankingData.map(d => d.month))];

      return {
        data: rankingData,
        brands,
        months: monthsArray,
      };
    },
  });
}
