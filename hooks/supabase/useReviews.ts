import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export interface Review {
  id: string;
  brand_id: string;
  rating: number;
  content: string | null;
  author_name: string | null;
  source: string | null;
  review_date: string | null;
  created_at: string;
  is_approved: boolean;
  brands: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export function useReviews(
  page: number = 0,
  limit: number = 50,
  brandId?: string,
  rating?: number,
  sources?: string[]
) {
  const { selectedCountry } = useCountry();
  const from = page * limit;
  const to = from + limit - 1;

  return useQuery({
    queryKey: ["reviews", page, limit, brandId, rating, selectedCountry, sources],
    queryFn: async () => {
      let query = (supabase as any)
        .from("reviews")
        .select(`
          *,
          brands!inner (
            id,
            name,
            logo_url,
            country
          )
        `, { count: 'exact' })
        .eq("is_approved", true);

      if (selectedCountry === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      if (brandId) {
        query = query.eq("brand_id", brandId);
      }

      if (rating !== undefined) {
        query = query.eq("rating", rating);
      }

      if (sources && sources.length > 0) {
        const sourceMapping: Record<string, string[]> = {
          "Google Maps": ["Google Maps", "google_maps", "n8n_google_maps"],
          "Dietly": ["Dietly", "dietly"],
          "Trustpilot": ["Trustpilot", "trustpilot"],
        };
        const dbSources = sources.flatMap(s => sourceMapping[s] || [s]);
        query = query.in("source", dbSources);
      }

      const { data, error, count } = await query
        .order("review_date", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const total = count || 0;

      return {
        reviews: (data || []) as Review[],
        total,
        hasMore: count ? (to + 1) < count : false,
      };
    },
  });
}
