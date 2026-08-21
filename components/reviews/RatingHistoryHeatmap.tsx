'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Calendar, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ratingColor, formatMonthLabel } from '@/lib/rating-colors'

interface Props {
  brandId: string | null
  excludeDietly: boolean
}

interface CellData {
  avg: number
  count: number
}

const EXCLUDED_BRANDS = new Set(['Nice To Fit You CZ', 'Zdravestravovani'])
const MONTH_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

export function RatingHistoryHeatmap({ brandId, excludeDietly }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['rating-history-heatmap', brandId, excludeDietly],
    queryFn: async () => {
      let query = (supabase as any)
        .from('reviews')
        .select('brand_id, rating, review_date, brands!inner(name)')
        .eq('is_approved', true)

      if (brandId) {
        query = query.eq('brand_id', brandId)
      } else {
        const d = new Date()
        const from = new Date(d.getFullYear(), d.getMonth() - 11, 1)
        query = query.gte('review_date', format(from, 'yyyy-MM-dd'))
      }

      if (excludeDietly) {
        query = query.not('source', 'ilike', '%dietly%')
      }

      const { data: reviews, error } = await query
        .order('review_date', { ascending: true })
        .limit(50000)

      if (error) throw error
      if (!reviews || reviews.length === 0) return null

      // Group by brand + month
      const byBrand = new Map<string, { name: string; byMonth: Map<string, number[]> }>()

      for (const r of reviews as any[]) {
        const name: string = r.brands?.name
        if (!name || EXCLUDED_BRANDS.has(name)) continue

        const monthKey = (r.review_date as string).slice(0, 7)

        let brand = byBrand.get(r.brand_id)
        if (!brand) {
          brand = { name, byMonth: new Map() }
          byBrand.set(r.brand_id, brand)
        }

        const monthRatings = brand.byMonth.get(monthKey)
        if (monthRatings) monthRatings.push(r.rating)
        else brand.byMonth.set(monthKey, [r.rating])
      }

      // Build month series
      let months: string[]
      if (brandId) {
        let oldest = '9999-12'
        for (const b of byBrand.values()) {
          for (const m of b.byMonth.keys()) {
            if (m < oldest) oldest = m
          }
        }
        const now = new Date()
        const currentMonth = format(now, 'yyyy-MM')
        months = []
        const [startY, startM] = oldest.split('-').map(Number)
        let y = startY, m = startM
        while (true) {
          const key = `${y}-${String(m).padStart(2, '0')}`
          months.push(key)
          if (key === currentMonth) break
          m++
          if (m > 12) { m = 1; y++ }
        }
      } else {
        const now = new Date()
        months = []
        for (let i = 11; i >= 0; i--) {
          months.push(format(new Date(now.getFullYear(), now.getMonth() - i, 1), 'yyyy-MM'))
        }
      }

      // Build cells with avg + count
      const MIN_REVIEWS = brandId ? 0 : 10
      const brands = Array.from(byBrand.values())
        .map(v => {
          const allRatings = Array.from(v.byMonth.values()).flat()
          return { name: v.name, totalCount: allRatings.length, overallAvg: allRatings.reduce((a, b) => a + b, 0) / allRatings.length, byMonth: v.byMonth }
        })
        .filter(b => b.totalCount >= MIN_REVIEWS)
        .sort((a, b) => b.overallAvg - a.overallAvg)

      const cells: Record<string, Record<string, CellData | null>> = {}
      for (const brand of brands) {
        cells[brand.name] = {}
        for (const month of months) {
          const rs = brand.byMonth.get(month)
          cells[brand.name][month] = rs
            ? { avg: Math.round(rs.reduce((a, b) => a + b, 0) / rs.length * 100) / 100, count: rs.length }
            : null
        }
      }

      const oldestLabel = formatMonthLabel(months[0])
      const newestLabel = formatMonthLabel(months[months.length - 1])

      return {
        cells,
        brandNames: brands.map(b => b.name),
        months,
        totalMonths: months.length,
        rangeLabel: `${oldestLabel} – ${newestLabel}`,
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.brandNames.length === 0) return null

  const isSingleBrand = !!brandId
  const title = isSingleBrand
    ? `Historia ocen — pełna historia (${data.rangeLabel})`
    : 'Historia ocen — ostatnie 12 miesięcy'
  const subtitle = isSingleBrand
    ? `${data.totalMonths} miesięcy`
    : 'Wszystkie marki z min. 10 opiniami w okresie'

  // Extract unique years for vertical layout
  const years = [...new Set(data.months.map(m => m.split('-')[0]))].sort()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-blue-500" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <TooltipProvider delay={100}>
          {data.brandNames.map((brand, brandIdx) => (
            <div key={brand} className={brandIdx > 0 ? 'mt-6' : ''}>
              {data.brandNames.length > 1 && (
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--foreground)' }}>{brand}</p>
              )}
              <div className="overflow-x-auto">
                <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{
                        width: 36, textAlign: 'right', paddingRight: 6, fontWeight: 400,
                        color: 'var(--muted-foreground)',
                        position: 'sticky', left: 0, zIndex: 2, background: 'var(--card)',
                      }} />
                      {years.map(y => (
                        <th key={y} style={{
                          width: 44, textAlign: 'center', fontWeight: 600,
                          color: 'var(--muted-foreground)', paddingBottom: 4,
                        }}>
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((monthName, monthIdx) => {
                      const mm = String(monthIdx + 1).padStart(2, '0')
                      return (
                        <tr key={mm}>
                          <td style={{
                            textAlign: 'right', paddingRight: 6, color: 'var(--muted-foreground)',
                            fontWeight: 500, whiteSpace: 'nowrap',
                            position: 'sticky', left: 0, zIndex: 1, background: 'var(--card)',
                          }}>
                            {monthName}
                          </td>
                          {years.map(y => {
                            const key = `${y}-${mm}`
                            const inRange = data.months.includes(key)
                            const cell = inRange ? data.cells[brand]?.[key] ?? null : null
                            const col = cell ? ratingColor(cell.avg) : null

                            if (!inRange) {
                              return <td key={y} style={{ width: 44, height: 24 }} />
                            }

                            return (
                              <td key={y} style={{
                                width: 44, height: 24, textAlign: 'center', fontSize: 10, fontWeight: 500,
                                backgroundColor: col ? col.bg : 'var(--color-background-secondary)',
                                color: col ? col.text : 'var(--color-text-tertiary)',
                                border: '1px solid white', borderRadius: 2,
                                padding: 0,
                              }}>
                                {cell ? (
                                  <Tooltip>
                                    <TooltipTrigger
                                      style={{ all: 'unset', display: 'block', width: '100%', lineHeight: '24px', cursor: 'default' }}
                                    >
                                      {cell.avg.toFixed(1)}
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <p>{monthName} {y} — śr. {cell.avg.toFixed(2)}★</p>
                                      <p>Ilość opinii: {cell.count}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : ''}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </TooltipProvider>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
          {([['≥4.5', '#1D9E75'], ['4.0–4.5', '#639922'], ['3.5–4.0', '#BA7517'], ['3.0–3.5', '#D85A30'], ['<3.0', '#A32D2D']] as [string, string][]).map(([label, color]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: color, display: 'inline-block' }} />
              {label}★
            </span>
          ))}
          <span style={{ color: 'var(--muted-foreground)', marginLeft: 'auto', fontSize: 11 }}>Brak danych = szary</span>
        </div>
      </CardContent>
    </Card>
  )
}
