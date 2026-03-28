import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface TopWord {
  word: string;
  count: number;
}

export function useTopWords(
  brandId: string | null,
  ratingType: 'positive' | 'negative'
) {
  return useQuery({
    queryKey: ["top-words", brandId, ratingType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc("get_top_words_analysis", {
          filter_brand_id: brandId || null,
          rating_type: ratingType,
          limit_words: 10
        });

      if (error) throw error;

      return (data || []) as TopWord[];
    },
  });
}
