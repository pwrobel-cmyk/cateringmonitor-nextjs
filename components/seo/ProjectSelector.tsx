'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

interface Project { id: string; name: string; domain: string }

interface ProjectSelectorProps {
  selectedProject: string | null
  onProjectChange: (id: string | null) => void
}

export function ProjectSelector({ selectedProject, onProjectChange }: ProjectSelectorProps) {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['user-projects'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('projects').select('id, name, domain').order('name')
      return data || []
    },
  })

  return (
    <Select value={selectedProject || ''} onValueChange={onProjectChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Wybierz projekt" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
