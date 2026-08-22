'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { useMenuChanges, type MenuChangeEvent } from '@/hooks/supabase/useMenuChanges'
import { DIET_TYPES } from '@/lib/dietClassification'

export function MenuChangesTimeline() {
  const { data, isLoading } = useMenuChanges()
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [dietFilter, setDietFilter] = useState<string>('all')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(50)

  const brands = useMemo(() => {
    if (!data) return []
    const set = new Set(data.events.map(e => e.brandName))
    return Array.from(set).sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.events.filter(e => {
      if (brandFilter !== 'all' && e.brandName !== brandFilter) return false
      if (dietFilter !== 'all' && !e.dietTags.includes(dietFilter)) return false
      if (eventFilter === 'new' && e.eventType !== 'new') return false
      if (eventFilter === 'removed' && e.eventType !== 'removed') return false
      return true
    })
  }, [data, brandFilter, dietFilter, eventFilter])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Marka</span>
              <Select value={brandFilter} onValueChange={(v) => v && setBrandFilter(v)}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie marki</SelectItem>
                  {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Typ diety</span>
              <Select value={dietFilter} onValueChange={(v) => v && setDietFilter(v)}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie diety</SelectItem>
                  {DIET_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={eventFilter} onValueChange={setEventFilter}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3">Wszystkie</TabsTrigger>
                <TabsTrigger value="new" className="text-xs px-3">Nowości</TabsTrigger>
                <TabsTrigger value="removed" className="text-xs px-3">Wycofane</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} zdarzeń</span>
          </div>
        </CardContent>
      </Card>

      {/* Info banner */}
      {data.globalOldest && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            Monitoring zmian w menu aktywny od <span className="font-medium text-foreground">{data.globalOldest}</span>. Nowości i wycofania pakietów pojawiają się tutaj wraz ze zmianami na rynku.
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline zmian menu</CardTitle>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {filtered.length === 0 && data.events.length === 0
                ? 'Brak zarejestrowanych zmian w menu od rozpoczęcia monitoringu.'
                : 'Brak wyników dla wybranych filtrów.'}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((event, idx) => (
                <TimelineRow key={`${event.packageId}-${event.eventType}-${idx}`} event={event} />
              ))}
            </div>
          )}
          {filtered.length > visibleCount && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(c => c + 50)}>
                <ChevronDown className="h-4 w-4 mr-1" />Pokaż więcej ({filtered.length - visibleCount} pozostało)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TimelineRow({ event }: { event: MenuChangeEvent }) {
  const isNew = event.eventType === 'new'
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors">
      <span className="text-xs text-muted-foreground w-[72px] shrink-0 tabular-nums">{event.eventDate}</span>
      <div className="flex items-center gap-2 shrink-0 w-[140px]">
        {event.brandLogo ? (
          <img src={event.brandLogo} alt="" className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
            {event.brandName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-medium truncate">{event.brandName}</span>
      </div>
      <span className="text-sm flex-1 truncate" title={event.packageName}>{event.packageName}</span>
      <div className="flex gap-1 shrink-0">
        {event.dietTags.filter(t => t !== 'Inne').slice(0, 2).map(tag => (
          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
        ))}
      </div>
      <Badge
        className={`text-[10px] px-1.5 py-0 shrink-0 ${isNew
          ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
          : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
        }`}
      >
        {isNew ? <><TrendingUp className="h-3 w-3 mr-0.5" />NOWOŚĆ</> : <><TrendingDown className="h-3 w-3 mr-0.5" />WYCOFANY</>}
      </Badge>
      <span className="text-[10px] text-muted-foreground shrink-0 w-[110px] text-right">
        {event.kcalCount} kcal · {event.minPrice.toFixed(0)}–{event.maxPrice.toFixed(0)} zł
      </span>
    </div>
  )
}
