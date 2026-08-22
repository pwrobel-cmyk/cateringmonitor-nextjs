'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useCountry } from '@/contexts/CountryContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Package, Tags, Ruler, UtensilsCrossed, AlertTriangle, BarChart3, TrendingUp, Sparkles, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { classifyDiet, isTestPackage, toKcalBucket, KCAL_BUCKETS, kcalBucketLabel, DIET_TYPES } from '@/lib/dietClassification'
import { format } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────

interface LifecycleRow {
  package_id: string; package_name: string; brand_name: string; brand_logo: string | null
  country: string; first_seen: string; last_seen: string; kcal_count: number
  min_price: number; max_price: number
}

interface ActivePriceRow {
  package_id: string; package_name: string; brand_name: string; brand_logo: string | null
  country: string; kcal_from: number; kcal_to: number; price: number
}

interface ProcessedData {
  // KPI
  activeCount: number; activeDelta30: number; totalBrands: number
  dietTagCount: number; classifiedPct: number
  kcalBucketCount: number; kcalRange: string
  mealsMin: number; mealsMax: number; mealsMedian: number
  globalOldest: string

  // Section 1 — Gap table
  gapTable: { diet: string; counts: Record<number, number>; totalBrands: number }[]
  gapOtherRow: { dietCount: number; counts: Record<number, { min: number; max: number }>; totalBrands: { min: number; max: number } } | null
  gapInsight: string

  // Section 2 — Range analysis
  rangeTable: { diet: string; avgKcalRanges: number; pct2500plus: number; avgMeals: number }[]
  rangeInsights: string[]

  // Section 3 — Momentum
  momentumTable: { diet: string; brandsNow: number; brands6m: number; changePct: number }[]
  momentumInsights: string[]

  // Section 4 — New & removed
  newPackages: { name: string; brand: string; diet: string; kcalCount: number; meals: number | null }[]
  removedPackages: { name: string; brand: string; diet: string; kcalCount: number; meals: number | null }[]
  totalNew: number; totalRemoved: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

// ── Data processing ─────────────────────────────────────────────────────────────

function processData(
  lifecycle: LifecycleRow[],
  activePrices: ActivePriceRow[],
  mealsMap: Map<string, number | null>,
  country: string,
): ProcessedData {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const d7 = format(new Date(today.getTime() - 7 * 86400000), 'yyyy-MM-dd')
  const d30 = format(new Date(today.getTime() - 30 * 86400000), 'yyyy-MM-dd')
  const d37 = format(new Date(today.getTime() - 37 * 86400000), 'yyyy-MM-dd')
  const d180 = format(new Date(today.getTime() - 180 * 86400000), 'yyyy-MM-dd')

  // Filter by country & test
  const lc = lifecycle.filter(r => {
    if (country === 'Czechy') return r.country === 'Czechy'
    return r.country !== 'Czechy'
  }).filter(r => !isTestPackage(r.package_name))

  const ap = activePrices.filter(r => {
    if (country === 'Czechy') return r.country === 'Czechy'
    return r.country !== 'Czechy'
  }).filter(r => !isTestPackage(r.package_name))

  // Active = last_seen >= d7
  const active = lc.filter(r => r.last_seen >= d7)
  const active30ago = lc.filter(r => r.first_seen <= d30 && r.last_seen >= d30)

  // Global oldest
  let globalOldest = '9999-12-31'
  for (const r of lc) { if (r.first_seen < globalOldest) globalOldest = r.first_seen }
  const globalThreshold = format(new Date(new Date(globalOldest).getTime() + 3 * 86400000), 'yyyy-MM-dd')

  // ── KPI ──
  const activeBrands = new Set(active.map(r => r.brand_name))
  const activeDietTags = new Set<string>()
  let classifiedCount = 0
  for (const r of active) {
    const tags = classifyDiet(r.package_name)
    for (const t of tags) activeDietTags.add(t)
    if (!(tags.length === 1 && tags[0] === 'Inne')) classifiedCount++
  }
  activeDietTags.delete('Inne')

  const activeKcalBuckets = new Set<number>()
  for (const r of ap) activeKcalBuckets.add(toKcalBucket(r.kcal_from, r.kcal_to))

  const mealValues = active.map(r => mealsMap.get(r.package_id)).filter((v): v is number => v != null && v > 0)

  // ── Section 1: Gap table ──
  // Build diet → kcal_bucket → Set<brand> from active prices
  const gapData = new Map<string, Map<number, Set<string>>>()
  for (const r of ap) {
    const tags = classifyDiet(r.package_name)
    const bucket = toKcalBucket(r.kcal_from, r.kcal_to)
    for (const tag of tags) {
      if (!gapData.has(tag)) gapData.set(tag, new Map())
      const bucketMap = gapData.get(tag)!
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, new Set())
      bucketMap.get(bucket)!.add(r.brand_name)
    }
  }

