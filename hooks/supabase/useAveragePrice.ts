import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

interface AveragePriceData {
  currentAvgPrice: number;
  previousAvgPrice: number;
  changePercent: number;
}

export const useAveragePrice = () => {
  return useQuery({
    queryKey: ["average-price"],
    queryFn: async (): Promise<AveragePriceData> => {
      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      const { data: currentData, error: currentError } = await supabase
        .from("price_history")
        .select("price")
        .gte("date_recorded", currentMonthStart.toISOString().split('T')[0])
        .lte("date_recorded", currentMonthEnd.toISOString().split('T')[0])
        .not("price", "is", null);

      if (currentError) throw currentError;

      const { data: previousData, error: previousError } = await supabase
        .from("price_history")
        .select("price")
        .gte("date_recorded", previousMonthStart.toISOString().split('T')[0])
        .lte("date_recorded", previousMonthEnd.toISOString().split('T')[0])
        .not("price", "is", null);

      if (previousError) throw previousError;

      const currentAvgPrice = currentData.length > 0
        ? currentData.reduce((sum, item) => sum + Number(item.price), 0) / currentData.length
        : 0;

      const previousAvgPrice = previousData.length > 0
        ? previousData.reduce((sum, item) => sum + Number(item.price), 0) / previousData.length
        : 0;

      const changePercent = previousAvgPrice > 0
        ? ((currentAvgPrice - previousAvgPrice) / previousAvgPrice) * 100
        : 0;

      return { currentAvgPrice, previousAvgPrice, changePercent };
    },
  });
};
