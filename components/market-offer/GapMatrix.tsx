'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Loader2, Grid3X3, ChevronDown } from 'lucide-react'
import { useMarketGaps, type GapCell } from '@/hooks/supabase/useMarketGaps'
import { DIET_TYPES, KCAL_BUCKETS, kcalBucketLabel } from '@/lib/dietClassification'

function cellColor(brandCount: number): { bg: string; text: string } {
  if (brandCount === 0) return { bg: '#FEF3C7', text: '#92400E' }   // yellow — gap
  if (brandCount <= 2) return { bg: '#FFEDD5', text: '#9A3412' }    // light orange
  return { bg: 'var(--color-background-secondary)', text: 'var(--foreground)' }
}

export function GapMatrix() {
  const { data, isLoading } = useMarketGaps()
  const [unclassifiedOpen, setUnclassifiedOpen] = useState(false)

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

  // Only show diet types that have at least one non-empty cell, exclude "Inne"
  const visibleDiets = DIET_TYPES.filter(dt => {
    if (dt === 'Inne') return false
    return KCAL_BUCKETS.some(kb => (data.matrix[dt]?.[kb]?.brandCount ?? 0) > 0)
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Grid3X3 className="h-5 w-5 text-violet-500" />
            Macierz luk ofertowych
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Komórka = liczba marek oferujących daną kombinację diety i kaloryczności. Żółte = luka rynkowa.
          </p>
        </CardHeader>
        <CardContent>
          <TooltipProvider delay={150}>
            <div className="overflow-x-auto">
              <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 11, width: 'max-content', minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{
                      width: 160, textAlign: 'left', paddingRight: 8, paddingLeft: 4,
                      fontWeight: 600, color: 'var(--muted-foreground)',
                      position: 'sticky', left: 0, zIndex: 2, background: 'var(--card)',
                    }}>
                      Typ diety
                    </th>
                    {KCAL_BUCKETS.map(kb => (
                      <th key={kb} style={{
                        width: 80, textAlign: 'center', fontWeight: 600,
                        color: 'var(--muted-foreground)', paddingBottom: 4,
                      }}>
                        {kcalBucketLabel(kb)} kcal
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDiets.map(dt => (
                    <tr key={dt} className="heatmap-row">
                      <td style={{
                        textAlign: 'left', paddingRight: 8, paddingLeft: 4,
                        color: 'var(--foreground)', whiteSpace: 'nowrap', fontWeight: 500,
                        position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)',
                      }}>
                        {dt}
                      </td>
                      {KCAL_BUCKETS.map(kb => {
                        const cell = data.matrix[dt]?.[kb]
                        if (!cell) return <td key={kb} />
                        return <MatrixCell key={kb} cell={cell} diet={dt} kcal={kb} />
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, flexWrap: 'wrap' }}>
            {([['0 marek — LUKA', '#FEF3C7', '#92400E'], ['1-2 marki', '#FFEDD5', '#9A3412'], ['3+ marek', 'var(--color-background-secondary)', 'var(--foreground)']] as [string, string, string][]).map(([label, bg, text]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                <span style={{ width: 14, height: 14, borderRadius: 2, background: bg, border: '1px solid #e5e7eb', display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unclassified packages notice */}
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

function MatrixCell({ cell, diet, kcal }: { cell: GapCell; diet: string; kcal: number }) {
  const col = cellColor(cell.brandCount)
  const hasData = cell.brandCount > 0

  return (
    <td style={{
      height: 36, textAlign: 'center', fontSize: 10, fontWeight: 500,
      backgroundColor: col.bg, color: col.text,
      border: '1px solid white', borderRadius: 2,
      padding: 0, verticalAlign: 'middle',
    }}>
      {hasData ? (
        <Tooltip>
          <TooltipTrigger style={{ all: 'unset', display: 'block', width: '100%', padding: '2px 4px', cursor: 'default' }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{cell.brandCount}</div>
            <div style={{ fontSize: 9, opacity: 0.8 }}>
              {cell.minPrice!.toFixed(0)}–{cell.maxPrice!.toFixed(0)} zł
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs">
            <p className="font-semibold mb-1">{diet} · {kcal} kcal</p>
            {cell.brands.slice(0, 8).map((b, i) => (
              <p key={i} className="text-muted-foreground">
                {b.brandName}: {b.packageName} — {b.price.toFixed(0)} zł
              </p>
            ))}
            {cell.brands.length > 8 && (
              <p className="text-muted-foreground">...i {cell.brands.length - 8} więcej</p>
            )}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span style={{ fontSize: 9, fontWeight: 600, display: 'block', padding: '2px 4px' }}>LUKA</span>
      )}
    </td>
  )
}
