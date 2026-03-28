import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface UserPackagePair {
  id: string;
  user_id: string;
  name: string;
  package_ids: string[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export function useUserPackagePairs() {
  return useQuery({
    queryKey: ["user-package-pairs"],
    queryFn: async (): Promise<UserPackagePair[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .from("user_package_pairs")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreatePackagePair() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; package_ids: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Musisz być zalogowany aby zapisać parę");

      const { data: result, error } = await (supabase as any)
        .from("user_package_pairs")
        .insert({ user_id: user.id, name: data.name, package_ids: data.package_ids })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-package-pairs"] });
      toast.success("Para pakietów zapisana");
    },
    onError: () => {
      toast.error("Błąd podczas zapisywania");
    },
  });
}
