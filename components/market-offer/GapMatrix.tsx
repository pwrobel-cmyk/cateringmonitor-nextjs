'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Loader2, Grid3X3, ChevronDown, Lightbulb, Target } from 'lucide-react'
import { useMarketGaps, type GapCell } from '@/hooks/supabase/useMarketGaps'
import { useBrands } from '@/hooks/supabase/useBrands'
import { useUserBrands } from '@/hooks/useUserBrands'
import { KCAL_BUCKETS, kcalBucketLabel, type DietType } from '@/lib/dietClassification'

const PRIMARY_DIETS: DietType[] = [
  'Standard', 'Keto', 'Vege', 'Wegańska', 'Vege+Fish', 'Low IG',
  'Low Carb', 'Sport', 'Bez glutenu/laktozy', 'Hashimoto',
]

const COL_COUNT = KCAL_BUCKETS.length + 1

function cellBg(count: number, maxCount: number): string {
  if (count === 0) return 'transparent'
  const intensity = Math.min(count / Math.max(maxCount, 1), 1)
  const lightness = Math.round(90 - intensity * 55)
  return `hsl(215, 84%, ${lightness}%)`
}

function cellTextColor(count: number, maxCount: number): string {
  if (count === 0) return 'var(--muted-foreground)'
  const intensity = count / Math.max(maxCount, 1)
  return intensity > 0.35 ? '#fff' : 'hsl(215, 25%, 16%)'
}

/** One representative price per brand = cheapest package of that brand */
function brandMinPrices(cell: GapCell): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of cell.brands) {
    const cur = map.get(b.brandName)
    if (cur === undefined || b.price < cur) map.set(b.brandName, b.price)
  }
  return map
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ── Detail Panel ───────────────────────────────────────────────────────────────