  // Sort diets by total brands, take top 10
  const dietTotals = Array.from(gapData.entries())
    .filter(([dt]) => dt !== 'Inne')
    .map(([dt, buckets]) => {
      const allBrands = new Set<string>()
      for (const s of buckets.values()) for (const b of s) allBrands.add(b)
      return { diet: dt, buckets, totalBrands: allBrands.size }
    })
    .sort((a, b) => b.totalBrands - a.totalBrands)

  const top10 = dietTotals.slice(0, 10)
  const others = dietTotals.slice(10)

  const gapTable = top10.map(d => {
    const counts: Record<number, number> = {}
    for (const kb of KCAL_BUCKETS) counts[kb] = d.buckets.get(kb)?.size ?? 0
    return { diet: d.diet, counts, totalBrands: d.totalBrands }
  })

  let gapOtherRow: ProcessedData['gapOtherRow'] = null
  if (others.length > 0) {
    const otherCounts: Record<number, { min: number; max: number }> = {}
    for (const kb of KCAL_BUCKETS) {
      const vals = others.map(d => d.buckets.get(kb)?.size ?? 0)
      otherCounts[kb] = { min: Math.min(...vals), max: Math.max(...vals) }
    }
    const otherTotals = others.map(d => d.totalBrands)
    gapOtherRow = {
      dietCount: others.length,
      counts: otherCounts,
      totalBrands: { min: Math.min(...otherTotals), max: Math.max(...otherTotals) },
    }
  }

  // Gap insight: diets with red/gray in buckets where others have green
  const greenBuckets = new Set<number>()
  for (const row of gapTable) {
    for (const kb of KCAL_BUCKETS) { if (row.counts[kb] >= 10) greenBuckets.add(kb) }
  }
  const gapCandidates: string[] = []
  for (const row of gapTable) {
    const weakBuckets = KCAL_BUCKETS.filter(kb => greenBuckets.has(kb) && row.counts[kb] <= 4 && row.counts[kb] >= 0)
    if (weakBuckets.length > 0) {
      const range = weakBuckets.length === 1
        ? `${kcalBucketLabel(weakBuckets[0])} kcal`
        : `${kcalBucketLabel(weakBuckets[0])}–${kcalBucketLabel(weakBuckets[weakBuckets.length - 1])} kcal`
      gapCandidates.push(`${row.diet} (${range})`)
    }
  }
  const gapInsight = gapCandidates.length > 0
    ? `Największe luki: ${gapCandidates.slice(0, 4).join(', ')}`
    : ''

