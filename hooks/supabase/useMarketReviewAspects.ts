import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface AspectData {
  aspect: string;
  mentions: number;
  positive: number;
  negative: number;
}

const ASPECT_KEYWORDS: Record<string, string[]> = {
  smak: ['smak', 'smaczn', 'pyszn', 'delicious', 'tasty', 'smaczne', 'pyszne', 'smaczny'],
  dostawa: ['dostaw', 'delivery', 'kurier', 'przesyłk', 'transport'],
  cena: ['cen', 'drogie', 'tanie', 'price', 'kosztuj', 'drogo', 'tanio', 'koszty'],
  jakość: ['jakość', 'jakośc', 'quality', 'jakości'],
  obsługa: ['obsług', 'kontakt', 'support', 'customer', 'klient'],
  porcje: ['porcj', 'ilość', 'portion', 'wielkość', 'ilości'],
};

async function fetchAllPolishReviews() {
  // Try RPC first
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_market_average_parameters')
  if (!rpcError && rpcData) return rpcData as Array<{ content: string | null; rating: number | null; brand_id: string }>

  // Fallback: last 3000 reviews for Polish brands
  const { data: polishBrands } = await supabase
    .from('brands')
    .select('id')
    .neq('country', 'Czechy')

  const polishBrandIds = (polishBrands || []).map(b => b.id)
  if (polishBrandIds.length === 0) return []

  const { data, error } = await supabase
    .from('reviews')
    .select('content, rating, brand_id')
    .in('brand_id', polishBrandIds)
    .eq('is_approved', true)
    .order('review_date', { ascending: false })
    .limit(3000)

  if (error) throw error
  return data || []
}

function analyzeAspects(reviews: Array<{ content: string | null; rating: number | null }>): AspectData[] {
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

export function useMarketReviewAspects() {
  return useQuery({
    queryKey: ['market-review-aspects'],
    queryFn: async () => {
      const reviews = await fetchAllPolishReviews();
      return analyzeAspects(reviews);
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
