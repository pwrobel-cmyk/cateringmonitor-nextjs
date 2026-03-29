import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export const useLastPositionCheck = (projectId: string | null) => {
  return useQuery<string | null>({
    queryKey: ['last-position-check', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const { data } = await supabase
        .from('position_checks')
        .select('checked_at')
        .eq('project_id', projectId)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.checked_at ?? null
    },
    enabled: !!projectId,
  })
}