  // ── Section 2: Range analysis ──
  // Per diet: avg kcal ranges per package, % with 2500+, avg meals
  const top7diets = dietTotals.slice(0, 7)
  const rangeTable = top7diets.map(d => {
    // Get active packages in this diet
    const dietPackages = new Map<string, { kcalBuckets: Set<number>; brand: string }>()
    for (const r of ap) {
      const tags = classifyDiet(r.package_name)
      if (!tags.includes(d.diet)) continue
      const bucket = toKcalBucket(r.kcal_from, r.kcal_to)
      if (!dietPackages.has(r.package_id)) {
        dietPackages.set(r.package_id, { kcalBuckets: new Set(), brand: r.brand_name })
      }
      dietPackages.get(r.package_id)!.kcalBuckets.add(bucket)
    }

    const kcalCounts = Array.from(dietPackages.values()).map(p => p.kcalBuckets.size)
    const avgKcalRanges = kcalCounts.length > 0 ? kcalCounts.reduce((a, b) => a + b, 0) / kcalCounts.length : 0

    // % brands with 2500+ kcal bucket
    const brandsAll = new Set(Array.from(dietPackages.values()).map(p => p.brand))
    const brandsWith2500 = new Set<string>()
    for (const [, p] of dietPackages) {
      for (const kb of p.kcalBuckets) { if (kb >= 2500) brandsWith2500.add(p.brand) }
    }
    const pct2500plus = brandsAll.size > 0 ? (brandsWith2500.size / brandsAll.size) * 100 : 0

    // Avg meals
    const meals = Array.from(dietPackages.keys())
      .map(pid => mealsMap.get(pid))
      .filter((v): v is number => v != null && v > 0)
    const avgMeals = meals.length > 0 ? meals.reduce((a, b) => a + b, 0) / meals.length : 0

    return { diet: d.diet, avgKcalRanges: Math.round(avgKcalRanges * 10) / 10, pct2500plus: Math.round(pct2500plus), avgMeals: Math.round(avgMeals * 10) / 10 }
  })

  const rangeInsights: string[] = []
  const byRange = [...rangeTable].sort((a, b) => b.avgKcalRanges - a.avgKcalRanges)
  if (byRange.length >= 2) rangeInsights.push(`Najszersze zakresy kcal: ${byRange[0].diet} (śr. ${byRange[0].avgKcalRanges}) i ${byRange[1].diet} (śr. ${byRange[1].avgKcalRanges})`)
  const by2500 = [...rangeTable].sort((a, b) => b.pct2500plus - a.pct2500plus)
  if (by2500.length > 0 && by2500[0].pct2500plus > 0) rangeInsights.push(`Najwyższa dostępność 2500+ kcal: ${by2500[0].diet} (${by2500[0].pct2500plus}% marek)`)
  const byRangeAsc = [...rangeTable].sort((a, b) => a.avgKcalRanges - b.avgKcalRanges)
  if (byRangeAsc.length > 0 && byRangeAsc[0].avgKcalRanges < byRange[0]?.avgKcalRanges) rangeInsights.push(`Najmniejszy wybór: ${byRangeAsc[0].diet} (śr. ${byRangeAsc[0].avgKcalRanges} zakresów)`)

  // ── Section 3: Momentum ──
  // Brands today vs 6 months ago per diet
  const dietBrandsNow = new Map<string, Set<string>>()
  const dietBrands6m = new Map<string, Set<string>>()
  for (const r of lc) {
    const tags = classifyDiet(r.package_name)
    for (const tag of tags) {
      if (tag === 'Inne') continue
      // Now: active
      if (r.last_seen >= d7) {
        if (!dietBrandsNow.has(tag)) dietBrandsNow.set(tag, new Set())
        dietBrandsNow.get(tag)!.add(r.brand_name)
      }
      // 6M ago: first_seen <= d180 AND last_seen >= d180
      if (r.first_seen <= d180 && r.last_seen >= d180) {
        if (!dietBrands6m.has(tag)) dietBrands6m.set(tag, new Set())
        dietBrands6m.get(tag)!.add(r.brand_name)
      }
    }
  }

