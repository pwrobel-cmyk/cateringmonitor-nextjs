'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useUserBrands() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignedBrandIds = [], isLoading } = useQuery({
    queryKey: ["user-brands", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any)
        .from("user_brand_assignments")
        .select("brand_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user brands:", error);
        throw error;
      }

      return (data || []).map((item: any) => item.brand_id);
    },
    enabled: !!user?.id,
  });

  const updateBrandsMutation = useMutation({
    mutationFn: async (brandIds: string[]) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error: deleteError } = await (supabase as any)
        .from("user_brand_assignments")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      if (brandIds.length > 0) {
        const assignments = brandIds.map((brandId) => ({
          user_id: user.id,
          brand_id: brandId,
        }));

        const { error: insertError } = await (supabase as any)
          .from("user_brand_assignments")
          .insert(assignments);

        if (insertError) throw insertError;
      }

      return brandIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-brands", user?.id] });
      toast.success("Przypisane marki zostały zaktualizowane");
    },
    onError: (error) => {
      console.error("Error updating user brands:", error);
      toast.error("Nie udało się zaktualizować przypisanych marek");
    },
  });

  return {
    assignedBrandIds,
    isLoading,
    updateBrands: updateBrandsMutation.mutate,
    isUpdating: updateBrandsMutation.isPending,
  };
}
