import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export interface ScrapeRun {
  id: string;
  scraper_name: string;
  status: "running" | "success" | "partial" | "failed";
  started_at: string;
  finished_at: string | null;
  saved_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  variants_processed: number | null;
  execution_time_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  triggered_by: string;
  created_at: string;
}

export function useScrapeRuns(scraperName?: string, limit = 50) {
  return useQuery({
    queryKey: ["scrape-runs", scraperName, limit],
    queryFn: async () => {
      let query = supabase
        .from("scrape_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);

      if (scraperName) {
        query = query.eq("scraper_name", scraperName);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScrapeRun[];
    },
    staleTime: 30_000,
  });
}

export function useLastScrapeRun(scraperName: string) {
  return useQuery({
    queryKey: ["last-scrape-run", scraperName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_runs")
        .select("*")
        .eq("scraper_name", scraperName)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ScrapeRun | null;
    },
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 5000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
