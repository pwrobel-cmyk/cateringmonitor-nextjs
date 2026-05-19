'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Printer, TrendingUp, ArrowUp, ArrowDown, Send } from 'lucide-react'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'

// ── Types ───────────────────────────────────────────────────────────────────────
interface BrandRank {
  brandId: string; brandName: string; brandLogo: string | null
  avgRating: number; count: number; positivePercent: number; negativePercent: number
  position: number; prevPosition: number | null; change: number | null
}
interface BrandPrice {
  brandId: string; brandName: string; brandLogo: string | null
  avgPrice: number; minPrice: number; maxPrice: number; packageCount: number; position: number
}
interface BrandDiscount {
  brandId: string; brandName: string; brandLogo: string | null
  avgDiscount: number; promoCount: number; position: number
}
interface BrandPriceAfterDiscount {
  brandId: string; brandName: string; brandLogo: string | null
  avgCatalog: number; avgDiscount: number; avgAfterDiscount: number; position: number
}

interface HeatmapData {
  data: Record<string, Record<string, number | null>>
  brands: string[]
  months: string[]
}

interface RankingData {
  ratings: BrandRank[]
  heatmap: HeatmapData
  discountHeatmap: HeatmapData
  prices: BrandPrice[]
  discounts: BrandDiscount[]
  pricesAfterDiscount: BrandPriceAfterDiscount[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
const getRatingColor = (avg: number) => avg >= 4.0 ? '#16a34a' : avg >= 3.5 ? '#d97706' : '#dc2626'

function BrandLogo({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function ChangeIndicator({ change, prevPosition }: { change: number | null; prevPosition: number | null }) {
  if (prevPosition === null) return <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">NEW</Badge>
  if (change === null || change === 0) return <span className="text-muted-foreground text-sm">→</span>
  if (change > 0) return (
    <span className="text-green-600 text-sm font-medium flex items-center gap-0.5">
      <ArrowUp className="h-3.5 w-3.5" />{change}
    </span>
  )
  return (
    <span className="text-red-600 text-sm font-medium flex items-center gap-0.5">
      <ArrowDown className="h-3.5 w-3.5" />{Math.abs(change)}
    </span>
  )
}

// ── Heatmap helpers ──────────────────────────────────────────────────────────────
function formatMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  const names = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
  return names[parseInt(month) - 1] + ' ' + year.slice(2)
}

// ── Heatmap (HTML table) ─────────────────────────────────────────────────────────
function HeatmapChart({ data, brands, months }: {
  data: Record<string, Record<string, number | null>>
  brands: string[]
  months: string[]
}) {
  function ratingColor(v: number): { bg: string; text: string } {
    if (v >= 4.5) return { bg: '#1D9E75', text: '#fff' }
    if (v >= 4.0) return { bg: '#639922', text: '#fff' }
    if (v >= 3.5) return { bg: '#BA7517', text: '#fff' }
    if (v >= 3.0) return { bg: '#D85A30', text: '#fff' }
    return { bg: '#A32D2D', text: '#fff' }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 11, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 140, textAlign: 'right', paddingRight: 8, fontWeight: 400, color: 'var(--muted-foreground)' }} />
            {months.map(m => (
              <th key={m} style={{ width: 46, textAlign: 'center', fontWeight: 500, color: 'var(--muted-foreground)', paddingBottom: 4 }}>
                {formatMonthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {brands.map(brand => (
            <tr key={brand}>
              <td style={{ textAlign: 'right', paddingRight: 8, color: 'var(--foreground)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {brand.length > 18 ? brand.slice(0, 17) + '…' : brand}
              </td>
              {months.map(m => {
                const v = data[brand]?.[m]
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
  )
}

// ── Discount heatmap (HTML table) ────────────────────────────────────────────────
function DiscountHeatmapChart({ data, brands, months }: {
  data: Record<string, Record<string, number | null>>
  brands: string[]
  months: string[]
}) {
  function discountColor(v: number): { bg: string; text: string } {
    if (v <= 15) return { bg: '#FFF3CD', text: '#7A5800' }
    if (v <= 20) return { bg: '#BA7517', text: '#fff' }
    if (v <= 25) return { bg: '#D85A30', text: '#fff' }
    if (v <= 30) return { bg: '#A32D2D', text: '#fff' }
    return { bg: '#501313', text: '#fff' }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 1, fontSize: 11, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 145, textAlign: 'right', paddingRight: 8, fontWeight: 400, color: 'var(--muted-foreground)' }} />
            {months.map(m => (
              <th key={m} style={{ width: 46, textAlign: 'center', fontWeight: 500, color: 'var(--muted-foreground)', paddingBottom: 4 }}>
                {formatMonthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {brands.map(brand => (
            <tr key={brand}>
              <td style={{ textAlign: 'right', paddingRight: 8, color: 'var(--foreground)', whiteSpace: 'nowrap', maxWidth: 145, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {brand.length > 18 ? brand.slice(0, 17) + '…' : brand}
              </td>
              {months.map(m => {
                const v = data[brand]?.[m]
                const col = v != null ? discountColor(v) : null
                return (
                  <td key={m} style={{
                    width: 44, height: 24, textAlign: 'center', fontSize: 10, fontWeight: 500,
                    backgroundColor: col ? col.bg : 'var(--color-background-secondary)',
                    color: col ? col.text : 'var(--color-text-tertiary)',
                    border: '1px solid white', borderRadius: 2,
                  }}>
                    {v != null ? Math.round(v) + '%' : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────────
export function RankingReport({
  dateFrom, dateTo, highlightBrandId,
}: {
  dateFrom: string
  dateTo: string
  highlightBrandId?: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RankingData | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(new Set())
  const [emailExtraEmails, setEmailExtraEmails] = useState('')
  const [sending, setSending] = useState(false)

  const { data: emailUsers = [] } = useQuery({
    queryKey: ['ranking-email-users'],
    enabled: showEmailModal,
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      return (json.users || []) as { id: string; email: string; full_name?: string; status?: string }[]
    },
  })

  const generate = useCallback(async () => {
    setLoading(true)
    setData(null)
    try {
      // Previous analogous period
      const fromDate = parseISO(dateFrom)
      const toDate = parseISO(dateTo)
      const periodDays = differenceInDays(toDate, fromDate) + 1
      const prevTo = subDays(fromDate, 1)
      const prevFrom = subDays(prevTo, periodDays - 1)
      const prevDateFrom = format(prevFrom, 'yyyy-MM-dd')
      const prevDateTo = format(prevTo, 'yyyy-MM-dd')

      // 12-month window for heatmap (always fixed, independent of selected date range)
      const now = new Date()
      const hist12Months: string[] = []
      for (let i = 11; i >= 0; i--) {
        hist12Months.push(format(new Date(now.getFullYear(), now.getMonth() - i, 1), 'yyyy-MM'))
      }
      const hist12From = hist12Months[0] + '-01'
      const hist12To = format(now, 'yyyy-MM-dd')

      const [reviewsRes, prevReviewsRes, priceHistRes, discountsRes, histReviewsRes, discHistRes] = await Promise.all([
        // A — current period ratings
        supabase.from('reviews')
          .select('brand_id, rating, brands(name, logo_url)')
          .eq('is_approved', true)
          .gte('review_date', dateFrom)
          .lte('review_date', dateTo),

        // B — previous period ratings (for rank change arrows)
        supabase.from('reviews')
          .select('brand_id, rating')
          .eq('is_approved', true)
          .gte('review_date', prevDateFrom)
          .lte('review_date', prevDateTo),

        // D — catalog prices  (FK: price_history → package_kcal_ranges → packages → brands)
        supabase.from('price_history')
          .select('price, package_kcal_ranges!price_history_package_kcal_range_id_fkey(packages(brand_id, brands(name, logo_url)))')
          .gte('date_recorded', dateFrom)
          .lte('date_recorded', dateTo),

        // E — discounts  (column name: percentage, not discount_percentage)
        supabase.from('discounts')
          .select('brand_id, percentage, brands(name, logo_url)')
          .gte('valid_from', dateFrom)
          .lte('valid_from', dateTo)
          .not('percentage', 'is', null),

        // C — last 12 months reviews for rating heatmap
        supabase.from('reviews')
          .select('brand_id, rating, review_date, brands(name)')
          .eq('is_approved', true)
          .gte('review_date', hist12From)
          .lte('review_date', hist12To),

        // F — last 12 months discounts for discount heatmap
        supabase.from('discounts')
          .select('brand_id, percentage, valid_from, brands(name)')
          .gte('valid_from', hist12From)
          .not('percentage', 'is', null),
      ])

      // Debug
      console.log('[RankingReport] price_history rows:', priceHistRes.data?.length, priceHistRes.error)
      console.log('[RankingReport] discounts rows:', discountsRes.data?.length, discountsRes.error)
      console.log('[RankingReport] discounts sample:', JSON.stringify(discountsRes.data?.slice(0, 2)))

      // ── Current period ratings ─────────────────────────────────────────────
      const byBrand = new Map<string, { name: string; logo: string | null; rs: number[] }>()
      for (const r of reviewsRes.data ?? []) {
        const b = (r as any).brands
        if (!b) continue
        const ex = byBrand.get(r.brand_id)
        if (ex) ex.rs.push(r.rating)
        else byBrand.set(r.brand_id, { name: b.name, logo: b.logo_url ?? null, rs: [r.rating] })
      }

      const rEntries = Array.from(byBrand.entries())
        .map(([id, v]) => ({
          brandId: id, brandName: v.name, brandLogo: v.logo,
          avgRating: v.rs.reduce((a, b) => a + b, 0) / v.rs.length,
          count: v.rs.length,
          positivePercent: Math.round(v.rs.filter(r => r >= 4).length / v.rs.length * 100),
          negativePercent: Math.round(v.rs.filter(r => r <= 2).length / v.rs.length * 100),
        }))
        .sort((a, b) => b.avgRating - a.avgRating)

      // Previous period ranks
      const prevMap = new Map<string, number[]>()
      for (const r of prevReviewsRes.data ?? []) {
        const ex = prevMap.get(r.brand_id); if (ex) ex.push(r.rating); else prevMap.set(r.brand_id, [r.rating])
      }
      const prevSorted = Array.from(prevMap.entries())
        .map(([id, rs]): [string, number] => [id, rs.reduce((a, b) => a + b, 0) / rs.length])
        .sort((a, b) => b[1] - a[1])
      const prevRankMap = new Map<string, number>(prevSorted.map(([id], i) => [id, i + 1]))

      const ratings: BrandRank[] = rEntries.map((e, i) => {
        const prev = prevRankMap.get(e.brandId) ?? null
        return { ...e, position: i + 1, prevPosition: prev, change: prev !== null ? prev - (i + 1) : null }
      })

      // ── Catalog prices ─────────────────────────────────────────────────────
      const priceMap = new Map<string, { name: string; logo: string | null; ps: number[] }>()
      for (const ph of priceHistRes.data ?? []) {
        const pkr = (ph as any).package_kcal_ranges
        if (!pkr) continue
        const pkg = Array.isArray(pkr) ? pkr[0]?.packages : pkr.packages
        if (!pkg?.brand_id) continue
        const b = Array.isArray(pkg.brands) ? pkg.brands[0] : pkg.brands
        if (!b || !ph.price) continue
        const ex = priceMap.get(pkg.brand_id)
        if (ex) ex.ps.push(ph.price)
        else priceMap.set(pkg.brand_id, { name: b.name, logo: b.logo_url ?? null, ps: [ph.price] })
      }

      const prices: BrandPrice[] = Array.from(priceMap.entries())
        .map(([id, v]) => ({
          brandId: id, brandName: v.name, brandLogo: v.logo,
          avgPrice: Math.round(v.ps.reduce((a, b) => a + b, 0) / v.ps.length),
          minPrice: Math.round(Math.min(...v.ps)),
          maxPrice: Math.round(Math.max(...v.ps)),
          packageCount: v.ps.length, position: 0,
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice)
        .map((e, i) => ({ ...e, position: i + 1 }))

      // ── Discounts ──────────────────────────────────────────────────────────
      const discMap = new Map<string, { name: string; logo: string | null; ds: number[] }>()
      for (const d of discountsRes.data ?? []) {
        const b = (d as any).brands
        const pct = (d as any).percentage
        if (!b || pct == null) continue
        const ex = discMap.get(d.brand_id)
        if (ex) ex.ds.push(pct)
        else discMap.set(d.brand_id, { name: b.name, logo: b.logo_url ?? null, ds: [pct] })
      }

      const discounts: BrandDiscount[] = Array.from(discMap.entries())
        .map(([id, v]) => ({
          brandId: id, brandName: v.name, brandLogo: v.logo,
          avgDiscount: Math.round(v.ds.reduce((a, b) => a + b, 0) / v.ds.length * 10) / 10,
          promoCount: v.ds.length, position: 0,
        }))
        .sort((a, b) => b.avgDiscount - a.avgDiscount)
        .map((e, i) => ({ ...e, position: i + 1 }))

      // ── Price after discount ───────────────────────────────────────────────
      const pMap = new Map(prices.map(p => [p.brandId, p]))
      const dMap = new Map(discounts.map(d => [d.brandId, d]))
      const pricesAfterDiscount: BrandPriceAfterDiscount[] = Array.from(
        new Set([...pMap.keys(), ...dMap.keys()])
      )
        .filter(id => pMap.has(id))
        .map(id => {
          const p = pMap.get(id)!
          const d = dMap.get(id)
          const disc = d?.avgDiscount ?? 0
          return {
            brandId: id, brandName: p.brandName, brandLogo: p.brandLogo,
            avgCatalog: p.avgPrice, avgDiscount: disc,
            avgAfterDiscount: Math.round(p.avgPrice * (1 - disc / 100)), position: 0,
          }
        })
        .sort((a, b) => a.avgAfterDiscount - b.avgAfterDiscount)
        .map((e, i) => ({ ...e, position: i + 1 }))

      // ── Heatmap (12 months) ────────────────────────────────────────────────
      const hmByBrand = new Map<string, { name: string; byMonth: Map<string, number[]> }>()
      for (const r of histReviewsRes.data ?? []) {
        const b = (r as any).brands
        if (!b || !r.review_date) continue
        const month = (r.review_date as string).slice(0, 7)
        const ex = hmByBrand.get(r.brand_id)
        if (ex) {
          const mx = ex.byMonth.get(month)
          if (mx) mx.push(r.rating); else ex.byMonth.set(month, [r.rating])
        } else {
          hmByBrand.set(r.brand_id, { name: b.name, byMonth: new Map([[month, [r.rating]]]) })
        }
      }

      const hmBrands = Array.from(hmByBrand.values())
        .map(v => {
          const allRs = Array.from(v.byMonth.values()).flat()
          return {
            name: v.name,
            totalCount: allRs.length,
            overallAvg: allRs.reduce((a, b) => a + b, 0) / allRs.length,
            byMonth: v.byMonth,
          }
        })
        .filter(b => b.totalCount >= 10)
        .sort((a, b) => b.overallAvg - a.overallAvg)

      const heatmapCells: Record<string, Record<string, number | null>> = {}
      for (const brand of hmBrands) {
        heatmapCells[brand.name] = {}
        for (const month of hist12Months) {
          const rs = brand.byMonth.get(month)
          heatmapCells[brand.name][month] = rs
            ? Math.round(rs.reduce((a, b) => a + b, 0) / rs.length * 100) / 100
            : null
        }
      }

      const heatmap: HeatmapData = {
        data: heatmapCells,
        brands: hmBrands.map(b => b.name),
        months: hist12Months,
      }

      // ── Discount heatmap (12 months) ───────────────────────────────────────
      const discHmByBrand = new Map<string, { name: string; byMonth: Map<string, number[]> }>()
      for (const d of discHistRes.data ?? []) {
        const b = (d as any).brands
        const pct = (d as any).percentage
        const vf = (d as any).valid_from
        if (!b || pct == null || !vf) continue
        const month = (vf as string).slice(0, 7)
        const ex = discHmByBrand.get(d.brand_id)
        if (ex) {
          const mx = ex.byMonth.get(month)
          if (mx) mx.push(pct); else ex.byMonth.set(month, [pct])
        } else {
          discHmByBrand.set(d.brand_id, { name: b.name, byMonth: new Map([[month, [pct]]]) })
        }
      }

      const discHmBrands = Array.from(discHmByBrand.values())
        .map(v => {
          const allDs = Array.from(v.byMonth.values()).flat()
          return {
            name: v.name,
            overallAvg: allDs.reduce((a, b) => a + b, 0) / allDs.length,
            byMonth: v.byMonth,
          }
        })
        .sort((a, b) => b.overallAvg - a.overallAvg)

      const discHeatmapCells: Record<string, Record<string, number | null>> = {}
      for (const brand of discHmBrands) {
        discHeatmapCells[brand.name] = {}
        for (const month of hist12Months) {
          const ds = brand.byMonth.get(month)
          discHeatmapCells[brand.name][month] = ds
            ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length * 10) / 10
            : null
        }
      }

      const discountHeatmap: HeatmapData = {
        data: discHeatmapCells,
        brands: discHmBrands.map(b => b.name),
        months: hist12Months,
      }

      setData({ ratings, heatmap, discountHeatmap, prices, discounts, pricesAfterDiscount })
    } catch (e) {
      console.error('[RankingReport] error:', e)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  const handleSendEmail = async () => {
    if (!data) return
    const selectedRecipients = emailUsers
      .filter(u => emailRecipients.has(u.id))
      .map(u => ({ userId: u.id, email: u.email }))
    const extraList = emailExtraEmails.split('\n').map(e => e.trim()).filter(Boolean).map(e => ({ email: e }))
    const recipients = [...selectedRecipients, ...extraList]
    if (!recipients.length) { toast.error('Brak odbiorców'); return }

    setSending(true)
    try {
      const reportSummary = {
        brandId: null,
        brandName: 'Ranking marek',
        dateFrom,
        dateTo,
        title: `Ranking marek · ${dateFrom} – ${dateTo}`,
        stats: {
          count: data.ratings.reduce((a, b) => a + b.count, 0),
          avgRating: (data.ratings[0]?.avgRating ?? 0).toFixed(2),
          positivePercent: (data.ratings[0]?.positivePercent ?? 0).toString(),
          negativePercent: (data.ratings[0]?.negativePercent ?? 0).toString(),
        },
        ranking: data.ratings.map(r => ({
          name: r.brandName,
          count: r.count,
          avgRating: r.avgRating,
          positivePercent: r.positivePercent,
          negativePercent: r.negativePercent,
          isSelected: r.brandId === highlightBrandId,
        })),
      }

      const res = await fetch('/api/admin/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, reportSummary }),
      })
      const result = await res.json()
      if (result.sent > 0) toast.success(`Wysłano do ${result.sent} odbiorców`)
      if (result.errors?.length) toast.error(`Błędy: ${result.errors.join(', ')}`)
      setShowEmailModal(false)
      setEmailRecipients(new Set())
      setEmailExtraEmails('')
    } catch (e: any) {
      toast.error(e.message || 'Błąd wysyłki')
    } finally {
      setSending(false)
    }
  }

  // Qualified = >=10 reviews; re-number positions
  const qualifiedRatings = (data?.ratings ?? []).filter(r => r.count >= 10).map((r, i) => ({ ...r, position: i + 1 }))
  const excludedRatings = (data?.ratings ?? []).filter(r => r.count < 10)


  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={generate} disabled={loading}>
          {loading
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generuję...</>
            : <><TrendingUp className="h-4 w-4 mr-2" />Generuj ranking</>}
        </Button>
        {data && (
          <>
            <Button variant="outline" onClick={() => handlePrint()}>
              <Printer className="h-4 w-4 mr-2" />Pobierz PDF
            </Button>
            <Button variant="outline" onClick={() => setShowEmailModal(true)}>
              <Send className="h-4 w-4 mr-2" />Wyślij email
            </Button>
          </>
        )}
        {dateFrom && dateTo && (
          <span className="text-sm text-muted-foreground">{dateFrom} – {dateTo}</span>
        )}
      </div>

      {/* Empty state */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-xl text-center text-muted-foreground">
          <TrendingUp className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-lg font-medium">Wybierz zakres dat i kliknij „Generuj ranking"</p>
          <p className="text-sm mt-1 opacity-70">Ranking zostanie wyświetlony tutaj</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div ref={printRef} className="space-y-10">

          {/* SECTION 1 — Rating ranking table (only brands with >=10 reviews) */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking ocen marek</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {qualifiedRatings.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Brak marek z wystarczającą liczbą opinii (min. 10).</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Zmiana</th>
                        <th className="px-3 py-3 w-10" />
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. ocena</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Opinii</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">% poz.</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">% neg.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualifiedRatings.map(r => (
                        <tr
                          key={r.brandId}
                          className={`border-b transition-colors ${r.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'}`}
                        >
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{r.position}</td>
                          <td className="text-center px-4 py-3">
                            <ChangeIndicator change={r.change} prevPosition={r.prevPosition} />
                          </td>
                          <td className="px-3 py-3"><BrandLogo url={r.brandLogo} name={r.brandName} /></td>
                          <td className="px-4 py-3 font-medium">{r.brandName}</td>
                          <td className="text-right px-4 py-3 font-semibold">{r.avgRating.toFixed(2)}</td>
                          <td className="text-right px-4 py-3">{r.count}</td>
                          <td className="text-right px-4 py-3 text-green-600 font-medium">{r.positivePercent}%</td>
                          <td className="text-right px-4 py-3 text-red-600 font-medium">{r.negativePercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Brands excluded due to insufficient reviews */}
              {excludedRatings.length > 0 && (
                <div className="px-4 py-3 border-t bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zbyt mało opinii do rankingu (min. 10)</p>
                  <div className="flex flex-wrap gap-2">
                    {excludedRatings.map(r => (
                      <span key={r.brandId} className="text-xs px-2 py-1 rounded-full border bg-background text-muted-foreground">
                        {r.brandName} <span className="font-medium">{r.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2 — Heatmap: 12-month rating history */}
          {data.heatmap.brands.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historia ocen — ostatnie 12 miesięcy</CardTitle>
                <p className="text-sm text-muted-foreground">Wszystkie marki z min. 10 opiniami w okresie</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <HeatmapChart
                    data={data.heatmap.data}
                    brands={data.heatmap.brands}
                    months={data.heatmap.months}
                  />
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
          )}

          {/* SECTION 3 — Price ranking */}
          {data.prices.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Ranking cen katalogowych</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                        <th className="px-3 py-3 w-10" />
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. cena kat.</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Min</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Max</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pakiety</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.prices.map(p => (
                        <tr key={p.brandId} className={`border-b transition-colors ${p.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'}`}>
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{p.position}</td>
                          <td className="px-3 py-3"><BrandLogo url={p.brandLogo} name={p.brandName} /></td>
                          <td className="px-4 py-3 font-medium">{p.brandName}</td>
                          <td className="text-right px-4 py-3 font-semibold">{p.avgPrice.toLocaleString('pl-PL')} zł</td>
                          <td className="text-right px-4 py-3 text-muted-foreground">{p.minPrice.toLocaleString('pl-PL')} zł</td>
                          <td className="text-right px-4 py-3 text-muted-foreground">{p.maxPrice.toLocaleString('pl-PL')} zł</td>
                          <td className="text-right px-4 py-3">{p.packageCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Ranking cen katalogowych</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Brak danych cenowych dla wybranego okresu.</p>
              </CardContent>
            </Card>
          )}

          {/* SECTION 4 — Discount ranking */}
          {data.discounts.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Ranking rabatów</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                        <th className="px-3 py-3 w-10" />
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. rabat</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Promocji</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.discounts.map(d => (
                        <tr key={d.brandId} className={`border-b transition-colors ${d.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'}`}>
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{d.position}</td>
                          <td className="px-3 py-3"><BrandLogo url={d.brandLogo} name={d.brandName} /></td>
                          <td className="px-4 py-3 font-medium">{d.brandName}</td>
                          <td className="text-right px-4 py-3 font-semibold">{d.avgDiscount}%</td>
                          <td className="text-right px-4 py-3">{d.promoCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Ranking rabatów</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Brak danych rabatowych dla wybranego okresu.</p>
              </CardContent>
            </Card>
          )}

          {/* SECTION 4b — Discount heatmap: 12-month history */}
          {data.discountHeatmap.brands.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historia rabatów — ostatnie 12 miesięcy</CardTitle>
                <p className="text-sm text-muted-foreground">Średni % rabatu per marka per miesiąc · tylko marki które stosowały promocje</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <DiscountHeatmapChart
                    data={data.discountHeatmap.data}
                    brands={data.discountHeatmap.brands}
                    months={data.discountHeatmap.months}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, flexWrap: 'wrap', alignItems: 'center' }}>
                  {([
                    ['Brak', '#f0f0f0', '#555'],
                    ['1–15%', '#FFF3CD', '#7A5800'],
                    ['16–20%', '#BA7517', '#fff'],
                    ['21–25%', '#D85A30', '#fff'],
                    ['26–30%', '#A32D2D', '#fff'],
                    ['>30%', '#501313', '#fff'],
                  ] as [string, string, string][]).map(([label, bg, fg]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 2, background: bg, border: label === 'Brak' ? '1px solid #ccc' : undefined, display: 'inline-block' }} />
                      <span style={{ color: fg === '#fff' ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{label}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION 5 — Price after discount */}
          {data.pricesAfterDiscount.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Ranking cen po rabacie</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                        <th className="px-3 py-3 w-10" />
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. cena kat.</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. rabat</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. cena po rab.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pricesAfterDiscount.map(p => (
                        <tr key={p.brandId} className={`border-b transition-colors ${p.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'}`}>
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{p.position}</td>
                          <td className="px-3 py-3"><BrandLogo url={p.brandLogo} name={p.brandName} /></td>
                          <td className="px-4 py-3 font-medium">{p.brandName}</td>
                          <td className="text-right px-4 py-3 text-muted-foreground">{p.avgCatalog.toLocaleString('pl-PL')} zł</td>
                          <td className="text-right px-4 py-3 text-muted-foreground">{p.avgDiscount > 0 ? `-${p.avgDiscount}%` : '—'}</td>
                          <td className="text-right px-4 py-3 font-semibold text-green-700">{p.avgAfterDiscount.toLocaleString('pl-PL')} zł</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Email modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wyślij ranking emailem</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1">
            {/* System users */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Użytkownicy systemu</Label>
                <div className="flex gap-1">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setEmailRecipients(new Set(emailUsers.filter(u => u.status === 'active').map(u => u.id)))}
                  >
                    Zaznacz aktywnych
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button className="text-xs text-muted-foreground hover:underline" onClick={() => setEmailRecipients(new Set())}>
                    Wyczyść
                  </button>
                </div>
              </div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto border rounded-md p-1">
                {emailUsers.filter(u => u.status === 'active' || u.status === 'trial').map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={emailRecipients.has(u.id)}
                      onChange={e => setEmailRecipients(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(u.id) : next.delete(u.id)
                        return next
                      })}
                      className="rounded flex-shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{u.full_name || u.email}</span>
                      {u.full_name && <span className="text-xs text-muted-foreground">{u.email}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Extra emails */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dodatkowe emaile (jeden na linię)</Label>
              <Textarea
                placeholder={"email@example.com\nkolejny@firma.pl"}
                value={emailExtraEmails}
                onChange={e => setEmailExtraEmails(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="pt-1 border-t flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>Anuluj</Button>
              <Button onClick={handleSendEmail} disabled={sending}>
                {sending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wysyłam...</>
                  : <><Send className="h-4 w-4 mr-2" />Wyślij ranking</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
