import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'user';

export function useUserRole() {
  const { user } = useAuth();

  return useQuery<AppRole | null>({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        return 'user';
      }

      return (data?.role as AppRole) || 'user';
    },
    enabled: !!user,
  });
}
