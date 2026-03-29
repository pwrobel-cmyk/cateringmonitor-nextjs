'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectSelector } from '@/components/seo/ProjectSelector'
import { KeywordsList } from '@/components/keywords/KeywordsList'
import { Clock } from 'lucide-react'
import { KPICards } from '@/components/positions-v2/KPICards'
import { HeroChart } from '@/components/positions-v2/HeroChart'
import { SmartInsightsPanel } from '@/components/positions-v2/SmartInsightsPanel'
import { KeywordsDataTable } from '@/components/positions-v2/KeywordsDataTable'
import { CompetitorSidebar } from '@/components/positions-v2/CompetitorSidebar'
import { PositionHeatmap } from '@/components/positions-v2/PositionHeatmap'
import { ForecastCards } from '@/components/positions-v2/ForecastCards'
import { KeywordClustersView } from '@/components/keywords/KeywordClustersView'
import { KeywordCompetition } from '@/components/keywords/KeywordCompetition'
import { useLastPositionCheck } from '@/hooks/useLastPositionCheck'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { usePackageAccess } from '@/hooks/usePackageAccess'
import { UpgradePrompt } from '@/components/upgrade/UpgradePrompt'
import { FeatureAccessGate } from '@/components/upgrade/FeatureAccessGate'

const SEO = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [timeRange] = useState<7 | 14 | 30 | 90>(30)
  const { data: lastCheck, isLoading: isLoadingLastCheck } = useLastPositionCheck(selectedProject)
  const { needsUpgrade, upgradeTarget, userType } = usePackageAccess()

  const { data: projects } = useQuery({
    queryKey: ['user-projects'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()

      const ntfyResult: any = await (supabase as any)
        .from('projects')
        .select('id, name, domain')
        .eq('name', 'NTFY')
        .maybeSingle()

      const ntfyProject = ntfyResult.data ? [ntfyResult.data] : []

      if (!user) return ntfyProject

      const userResult: any = await (supabase as any)
        .from('projects')
        .select('id, name, domain')
        .eq('owner_id', user.id)
        .neq('name', 'NTFY')
        .order('name')

      return [...ntfyProject, ...(userResult.data || [])]
    },
  })

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProject) {
      const ntfyProject = projects.find((p: any) => p.name === 'NTFY')
      if (ntfyProject) setSelectedProject(ntfyProject.id)
    }
  }, [projects, selectedProject])

  return (
    <FeatureAccessGate
      feature="seo"
      title="SEO wymaga planu Pro"
      description="Monitoruj pozycje słów kluczowych, analizuj konkurencję i optymalizuj swoją widoczność."
    >
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
            SEO
          </h1>
          <p className="text-muted-foreground">Zarządzanie słowami kluczowymi i monitorowanie pozycji</p>
        </div>

        <ProjectSelector
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
        />

        {needsUpgrade('seo') ? (
          <div className="flex justify-center py-12 mt-8">
            <div className="w-full max-w-2xl">
              <UpgradePrompt
                feature="seo"
                currentPackage={userType}
                targetPackage={upgradeTarget('seo')}
              />
            </div>
          </div>
        ) : (
          <Tabs defaultValue="pozycje" className="mt-8">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="pozycje">Pozycje</TabsTrigger>
              <TabsTrigger value="keywords">Keywords</TabsTrigger>
            </TabsList>

            <TabsContent value="pozycje" className="space-y-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Monitoring Pozycji</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {isLoadingLastCheck ? (
                    <span>Ładowanie...</span>
                  ) : lastCheck ? (
                    <span>Ostatnia aktualizacja: {format(new Date(lastCheck), 'd MMM yyyy, HH:mm', { locale: pl })}</span>
                  ) : (
                    <span>Brak danych</span>
                  )}
                </div>
              </div>

              <KPICards projectId={selectedProject} timeRange={timeRange} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <HeroChart projectId={selectedProject} timeRange={timeRange} />
                </div>
                <div>
                  <SmartInsightsPanel projectId={selectedProject} timeRange={timeRange} />
                </div>
              </div>

              <KeywordsDataTable projectId={selectedProject} timeRange={timeRange} />
              <CompetitorSidebar projectId={selectedProject} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PositionHeatmap projectId={selectedProject} />
                <ForecastCards projectId={selectedProject} />
              </div>

              <KeywordClustersView projectId={selectedProject} />
              <KeywordCompetition projectId={selectedProject} />
            </TabsContent>

            <TabsContent value="keywords" className="space-y-8">
              <KeywordsList projectId={selectedProject} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </FeatureAccessGate>
  )
}

export default SEO
