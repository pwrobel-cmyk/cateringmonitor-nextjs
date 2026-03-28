import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface GoogleTrendsAnalysis {
  id: string;
  name: string;
  analysis_type: string;
  queries: string[];
  geo: string | null;
  date_range: string | null;
  data: Record<string, unknown>;
  ai_analysis: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useGoogleTrendsAnalyses() {
  return useQuery({
    queryKey: ["google-trends-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_trends_analyses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GoogleTrendsAnalysis[];
    },
  });
}
