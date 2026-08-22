'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useCountry } from '@/contexts/CountryContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Package, Info, BarChart3, TrendingUp, Sparkles,
  ArrowUp, ArrowDown, ArrowRight,
  // Diet icons (lucide, spec point 1)
  Dumbbell, Leaf, Flame, Droplet, CheckCircle, WheatOff, ListChecks,
  TrendingDown, Triangle, Baby, GlassWater, Dna, Sun, Briefcase,
  Microscope, Infinity, Activity, Tag,
} from 'lucide-react'
import { classifyDiet, isTestPackage, toKcalBucket, KCAL_BUCKETS, kcalBucketLabel } from '@/lib/dietClassification'
import { format } from 'date-fns'
import type { LucideIcon } from 'lucide-react'

// ── Diet icons (spec point 1: lucide mono, 16px, green) ─────────────────────

const DIET_LUCIDE_ICON: Record<string, LucideIcon> = {
  Sport: Dumbbell, Vege: Leaf, 'Wegańska': Leaf, Keto: Flame, 'Low IG': Droplet,
  Standard: CheckCircle, 'Bez glutenu/laktozy': WheatOff, 'Wybór menu': ListChecks,
  'Slim/Redukcyjna': TrendingDown, 'Low Carb': Triangle, 'Ciąża/Mamy': Baby,
  Detox: GlassWater, Sirtuinowa: Dna, Sezonowa: Sun, 'Office/Lunch': Briefcase,
  Mikrobiom: Microscope, Longevity: Infinity, Hashimoto: Activity, 'Vege+Fish': Leaf,
}

function DietIcon({ diet }: { diet: string }) {
  const Icon = DIET_LUCIDE_ICON[diet] || Tag
  return <Icon className="inline-block w-4 h-4 mr-1 text-green-600 shrink-0" style={{ verticalAlign: 'middle' }} />
}

// Diet badge colors
const DIET_BADGE_COLOR: Record<string, string> = {
  Standard: 'bg-slate-100 text-slate-700 border-slate-300',
  'Wybór menu': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  Sport: 'bg-green-100 text-green-700 border-green-300',
  Keto: 'bg-orange-100 text-orange-700 border-orange-300',
  Vege: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Wegańska': 'bg-lime-100 text-lime-700 border-lime-300',
  'Low IG': 'bg-sky-100 text-sky-700 border-sky-300',
  'Low Carb': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  'Bez glutenu/laktozy': 'bg-amber-100 text-amber-700 border-amber-300',
  Hashimoto: 'bg-violet-100 text-violet-700 border-violet-300',
  'Slim/Redukcyjna': 'bg-pink-100 text-pink-700 border-pink-300',
  'Office/Lunch': 'bg-blue-100 text-blue-700 border-blue-300',
  Detox: 'bg-teal-100 text-teal-700 border-teal-300',
  'Vege+Fish': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Longevity: 'bg-purple-100 text-purple-700 border-purple-300',
  Sezonowa: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  Sirtuinowa: 'bg-rose-100 text-rose-700 border-rose-300',
  Mikrobiom: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
}

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

interface PkrRow { package_id: string; kcal_from: number; kcal_to: number }

interface ProcessedData {
  activeCount: number; activeDelta30: number; totalBrands: number
  dietTagCount: number; classifiedPct: number
  kcalBucketCount: number; kcalRange: string
  mealsMin: number; mealsMax: number; mealsMedian: number
  globalOldest: string
  gapTable: { diet: string; counts: Record<number, number>; totalBrands: number }[]
  gapOtherRow: { dietCount: number; counts: Record<number, { min: number; max: number }>; totalBrands: { min: number; max: number } } | null
  gapInsight: string
  rangeTable: { diet: string; avgKcalRanges: number; pct2500plus: number; avgMeals: number }[]
  rangeInsights: { arrow: 'up' | 'down'; text: string }[]
  rangeConclusion: string
  momentumTable: { diet: string; brandsNow: number; brands6m: number; changePct: number; lowBase: boolean }[]
  momentumInsights: string[]
  newPackages: PkgItem[]; removedPackages: PkgItem[]
  totalNew: number; totalRemoved: number
}

