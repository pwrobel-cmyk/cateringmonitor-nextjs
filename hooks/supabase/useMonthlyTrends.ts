import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface MonthlyTrend {
  month: string;
  avgPrice: number;
  promotions: number;
}

export const useMonthlyTrends = () => {
  return useQuery({
    queryKey: ["monthly-trends"],
    queryFn: async (): Promise<MonthlyTrend[]> => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from("brand_daily_stats")
        .select("date, average_price")
        .gte("date", sixMonthsAgo.toISOString().split('T')[0])
        .order("date", { ascending: true });

      if (error) throw error;

      // Group by month
      const monthMap = new Map<string, { total: number; count: number }>();
      data?.forEach((row: any) => {
        const month = row.date.slice(0, 7);
        const existing = monthMap.get(month) || { total: 0, count: 0 };
        monthMap.set(month, { total: existing.total + (row.average_price || 0), count: existing.count + 1 });
      });

      return Array.from(monthMap.entries()).map(([month, { total, count }]) => ({
        month,
        avgPrice: count > 0 ? total / count : 0,
        promotions: 0,
      }));
    },
  });
};
