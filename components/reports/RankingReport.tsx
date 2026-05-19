'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Printer, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, subDays, startOfWeek, differenceInDays, parseISO } from 'date-fns'
import { useReactToPrint } from 'react-to-print'

const BRAND_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d']

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
interface WeekPoint { week: string; [key: string]: string | number }

interface RankingData {
  ratings: BrandRank[]
  historyChart: WeekPoint[]
  top8Names: string[]
  prices: BrandPrice[]
  discounts: BrandDiscount[]
  pricesAfterDiscount: BrandPriceAfterDiscount[]
}

function BrandLogo({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
  }
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function ChangeIndicator({ change, prevPosition }: { change: number | null; prevPosition: number | null }) {
  if (prevPosition === null) {
    return <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">NEW</Badge>
  }
  if (change === null || change === 0) {
    return <span className="text-muted-foreground text-sm">→</span>
  }
  if (change > 0) {
    return (
      <span className="text-green-600 text-sm font-medium flex items-center gap-0.5">
        <ArrowUp className="h-3.5 w-3.5" />{change}
      </span>
    )
  }
  return (
    <span className="text-red-600 text-sm font-medium flex items-center gap-0.5">
      <ArrowDown className="h-3.5 w-3.5" />{Math.abs(change)}
    </span>
  )
}

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
      // History: last 60 days
      const histFrom = format(subDays(new Date(), 60), 'yyyy-MM-dd')
      const histTo = format(new Date(), 'yyyy-MM-dd')

      const [reviewsRes, prevReviewsRes, histReviewsRes, priceHistRes, discountsRes] = await Promise.all([
        supabase.from('reviews')
          .select('brand_id, rating, brands(name, logo_url)')
          .eq('is_approved', true).gte('review_date', dateFrom).lte('review_date', dateTo),
        supabase.from('reviews')
          .select('brand_id, rating')
          .eq('is_approved', true).gte('review_date', prevDateFrom).lte('review_date', prevDateTo),
        supabase.from('reviews')
          .select('brand_id, rating, review_date, brands(name)')
          .eq('is_approved', true).gte('review_date', histFrom).lte('review_date', histTo),
        supabase.from('price_history')
          .select('price, packages(brand_id, brands(name, logo_url))')
          .gte('recorded_at', dateFrom).lte('recorded_at', dateTo),
        supabase.from('discounts')
          .select('brand_id, discount_percentage, brands(name, logo_url)')
          .gte('valid_from', dateFrom).lte('valid_from', dateTo)
          .not('discount_percentage', 'is', null),
      ])

      // ── Current period ratings ────────────────────────────────────────────────
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

      // ── Previous period ranks ─────────────────────────────────────────────────
      const prevMap = new Map<string, number[]>()
      for (const r of prevReviewsRes.data ?? []) {
        const ex = prevMap.get(r.brand_id)
        if (ex) ex.push(r.rating); else prevMap.set(r.brand_id, [r.rating])
      }
      const prevSorted = Array.from(prevMap.entries())
        .map(([id, rs]): [string, number] => [id, rs.reduce((a, b) => a + b, 0) / rs.length])
        .sort((a, b) => b[1] - a[1])
      const prevRankMap = new Map<string, number>(prevSorted.map(([id], i) => [id, i + 1]))

      const ratings: BrandRank[] = rEntries.map((e, i) => {
        const prev = prevRankMap.get(e.brandId) ?? null
        return { ...e, position: i + 1, prevPosition: prev, change: prev !== null ? prev - (i + 1) : null }
      })

      // ── History chart (last 60 days, weekly) ─────────────────────────────────
      const top8 = ratings.slice(0, 8)
      const weekMap = new Map<string, Map<string, number[]>>()
      for (const r of histReviewsRes.data ?? []) {
        const b = (r as any).brands
        if (!b || !r.review_date) continue
        const wk = format(startOfWeek(parseISO(r.review_date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
        if (!weekMap.has(wk)) weekMap.set(wk, new Map())
        const bm = weekMap.get(wk)!
        if (!bm.has(r.brand_id)) bm.set(r.brand_id, [])
        bm.get(r.brand_id)!.push(r.rating)
      }

      const historyChart: WeekPoint[] = Array.from(weekMap.keys()).sort().map(wk => {
        const bm = weekMap.get(wk)!
        const ranked = Array.from(bm.entries())
          .map(([id, rs]) => ({ id, avg: rs.reduce((a, b) => a + b, 0) / rs.length }))
          .sort((a, b) => b.avg - a.avg)
        const rankMap = new Map(ranked.map((e, i) => [e.id, i + 1]))
        const pt: WeekPoint = { week: format(parseISO(wk), 'dd.MM') }
        for (const br of top8) {
          const rk = rankMap.get(br.brandId)
          if (rk !== undefined) pt[br.brandName] = rk
        }
        return pt
      })

      // ── Prices ───────────────────────────────────────────────────────────────
      const priceMap = new Map<string, { name: string; logo: string | null; ps: number[] }>()
      for (const ph of priceHistRes.data ?? []) {
        const pkg = (ph as any).packages
        if (!pkg?.brand_id) continue
        const b = pkg.brands
        if (!b) continue
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

      // ── Discounts ────────────────────────────────────────────────────────────
      const discMap = new Map<string, { name: string; logo: string | null; ds: number[] }>()
      for (const d of discountsRes.data ?? []) {
        const b = (d as any).brands
        if (!b || d.discount_percentage == null) continue
        const ex = discMap.get(d.brand_id)
        if (ex) ex.ds.push(d.discount_percentage)
        else discMap.set(d.brand_id, { name: b.name, logo: b.logo_url ?? null, ds: [d.discount_percentage] })
      }
      const discounts: BrandDiscount[] = Array.from(discMap.entries())
        .map(([id, v]) => ({
          brandId: id, brandName: v.name, brandLogo: v.logo,
          avgDiscount: Math.round(v.ds.reduce((a, b) => a + b, 0) / v.ds.length * 10) / 10,
          promoCount: v.ds.length, position: 0,
        }))
        .sort((a, b) => b.avgDiscount - a.avgDiscount)
        .map((e, i) => ({ ...e, position: i + 1 }))

      // ── Price after discount ─────────────────────────────────────────────────
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

      setData({
        ratings, historyChart, top8Names: top8.map(b => b.brandName),
        prices, discounts, pricesAfterDiscount,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

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
          <Button variant="outline" onClick={() => handlePrint()}>
            <Printer className="h-4 w-4 mr-2" />Pobierz PDF
          </Button>
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

          {/* SECTION 1 — Rating ranking */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking ocen marek</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
                    {data.ratings.map(r => (
                      <tr
                        key={r.brandId}
                        className={`border-b transition-colors ${
                          r.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'
                        }`}
                      >
                        <td className="text-center px-4 py-3 font-bold text-muted-foreground">{r.position}</td>
                        <td className="text-center px-4 py-3">
                          <ChangeIndicator change={r.change} prevPosition={r.prevPosition} />
                        </td>
                        <td className="px-3 py-3">
                          <BrandLogo url={r.brandLogo} name={r.brandName} />
                        </td>
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
            </CardContent>
          </Card>

          {/* SECTION 2 — History chart */}
          {data.historyChart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historia rankingu (ostatnie 2 miesiące)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.historyChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis
                        reversed
                        domain={['auto', 'auto']}
                        allowDecimals={false}
                        label={{ value: 'Pozycja', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 12 } }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [`#${value}`, String(name ?? '')]}
                        labelFormatter={(l: unknown) => `Tydzień ${l}`}
                      />
                      <Legend />
                      {data.top8Names.map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={BRAND_COLORS[i]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION 3 — Price ranking */}
          {data.prices.length > 0 && (
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
                        <tr
                          key={p.brandId}
                          className={`border-b transition-colors ${
                            p.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'
                          }`}
                        >
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{p.position}</td>
                          <td className="px-3 py-3">
                            <BrandLogo url={p.brandLogo} name={p.brandName} />
                          </td>
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
          )}

          {/* SECTION 4 — Discount ranking */}
          {data.discounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ranking rabatów</CardTitle>
              </CardHeader>
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
                        <tr
                          key={d.brandId}
                          className={`border-b transition-colors ${
                            d.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'
                          }`}
                        >
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{d.position}</td>
                          <td className="px-3 py-3">
                            <BrandLogo url={d.brandLogo} name={d.brandName} />
                          </td>
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
          )}

          {/* SECTION 5 — Price after discount */}
          {data.pricesAfterDiscount.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ranking cen po rabacie</CardTitle>
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
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. rabat</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. cena po rab.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pricesAfterDiscount.map(p => (
                        <tr
                          key={p.brandId}
                          className={`border-b transition-colors ${
                            p.brandId === highlightBrandId ? 'bg-primary/10' : 'hover:bg-muted/20'
                          }`}
                        >
                          <td className="text-center px-4 py-3 font-bold text-muted-foreground">{p.position}</td>
                          <td className="px-3 py-3">
                            <BrandLogo url={p.brandLogo} name={p.brandName} />
                          </td>
                          <td className="px-4 py-3 font-medium">{p.brandName}</td>
                          <td className="text-right px-4 py-3 text-muted-foreground">{p.avgCatalog.toLocaleString('pl-PL')} zł</td>
                          <td className="text-right px-4 py-3 text-muted-foreground">
                            {p.avgDiscount > 0 ? `-${p.avgDiscount}%` : '—'}
                          </td>
                          <td className="text-right px-4 py-3 font-semibold text-green-700">
                            {p.avgAfterDiscount.toLocaleString('pl-PL')} zł
                          </td>
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
    </div>
  )
}
