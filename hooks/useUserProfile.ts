'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserProfile {
  id: string;
  user_id: string;
  type: string;
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  company_name: string | null;
  nip: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  created_at: string | null;
  updated_at: string | null;
  trial_ends_at: string | null;
}

export function useUserProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data as unknown as UserProfile;
    },
    enabled: !!user?.id,
  });
}
