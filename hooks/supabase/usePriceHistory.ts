import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { matchesCustomerType } from "@/lib/discounts";

export interface PriceChange {
  brandId: string;
  brand: string;
  brandLogoUrl: string | null;
  package: string;
  kcal: string | null;
  changePercent: number;
  oldPrice: number;
  newPrice: number;
  changeDate: string;
}

interface PriceChangesFilters {
  brandId?: string;
  packageName?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function usePriceChanges(filters?: PriceChangesFilters) {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["price-changes", filters, selectedCountry],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_price_changes");
      if (error) throw error;

      let changes = (data as any[]) || [];

      if (selectedCountry === "Czechy") {
        const { data: czechBrands } = await (supabase as any)
          .from("brands")
          .select("id")
          .eq("country", "Czechy")
          .eq("is_active", true);

        const czechBrandIds = new Set((czechBrands || []).map((b: any) => b.id));
        changes = changes.filter((item: any) => czechBrandIds.has(item.brand_id));
      } else {
        const { data: polishBrands } = await (supabase as any)
          .from("brands")
          .select("id")
          .neq("country", "Czechy")
          .eq("is_active", true);
        const polishBrandIds = new Set((polishBrands || []).map((b: any) => b.id));
        changes = changes.filter((item: any) => polishBrandIds.has(item.brand_id));
      }

      if (filters?.brandId && filters.brandId !== "all") {
        changes = changes.filter((item: any) => item.brand_id === filters.brandId);
      }

      if (filters?.packageName && filters.packageName !== "all") {
        changes = changes.filter((item: any) => item.package_name === filters.packageName);
      }

      if (filters?.dateFrom) {
        const dateFromStr = filters.dateFrom.toISOString().split('T')[0];
        changes = changes.filter((item: any) => item.change_date >= dateFromStr);
      }

      if (filters?.dateTo) {
        const dateToStr = filters.dateTo.toISOString().split('T')[0];
        changes = changes.filter((item: any) => item.change_date <= dateToStr);
      }

      return changes.map((item: any): PriceChange => ({
        brandId: item.brand_id,
        brand: item.brand_name,
        brandLogoUrl: item.brand_logo_url,
        package: item.package_name,
        kcal: item.kcal_label,
        changePercent: item.change_percent,
        oldPrice: item.old_price,
        newPrice: item.new_price,
        changeDate: item.change_date,
      }));
    },
  });
}

// ============================================================
// usePackagePriceComparison — for Compare page
// ============================================================

interface PriceHistoryFilters {
  dateFrom?: Date;
  dateTo?: Date;
  packageIds?: string[];
  customerType?: "existing" | "new";
}

export interface BrandPackagePrice {
  brandName: string;
  packageName: string;
  category: string;
  catalogPrice: number;
  promoPrice: number;
  discountPercentage: number;
  hasDiscount: boolean;
}

export interface KcalComparisonRow {
  kcalLabel: string;
  kcal: number;
  brandPackagePrices: Record<string, BrandPackagePrice>;
}