  const momentumTable = Array.from(dietBrandsNow.entries())
    .map(([diet, brandsNow]) => {
      const brands6m = dietBrands6m.get(diet)?.size ?? 0
      const now = brandsNow.size
      const changePct = brands6m > 0 ? ((now - brands6m) / brands6m) * 100 : (now > 0 ? 100 : 0)
      return { diet, brandsNow: now, brands6m, changePct: Math.round(changePct) }
    })
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 8)

  const momentumInsights: string[] = []
  const growing = momentumTable.filter(m => m.changePct > 5)
  const declining = momentumTable.filter(m => m.changePct < -5)
  if (growing.length > 0) momentumInsights.push(`Najszybciej rosnące: ${growing.slice(0, 3).map(m => `${m.diet} (+${m.changePct}%)`).join(', ')}`)
  if (declining.length > 0) momentumInsights.push(`Kategorie tracące: ${declining.map(m => `${m.diet} (${m.changePct}%)`).join(', ')}`)

  // ── Section 4: New & removed ──
  const d30ago = format(new Date(today.getTime() - 30 * 86400000), 'yyyy-MM-dd')
  const allNew = lc.filter(r => r.first_seen > globalThreshold && r.first_seen >= d30ago)
  const allRemoved = lc.filter(r => r.last_seen >= d37 && r.last_seen < d7)

  const mapPkg = (r: LifecycleRow) => ({
    name: r.package_name, brand: r.brand_name,
    diet: classifyDiet(r.package_name).filter(t => t !== 'Inne')[0] || 'Inne',
    kcalCount: Number(r.kcal_count),
    meals: mealsMap.get(r.package_id) ?? null,
  })

  return {
    activeCount: active.length,
    activeDelta30: active.length - active30ago.length,
    totalBrands: activeBrands.size,
    dietTagCount: activeDietTags.size,
    classifiedPct: active.length > 0 ? Math.round((classifiedCount / active.length) * 100) : 0,
    kcalBucketCount: activeKcalBuckets.size,
    kcalRange: activeKcalBuckets.size > 0
      ? `${Math.min(...activeKcalBuckets)}–${kcalBucketLabel(Math.max(...activeKcalBuckets) as any)} kcal`
      : '—',
    mealsMin: mealValues.length > 0 ? Math.min(...mealValues) : 0,
    mealsMax: mealValues.length > 0 ? Math.max(...mealValues) : 0,
    mealsMedian: medianOf(mealValues),
    globalOldest,
    gapTable, gapOtherRow, gapInsight,
    rangeTable, rangeInsights,
    momentumTable, momentumInsights,
    newPackages: allNew.sort((a, b) => b.first_seen.localeCompare(a.first_seen)).slice(0, 5).map(mapPkg),
    removedPackages: allRemoved.sort((a, b) => b.last_seen.localeCompare(a.last_seen)).slice(0, 5).map(mapPkg),
    totalNew: allNew.length, totalRemoved: allRemoved.length,
  }
}

// ── Gap cell color ──────────────────────────────────────────────────────────────

function gapCellStyle(count: number): { bg: string; text: string } {
  if (count >= 10) return { bg: '#dcfce7', text: '#166534' }
  if (count >= 5) return { bg: '#fef9c3', text: '#854d0e' }
  if (count >= 1) return { bg: '#fee2e2', text: '#991b1b' }
  return { bg: '#f3f4f6', text: '#9ca3af' }
}

// ── Component ───────────────────────────────────────────────────────────────────

