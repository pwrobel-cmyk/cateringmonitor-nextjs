import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export interface CalorieVariant {
  kcal: number;
  price: number | null;
  price_date: string | null;
  package_id: string;
}

export interface PackageWithDetails {
  id: string;
  name: string;
  description: string | null;
  meals_per_day: number | null;
  category: string | null;
  calorie_variants: CalorieVariant[];
  base_price: number | null;
  base_price_date: string | null;
}

export interface BrandWithPackages {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  packages: PackageWithDetails[];
}

export function useBrandsWithPackages(filterDate?: string) {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["brands-with-packages", filterDate, selectedCountry],
    queryFn: async (): Promise<BrandWithPackages[]> => {
      let query = (supabase as any)
        .from("brands")
        .select(`
          id,
          name,
          description,
          logo_url,
          website_url,
          packages!inner(
            id,
            name,
            description,
            meals_per_day,
            category,
            package_kcal_ranges!inner(
              id,
              kcal_range_id,
              kcal_ranges!inner(
                kcal_from,
                kcal_to,
                kcal_label
              )
            )
          )
        `)
        .eq("is_active", true)
        .eq("packages.is_active", true);

      if (selectedCountry === "Czechy") {
        query = query.eq("country", "Czechy");
      } else {
        query = query.neq("country", "Czechy");
      }

      const { data: brandsData, error: brandsError } = await query.order("name");

      if (brandsError) throw brandsError;
      if (!brandsData || brandsData.length === 0) return [];

      const packageIds = new Set<string>();
      const kcalRangeIds = new Set<string>();

      brandsData.forEach((brand: any) => {
        brand.packages?.forEach((pkg: any) => {
          packageIds.add(pkg.id);
          pkg.package_kcal_ranges?.forEach((pkr: any) => {
            kcalRangeIds.add(pkr.kcal_range_id);
          });
        });
      });

      let pricesData: any[] = [];

      if (filterDate) {
        const { data, error } = await supabase
          .from("price_history")
          .select(`
            price,
            promotional_price,
            discount_percentage,
            date_recorded,
            package_kcal_ranges!price_history_package_kcal_range_id_fkey!inner (
              package_id,
              kcal_range_id
            )
          `)
          .eq("date_recorded", filterDate)
          .order("date_recorded", { ascending: false })
          .limit(5000);

        if (!error) pricesData = data || [];
      } else {
        // Najpierw znajdź ostatnią dostępną datę w bazie
        const { data: latestDateData } = await supabase
          .from("price_history")
          .select("date_recorded")
          .order("date_recorded", { ascending: false })
          .limit(1);

        const latestDate = latestDateData?.[0]?.date_recorded;

        if (!latestDate) {
          pricesData = [];
        } else {
          // Pobierz ceny z ostatnich 3 dni względem ostatniej dostępnej daty
          const latestDateObj = new Date(latestDate);
          const threeDaysBefore = new Date(latestDateObj);
          threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
          const dateStr = threeDaysBefore.toISOString().split('T')[0];

          const { data, error } = await supabase
            .from("price_history")
            .select(`
              price,
              promotional_price,
              discount_percentage,
              date_recorded,
              package_kcal_ranges!price_history_package_kcal_range_id_fkey!inner (
                package_id,
                kcal_range_id
              )
            `)
            .gte("date_recorded", dateStr)
            .order("date_recorded", { ascending: false })
            .limit(5000);

          if (!error) pricesData = data || [];
        }
      }

      const priceMap = new Map<string, { price: number; date_recorded: string; promotional_price?: number; discount_percentage?: number }>();
      pricesData?.forEach((priceRecord: any) => {
        const packageId = priceRecord.package_kcal_ranges?.package_id;
        const kcalRangeId = priceRecord.package_kcal_ranges?.kcal_range_id;
        if (!packageId || !kcalRangeId) return;

        const key = `${packageId}_${kcalRangeId}`;
        if (!priceMap.has(key)) {
          priceMap.set(key, {
            price: priceRecord.price,
            date_recorded: priceRecord.date_recorded,
            promotional_price: priceRecord.promotional_price,
            discount_percentage: priceRecord.discount_percentage
          });
        }
      });

      const brandsWithPackages: BrandWithPackages[] = brandsData.map((brand: any) => {
        const packagesWithDetails: PackageWithDetails[] = (brand.packages || []).map((pkg: any) => {
          const validKcalRanges = pkg.package_kcal_ranges || [];

          const exactMatches: { pkr: any; kcal: number }[] = [];
          const rangeMatches: { pkr: any; kcal: number }[] = [];

          validKcalRanges.forEach((pkr: any) => {
            const kcalRanges = pkr.kcal_ranges;
            const isExact = kcalRanges?.kcal_from === kcalRanges?.kcal_to;
            const kcalValue = isExact
              ? kcalRanges.kcal_from
              : Math.round((kcalRanges.kcal_from + kcalRanges.kcal_to) / 2);

            if (isExact) {
              exactMatches.push({ pkr, kcal: kcalValue });
            } else {
              rangeMatches.push({ pkr, kcal: kcalValue });
            }
          });

          const coveredKcals = new Set(exactMatches.map(m => m.kcal));
          const allMatches = [
            ...exactMatches,
            ...rangeMatches.filter(m => !coveredKcals.has(m.kcal))
          ];

          const calorieVariants: CalorieVariant[] = allMatches.map(({ pkr, kcal }) => {
            const priceKey = `${pkg.id}_${pkr.kcal_range_id}`;
            const priceInfo = priceMap.get(priceKey);

            return {
              kcal,
              price: priceInfo?.price || null,
              price_date: priceInfo?.date_recorded || null,
              package_id: pkg.id
            };
          });

          calorieVariants.sort((a, b) => a.kcal - b.kcal);

          const uniqueVariants = new Map<number, CalorieVariant>();
          calorieVariants.forEach(variant => {
            const existing = uniqueVariants.get(variant.kcal);
            if (!existing) {
              uniqueVariants.set(variant.kcal, variant);
            } else if (variant.price !== null && existing.price === null) {
              uniqueVariants.set(variant.kcal, variant);
            } else if (variant.price !== null && existing.price !== null && variant.price_date && existing.price_date) {
              if (variant.price_date > existing.price_date) {
                uniqueVariants.set(variant.kcal, variant);
              }
            }
          });

          const finalVariants = Array.from(uniqueVariants.values()).sort((a, b) => a.kcal - b.kcal);
          const basePriceVariant = finalVariants.find(v => v.price !== null);

          return {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            meals_per_day: pkg.meals_per_day,
            category: pkg.category,
            calorie_variants: finalVariants,
            base_price: basePriceVariant?.price || null,
            base_price_date: basePriceVariant?.price_date || null
          };
        });

        return {
          id: brand.id,
          name: brand.name,
          description: brand.description,
          logo_url: brand.logo_url,
          website_url: brand.website_url,
          packages: packagesWithDetails
        };
      });

      return brandsWithPackages;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
