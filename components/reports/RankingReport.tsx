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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
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

interface RankingData {
  ratings: BrandRank[]
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

function RatingTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border rounded shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{d.fullName}</p>
      <p>Śr. ocena: <strong>{d.avgRating.toFixed(2)}</strong></p>
      <p>Opinii: <strong>{d.count}</strong></p>
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

      const [reviewsRes, prevReviewsRes, priceHistRes, discountsRes] = await Promise.all([
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

        // E — discounts
        supabase.from('discounts')
          .select('brand_id, discount_percentage, brands(name, logo_url)')
          .gte('valid_from', dateFrom)
          .lte('valid_from', dateTo)
          .not('discount_percentage', 'is', null),
      ])

      // Debug
      console.log('[RankingReport] price_history rows:', priceHistRes.data?.length, priceHistRes.error)
      console.log('[RankingReport] discounts rows:', discountsRes.data?.length, discountsRes.error)

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

      setData({ ratings, prices, discounts, pricesAfterDiscount })
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

  // Bar chart data (top 8 by avgRating)
  const barData = data?.ratings.slice(0, 8).map(r => ({
    name: r.brandName.length > 14 ? r.brandName.slice(0, 13) + '…' : r.brandName,
    fullName: r.brandName,
    avgRating: Math.round(r.avgRating * 100) / 100,
    count: r.count,
  })) ?? []

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

          {/* SECTION 1 — Rating ranking table */}
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
            </CardContent>
          </Card>

          {/* SECTION 2 — Bar chart: avgRating per brand (top 8) */}
          {barData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Średnia ocena marek w wybranym okresie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 12 }} />
                      <Tooltip content={<RatingTooltip />} />
                      <Bar dataKey="avgRating" radius={[4, 4, 0, 0]}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={getRatingColor(entry.avgRating)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 justify-center mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-[#16a34a]" />≥ 4.0 (wysoka)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-[#d97706]" />3.5 – 4.0 (średnia)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-[#dc2626]" />{'< 3.5 (niska)'}</span>
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