interface PkgItem { name: string; brand: string; diet: string; kcalLabel: string; meals: number | null }

// ── Helpers ─────────────────────────────────────────────────────────────────────

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

// ── Data processing (all values computed live, zero hardcoded mockup data) ───

function processData(
  lifecycle: LifecycleRow[], activePrices: ActivePriceRow[],
  mealsMap: Map<string, number | null>, pkrMap: Map<string, { min: number; max: number }>,
  country: string,
): ProcessedData {
  const today = new Date()
  const d7 = format(new Date(today.getTime() - 7 * 86400000), 'yyyy-MM-dd')
  const d30 = format(new Date(today.getTime() - 30 * 86400000), 'yyyy-MM-dd')
  const d37 = format(new Date(today.getTime() - 37 * 86400000), 'yyyy-MM-dd')
  const d180 = format(new Date(today.getTime() - 180 * 86400000), 'yyyy-MM-dd')

  const lc = lifecycle.filter(r => {
    if (country === 'Czechy') return r.country === 'Czechy'
    return r.country !== 'Czechy'
  }).filter(r => !isTestPackage(r.package_name))

  const ap = activePrices.filter(r => {
    if (country === 'Czechy') return r.country === 'Czechy'
    return r.country !== 'Czechy'
  }).filter(r => !isTestPackage(r.package_name))

  const active = lc.filter(r => r.last_seen >= d7)
  const active30ago = lc.filter(r => r.first_seen <= d30 && r.last_seen >= d30)

  let globalOldest = '9999-12-31'
  for (const r of lc) { if (r.first_seen < globalOldest) globalOldest = r.first_seen }
  const globalThreshold = format(new Date(new Date(globalOldest).getTime() + 3 * 86400000), 'yyyy-MM-dd')

  // KPI
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

  // Section 1: Gap table
  const gapData = new Map<string, Map<number, Set<string>>>()
  for (const r of ap) {
    const tags = classifyDiet(r.package_name); const bucket = toKcalBucket(r.kcal_from, r.kcal_to)
    for (const tag of tags) {
      if (!gapData.has(tag)) gapData.set(tag, new Map())
      const bm = gapData.get(tag)!; if (!bm.has(bucket)) bm.set(bucket, new Set())
      bm.get(bucket)!.add(r.brand_name)
    }
  }
  const dietTotals = Array.from(gapData.entries()).filter(([dt]) => dt !== 'Inne')
    .map(([dt, buckets]) => { const ab = new Set<string>(); for (const s of buckets.values()) for (const b of s) ab.add(b); return { diet: dt, buckets, totalBrands: ab.size } })
    .sort((a, b) => b.totalBrands - a.totalBrands)
  const top10 = dietTotals.slice(0, 10); const others = dietTotals.slice(10)
  const gapTable = top10.map(d => { const counts: Record<number, number> = {}; for (const kb of KCAL_BUCKETS) counts[kb] = d.buckets.get(kb)?.size ?? 0; return { diet: d.diet, counts, totalBrands: d.totalBrands } })
  let gapOtherRow: ProcessedData['gapOtherRow'] = null
  if (others.length > 0) {
    const oc: Record<number, { min: number; max: number }> = {}
    for (const kb of KCAL_BUCKETS) { const vals = others.map(d => d.buckets.get(kb)?.size ?? 0); oc[kb] = { min: Math.min(...vals), max: Math.max(...vals) } }
    const ot = others.map(d => d.totalBrands); gapOtherRow = { dietCount: others.length, counts: oc, totalBrands: { min: Math.min(...ot), max: Math.max(...ot) } }
  }
  const greenBuckets = new Set<number>()
  for (const row of gapTable) { for (const kb of KCAL_BUCKETS) { if (row.counts[kb] >= 10) greenBuckets.add(kb) } }
  const gapCandidates: string[] = []
  for (const row of gapTable) {
    const weak = KCAL_BUCKETS.filter(kb => greenBuckets.has(kb) && row.counts[kb] <= 4)
    if (weak.length > 0) { const range = weak.length === 1 ? `${kcalBucketLabel(weak[0])} kcal` : `${kcalBucketLabel(weak[0])}\u2013${kcalBucketLabel(weak[weak.length - 1])} kcal`; gapCandidates.push(`${row.diet.toUpperCase()} (${range})`) }
  }
  const gapInsight = gapCandidates.length > 0 ? `Największe luki: ${gapCandidates.slice(0, 4).join(', ')}` : ''

  // Section 2: Range analysis
  const top7diets = dietTotals.slice(0, 7)
  const rangeTable = top7diets.map(d => {
    const dietPkgs = new Map<string, { kcalBuckets: Set<number>; brand: string }>()
    for (const r of ap) { const tags = classifyDiet(r.package_name); if (!tags.includes(d.diet)) continue; const bucket = toKcalBucket(r.kcal_from, r.kcal_to); if (!dietPkgs.has(r.package_id)) dietPkgs.set(r.package_id, { kcalBuckets: new Set(), brand: r.brand_name }); dietPkgs.get(r.package_id)!.kcalBuckets.add(bucket) }
    const kc = Array.from(dietPkgs.values()).map(p => p.kcalBuckets.size); const avgKcal = kc.length > 0 ? kc.reduce((a, b) => a + b, 0) / kc.length : 0
    const brandsAll = new Set(Array.from(dietPkgs.values()).map(p => p.brand)); const brands2500 = new Set<string>()
    for (const [, p] of dietPkgs) { for (const kb of p.kcalBuckets) { if (kb >= 2500) brands2500.add(p.brand) } }
    const pct = brandsAll.size > 0 ? (brands2500.size / brandsAll.size) * 100 : 0
    const meals = Array.from(dietPkgs.keys()).map(pid => mealsMap.get(pid)).filter((v): v is number => v != null && v > 0)
    const avgM = meals.length > 0 ? meals.reduce((a, b) => a + b, 0) / meals.length : 0
    return { diet: d.diet, avgKcalRanges: Math.round(avgKcal * 10) / 10, pct2500plus: Math.round(pct), avgMeals: Math.round(avgM * 10) / 10 }
  })
  const rangeInsights: { arrow: 'up' | 'down'; text: string }[] = []
  const byRange = [...rangeTable].sort((a, b) => b.avgKcalRanges - a.avgKcalRanges)
  if (byRange.length >= 2) rangeInsights.push({ arrow: 'up', text: `Najszersze zakresy kcal: ${byRange[0].diet.toUpperCase()}, ${byRange[1].diet.toUpperCase()}` })
  const by2500 = [...rangeTable].sort((a, b) => b.pct2500plus - a.pct2500plus)
  if (by2500.length > 0 && by2500[0].pct2500plus > 0) rangeInsights.push({ arrow: 'up', text: `Najwyższa dostępność 2500+ kcal: ${by2500[0].diet.toUpperCase()} (${by2500[0].pct2500plus}%)` })
  const byRangeAsc = [...rangeTable].sort((a, b) => a.avgKcalRanges - b.avgKcalRanges)
  if (byRangeAsc.length > 0 && byRangeAsc[0].avgKcalRanges < byRange[0]?.avgKcalRanges) rangeInsights.push({ arrow: 'down', text: `Najmniejszy wybór w segmencie ${byRangeAsc[0].diet.toUpperCase()} \u2014 niska pokrywa kaloryczna` })
  const lowCoverageDiets = rangeTable.filter(r => r.pct2500plus < 20 && r.avgKcalRanges < 4)
  const rangeConclusion = lowCoverageDiets.length > 0 ? `Segmenty ${lowCoverageDiets.map(d => d.diet.toUpperCase()).join(' i ')} są niedobsadzone przy rosnącym popycie \u2014 wysoki potencjał.` : ''

  // Section 3: Momentum (spec point 2: always %, lowBase flag when <3)
  const dietBrandsNow = new Map<string, Set<string>>(); const dietBrands6m = new Map<string, Set<string>>()
  for (const r of lc) { const tags = classifyDiet(r.package_name); for (const tag of tags) { if (tag === 'Inne') continue; if (r.last_seen >= d7) { if (!dietBrandsNow.has(tag)) dietBrandsNow.set(tag, new Set()); dietBrandsNow.get(tag)!.add(r.brand_name) }; if (r.first_seen <= d180 && r.last_seen >= d180) { if (!dietBrands6m.has(tag)) dietBrands6m.set(tag, new Set()); dietBrands6m.get(tag)!.add(r.brand_name) } } }
  const momentumTable = Array.from(dietBrandsNow.entries())
    .map(([diet, brandsNow]) => { const b6m = dietBrands6m.get(diet)?.size ?? 0; const now = brandsNow.size; const changePct = b6m > 0 ? Math.round(((now - b6m) / b6m) * 100) : (now > 0 ? 100 : 0); return { diet, brandsNow: now, brands6m: b6m, changePct, lowBase: b6m < 3 } })
    .sort((a, b) => b.changePct - a.changePct).slice(0, 8)
  const momentumInsights: string[] = []
  const growing = momentumTable.filter(m => m.changePct > 5 && m.brands6m >= 3); const declining = momentumTable.filter(m => m.changePct < -5 && m.brands6m >= 3)
  if (growing.length > 0) { momentumInsights.push(`Najszybciej rosnące kategorie to: ${growing.slice(0, 3).map(m => m.diet.toUpperCase()).join(', ')}.`); momentumInsights.push('To kierunki, w które rynek inwestuje ofertę.') }
  if (declining.length > 0) momentumInsights.push(`Kategorie takie jak ${declining.slice(0, 2).map(m => m.diet.toUpperCase()).join(', ')} tracą popularność ofertową.`)

  // Section 4: New & removed (spec point 4: kcal range from pkrMap, meals from mealsMap)
  const allNew = lc.filter(r => r.first_seen > globalThreshold && r.first_seen >= d30)
  const allRemoved = lc.filter(r => r.last_seen >= d37 && r.last_seen < d7)
  const mapPkg = (r: LifecycleRow): PkgItem => {
    const pkr = pkrMap.get(r.package_id)
    const kcalLabel = pkr ? (pkr.min === pkr.max ? `${pkr.min}` : `${pkr.min}\u2013${pkr.max}`) : '\u2013'
    return { name: r.package_name, brand: r.brand_name, diet: classifyDiet(r.package_name).filter(t => t !== 'Inne')[0] || 'Inne', kcalLabel, meals: mealsMap.get(r.package_id) ?? null }
  }

  return {
    activeCount: active.length, activeDelta30: active.length - active30ago.length, totalBrands: activeBrands.size, dietTagCount: activeDietTags.size,
    classifiedPct: active.length > 0 ? Math.round((classifiedCount / active.length) * 100) : 0, kcalBucketCount: activeKcalBuckets.size,
    kcalRange: activeKcalBuckets.size > 0 ? `${Math.min(...activeKcalBuckets)} \u2013 ${kcalBucketLabel(Math.max(...activeKcalBuckets) as any)} kcal` : '\u2014',
    mealsMin: mealValues.length > 0 ? Math.min(...mealValues) : 0, mealsMax: mealValues.length > 0 ? Math.max(...mealValues) : 0, mealsMedian: medianOf(mealValues), globalOldest,
    gapTable, gapOtherRow, gapInsight, rangeTable, rangeInsights, rangeConclusion, momentumTable, momentumInsights,
    newPackages: allNew.sort((a, b) => b.first_seen.localeCompare(a.first_seen)).slice(0, 5).map(mapPkg),
    removedPackages: allRemoved.sort((a, b) => b.last_seen.localeCompare(a.last_seen)).slice(0, 5).map(mapPkg),
    totalNew: allNew.length, totalRemoved: allRemoved.length,
  }
}

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
      const [lcRes, apRes, mealsRes, pkrRes] = await Promise.all([
        (supabase as any).rpc('get_package_lifecycle'),
        (supabase as any).rpc('get_active_package_prices'),
        (supabase as any).from('packages').select('id, meals_per_day').limit(2000),
        (supabase as any).from('package_kcal_ranges').select('package_id, kcal_ranges!inner(kcal_from, kcal_to)').limit(10000),
      ])
      if (lcRes.error) throw lcRes.error
      if (apRes.error) throw apRes.error
      return {
        lifecycle: (lcRes.data ?? []) as LifecycleRow[],
        activePrices: (apRes.data ?? []) as ActivePriceRow[],
        meals: (mealsRes.data ?? []) as { id: string; meals_per_day: number | null }[],
        pkr: (pkrRes.data ?? []) as { package_id: string; kcal_ranges: { kcal_from: number; kcal_to: number } }[],
      }
    },
  })

  const data = useMemo(() => {
    if (!rawData) return null
    const mealsMap = new Map(rawData.meals.map(m => [m.id, m.meals_per_day]))
    // Build pkr kcal range per package: min(kcal_from) – max(kcal_to)
    const pkrMap = new Map<string, { min: number; max: number }>()
    for (const r of rawData.pkr) {
      const kr = r.kcal_ranges
      const cur = pkrMap.get(r.package_id)
      if (cur) { cur.min = Math.min(cur.min, kr.kcal_from); cur.max = Math.max(cur.max, kr.kcal_to) }
      else pkrMap.set(r.package_id, { min: kr.kcal_from, max: kr.kcal_to })
    }
    return processData(rawData.lifecycle, rawData.activePrices, mealsMap, pkrMap, selectedCountry)
  }, [rawData, selectedCountry])

  if (isLoading || !data) {
    return <Card><CardContent className="py-16 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>
  }

  // Spec point 6: navy color from theme = hsl(var(--primary))
  const navyCls = 'text-primary'

  return (
    <div className="space-y-5">
      {/* ── Header (spec 7: polskie znaki) ── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Package className="h-7 w-7 text-primary" />
            <h2 className={`text-2xl font-extrabold tracking-tight uppercase ${navyCls}`}>Oferta — gap, zakresy, potencjał</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Pełny obraz oferty rynkowej diet pudełkowych w Polsce</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analiza {data.activeCount} pakietów ({data.totalBrands} marki) | Dane na dzień: {format(new Date(), 'dd.MM.yyyy')} | Historia od {data.globalOldest}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <KpiCard label="PAKIETY (AKTYWNE)" value={data.activeCount} delta={data.activeDelta30} deltaLabel="vs 30 dni" />
          <KpiCard label="TYPY DIET (TAGI)" value={data.dietTagCount} sub={`Pokrycie klasyfikacją ${data.classifiedPct}%`} />
          <KpiCard label="ZAKRESY KALORYCZNE" value={data.kcalBucketCount} sub={data.kcalRange} />
          <KpiCard label="POSIŁKI / DZIEŃ" value={`${data.mealsMin}\u2013${data.mealsMax}`} sub={`Śr. mediana: ${data.mealsMedian}`} />
        </div>
      </div>

      {/* ── 2x2 grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* S1: Gapy ofertowe (spec 6: navy title, spec 7: diakrytyki, spec 8: kwadraciki+liczby) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm font-bold uppercase tracking-wide ${navyCls}`}>Gapy ofertowe — gdzie jest mało ofert?</CardTitle>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground">Liczba marek oferujących dany typ diety w danym zakresie kcal (aktywne pakiety)</p>
            {/* Spec 8: kwadraciki z liczbami */}
            <div className="flex gap-4 mt-1">
              {([['#dcfce7', '#166534', 'Wysoka (10+)'], ['#fef9c3', '#854d0e', 'Średnia (5\u20139)'], ['#fee2e2', '#991b1b', 'Niska (1\u20134)'], ['#f3f4f6', '#9ca3af', 'Brak (0)']] as [string, string, string][]).map(([bg, border, label]) => (
                <span key={label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${border}`, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
              <thead>
                <tr>
                  <th className="text-left px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Typ diety \ kcal</th>
                  {KCAL_BUCKETS.map(kb => <th key={kb} className="text-center px-0 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>{kcalBucketLabel(kb)}</th>)}
                  <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Liczba marek<br/>(łącznie)</th>
                </tr>
              </thead>
              <tbody>
                {data.gapTable.map(row => (
                  <tr key={row.diet} className="heatmap-row">
                    <td className="px-1 py-0.5 font-semibold whitespace-nowrap text-[11px]"><DietIcon diet={row.diet} />{row.diet.toUpperCase()}</td>
                    {KCAL_BUCKETS.map(kb => { const s = gapCellStyle(row.counts[kb]); return <td key={kb} style={{ backgroundColor: s.bg, color: s.text, textAlign: 'center', fontWeight: 600, borderRadius: 2, border: '1px solid white', height: 24 }}>{row.counts[kb] || ''}</td> })}
                    <td className="text-center font-bold text-[12px]">{row.totalBrands}</td>
                  </tr>
                ))}
                {/* Spec 3: fix \u2013 — use actual en-dash character */}
                {data.gapOtherRow && (
                  <tr>
                    <td className="px-1 py-0.5 text-muted-foreground italic text-[10px]">Inne typy ({data.gapOtherRow.dietCount})</td>
                    {KCAL_BUCKETS.map(kb => { const r = data.gapOtherRow!.counts[kb]; return <td key={kb} className="text-center text-muted-foreground italic" style={{ fontSize: 9, height: 24 }}>{r.min === r.max ? (r.min || '') : `${r.min}\u2013${r.max}`}</td> })}
                    <td className="text-center text-muted-foreground italic" style={{ fontSize: 9 }}>{'\u2013'}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {data.gapInsight && (
              <div className="flex items-start gap-1.5 mt-2 pt-2 border-t">
                <Info className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground">{data.gapInsight}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* S2: Zakresy oferty (spec 5: CO TO OZNACZA? jasnofioletowe tło) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm font-bold uppercase tracking-wide ${navyCls}`}>Zakresy oferty — jak szeroka jest oferta marek?</CardTitle>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground">Liczba różnych zakresów kcal × liczba posiłków w ofercie</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-3">
              <div className="flex-1">
                <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
                  <thead>
                    <tr>
                      <th className="text-left px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Segment</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Śr. liczba<br/>zakresów kcal</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>% marek z zakresem<br/>2500+ kcal</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Śr. liczba<br/>posiłków</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rangeTable.map(row => (
                      <tr key={row.diet} className="heatmap-row">
                        <td className="px-1 py-1 font-semibold whitespace-nowrap"><DietIcon diet={row.diet} />{row.diet.toUpperCase()}</td>
                        <td className="text-center font-semibold">{row.avgKcalRanges}</td>
                        <td className="px-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium w-[28px]">{row.pct2500plus}%</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(row.pct2500plus, 100)}%` }} /></div>
                          </div>
                        </td>
                        <td className="text-center">{row.avgMeals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.rangeInsights.length > 0 || data.rangeConclusion) && (
                <div className="w-[180px] shrink-0 border-l pl-3 space-y-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Insight</p>
                  {data.rangeInsights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {ins.arrow === 'up' ? <ArrowUp className="h-3 w-3 text-green-600 mt-0.5 shrink-0" /> : <ArrowDown className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />}
                      <p className="text-[10px] text-muted-foreground leading-tight">{ins.text}</p>
                    </div>
                  ))}
                  {/* Spec 5: CO TO OZNACZA? box */}
                  {data.rangeConclusion && (
                    <div className="mt-2 p-2 rounded bg-violet-50 border border-violet-200 dark:bg-violet-950/30 dark:border-violet-800">
                      <p className="text-[9px] font-bold text-violet-700 dark:text-violet-400 uppercase mb-1">Co to oznacza?</p>
                      <p className="text-[10px] text-violet-900 dark:text-violet-300 leading-tight">{data.rangeConclusion}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* S3: Momentum (spec 2: always %, lowBase annotation) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-bold uppercase tracking-wide ${navyCls}`}>Momentum kategorii — co zyskuje popularność?</CardTitle>
            <p className="text-[10px] text-muted-foreground">Zmiana liczby marek oferujących dany typ diety (aktywne pakiety)</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-3">
              <div className="flex-1">
                <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 1 }}>
                  <thead>
                    <tr>
                      <th className="text-left px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Typ diety</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Marki dziś</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>6M temu</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold" style={{ fontSize: 9 }}>Zmiana</th>
                      <th className="text-center px-1 py-1 text-muted-foreground font-semibold w-8" style={{ fontSize: 9 }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.momentumTable.map(row => (
                      <tr key={row.diet} className="heatmap-row">
                        <td className="px-1 py-1 font-semibold whitespace-nowrap"><DietIcon diet={row.diet} />{row.diet.toUpperCase()}</td>
                        <td className="text-center font-semibold">{row.brandsNow}</td>
                        <td className="text-center text-muted-foreground">{row.brands6m}</td>
                        <td className="text-center" style={{ color: row.changePct > 5 ? '#16a34a' : row.changePct < -5 ? '#dc2626' : '#9ca3af' }}>
                          <span className="font-semibold">{row.changePct > 0 ? '+' : ''}{row.changePct}%</span>
                          {row.lowBase && <span className="block text-[8px] text-muted-foreground font-normal">niska baza</span>}
                        </td>
                        <td className="text-center">
                          {row.changePct > 5 ? <ArrowUp className="h-3.5 w-3.5 text-green-600 mx-auto" /> :
                           row.changePct < -5 ? <ArrowDown className="h-3.5 w-3.5 text-red-600 mx-auto" /> :
                           <ArrowRight className="h-3.5 w-3.5 text-amber-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.momentumInsights.length > 0 && (
                <div className="w-[180px] shrink-0 border-l pl-3 space-y-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Insight</p>
                  {data.momentumInsights.map((ins, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground leading-tight">{ins}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* S4: Co nowego (spec 4: full names, kcal range, meals; spec 6: navy title) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-bold uppercase tracking-wide ${navyCls}`}>Co nowego w ofercie?</CardTitle>
            <p className="text-[10px] text-muted-foreground">Nowe i wycofane pakiety w ostatnich 30 dniach</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">Nowe pakiety (top 5)</p>
                {data.newPackages.length === 0 ? <p className="text-[10px] text-muted-foreground">Brak nowych pakietów.</p> : <PkgTable items={data.newPackages} />}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1">Wycofane pakiety (top 5)</p>
                {data.removedPackages.length === 0 ? <p className="text-[10px] text-muted-foreground">Brak wycofanych pakietów.</p> : <PkgTable items={data.removedPackages} />}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
              <Info className="h-3 w-3 text-blue-500 shrink-0" />
              <p className="text-[10px] text-muted-foreground">{data.totalNew} nowych pakietów | {data.totalRemoved} wycofanych pakietów</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Oferta analizowana na podstawie aktywnych pakietów i ich dostępności kalorycznej oraz liczby posiłków.
      </p>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, delta, deltaLabel, sub }: {
  label: string; value: string | number; delta?: number; deltaLabel?: string; sub?: string
}) {
  return (
    <div className="border rounded-lg px-3 py-2.5 bg-card">
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      {delta !== undefined && (
        <p className={`text-[10px] font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {delta >= 0 ? '+' : ''}{delta} {deltaLabel}
        </p>
      )}
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

/* Spec 4: pełne nazwy (zawijane do 2 linii), Kcal = zakres, Posiłki = meals_per_day, nagłówki wg specyfikacji */
function PkgTable({ items }: { items: PkgItem[] }) {
  return (
    <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr className="border-b">
          <th className="text-left py-0.5 font-semibold text-muted-foreground">Nazwa pakietu</th>
          <th className="text-left py-0.5 font-semibold text-muted-foreground">Typ diety</th>
          <th className="text-center py-0.5 font-semibold text-muted-foreground">Kcal</th>
          <th className="text-center py-0.5 font-semibold text-muted-foreground">Posiłki</th>
          <th className="text-left py-0.5 font-semibold text-muted-foreground">Marka</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p, i) => {
          const badgeClass = DIET_BADGE_COLOR[p.diet] || 'bg-gray-100 text-gray-700 border-gray-300'
          return (
            <tr key={i} className="border-b last:border-0">
              <td className="py-1 pr-1 font-medium" style={{ maxWidth: 160, wordBreak: 'break-word', lineHeight: '1.3' }}>{p.name}</td>
              <td className="py-1 pr-1">
                <Badge className={`text-[8px] px-1 py-0 font-medium border whitespace-nowrap ${badgeClass}`}>{p.diet.toUpperCase()}</Badge>
              </td>
              <td className="text-center py-1 text-muted-foreground whitespace-nowrap">{p.kcalLabel}</td>
              <td className="text-center py-1 text-muted-foreground">{p.meals ?? '\u2013'}</td>
              <td className="py-1 text-muted-foreground" style={{ maxWidth: 80, wordBreak: 'break-word', lineHeight: '1.3' }}>{p.brand}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
