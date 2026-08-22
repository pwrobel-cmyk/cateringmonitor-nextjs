'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Loader2, Grid3X3, ChevronDown, Lightbulb } from 'lucide-react'
import { useMarketGaps, type GapCell } from '@/hooks/supabase/useMarketGaps'
import { KCAL_BUCKETS, kcalBucketLabel, type DietType } from '@/lib/dietClassification'

const PRIMARY_DIETS: DietType[] = [
  'Standard', 'Keto', 'Vege', 'Wegańska', 'Vege+Fish', 'Low IG',
  'Low Carb', 'Sport', 'Bez glutenu/laktozy', 'Hashimoto',
]

const COL_COUNT = KCAL_BUCKETS.length + 1 // diet label + kcal columns

interface InterestingGap {
  diet: string
  kcal: number
  neighborCount: number
  label: string
}

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

// Inline detail panel with max-height transition
function DetailPanel({ diet, kcal, cell, matrix }: {
  diet: string; kcal: number; cell: GapCell
  matrix: Record<string, Record<number, GapCell>>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (ref.current) setHeight(ref.current.scrollHeight)
  }, [diet, kcal, cell])

  const isEmpty = cell.brandCount === 0

  // For gap cells: find nearest neighbors with brands
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
            {cell.brands.map((b, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded border">
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function GapMatrix() {
  const { data, isLoading } = useMarketGaps()
  const [showAllDiets, setShowAllDiets] = useState(false)
  const [unclassifiedOpen, setUnclassifiedOpen] = useState(false)
  const [expanded, setExpanded] = useState<{ diet: string; kcal: number } | null>(null)

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

  const interestingGaps = useMemo(() => {
    if (!data) return []
    const gaps: InterestingGap[] = []

    for (const dt of visibleDiets) {
      const row = data.matrix[dt]
      if (!row) continue
      for (let i = 0; i < KCAL_BUCKETS.length; i++) {
        const kb = KCAL_BUCKETS[i]
        const count = row[kb]?.brandCount ?? 0
        if (count > 0) continue
        const hasLeft = KCAL_BUCKETS.slice(0, i).some(b => (row[b]?.brandCount ?? 0) > 0)
        const hasRight = KCAL_BUCKETS.slice(i + 1).some(b => (row[b]?.brandCount ?? 0) > 0)
        const leftCount = i > 0 ? (row[KCAL_BUCKETS[i - 1]]?.brandCount ?? 0) : 0
        const rightCount = i < KCAL_BUCKETS.length - 1 ? (row[KCAL_BUCKETS[i + 1]]?.brandCount ?? 0) : 0
        if ((hasLeft && hasRight) || leftCount >= 5 || rightCount >= 5) {
          const strongBucket = leftCount >= rightCount
            ? (i > 0 ? KCAL_BUCKETS[i - 1] : kb)
            : (i < KCAL_BUCKETS.length - 1 ? KCAL_BUCKETS[i + 1] : kb)
          const strongCount = Math.max(leftCount, rightCount)
          gaps.push({
            diet: dt, kcal: kb, neighborCount: leftCount + rightCount,
            label: `${dt} ${kcalBucketLabel(kb)} kcal — 0 marek, przy ${strongCount} markach w ${kcalBucketLabel(strongBucket)} kcal`,
          })
        }
      }
    }
    return gaps.sort((a, b) => b.neighborCount - a.neighborCount).slice(0, 5)
  }, [data, visibleDiets])

  const isSmartGap = useMemo(() => {
    const set = new Set(interestingGaps.map(g => `${g.diet}|${g.kcal}`))
    if (!data) return (dt: string, kb: number) => set.has(`${dt}|${kb}`)
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
  }, [data, visibleDiets, interestingGaps])

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

  return (
    <div className="space-y-4">
      {interestingGaps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Najciekawsze luki
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {interestingGaps.map((gap, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{gap.diet}</span> {kcalBucketLabel(gap.kcal as any)} kcal — <span className="text-amber-600 font-medium">0 marek</span>, przy {gap.label.split('przy ')[1]}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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

                          return (
                            <td
                              key={kb}
                              onClick={() => handleCellClick(dt, kb)}
                              style={{
                                height: 32, textAlign: 'center', fontWeight: 600, fontSize: 12,
                                backgroundColor: gap ? '#FEF3C7' : cellBg(count, maxBrandCount),
                                color: gap ? '#92400E' : cellTextColor(count, maxBrandCount),
                                border: isActive ? '2px solid hsl(215, 84%, 25%)' : '1px solid white',
                                borderRadius: 2,
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 0 0 1px hsl(215, 84%, 25%)' : undefined,
                              }}
                            >
                              {count > 0 ? count : ''}
                            </td>
                          )
                        })}
                      </tr>
                      {isExpandedRow && expandedCell && (
                        <tr>
                          <td colSpan={COL_COUNT} style={{ padding: 0, background: 'var(--muted)', borderRadius: 4 }}>
                            <DetailPanel diet={dt} kcal={expanded!.kcal} cell={expandedCell} matrix={data.matrix} />
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
