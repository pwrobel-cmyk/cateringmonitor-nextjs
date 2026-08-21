'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ratingColor, formatMonthLabel } from '@/lib/rating-colors'

interface Props {
  brandId: string | null
  excludeDietly: boolean
}

const EXCLUDED_BRANDS = new Set(['Nice To Fit You CZ', 'Zdravestravovani'])

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
        // All brands, last 12 months
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

        const monthKey = (r.review_date as string).slice(0, 7) // 'YYYY-MM'

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
        // Full history: from oldest month to current
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
        // Last 12 months
        const now = new Date()
        months = []
        for (let i = 11; i >= 0; i--) {
          months.push(format(new Date(now.getFullYear(), now.getMonth() - i, 1), 'yyyy-MM'))
        }
      }

      // Build heatmap cells and filter brands
      const MIN_REVIEWS = brandId ? 0 : 10
      const brands = Array.from(byBrand.values())
        .map(v => {
          const allRatings = Array.from(v.byMonth.values()).flat()
          return { name: v.name, totalCount: allRatings.length, overallAvg: allRatings.reduce((a, b) => a + b, 0) / allRatings.length, byMonth: v.byMonth }
        })
        .filter(b => b.totalCount >= MIN_REVIEWS)
        .sort((a, b) => b.overallAvg - a.overallAvg)

      const cells: Record<string, Record<string, number | null>> = {}
      for (const brand of brands) {
        cells[brand.name] = {}
        for (const month of months) {
          const rs = brand.byMonth.get(month)
          cells[brand.name][month] = rs
            ? Math.round(rs.reduce((a, b) => a + b, 0) / rs.length * 100) / 100
            : null
        }
      }

      // Build subtitle with date range
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
        <div className="overflow-x-auto">
          <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 11, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{
                  width: 140, textAlign: 'right', paddingRight: 8, fontWeight: 400,
                  color: 'var(--muted-foreground)',
                  position: isSingleBrand ? 'sticky' : undefined,
                  left: isSingleBrand ? 0 : undefined,
                  zIndex: isSingleBrand ? 2 : undefined,
                  background: 'var(--card)',
                }} />
                {data.months.map(m => (
                  <th key={m} style={{
                    width: 46, textAlign: 'center', fontWeight: 500,
                    color: 'var(--muted-foreground)', paddingBottom: 4,
                  }}>
                    {formatMonthLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.brandNames.map(brand => (
                <tr key={brand}>
                  <td style={{
                    textAlign: 'right', paddingRight: 8, color: 'var(--foreground)',
                    whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
                    position: isSingleBrand ? 'sticky' : undefined,
                    left: isSingleBrand ? 0 : undefined,
                    zIndex: isSingleBrand ? 1 : undefined,
                    background: 'var(--card)',
                  }}>
                    {brand.length > 18 ? brand.slice(0, 17) + '\u2026' : brand}
                  </td>
                  {data.months.map(m => {
                    const v = data.cells[brand]?.[m]
                    const col = v != null ? ratingColor(v) : null
                    return (
                      <td key={m} style={{
                        width: 44, height: 24, textAlign: 'center', fontSize: 10, fontWeight: 500,
                        backgroundColor: col ? col.bg : 'var(--color-background-secondary)',
                        color: col ? col.text : 'var(--color-text-tertiary)',
                        border: '1px solid white', borderRadius: 2,
                      }}>
                        {v != null ? v.toFixed(1) : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