function DetailPanel({ diet, kcal, cell, matrix, refBrand }: {
  diet: string; kcal: number; cell: GapCell
  matrix: Record<string, Record<number, GapCell>>
  refBrand: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (ref.current) setHeight(ref.current.scrollHeight)
  }, [diet, kcal, cell, refBrand])

  const isEmpty = cell.brandCount === 0

  const neighbors = useMemo(() => {
    if (!isEmpty) return []
    const row = matrix[diet]
    if (!row) return []
    const result: { kcal: number; brands: typeof cell.brands }[] = []
    for (const kb of KCAL_BUCKETS) {
      if (kb === kcal) continue
      const c = row[kb]
      if (c && c.brandCount > 0) result.push({ kcal: kb, brands: c.brands })
    }
    result.sort((a, b) => Math.abs(a.kcal - kcal) - Math.abs(b.kcal - kcal))
    return result.slice(0, 2)
  }, [isEmpty, matrix, diet, kcal, cell])

  // Ref brand analysis
  const refAnalysis = useMemo(() => {
    if (!refBrand || isEmpty) return null
    const refPackages = cell.brands.filter(b => b.brandName === refBrand)
    if (refPackages.length === 0) return null

    const minPrices = brandMinPrices(cell)
    const prices = Array.from(minPrices.values())
    const med = median(prices)
    const refMinPrice = minPrices.get(refBrand)!
    const deviation = med > 0 ? ((refMinPrice - med) / med) * 100 : 0

    return { refPackages, refMinPrice, median: med, deviation, totalBrands: minPrices.size }
  }, [refBrand, cell, isEmpty])

  return (
    <div style={{ maxHeight: height || 'none', overflow: 'hidden', transition: 'max-height 200ms ease' }}>
      <div ref={ref} className="px-4 py-3">
        <p className="text-sm font-semibold mb-2">
          {diet} · {kcalBucketLabel(kcal as any)} kcal — {cell.brandCount} marek
        </p>
        {isEmpty ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Brak ofert w tej kombinacji.</p>
            {neighbors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Najbliżej luki są:</p>
                {neighbors.map(n => (
                  <div key={n.kcal} className="mb-2">
                    <p className="text-xs font-medium">{kcalBucketLabel(n.kcal as any)} kcal ({n.brands.length} pakietów):</p>
                    {n.brands.slice(0, 3).map((b, i) => (
                      <p key={i} className="text-xs text-muted-foreground ml-2">{b.brandName}: {b.packageName} — {b.price.toFixed(0)} zł</p>
                    ))}
                    {n.brands.length > 3 && <p className="text-xs text-muted-foreground ml-2">...i {n.brands.length - 3} więcej</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {cell.brands.map((b, i) => {
              const isRef = refBrand && b.brandName === refBrand
              return (
                <div key={i} className={`flex items-center gap-2 py-1.5 px-2 rounded border ${isRef ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800' : ''}`}>
                  {b.brandLogo ? (
                    <img src={b.brandLogo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                      {b.brandName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{b.brandName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{b.packageName}</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums shrink-0">{b.price.toFixed(0)} zł</span>
                </div>
              )
            })}
          </div>
        )}
        {refAnalysis && (
          <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
            Twoja cena {refAnalysis.refMinPrice.toFixed(0)} zł
            {refAnalysis.refPackages.length > 1 && ` (najtańszy z ${refAnalysis.refPackages.length} pakietów)`}
            , mediana {refAnalysis.median.toFixed(0)} zł,{' '}
            <span className={refAnalysis.deviation > 0 ? 'text-red-600' : 'text-green-600'}>
              {refAnalysis.deviation > 0 ? '+' : ''}{refAnalysis.deviation.toFixed(0)}%
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

// ── Insights ───────────────────────────────────────────────────────────────────

interface Insight {
  text: string
  type: 'gap' | 'blind-spot' | 'price'
}

function generateInsights(
  matrix: Record<string, Record<number, GapCell>>,
  visibleDiets: string[],
  refBrand: string,
): Insight[] {
  const insights: Insight[] = []

  // 1. Blind spots: cells with 5+ competitors, ref brand absent (top 2)
  const blindSpots: { diet: string; kcal: number; competitors: number }[] = []
  // 2. Price extremes: cells where ref brand present, |deviation| from median > 10% (top 2 by |dev|)
  const priceExtremes: { diet: string; kcal: number; refPrice: number; med: number; dev: number; rank: number; total: number }[] = []

  for (const dt of visibleDiets) {
    const row = matrix[dt]
    if (!row) continue
    for (const kb of KCAL_BUCKETS) {
      const cell = row[kb]
      if (!cell) continue

      const minPrices = brandMinPrices(cell)
      const hasRef = minPrices.has(refBrand)

      if (!hasRef && cell.brandCount >= 5) {
        blindSpots.push({ diet: dt, kcal: kb, competitors: cell.brandCount })
      }

      if (hasRef && minPrices.size >= 3) {
        const prices = Array.from(minPrices.values())
        const med = median(prices)
        const refPrice = minPrices.get(refBrand)!
        const dev = med > 0 ? ((refPrice - med) / med) * 100 : 0
        const sorted = [...prices].sort((a, b) => a - b)
        const rank = sorted.indexOf(refPrice) + 1

        if (Math.abs(dev) > 10) {
          priceExtremes.push({ diet: dt, kcal: kb, refPrice, med, dev, rank, total: minPrices.size })
        }
      }
    }
  }

  // Top 2 blind spots by competitor count
  blindSpots.sort((a, b) => b.competitors - a.competitors)
  for (const bs of blindSpots.slice(0, 2)) {
    insights.push({
      type: 'blind-spot',
      text: `${bs.diet} ${kcalBucketLabel(bs.kcal as any)} kcal — ${bs.competitors} konkurentów bez Twojej oferty`,
    })
  }

  // Top 2 price extremes by |deviation|
  priceExtremes.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))
  for (const pe of priceExtremes.slice(0, 2)) {
    const dir = pe.dev > 0
      ? `+${pe.dev.toFixed(0)}% vs mediana ${pe.med.toFixed(0)} zł — najdroższa półka`
      : `${pe.dev.toFixed(0)}% vs mediana ${pe.med.toFixed(0)} zł — najniższa półka segmentu`
    insights.push({
      type: 'price',
      text: `${pe.diet} ${kcalBucketLabel(pe.kcal as any)} kcal — Twoja cena ${pe.refPrice.toFixed(0)} zł, ${dir}`,
    })
  }

  // Max 1 market gap (existing smart gap logic)
  for (const dt of visibleDiets) {
    const row = matrix[dt]
    if (!row) continue
    for (let i = 0; i < KCAL_BUCKETS.length; i++) {
      const kb = KCAL_BUCKETS[i]
      if ((row[kb]?.brandCount ?? 0) > 0) continue
      const hasLeft = KCAL_BUCKETS.slice(0, i).some(b => (row[b]?.brandCount ?? 0) > 0)
      const hasRight = KCAL_BUCKETS.slice(i + 1).some(b => (row[b]?.brandCount ?? 0) > 0)
      const leftCount = i > 0 ? (row[KCAL_BUCKETS[i - 1]]?.brandCount ?? 0) : 0
      const rightCount = i < KCAL_BUCKETS.length - 1 ? (row[KCAL_BUCKETS[i + 1]]?.brandCount ?? 0) : 0
      if ((hasLeft && hasRight) || leftCount >= 5 || rightCount >= 5) {
        const strongCount = Math.max(leftCount, rightCount)
        const strongBucket = leftCount >= rightCount
          ? (i > 0 ? KCAL_BUCKETS[i - 1] : kb)
          : (i < KCAL_BUCKETS.length - 1 ? KCAL_BUCKETS[i + 1] : kb)
        insights.push({
          type: 'gap',
          text: `${dt} ${kcalBucketLabel(kb as any)} kcal — luka rynkowa (0 marek), przy ${strongCount} markach w ${kcalBucketLabel(strongBucket as any)} kcal`,
        })
        return insights // max 1 gap, stop early
      }
    }
  }

  return insights
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GapMatrix() {
  const { data, isLoading } = useMarketGaps()
  const { data: brands } = useBrands()
  const { assignedBrandIds } = useUserBrands()

  const [showAllDiets, setShowAllDiets] = useState(false)
  const [unclassifiedOpen, setUnclassifiedOpen] = useState(false)
  const [expanded, setExpanded] = useState<{ diet: string; kcal: number } | null>(null)
  const [brandOverride, setBrandOverride] = useState<string | undefined>(undefined)

  // Resolve default brand from user assignments
  const defaultBrandName = useMemo(() => {
    if (!brands || !assignedBrandIds || assignedBrandIds.length === 0) return null
    const firstAssigned = brands.find(b => assignedBrandIds.includes(b.id))
    return firstAssigned?.name ?? null
  }, [brands, assignedBrandIds])

  const selectedBrand = brandOverride === undefined
    ? defaultBrandName
    : brandOverride === '__all__' ? null : brandOverride

  const maxBrandCount = useMemo(() => {
    if (!data) return 1
    let max = 1
    for (const dt of Object.keys(data.matrix)) {
      for (const kb of KCAL_BUCKETS) {
        const c = data.matrix[dt]?.[kb]?.brandCount ?? 0
        if (c > max) max = c
      }
    }
    return max
  }, [data])

  const visibleDiets = useMemo(() => {
    if (!data) return []
    const hasCells = (dt: string) => KCAL_BUCKETS.some(kb => (data.matrix[dt]?.[kb]?.brandCount ?? 0) > 0)
    if (showAllDiets) {
      return Object.keys(data.matrix).filter(dt => dt !== 'Inne' && hasCells(dt))
    }
    return PRIMARY_DIETS.filter(dt => hasCells(dt))
  }, [data, showAllDiets])

  const extraDietsCount = useMemo(() => {
    if (!data) return 0
    const hasCells = (dt: string) => KCAL_BUCKETS.some(kb => (data.matrix[dt]?.[kb]?.brandCount ?? 0) > 0)
    return Object.keys(data.matrix).filter(dt => dt !== 'Inne' && !PRIMARY_DIETS.includes(dt as DietType) && hasCells(dt)).length
  }, [data])

  // Smart gap detection (used in both modes)
  const isSmartGap = useMemo(() => {
    if (!data) return (_dt: string, _kb: number) => false
    const set = new Set<string>()
    for (const dt of visibleDiets) {
      const row = data.matrix[dt]
      if (!row) continue
      for (let i = 0; i < KCAL_BUCKETS.length; i++) {
        const kb = KCAL_BUCKETS[i]
        if ((row[kb]?.brandCount ?? 0) > 0) continue
        const hasLeft = KCAL_BUCKETS.slice(0, i).some(b => (row[b]?.brandCount ?? 0) > 0)
        const hasRight = KCAL_BUCKETS.slice(i + 1).some(b => (row[b]?.brandCount ?? 0) > 0)
        const leftCount = i > 0 ? (row[KCAL_BUCKETS[i - 1]]?.brandCount ?? 0) : 0
        const rightCount = i < KCAL_BUCKETS.length - 1 ? (row[KCAL_BUCKETS[i + 1]]?.brandCount ?? 0) : 0
        if ((hasLeft && hasRight) || leftCount >= 5 || rightCount >= 5) set.add(`${dt}|${kb}`)
      }
    }
    return (dt: string, kb: number) => set.has(`${dt}|${kb}`)
  }, [data, visibleDiets])

  // Insights — brand-specific or market-wide
  const insights = useMemo(() => {
    if (!data) return []
    if (selectedBrand) {
      return generateInsights(data.matrix, visibleDiets, selectedBrand)
    }
    // Market-wide: top 5 interesting gaps
    const gaps: { diet: string; kcal: number; neighborCount: number }[] = []
    for (const dt of visibleDiets) {
      const row = data.matrix[dt]
      if (!row) continue
      for (let i = 0; i < KCAL_BUCKETS.length; i++) {
        const kb = KCAL_BUCKETS[i]
        if ((row[kb]?.brandCount ?? 0) > 0) continue
        const hasLeft = KCAL_BUCKETS.slice(0, i).some(b => (row[b]?.brandCount ?? 0) > 0)
        const hasRight = KCAL_BUCKETS.slice(i + 1).some(b => (row[b]?.brandCount ?? 0) > 0)
        const leftCount = i > 0 ? (row[KCAL_BUCKETS[i - 1]]?.brandCount ?? 0) : 0
        const rightCount = i < KCAL_BUCKETS.length - 1 ? (row[KCAL_BUCKETS[i + 1]]?.brandCount ?? 0) : 0
        if ((hasLeft && hasRight) || leftCount >= 5 || rightCount >= 5) {
          const strongBucket = leftCount >= rightCount
            ? (i > 0 ? KCAL_BUCKETS[i - 1] : kb)
            : (i < KCAL_BUCKETS.length - 1 ? KCAL_BUCKETS[i + 1] : kb)
          const strongCount = Math.max(leftCount, rightCount)
          gaps.push({ diet: dt, kcal: kb, neighborCount: leftCount + rightCount })
        }
      }
    }
    gaps.sort((a, b) => b.neighborCount - a.neighborCount)
    return gaps.slice(0, 5).map(g => {
      const row = data.matrix[g.diet]
      const i = KCAL_BUCKETS.indexOf(g.kcal as any)
      const leftCount = i > 0 ? (row?.[KCAL_BUCKETS[i - 1]]?.brandCount ?? 0) : 0
      const rightCount = i < KCAL_BUCKETS.length - 1 ? (row?.[KCAL_BUCKETS[i + 1]]?.brandCount ?? 0) : 0
      const strongBucket = leftCount >= rightCount
        ? (i > 0 ? KCAL_BUCKETS[i - 1] : g.kcal)
        : (i < KCAL_BUCKETS.length - 1 ? KCAL_BUCKETS[i + 1] : g.kcal)
      const strongCount = Math.max(leftCount, rightCount)
      return {
        type: 'gap' as const,
        text: `${g.diet} ${kcalBucketLabel(g.kcal as any)} kcal — 0 marek, przy ${strongCount} markach w ${kcalBucketLabel(strongBucket as any)} kcal`,
      }
    })
  }, [data, visibleDiets, selectedBrand])

  // Brand presence per cell (for cell rendering)
  const refBrandPosition = useMemo(() => {
    if (!data || !selectedBrand) return (_dt: string, _kb: number) => null
    const cache = new Map<string, { rank: number; total: number } | null>()
    return (dt: string, kb: number) => {
      const key = `${dt}|${kb}`
      if (cache.has(key)) return cache.get(key)!
      const cell = data.matrix[dt]?.[kb]
      if (!cell) { cache.set(key, null); return null }
      const minPrices = brandMinPrices(cell)
      if (!minPrices.has(selectedBrand)) { cache.set(key, null); return null }
      const sorted = Array.from(minPrices.values()).sort((a, b) => a - b)
      const refPrice = minPrices.get(selectedBrand)!
      const rank = sorted.indexOf(refPrice) + 1
      const result = { rank, total: minPrices.size }
      cache.set(key, result)
      return result
    }
  }, [data, selectedBrand])

  // Blind spot detection for cells (5+ competitors, ref brand absent)
  const isBlindSpot = useMemo(() => {
    if (!data || !selectedBrand) return (_dt: string, _kb: number) => false
    return (dt: string, kb: number) => {
      const cell = data.matrix[dt]?.[kb]
      if (!cell || cell.brandCount < 5) return false
      return !cell.brands.some(b => b.brandName === selectedBrand)
    }
  }, [data, selectedBrand])

  function handleCellClick(diet: string, kcal: number) {
    if (expanded?.diet === diet && expanded?.kcal === kcal) {
      setExpanded(null)
    } else {
      setExpanded({ diet, kcal })
    }
  }

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

  const insightsTitle = selectedBrand ? `Wnioski dla ${selectedBrand}` : 'Najciekawsze luki'
  const insightsIcon = selectedBrand ? Target : Lightbulb

  return (
    <div className="space-y-4">
      {/* Brand selector */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Perspektywa:</span>
            <Select
              value={selectedBrand ?? '__all__'}
              onValueChange={(v) => v && setBrandOverride(v)}
            >
              <SelectTrigger className="w-[260px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie marki (cały rynek)</SelectItem>
                {(brands ?? []).map(b => (
                  <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {React.createElement(insightsIcon, { className: `h-4 w-4 ${selectedBrand ? 'text-green-600' : 'text-amber-500'}` })}
              {insightsTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {insights.map((ins, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    ins.type === 'blind-spot' ? 'bg-orange-400' :
                    ins.type === 'price' ? 'bg-blue-400' : 'bg-amber-400'
                  }`} />
                  <span>{ins.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Grid3X3 className="h-5 w-5 text-violet-500" />
            Macierz luk ofertowych
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Komórka = liczba marek. Kliknij komórkę, żeby zobaczyć szczegóły.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 12, width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{
                    width: 160, textAlign: 'left', paddingRight: 8, paddingLeft: 4,
                    fontWeight: 600, color: 'var(--muted-foreground)', fontSize: 11,
                    position: 'sticky', left: 0, zIndex: 2, background: 'var(--card)',
                  }}>
                    Typ diety
                  </th>
                  {KCAL_BUCKETS.map(kb => (
                    <th key={kb} style={{
                      textAlign: 'center', fontWeight: 600, fontSize: 10,
                      color: 'var(--muted-foreground)', paddingBottom: 4,
                    }}>
                      {kcalBucketLabel(kb)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDiets.map(dt => {
                  const isExpandedRow = expanded?.diet === dt
                  const expandedCell = isExpandedRow ? data.matrix[dt]?.[expanded!.kcal] : null
                  return (
                    <React.Fragment key={dt}>
                      <tr className="heatmap-row">
                        <td
                          onClick={() => isExpandedRow && setExpanded(null)}
                          style={{
                            textAlign: 'left', paddingRight: 8, paddingLeft: 4,
                            color: 'var(--foreground)', whiteSpace: 'nowrap', fontWeight: 500, fontSize: 11,
                            position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)',
                            cursor: isExpandedRow ? 'pointer' : undefined,
                          }}
                        >
                          {dt}
                        </td>
                        {KCAL_BUCKETS.map(kb => {
                          const cell = data.matrix[dt]?.[kb]
                          const count = cell?.brandCount ?? 0
                          const gap = count === 0 && isSmartGap(dt, kb)
                          const isActive = expanded?.diet === dt && expanded?.kcal === kb
                          const pos = refBrandPosition(dt, kb)
                          const blindSpot = isBlindSpot(dt, kb)

                          return (
                            <td
                              key={kb}
                              onClick={() => handleCellClick(dt, kb)}
                              style={{
                                height: 32, textAlign: 'center', fontWeight: 600, fontSize: 12,
                                backgroundColor: gap ? '#FEF3C7' : cellBg(count, maxBrandCount),
                                color: gap ? '#92400E' : cellTextColor(count, maxBrandCount),
                                border: isActive
                                  ? '2px solid hsl(215, 84%, 25%)'
                                  : pos ? '2px solid #16a34a' : '1px solid white',
                                borderRadius: 2,
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 0 0 1px hsl(215, 84%, 25%)' : undefined,
                                position: 'relative',
                              }}
                            >
                              {count > 0 ? count : ''}
                              {pos && (
                                <span style={{
                                  position: 'absolute', bottom: 1, right: 2,
                                  fontSize: 7, fontWeight: 500, lineHeight: 1,
                                  color: pos.rank <= 3 ? '#16a34a' : 'inherit',
                                  opacity: 0.8,
                                }}>
                                  #{pos.rank}/{pos.total}
                                </span>
                              )}
                              {blindSpot && !gap && (
                                <span style={{
                                  position: 'absolute', top: 2, right: 2,
                                  width: 5, height: 5, borderRadius: '50%',
                                  backgroundColor: '#f97316', display: 'inline-block',
                                }} />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                      {isExpandedRow && expandedCell && (
                        <tr>
                          <td colSpan={COL_COUNT} style={{ padding: 0, background: 'var(--muted)', borderRadius: 4 }}>
                            <DetailPanel
                              diet={dt} kcal={expanded!.kcal} cell={expandedCell}
                              matrix={data.matrix} refBrand={selectedBrand}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {extraDietsCount > 0 && (
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setShowAllDiets(v => !v)}>
              <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${showAllDiets ? 'rotate-180' : ''}`} />
              {showAllDiets ? 'Zwiń' : `Pokaż wszystkie typy diet (+${extraDietsCount})`}
            </Button>
          )}

          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: '#FEF3C7', border: '1px solid #e5e7eb', display: 'inline-block' }} />
              Luka rynkowa
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: 'hsl(215, 84%, 80%)', display: 'inline-block' }} />
              Mało marek
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: 'hsl(215, 84%, 45%)', display: 'inline-block' }} />
              Dużo marek
            </span>
            {selectedBrand && (<>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, border: '2px solid #16a34a', display: 'inline-block' }} />
                Twoja marka
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#f97316', display: 'inline-block' }} />
                Biała plama (5+ konkurentów)
              </span>
            </>)}
          </div>
        </CardContent>
      </Card>

      {data.unclassifiedCount > 0 && (
        <Collapsible open={unclassifiedOpen} onOpenChange={setUnclassifiedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-1">
            <ChevronDown className={`h-4 w-4 transition-transform ${unclassifiedOpen ? 'rotate-180' : ''}`} />
            {data.unclassifiedCount} pakietów niesklasyfikowanych (Inne)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {data.unclassifiedNames.map(name => (
                    <Badge key={name} variant="outline" className="text-xs font-normal">{name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
