import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface BrandParametersTrendData {
  period: string;
  smak: number | null;
  jakość: number | null;
  cena: number | null;
  obsługa: number | null;
  dostawa: number | null;
  porcje: number | null;
  smak_count: number;
  jakość_count: number;
  cena_count: number;
  obsługa_count: number;
  dostawa_count: number;
  porcje_count: number;
  total_reviews: number;
}

export function useBrandParametersTrends(
  brandId?: string | null,
  periodType: 'week' | 'month' = 'week',
  timeRange: '6months' | '1year' | 'all' = 'all'
) {
  return useQuery({
    queryKey: ["brand-parameters-trends", brandId, periodType, timeRange],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc("get_brand_parameters_trends", {
          filter_brand_id: brandId || null,
          period_type: periodType,
          time_range: timeRange
        });

      if (error) throw error;

      return (data || []) as BrandParametersTrendData[];
    },
    enabled: !!brandId,
  });
}