export function usePackagePriceComparison(filters: PriceHistoryFilters = {}, enabled: boolean = true) {
  const { selectedCountry } = useCountry();

  return useQuery<KcalComparisonRow[]>({
    queryKey: ["package-price-comparison", filters, selectedCountry],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {

      const dateFrom = filters.dateFrom || new Date();
      const dateTo = filters.dateTo || new Date();
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      const dateToStr = dateTo.toISOString().split('T')[0];
      const customerType = filters.customerType || "existing";

      // === Build price_history query ===
      let priceQuery = supabase
        .from("price_history")
        .select(`
          price,
          promotional_price,
          discount_percentage,
          date_recorded,
          package_kcal_ranges!price_history_package_kcal_range_id_fkey!inner (
            id,
            package_id,
            kcal_range_id,
            packages!inner (
              id,
              name,
              category,
              brand_id,
              brands!inner (
                id,
                name,
                country
              )
            ),
            kcal_ranges!inner (
              kcal_from,
              kcal_to,
              kcal_label
            )
          )
        `)
        .gte("date_recorded", dateFromStr)
        .lte("date_recorded", dateToStr)
        .order("date_recorded", { ascending: false })
        .limit(5000) as any;

      if (filters.packageIds && filters.packageIds.length > 0) {
        priceQuery = priceQuery.in("package_kcal_ranges.package_id", filters.packageIds);
      }

      // === Build discounts query ===
      const discountsQuery = (supabase as any)
        .from("discounts")
        .select(`brand_id, percentage, valid_from, valid_until, requirements, brands!inner(name, country)`)
        .eq("is_active", true)
        .lte("valid_from", dateToStr)
        .or(`valid_until.gte.${dateFromStr},valid_until.is.null`);

      // === Run both in parallel ===
      const [{ data, error }, { data: discountsData }] = await Promise.all([
        priceQuery,
        discountsQuery,
      ]);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // === Filter discounts by country & customerType → brand max % map ===
      const brandDiscountMap = new Map<string, number>();

      (discountsData || []).forEach((d: any) => {
        const country = d.brands?.country;
        const brandName = d.brands?.name;
        if (!brandName || !d.percentage) return;

        if (selectedCountry === "Czechy" && country !== "Czechy") return;
        if (selectedCountry !== "Czechy" && country === "Czechy") return;

        if (!matchesCustomerType(d.requirements, customerType)) return;

        const current = brandDiscountMap.get(brandName) || 0;
        brandDiscountMap.set(brandName, Math.max(current, d.percentage));
      });

      // === Group by kcal label ===
      const kcalMap = new Map<string, KcalComparisonRow>();
      const seenKeys = new Set<string>();

      data.forEach((record: any) => {
        const pkr = record.package_kcal_ranges;
        if (!pkr) return;

        const pkg = pkr.packages;
        if (!pkg) return;

        const brand = pkg.brands;
        if (!brand) return;

        if (selectedCountry === "Czechy" && brand.country !== "Czechy") return;
        if (selectedCountry !== "Czechy" && brand.country === "Czechy") return;

        const kcalRange = pkr.kcal_ranges;
        const kcal = kcalRange?.kcal_from === kcalRange?.kcal_to
          ? kcalRange?.kcal_from
          : Math.round(((kcalRange?.kcal_from || 0) + (kcalRange?.kcal_to || 0)) / 2);
        const kcalLabel = kcalRange?.kcal_label || `${kcal} kcal`;

        const brandPackageKey = `${brand.name} - ${pkg.name}`;
        const dedupeKey = `${kcalLabel}_${brandPackageKey}`;

        if (seenKeys.has(dedupeKey)) return;
        seenKeys.add(dedupeKey);

        if (!kcalMap.has(kcalLabel)) {
          kcalMap.set(kcalLabel, { kcalLabel, kcal, brandPackagePrices: {} });
        }

        const row = kcalMap.get(kcalLabel)!;
        const catalogPrice = record.price || 0;

        // --- Candidate A: scraper promotional_price ---
        const scraperPromo: number | null = record.promotional_price ?? null;
        let scraperPct: number;
        if (record.discount_percentage) {
          scraperPct = record.discount_percentage;
        } else if (scraperPromo !== null && catalogPrice > 0) {
          scraperPct = Math.round((1 - scraperPromo / catalogPrice) * 100);
        } else {
          scraperPct = 0;
        }

        // --- Candidate B: best discount from discounts table ---
        const tablePct = brandDiscountMap.get(brand.name) || 0;
        const tablePromo: number | null = tablePct > 0
          ? Math.round(catalogPrice * (1 - tablePct / 100) * 100) / 100
          : null;

        let promoPrice: number;
        let discountPct: number;

        if (customerType === "new") {
          // New customers: pick the LOWER price (better deal)
          const candidates: { price: number; pct: number }[] = [];
          if (scraperPromo !== null) candidates.push({ price: scraperPromo, pct: scraperPct });
          if (tablePromo !== null) candidates.push({ price: tablePromo, pct: tablePct });

          if (candidates.length > 0) {
            const best = candidates.reduce((a, b) => a.price < b.price ? a : b);
            promoPrice = best.price;
            discountPct = best.pct;
          } else {
            promoPrice = catalogPrice;
            discountPct = 0;
          }
        } else {
          // Existing customers: prefer scraper price, fallback to discounts table
          if (scraperPromo !== null) {
            promoPrice = scraperPromo;
            discountPct = scraperPct;
          } else if (tablePromo !== null) {
            promoPrice = tablePromo;
            discountPct = tablePct;
          } else {
            promoPrice = catalogPrice;
            discountPct = 0;
          }
        }

        row.brandPackagePrices[brandPackageKey] = {
          brandName: brand.name,
          packageName: pkg.name,
          category: pkg.category || "Inne",
          catalogPrice,
          promoPrice,
          discountPercentage: discountPct,
          hasDiscount: discountPct > 0,
        };
      });

      return Array.from(kcalMap.values()).sort((a, b) => a.kcal - b.kcal);
    },
  });
}
