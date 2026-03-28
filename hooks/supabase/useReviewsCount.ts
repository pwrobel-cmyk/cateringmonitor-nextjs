import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export const useReviewsCount = () => {
  return useQuery({
    queryKey: ["reviews-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", true);

      if (error) throw error;
      return count || 0;
    },
  });
};
