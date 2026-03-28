import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useStoredAIAnalysis(brandId?: string, timeFrame?: string) {
  return useQuery({
    queryKey: ["stored-ai-analysis", brandId, timeFrame],
    queryFn: async () => {
      if (!brandId) return null;
      const { data, error } = await (supabase as any)
        .from("ai_brand_analyses")
        .select("*")
        .eq("brand_id", brandId)
        .eq("time_frame", timeFrame || "1year")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!brandId,
  });
}

export function useAggregatedAIAnalysis(timeFrame?: string) {
  return useQuery({
    queryKey: ["aggregated-ai-analysis", timeFrame],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc("get_aggregated_ai_analysis", { time_frame: timeFrame || "1year" });
      if (error) return null;
      return data;
    },
  });
}
