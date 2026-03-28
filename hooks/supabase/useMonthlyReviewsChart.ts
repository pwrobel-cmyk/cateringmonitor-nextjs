import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

interface MonthlyReviewData {
  month: string; // Format: MM/YY
  positive: number;
  negative: number;
  total: number;
}

interface ReviewRecord {
  review_date: string | null;
  rating: number | null;
  brand_id: string;
}

async function fetchAllReviewsForChart(
  selectedCountry: string,
  brandIds?: string[]
): Promise<ReviewRecord[]> {
  let allReviews: ReviewRecord[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("reviews")
      .select(`
        review_date,
        rating,
        brand_id,
        brands!inner (country)
      `)
      .eq("is_approved", true)
      .not("review_date", "is", null);

    if (selectedCountry === "Czechy") {
      query = query.eq("brands.country", "Czechy");
    } else {
      query = query.neq("brands.country", "Czechy");
    }

    if (brandIds && brandIds.length > 0) {
      query = query.in("brand_id", brandIds);
    }

    const { data, error } = await query
      .order("review_date", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allReviews = [...allReviews, ...data as unknown as ReviewRecord[]];

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allReviews;
}

export function useMonthlyReviewsChart(brandIds?: string[]) {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["monthly-reviews-chart", selectedCountry, brandIds],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      const data = await fetchAllReviewsForChart(selectedCountry, brandIds);

      const monthlyMap = new Map<string, { positive: number; negative: number }>();

      data.forEach((review) => {
        if (!review.review_date) return;

        const date = new Date(review.review_date);
        const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { positive: 0, negative: 0 });
        }

        const monthData = monthlyMap.get(monthKey)!;
        const rating = review.rating || 0;

        if (rating >= 4) {
          monthData.positive += 1;
        } else {
          monthData.negative += 1;
        }
      });

      const chartData: MonthlyReviewData[] = Array.from(monthlyMap.entries())
        .map(([month, counts]) => ({
          month,
          positive: counts.positive,
          negative: counts.negative,
          total: counts.positive + counts.negative,
        }))
        .sort((a, b) => {
          const [aMonth, aYear] = a.month.split('/').map(Number);
          const [bMonth, bYear] = b.month.split('/').map(Number);
          const aDate = new Date(2000 + aYear, aMonth - 1);
          const bDate = new Date(2000 + bYear, bMonth - 1);
          return aDate.getTime() - bDate.getTime();
        });

      return chartData;
    },
  });
}

export function useBrandsForFilter() {
  const { selectedCountry } = useCountry();

  return useQuery({
    queryKey: ["brands-for-reviews-filter", selectedCountry],
    queryFn: async () => {
      let query = supabase
        .from("brands")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");

      if (selectedCountry === "Czechy") {
        query = query.eq("country", "Czechy");
      } else {
        query = query.neq("country", "Czechy");
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    },
  });
}
