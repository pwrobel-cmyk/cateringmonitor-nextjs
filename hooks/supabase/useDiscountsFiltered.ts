'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { matchesCustomerType, overlapsRange } from "@/lib/discounts";
import { useCountry } from "@/contexts/CountryContext";
import { useUserBrands } from "../useUserBrands";

interface DiscountsFilteredParams {
  dateFrom: Date;
  dateTo: Date;
  brandNames?: string[];
  customerType?: "existing" | "new";
}

interface Discount {
  id: string;
  percentage: number;
  valid_from: string;
  valid_until: string | null;
  requirements: string | null;
  brands: {
    id: string;
    name: string;
  };
}

export function useDiscountsFiltered({
  dateFrom,
  dateTo,
  brandNames,
  customerType,
}: DiscountsFilteredParams) {
  const { selectedCountry } = useCountry();
  const { assignedBrandIds } = useUserBrands();

  return useQuery({
    queryKey: ["discounts-filtered", dateFrom, dateTo, brandNames, customerType, selectedCountry, assignedBrandIds],
    queryFn: async () => {
      if (assignedBrandIds.length === 0) {
        return { discounts: [], brands: [] };
      }

      const dateFromStr = dateFrom.toISOString().split("T")[0];
      const dateToStr = dateTo.toISOString();

      let query: any = supabase
        .from("discounts")
        .select(`
          id,
          percentage,
          valid_from,
          valid_until,
          requirements,
          brand_id,
          brands!inner(
            id,
            name,
            country
          )
        `)
        .in("brand_id", assignedBrandIds)
        .eq("is_active", true)
        .lte("valid_from", dateToStr)
        .or(`valid_until.gte.${dateFromStr},valid_until.is.null`);

      if (selectedCountry === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      if (brandNames && brandNames.length > 0) {
        query = query.in("brands.name", brandNames);
      }

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data || []).filter((discount: Discount) => {
        if (customerType && !matchesCustomerType(discount.requirements, customerType)) {
          return false;
        }
        if (!overlapsRange(discount.valid_from, discount.valid_until, dateFromStr, dateToStr)) {
          return false;
        }
        return true;
      });

      const brands = Array.from(new Set(filtered.map((d: Discount) => d.brands.name)));

      return { discounts: filtered, brands };
    },
  });
}
