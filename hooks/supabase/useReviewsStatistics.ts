import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useReviewsStatistics(brandId?: string | null, timeFilter: string = "all", excludeDietly: boolean = false) {
  return useQuery({
    queryKey: ["reviews-statistics", brandId, timeFilter, excludeDietly],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: "always" as const,
    queryFn: async () => {
      const dbTimeFilter = timeFilter === "all" ? null :
        timeFilter === "3months" ? "6months" :
        timeFilter;

      const { data, error } = await (supabase as any)
        .rpc("get_reviews_statistics", {
          filter_brand_id: brandId || null,
          time_filter: dbTimeFilter,
          exclude_dietly: excludeDietly
        });

      if (error) throw error;

      const defaultData = {
        overview: {
          totalReviews: 0,
          averageRating: 0,
          dateRange: { oldest: null as Date | null, newest: null as Date | null },
          positivePercentage: 0,
        },
        ratingDistribution: [] as any[],
        brandRanking: [] as any[],
        monthlyTrends: [] as any[],
        dayOfWeekActivity: [] as any[],
        sourceBreakdown: [] as any[],
      };

      const raw = (data as any) || {};

      const merged = {
        ...defaultData,
        ...raw,
        overview: {
          ...defaultData.overview,
          ...(raw?.overview || {}),
        },
        ratingDistribution: raw?.ratingDistribution ?? defaultData.ratingDistribution,
        brandRanking: raw?.brandRanking ?? defaultData.brandRanking,
        monthlyTrends: raw?.monthlyTrends ?? defaultData.monthlyTrends,
        dayOfWeekActivity: raw?.dayOfWeekActivity ?? defaultData.dayOfWeekActivity,
        sourceBreakdown: raw?.sourceBreakdown ?? defaultData.sourceBreakdown,
      };

      return {
        ...merged,
        overview: {
          ...merged.overview,
          dateRange: {
            oldest: merged.overview?.dateRange?.oldest ? new Date(merged.overview.dateRange.oldest as any) : null,
            newest: merged.overview?.dateRange?.newest ? new Date(merged.overview.dateRange.newest as any) : null,
          },
        },
      };
    },
  });
}