export function MarketDashboard() {
  const { selectedCountry } = useCountry()

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['market-dashboard', selectedCountry],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [lcRes, apRes, mealsRes] = await Promise.all([
        (supabase as any).rpc('get_package_lifecycle'),
        (supabase as any).rpc('get_active_package_prices'),
        (supabase as any).from('packages').select('id, meals_per_day').limit(2000),
      ])
      if (lcRes.error) throw lcRes.error
      if (apRes.error) throw apRes.error
      return {
        lifecycle: (lcRes.data ?? []) as LifecycleRow[],
        activePrices: (apRes.data ?? []) as ActivePriceRow[],
        meals: (mealsRes.data ?? []) as { id: string; meals_per_day: number | null }[],
      }
    },
  })

  const data = useMemo(() => {
    if (!rawData) return null
    const mealsMap = new Map(rawData.meals.map(m => [m.id, m.meals_per_day]))
    return processData(rawData.lifecycle, rawData.activePrices, mealsMap, selectedCountry)
  }, [rawData, selectedCountry])

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Oferta — gap, zakresy, potencjał</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Pełny obraz oferty rynkowej diet pudełkowych w Polsce</p>
          <p className="text-xs text-muted-foreground mt-1">
            Analiza {data.activeCount} pakietów ({data.totalBrands} marek) | Dane na dzień: {format(new Date(), 'dd.MM.yyyy')} | Historia od {data.globalOldest}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Package} label="Pakiety (aktywne)" value={data.activeCount} delta={data.activeDelta30} deltaLabel="vs 30 dni" />
          <KpiCard icon={Tags} label="Typy diet" value={data.dietTagCount} sub={`Pokrycie ${data.classifiedPct}%`} />
          <KpiCard icon={Ruler} label="Zakresy kcal" value={data.kcalBucketCount} sub={data.kcalRange} />
          <KpiCard icon={UtensilsCrossed} label="Posiłki/dzień" value={`${data.mealsMin}–${data.mealsMax}`} sub={`Mediana: ${data.mealsMedian}`} />
        </div>
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Gap table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Gapy ofertowe — gdzie jest mało ofert?
            </CardTitle>
            <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
              {[['10+', '#dcfce7', 'Wysoka'], ['5–9', '#fef9c3', 'Średnia'], ['1–4', '#fee2e2', 'Niska'], ['0', '#f3f4f6', 'Brak']].map(([label, bg, name]) => (
                <span key={label} className="flex items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: '1px solid #e5e7eb', display: 'inline-block' }} />
                  {name} ({label})
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
                <thead>
                  <tr>
                    <th className="text-left px-1 py-1 font-semibold text-muted-foreground w-[110px]">Typ diety</th>
                    {KCAL_BUCKETS.map(kb => (
                      <th key={kb} className="text-center px-0.5 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>
                        {kcalBucketLabel(kb)}
                      </th>
                    ))}
                    <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>Marki</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gapTable.map(row => (
                    <tr key={row.diet} className="heatmap-row">
                      <td className="px-1 py-0.5 font-medium whitespace-nowrap">{row.diet}</td>
                      {KCAL_BUCKETS.map(kb => {
                        const s = gapCellStyle(row.counts[kb])
                        return (
                          <td key={kb} style={{ backgroundColor: s.bg, color: s.text, textAlign: 'center', fontWeight: 600, borderRadius: 2, border: '1px solid white', height: 24 }}>
                            {row.counts[kb] || ''}
                          </td>
                        )
                      })}
                      <td className="text-center font-bold">{row.totalBrands}</td>
                    </tr>
                  ))}
                  {data.gapOtherRow && (
                    <tr className="heatmap-row">
                      <td className="px-1 py-0.5 font-medium whitespace-nowrap text-muted-foreground">Inne ({data.gapOtherRow.dietCount})</td>
                      {KCAL_BUCKETS.map(kb => {
                        const r = data.gapOtherRow!.counts[kb]
                        return (
                          <td key={kb} className="text-center text-muted-foreground" style={{ fontSize: 9, borderRadius: 2, border: '1px solid white', height: 24, backgroundColor: '#f9fafb' }}>
                            {r.min === r.max ? (r.min || '') : `${r.min}–${r.max}`}
                          </td>
                        )
                      })}
                      <td className="text-center text-muted-foreground" style={{ fontSize: 9 }}>
                        {data.gapOtherRow.totalBrands.min}–{data.gapOtherRow.totalBrands.max}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.gapInsight && (
              <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{data.gapInsight}</p>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Range analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Zakresy oferty — jak szeroka jest oferta marek?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
                  <thead>
                    <tr>
                      <th className="text-left px-1 py-1 font-semibold text-muted-foreground">Segment</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>Śr. zakresów</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>2500+ kcal</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>Śr. posiłków</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rangeTable.map(row => (
                      <tr key={row.diet} className="heatmap-row">
                        <td className="px-1 py-1 font-medium whitespace-nowrap">{row.diet}</td>
                        <td className="text-center font-semibold">{row.avgKcalRanges}</td>
                        <td className="px-1">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(row.pct2500plus, 100)}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground w-[28px] text-right">{row.pct2500plus}%</span>
                          </div>
                        </td>
                        <td className="text-center">{row.avgMeals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.rangeInsights.length > 0 && (
                <div className="w-[200px] shrink-0 space-y-2 border-l pl-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Insight</p>
                  {data.rangeInsights.map((ins, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{ins}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Momentum */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Momentum kategorii — co zyskuje popularność?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
                  <thead>
                    <tr>
                      <th className="text-left px-1 py-1 font-semibold text-muted-foreground">Typ diety</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>Dziś</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>6M temu</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground" style={{ fontSize: 9 }}>Zmiana</th>
                      <th className="text-center px-1 py-1 font-semibold text-muted-foreground w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.momentumTable.map(row => (
                      <tr key={row.diet} className="heatmap-row">
                        <td className="px-1 py-1 font-medium whitespace-nowrap">{row.diet}</td>
                        <td className="text-center font-semibold">{row.brandsNow}</td>
                        <td className="text-center text-muted-foreground">{row.brands6m}</td>
                        <td className="text-center font-semibold" style={{ color: row.changePct > 5 ? '#16a34a' : row.changePct < -5 ? '#dc2626' : '#9ca3af' }}>
                          {row.changePct > 0 ? '+' : ''}{row.changePct}%
                        </td>
                        <td className="text-center">
                          {row.changePct > 5 ? <ArrowUp className="h-3 w-3 text-green-600 mx-auto" /> :
                           row.changePct < -5 ? <ArrowDown className="h-3 w-3 text-red-600 mx-auto" /> :
                           <Minus className="h-3 w-3 text-muted-foreground mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.momentumInsights.length > 0 && (
                <div className="w-[200px] shrink-0 space-y-2 border-l pl-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Insight</p>
                  {data.momentumInsights.map((ins, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{ins}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: New & removed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Co nowego w ofercie?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold mb-1.5 text-green-700">Nowe pakiety (top 5)</p>
                {data.newPackages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Brak nowych pakietów w ostatnich 30 dniach.</p>
                ) : (
                  <div className="space-y-1">
                    {data.newPackages.map((p, i) => (
                      <div key={i} className="text-[11px] flex items-start gap-1.5 py-0.5">
                        <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 mt-0.5">{p.diet}</Badge>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-muted-foreground text-[10px]">{p.brand} · {p.kcalCount} kcal{p.meals ? ` · ${p.meals} pos.` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5 text-red-700">Wycofane (top 5)</p>
                {data.removedPackages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Brak wycofanych pakietów.</p>
                ) : (
                  <div className="space-y-1">
                    {data.removedPackages.map((p, i) => (
                      <div key={i} className="text-[11px] flex items-start gap-1.5 py-0.5">
                        <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 mt-0.5">{p.diet}</Badge>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-muted-foreground text-[10px]">{p.brand} · {p.kcalCount} kcal{p.meals ? ` · ${p.meals} pos.` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 border-t pt-2">
              {data.totalNew} nowych pakietów | {data.totalRemoved} wycofanych pakietów
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── KPI card ────────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, delta, deltaLabel, sub }: {
  icon: any; label: string; value: string | number
  delta?: number; deltaLabel?: string; sub?: string
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {delta !== undefined && (
        <p className={`text-[10px] font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {delta >= 0 ? '+' : ''}{delta} {deltaLabel}
        </p>
      )}
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  )
}
