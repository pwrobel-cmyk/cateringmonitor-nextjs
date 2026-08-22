'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LayoutGrid, RefreshCw } from 'lucide-react'
import { MenuChangesTimeline } from '@/components/market-offer/MenuChangesTimeline'
import { GapMatrix } from '@/components/market-offer/GapMatrix'

export default function MarketOfferPage() {
  const [activeTab, setActiveTab] = useState('timeline')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutGrid className="h-6 w-6" />
          Oferta Rynku
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitoring zmian w menu konkurencji i analiza luk ofertowych
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="timeline">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Zmiany w menu
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Macierz luk ofertowych
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          <MenuChangesTimeline />
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4 mt-4">
          <GapMatrix />
        </TabsContent>
      </Tabs>
    </div>
  )
}
