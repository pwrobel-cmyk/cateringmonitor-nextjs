'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { useCountry } from "@/contexts/CountryContext";

export interface BrandAverageData {
  brandName: string;
  packageName?: string;
  catalogPrice: number;
  promoPrice: number;
  discountPercentage: number;
  packageCount: number;
}

interface BrandAverageComparisonFilters {
  dateFrom?: Date;
  dateTo?: Date;
  selectedPackages?: string[];
  customerType?: "existing" | "new";
}

export function useBrandAverageComparison(filters: BrandAverageComparisonFilters = {}) {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: [
      "brand-average-comparison-v3",
      filters.dateFrom ? format(filters.dateFrom, "yyyy-MM-dd") : null,
      filters.dateTo ? format(filters.dateTo, "yyyy-MM-dd") : null,
      filters.selectedPackages,
      filters.customerType || "existing",
      selectedCountry,
    ],
    queryFn: async (): Promise<{ brands: string[]; data: BrandAverageData[] }> => {
      try {
        // 1. Get all active brands
        let brandsQuery: any = (supabase as any)
          .from("brands")
          .select("id, name")
          .eq("is_active", true);

        if (selectedCountry === "Czechy") {
          brandsQuery = brandsQuery.eq("country", "Czechy");
        } else {
          brandsQuery = brandsQuery.or("country.is.null,country.neq.Czechy");
        }

        const { data: brands, error: brandsError } = await brandsQuery.order("name");
        if (brandsError) throw brandsError;

        // 2. Calculate date range
        const queryDateFrom = filters.dateFrom || subDays(filters.dateTo || new Date(), 7);
        const queryDateTo = filters.dateTo || new Date();

        const fromStr = format(queryDateFrom, "yyyy-MM-dd");
        const toStr = format(queryDateTo, "yyyy-MM-dd");

        // 3. Get discounts
        const { data: rawDiscounts } = await (supabase as any)
          .from("discounts")
          .select(`brand_id, percentage, valid_from, valid_until, requirements, brands!inner(name, country)`)
          .eq("is_active", true)
          .lte("valid_from", toStr)
          .or(`valid_until.gte.${fromStr},valid_until.is.null`);

        // Filter by country
        const countryFilteredDiscounts = (rawDiscounts || []).filter((discount: any) => {
          const country = discount.brands?.country;
          if (selectedCountry === "Czechy") return country === "Czechy";
          return !country || country !== "Czechy";
        });

        // Filter by customerType
        const customerTypeFilter = filters.customerType || "existing";
        const filteredDiscounts = countryFilteredDiscounts.filter((discount: any) => {
          const req = (discount.requirements || "").toLowerCase().trim();
          if (customerTypeFilter === "existing") {
            if (!req || req === "" || req === "brak") return true;
            const hasNewKeywords = req.includes("nowy") || req.includes("nowych") || req.includes("nowi");
            const hasAllKeywords = req.includes("wszyscy") || req.includes("dla wszystkich");
            const hasExistingKeywords = req.includes("istniejący") || req.includes("istniejacy") || req.includes("obecny") || req.includes("stały") || req.includes("staly");
            const isNewOnly = hasNewKeywords && !hasAllKeywords && !hasExistingKeywords;
            return !isNewOnly;
          } else {
            if (!req || req === "" || req === "brak") return false;
            return req.includes("nowy") || req.includes("nowych") || req.includes("nowi");
          }
        });

        // 4. Calculate daily average discount per brand (using last day's max)
        const dateSeries = eachDayOfInterval({ start: queryDateFrom, end: queryDateTo });
        const brandDiscountMap = new Map<string, number>();

        filteredDiscounts.forEach((discount: any) => {
          const brandName = discount.brands?.name;
          if (!brandName) return;

          const validFromStr = format(new Date(discount.valid_from), "yyyy-MM-dd");
          const validUntilStr = discount.valid_until
            ? format(new Date(discount.valid_until), "yyyy-MM-dd")
            : null;

          dateSeries.forEach((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const isValidFrom = dateStr >= validFromStr;
            const isValidUntil = validUntilStr ? dateStr <= validUntilStr : true;

            if (isValidFrom && isValidUntil) {
              const current = brandDiscountMap.get(brandName) || 0;
              brandDiscountMap.set(brandName, Math.max(current, discount.percentage || 0));
            }
          });
        });

        // 5. Get packages
        let packages: any[] = [];

        if (filters.selectedPackages && filters.selectedPackages.length > 0) {
          const packageFilters = filters.selectedPackages.map((packageKey) => {
            const firstDashIndex = packageKey.indexOf(" - ");
            return {
              brandName: packageKey.substring(0, firstDashIndex),
              packageName: packageKey.substring(firstDashIndex + 3),
            };
          });

          const packagePromises = packageFilters.map(({ brandName, packageName }) =>
            (supabase as any)
              .from("packages")
              .select("id, name, brand_id, brands!inner(name)")
              .eq("is_active", true)
              .eq("brands.name", brandName)
              .eq("name", packageName)
          );

          const packageResults = await Promise.all(packagePromises);
          packageResults.forEach((result: any) => {
            if (!result.error && result.data) {
              packages.push(...result.data);
            }
          });
        } else {
          const { data: packagesData } = await (supabase as any)
            .from("packages")
            .select("id, name, brand_id, brands!inner(name)")
            .eq("is_active", true);
          packages = packagesData || [];
        }

        // 6. Get package_kcal_range IDs if needed
        let packageKcalRangeIds: string[] | undefined;

        if (filters.selectedPackages && filters.selectedPackages.length > 0) {
          const packageFilters = filters.selectedPackages.map((packageKey) => {
            const firstDashIndex = packageKey.indexOf(" - ");
            return {
              brandName: packageKey.substring(0, firstDashIndex),
              packageName: packageKey.substring(firstDashIndex + 3),
            };
          });

          const packageKcalRangePromises = packageFilters.map(({ brandName, packageName }) =>
            (supabase as any)
              .from("package_kcal_ranges")
              .select("id, packages!inner(name, brands!inner(name))")
              .eq("packages.brands.name", brandName)
              .eq("packages.name", packageName)
          );

          const packageKcalRangeResults = await Promise.all(packageKcalRangePromises);
          const allIds: string[] = [];

          packageKcalRangeResults.forEach((result: any) => {
            if (!result.error && result.data) {
              allIds.push(...result.data.map((pkr: any) => pkr.id));
            }
          });

          packageKcalRangeIds = allIds;
        }

        // 7. Get price history in batches
        let allPriceHistory: any[] = [];
        let fromRecord = 0;
        const batchSize = 1000;

        while (true) {
          const { data: batch, error: priceError } = await (supabase as any)
            .from("price_history")
            .select(`
              price,
              promotional_price,
              discount_percentage,
              date_recorded,
              package_kcal_ranges!price_history_package_kcal_range_id_fkey!inner(
                id,
                packages!inner(
                  id,
                  name,
                  brands!inner(name, country)
                )
              )
            `)
            .gte("date_recorded", fromStr)
            .lte("date_recorded", toStr)
            .order("date_recorded", { ascending: false })
            .range(fromRecord, fromRecord + batchSize - 1);

          if (priceError) throw priceError;
          if (!batch || batch.length === 0) break;

          allPriceHistory = allPriceHistory.concat(batch);
          if (batch.length < batchSize) break;
          fromRecord += batchSize;
        }

        // Filter by country
        const countryFilteredPriceHistory = allPriceHistory.filter((priceRecord: any) => {
          const country = priceRecord.package_kcal_ranges?.packages?.brands?.country;
          if (selectedCountry === "Czechy") return country === "Czechy";
          return !country || country !== "Czechy";
        });

        const finalPriceHistory =
          packageKcalRangeIds && packageKcalRangeIds.length > 0
            ? countryFilteredPriceHistory.filter((ph: any) =>
                packageKcalRangeIds!.includes(ph.package_kcal_ranges?.id)
              )
            : countryFilteredPriceHistory;

        if (finalPriceHistory.length === 0) {
          return { brands: brands?.map((b: any) => b.name) || [], data: [] };
        }

        // 8. Group by brand and calculate averages
        const brandAverages = new Map<string, { brandName: string; packageName?: string; prices: number[]; packageIds: Set<string> }>();

        finalPriceHistory.forEach((priceRecord: any) => {
          const brandName = priceRecord.package_kcal_ranges?.packages?.brands?.name;
          const packageName = priceRecord.package_kcal_ranges?.packages?.name;
          const packageId = priceRecord.package_kcal_ranges?.packages?.id;

          if (brandName && packageName && packageId && priceRecord.price) {
            const groupKey =
              filters.selectedPackages && filters.selectedPackages.length > 0
                ? `${brandName} - ${packageName}`
                : brandName;

            if (!brandAverages.has(groupKey)) {
              brandAverages.set(groupKey, {
                brandName,
                packageName:
                  filters.selectedPackages && filters.selectedPackages.length > 0
                    ? packageName
                    : undefined,
                prices: [],
                packageIds: new Set(),
              });
            }

            const brandData = brandAverages.get(groupKey)!;
            brandData.prices.push(priceRecord.price);
            brandData.packageIds.add(packageId);
          }
        });

        // 9. Calculate final data
        const data: BrandAverageData[] = Array.from(brandAverages.entries()).map(
          ([, brandData]) => {
            const avgPrice = brandData.prices.reduce((sum, price) => sum + price, 0) / brandData.prices.length;
            const discountPct = brandDiscountMap.get(brandData.brandName) || 0;
            const promoPrice = avgPrice * (1 - discountPct / 100);

            return {
              brandName: brandData.brandName,
              packageName: brandData.packageName,
              catalogPrice: avgPrice,
              promoPrice,
              discountPercentage: discountPct,
              packageCount: brandData.packageIds.size,
            };
          }
        );

        data.sort((a, b) => a.brandName.localeCompare(b.brandName));

        return { brands: brands?.map((b: any) => b.name).sort() || [], data };
      } catch (error) {
        console.error("[useBrandAverageComparison] ERROR:", error);
        throw error;
      }
    },
    staleTime: 0,
    gcTime: 1000,
  });
}
