import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface AspectData {
  aspect: string;
  mentions: number;
  positive: number;
  negative: number;
}

export const ASPECT_KEYWORDS: Record<string, string[]> = {
  smak: ['smak', 'smaczn', 'pyszn', 'delicious', 'tasty', 'smaczne', 'pyszne', 'smaczny'],
  dostawa: ['dostaw', 'delivery', 'kurier', 'przesyłk', 'transport'],
  cena: ['cen', 'drogie', 'tanie', 'price', 'kosztuj', 'drogo', 'tanio', 'koszty'],
  jakość: ['jakość', 'jakośc', 'quality', 'jakości'],
  obsługa: ['obsług', 'kontakt', 'support', 'customer', 'klient'],
  porcje: ['porcj', 'ilość', 'portion', 'wielkość', 'ilości'],
};

async function fetchAllReviews(brandId: string) {
  const allReviews: Array<{ content: string | null; rating: number | null }> = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('reviews')
      .select('content, rating')
      .eq('brand_id', brandId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allReviews.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allReviews;
}

export function analyzeAspects(reviews: Array<{ content: string | null; rating: number | null }>): AspectData[] {
  const results: Record<string, { total: number; positive: number; negative: number }> = {};

  // Initialize results for each aspect
  Object.keys(ASPECT_KEYWORDS).forEach(aspect => {
    results[aspect] = { total: 0, positive: 0, negative: 0 };
  });

  reviews.forEach(review => {
    if (!review.content) return;
    
    const contentLower = review.content.toLowerCase();
    const rating = review.rating;

    Object.entries(ASPECT_KEYWORDS).forEach(([aspect, keywords]) => {
      const hasKeyword = keywords.some(keyword => contentLower.includes(keyword));
      
      if (hasKeyword) {
        results[aspect].total++;
        if (rating !== null) {
          if (rating >= 4) {
            results[aspect].positive++;
          } else if (rating <= 2) {
            results[aspect].negative++;
          }
        }
      }
    });
  });

  // Convert to AspectData array and calculate percentages
  return Object.entries(results)
    .map(([aspect, data]) => ({
      aspect,
      mentions: data.total,
      positive: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0,
      negative: data.total > 0 ? Math.round((data.negative / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.mentions - a.mentions);
}

export function useReviewAspects(brandId: string | undefined) {
  return useQuery({
    queryKey: ['review-aspects', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const reviews = await fetchAllReviews(brandId);
      return analyzeAspects(reviews);
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
