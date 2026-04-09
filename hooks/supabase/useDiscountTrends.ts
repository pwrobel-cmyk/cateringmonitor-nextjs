import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subDays } from "date-fns";
import { useCountry } from "@/contexts/CountryContext";

interface DiscountTrendsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  aggregation?: "daily" | "weekly" | "monthly";
  brandNames?: string[];
  customerType?: "existing" | "new";
}

export function useDiscountTrends(filters: DiscountTrendsFilters = {}, enabled: boolean = true) {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: [
      "discount-trends",
      filters.dateFrom?.toISOString(),
      filters.dateTo?.toISOString(),
      filters.aggregation,
      filters.brandNames?.join(','),
      filters.customerType,
      selectedCountry,
    ],
    enabled,
    queryFn: async () => {

      const defaultDateTo = new Date();
      const defaultDateFrom = subDays(defaultDateTo, 30);

      const dateFrom = filters.dateFrom || defaultDateFrom;
      const dateTo = filters.dateTo || defaultDateTo;
      const aggregation = filters.aggregation || "daily";

      let query: any = supabase
        .from("discounts")
        .select(`
          *,
          brands!inner(
            id,
            name,
            country
          )
        `)
        .eq("is_active", true)
        .limit(10000);

      if (selectedCountry === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      const { data, error } = await query.order("valid_from", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        return { chartData: [], brands: [] };
      }

      let validDiscounts = data.filter((discount: any) =>
        discount.percentage &&
        discount.percentage > 0 &&
        discount.brand_id &&
        discount.brands?.name
      );

      if (filters.customerType) {
        validDiscounts = validDiscounts.filter((discount: any) => {
          const requirements = discount.requirements?.toLowerCase().trim() || '';

          if (filters.customerType === 'existing') {
            if (!discount.requirements || requirements === '' || requirements === 'brak') return true;
            const hasNewKeywords = requirements.includes('nowy') || requirements.includes('nowych') || requirements.includes('nowi');
            const hasAllKeywords = requirements.includes('wszyscy') || requirements.includes('dla wszystkich');
            const hasExistingKeywords = requirements.includes('istniejący') || requirements.includes('istniejacy') || requirements.includes('obecny') || requirements.includes('stały') || requirements.includes('staly');
            const isNewOnly = hasNewKeywords && !hasAllKeywords && !hasExistingKeywords;
            return !isNewOnly;
          } else if (filters.customerType === 'new') {
            if (!discount.requirements || requirements === '') return false;
            return requirements.includes("nowy") || requirements.includes("nowi") || requirements.includes("nowych") || requirements.includes("dla nowych") || requirements.includes("pierwsze zamówienie") || requirements.includes("pierwsze zamowienie") || requirements.includes("pierwszy");
          }

          return true;
        });
      }

      if (filters.brandNames && filters.brandNames.length > 0) {
        validDiscounts = validDiscounts.filter((discount: any) =>
          filters.brandNames!.includes(discount.brands!.name)
        );
      }

      const brandNames = validDiscounts
        .map((item: any) => item.brands!.name)
        .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index)
        .sort();

      const generateDateSeries = () => {
        const dates = [];
        const currentDate = new Date(dateFrom);

        while (currentDate <= dateTo) {
          if (aggregation === "daily") {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (aggregation === "weekly") {
            dates.push(startOfWeek(currentDate, { weekStartsOn: 1 }));
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (aggregation === "monthly") {
            dates.push(startOfMonth(currentDate));
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }

        return dates;
      };

      const dateSeries = generateDateSeries();

      const chartData = dateSeries.map(periodStart => {
        let periodEnd: Date;
        let displayLabel: string;

        if (aggregation === "daily") {
          periodEnd = new Date(periodStart);
          displayLabel = format(periodStart, "dd/MM");
        } else if (aggregation === "weekly") {
          periodEnd = endOfWeek(periodStart, { weekStartsOn: 1 });
          displayLabel = `${format(periodStart, "dd/MM")} - ${format(periodEnd, "dd/MM")}`;
        } else {
          periodEnd = endOfMonth(periodStart);
          displayLabel = format(periodStart, "MM/yyyy");
        }

        const dataPoint: any = {
          date: periodStart,
          day: displayLabel
        };

        brandNames.forEach((brandName: string) => {
          const periodStartStr = format(periodStart, "yyyy-MM-dd");
          const periodEndStr = format(periodEnd, "yyyy-MM-dd");

          const brandDiscounts = validDiscounts.filter((discount: any) => {
            if (discount.brands!.name !== brandName || !discount.percentage) return false;
            const validFromStr = format(new Date(discount.valid_from), "yyyy-MM-dd");
            const validUntilStr = discount.valid_until ? format(new Date(discount.valid_until), "yyyy-MM-dd") : null;
            const hasStarted = validFromStr <= periodEndStr;
            const notEnded = !validUntilStr || validUntilStr >= periodStartStr;
            return hasStarted && notEnded;
          });

          if (brandDiscounts.length > 0) {
            const avgDiscount = brandDiscounts.reduce((sum: number, d: any) => sum + (d.percentage || 0), 0) / brandDiscounts.length;
            dataPoint[brandName] = Math.round(avgDiscount * 100) / 100;
          } else {
            dataPoint[brandName] = 0;
          }
        });

        return dataPoint;
      });

      return { chartData, brands: brandNames };
    },
    staleTime: 0,
    gcTime: 15 * 60 * 1000,
  });
}
