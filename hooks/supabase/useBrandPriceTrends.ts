'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

interface BrandPriceTrendsFilters {
  dateFrom?: Date;
  dateTo?: Date;
}

export function useBrandPriceTrends(filters: BrandPriceTrendsFilters = {}) {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["brand-price-trends", filters, selectedCountry],
    queryFn: async () => {

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const defaultDateFrom = twoWeeksAgo;
      const defaultDateTo = new Date();

      const dateFrom = filters.dateFrom || defaultDateFrom;
      const dateTo = filters.dateTo || defaultDateTo;

      let statsQuery: any = supabase
        .from("brand_daily_stats")
        .select(`
          date,
          average_price,
          brand_id,
          brands!inner (
            id,
            name,
            country
          )
        `)
        .gte("date", dateFrom.toISOString().split('T')[0])
        .lte("date", dateTo.toISOString().split('T')[0]);

      if (selectedCountry === "Czechy") {
        statsQuery = statsQuery.eq("brands.country", "Czechy");
      } else {
        statsQuery = statsQuery.neq("brands.country", "Czechy");
      }

      const { data, error } = await statsQuery.order("date", { ascending: true });
      if (error) throw error;

      // Fetch ALL discounts with pagination
      const allDiscounts: any[] = [];
      let discountOffset = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error: discountsError } = await supabase
          .from("discounts")
          .select("id, percentage, valid_from, valid_until, brand_id")
          .eq("is_active", true)
          .not("percentage", "is", null)
          .gt("percentage", 0)
          .not("brand_id", "is", null)
          .range(discountOffset, discountOffset + pageSize - 1);

        if (discountsError) throw discountsError;

        allDiscounts.push(...(page || []));
        if (!page || page.length < pageSize) break;
        discountOffset += pageSize;
      }

      const validDiscounts = allDiscounts;

      // Build brandName → brandId map from stats data
      const brandNameToId = new Map<string, string>();
      (data || []).forEach((item: any) => {
        if (item.brands?.name && item.brand_id) {
          brandNameToId.set(item.brands.name, item.brand_id);
        }
      });

      // Group by date, then by brand
      const dateMap = new Map<string, Map<string, { avgPrice: number }>>();

      (data || []).forEach((item: any) => {
        const date = item.date;
        const brandName = item.brands?.name;
        if (!brandName) return;

        if (!dateMap.has(date)) {
          dateMap.set(date, new Map());
        }
        dateMap.get(date)!.set(brandName, { avgPrice: item.average_price });
      });

      // Helper: get max discount for a specific brand on a specific date
      const discountCache = new Map<string, number>();
      const getBrandDiscountForDate = (brandName: string, dateStr: string): number => {
        const cacheKey = `${brandName}__${dateStr}`;
        if (discountCache.has(cacheKey)) return discountCache.get(cacheKey)!;

        const brandId = brandNameToId.get(brandName);
        if (!brandId) { discountCache.set(cacheKey, 0); return 0; }

        const brandDiscounts = validDiscounts.filter(d => {
          if (d.brand_id !== brandId || !d.valid_from) return false;
          const fromDate = new Date(d.valid_from).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
          if (fromDate > dateStr) return false;
          if (!d.valid_until) return true;
          const untilDate = new Date(d.valid_until).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
          return untilDate >= dateStr;
        });

        const maxDiscount = brandDiscounts.length > 0
          ? Math.max(...brandDiscounts.map(d => d.percentage || 0))
          : 0;

        discountCache.set(cacheKey, maxDiscount);
        return maxDiscount;
      };

      // Convert to chart data format
      const chartData = Array.from(dateMap.entries())
        .map(([date, brandMap]) => {
          const point: any = {
            date,
            dateFormatted: new Date(date).toLocaleDateString('pl-PL', {
              day: '2-digit',
              month: '2-digit'
            })
          };

          brandMap.forEach((brandData, brandName) => {
            const avgPrice = brandData.avgPrice;
            point[brandName] = Math.round(avgPrice * 100) / 100;

            const brandDiscount = getBrandDiscountForDate(brandName, date);
            const promoPrice = brandDiscount > 0
              ? avgPrice * (1 - brandDiscount / 100)
              : avgPrice;
            point[`${brandName}_promo`] = Math.round(promoPrice * 100) / 100;
          });

          return point;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Get unique brands
      const brandsSet = new Set<string>();
      (data || []).forEach((item: any) => {
        if (item.brands?.name) brandsSet.add(item.brands.name);
      });
      const brands = Array.from(brandsSet).sort();

      return { chartData, brands };
    },
  });
}
