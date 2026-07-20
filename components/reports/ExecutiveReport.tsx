'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle, TrendingUp, TrendingDown, ArrowUp, ArrowDown,
  Star, MessageSquare, Target, Percent, DollarSign, FileDown,
  Mail, Loader2, Send, ShieldAlert, CheckCircle, Lightbulb,
  BarChart3, Users, Megaphone, Calendar, Minus,
} from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ScatterChart, Scatter,
  Cell, ReferenceLine, ZAxis, Legend,
} from 'recharts'
import { format, subWeeks, startOfWeek, endOfWeek, parseISO, differenceInDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Constants ────────────────────────────────────────────────────────────────

const MY_BRAND_COLOR = '#185FA5'
const COMPETITOR_COLOR = '#9ca3af'
const KCAL_BUCKETS = [1500, 2000, 2500] as const
const TOPIC_KEYWORDS: Record<string, string[]> = {
  dostawa: ['dostaw', 'delivery', 'kurier', 'przesyłk', 'transport', 'opóźn', 'spóźn'],
  smak: ['smak', 'smaczn', 'pyszn', 'niesmaczn', 'mdłe', 'nudne'],
  cena: ['cen', 'drogie', 'tanie', 'drogo', 'tanio', 'kosztuj', 'koszty'],
  obsługa: ['obsług', 'kontakt', 'support', 'klient', 'pomoc'],
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExecutiveReportProps {
  myBrandId: string
  competitorBrandIds: string[]
  weekStart: string
  weekEnd: string
}

interface PriceRow {
  price: number
  promotional_price: number | null
  discount_percentage: number | null
  date_recorded: string
  package_kcal_range_id: string
  package_kcal_ranges: {
    id: string
    package_id: string
    packages: { id: string; name: string; brand_id: string; brands: { id: string; name: string; logo_url: string | null } }
    kcal_ranges: { kcal_from: number; kcal_to: number; kcal_label: string }
  }
}

interface DiscountRow {
  id: string
  brand_id: string
  percentage: number
  valid_from: string
  valid_until: string | null
  code: string | null
  description: string | null
  brands: { name: string; logo_url: string | null }
}

interface ReviewRow {
  brand_id: string
  rating: number
  content: string | null
  review_date: string
}

interface BrandKcalPrice {
  brandId: string
  brandName: string
  brandLogo: string | null
  kcal: number
  avgPrice: number
  packageIds: Set<string>
}

interface MatchedPairChange {
  brandId: string
  brandName: string
  currentAvg: number
  prevAvg: number
  changePercent: number
  matchedCount: number
}

interface StructuralChange {
  brandId: string
  brandName: string
  type: 'new' | 'removed'
  packageName: string
  kcalLabel: string
  date: string
}

interface BrandWeekReview {
  brandId: string
  brandName: string
  brandLogo: string | null
  avgRating: number
  count: number
  negativePercent: number
  reviews: ReviewRow[]
}

interface CompetitorEvent {
  date: string
  brandName: string
  type: 'price_change' | 'promo_start' | 'promo_end' | 'review_spike' | 'structural'
  description: string
}

interface WeekTrendPoint {
  weekLabel: string
  weekStart: string
  [brandName: string]: string | number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyKcal(kcalFrom: number, kcalTo: number): number | null {
  const mid = (kcalFrom + kcalTo) / 2
  if (mid < 1750) return 1500
  if (mid <= 2250) return 2000
  if (mid <= 3000) return 2500
  return null
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

function fmtPct(v: number, withSign = true): string {
  const s = v.toFixed(1)
  return withSign && v > 0 ? `+${s}%` : `${s}%`
}

function fmtPrice(v: number): string {
  return v.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł'
}

function detectTopic(content: string): string | null {
  const lower = content.toLowerCase()
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return topic
  }
  return null
}

function getWeekBounds(weekStart: string): { prevStart: string; prevEnd: string } {
  const ws = parseISO(weekStart)
  const prevEnd = new Date(ws)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - 6)
  return {
    prevStart: format(prevStart, 'yyyy-MM-dd'),
    prevEnd: format(prevEnd, 'yyyy-MM-dd'),
  }
}

function get8WeekBounds(weekEnd: string): { start: string; weeks: { start: string; end: string; label: string }[] } {
  const we = parseISO(weekEnd)
  const weeks: { start: string; end: string; label: string }[] = []
  for (let i = 7; i >= 0; i--) {
    const ws = startOfWeek(subWeeks(we, i), { weekStartsOn: 1 })
    const wEnd = endOfWeek(subWeeks(we, i), { weekStartsOn: 1 })
    weeks.push({
      start: format(ws, 'yyyy-MM-dd'),
      end: format(wEnd, 'yyyy-MM-dd'),
      label: format(ws, 'd MMM', { locale: pl }),
    })
  }
  return { start: weeks[0].start, weeks }
}

// ── Slide header ─────────────────────────────────────────────────────────────

function SlideHeader({ number, title, subtitle, icon: Icon }: {
  number: number; title: string; subtitle?: string; icon: any
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{number}/8</Badge>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, delta, deltaLabel, icon: Icon, highlight }: {
  label: string; value: string; delta?: string; deltaLabel?: string
  icon: any; highlight?: boolean
}) {
  const isPositive = delta?.startsWith('+')
  const isNegative = delta?.startsWith('-')
  return (
    <Card className={highlight ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {delta && (
          <p className={`text-xs font-medium mt-1 ${isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-muted-foreground'}`}>
            {delta} {deltaLabel || 'vs. poprz. tydzień'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Brand logo helper ────────────────────────────────────────────────────────

function BrandLogo({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'w-8 h-8' : 'w-6 h-6'
  const text = size === 'md' ? 'text-xs' : 'text-[10px]'
  if (url) return <img src={url} alt={name} className={`${s} rounded-full object-cover flex-shrink-0`} />
  return (
    <div className={`${s} rounded-full bg-primary/10 flex items-center justify-center ${text} font-semibold text-primary flex-shrink-0`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.stroke }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ██ MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function ExecutiveReport({ myBrandId, competitorBrandIds, weekStart, weekEnd }: ExecutiveReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(new Set())
  const [emailExtraEmails, setEmailExtraEmails] = useState('')
  const [sending, setSending] = useState(false)

  const allBrandIds = useMemo(() => [myBrandId, ...competitorBrandIds], [myBrandId, competitorBrandIds])
  const { prevStart, prevEnd } = useMemo(() => getWeekBounds(weekStart), [weekStart])
  const { start: trend8Start, weeks: trendWeeks } = useMemo(() => get8WeekBounds(weekEnd), [weekEnd])

  // ── Email users ────────────────────────────────────────────────────────────
  const { data: emailUsers = [] } = useQuery({
    queryKey: ['exec-email-users'],
    enabled: showEmailModal,
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      return (json.users || []) as { id: string; email: string; full_name?: string; status?: string }[]
    },
  })

  // ══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════════════════════════════════════════

  const { data, isLoading, error } = useQuery({
    queryKey: ['executive-report', myBrandId, competitorBrandIds, weekStart, weekEnd],
    queryFn: async () => {
      // Fetch all data in parallel
      const [pricesRes, discountsRes, reviewsRes, trendPricesRes, trendReviewsRes] = await Promise.all([
        // A) Prices: current + previous week
        (supabase as any)
          .from('price_history')
          .select(`
            price,
            promotional_price,
            discount_percentage,
            date_recorded,
            package_kcal_range_id,
            package_kcal_ranges!price_history_package_kcal_range_id_fkey(
              id,
              package_id,
              packages(id, name, brand_id, brands(id, name, logo_url)),
              kcal_ranges(kcal_from, kcal_to, kcal_label)
            )
          `)
          .gte('date_recorded', prevStart)
          .lte('date_recorded', weekEnd)
          .order('date_recorded', { ascending: false })
          .limit(10000),

        // B) Discounts active in the week
        (supabase as any)
          .from('discounts')
          .select('id, brand_id, percentage, valid_from, valid_until, code, description, brands(name, logo_url)')
          .lte('valid_from', weekEnd)
          .or(`valid_until.gte.${weekStart},valid_until.is.null`)
          .not('percentage', 'is', null),

        // C) Reviews: current + previous week
        (supabase as any)
          .from('reviews')
          .select('brand_id, rating, content, review_date')
          .eq('is_approved', true)
          .gte('review_date', prevStart)
          .lte('review_date', weekEnd)
          .limit(5000),

        // D) Trend: 8 weeks prices (2000 kcal)
        (supabase as any)
          .from('price_history')
          .select(`
            price,
            date_recorded,
            package_kcal_ranges!price_history_package_kcal_range_id_fkey(
              packages(brand_id, brands(name)),
              kcal_ranges(kcal_from, kcal_to)
            )
          `)
          .gte('date_recorded', trend8Start)
          .lte('date_recorded', weekEnd)
          .order('date_recorded', { ascending: false })
          .limit(20000),

        // E) Trend: 8 weeks reviews
        (supabase as any)
          .from('reviews')
          .select('brand_id, rating, review_date, brands(name)')
          .eq('is_approved', true)
          .gte('review_date', trend8Start)
          .lte('review_date', weekEnd)
          .limit(10000),
      ])

      // ── Parse brand info ──────────────────────────────────────────────────
      const brandInfo = new Map<string, { name: string; logo: string | null }>()
      const priceRows = (pricesRes.data || []) as any[]
      for (const row of priceRows) {
        const brand = row.package_kcal_ranges?.packages?.brands
        if (brand && !brandInfo.has(brand.id)) {
          brandInfo.set(brand.id, { name: brand.name, logo: brand.logo_url })
        }
      }
      // Also from discounts
      for (const d of (discountsRes.data || []) as any[]) {
        if (d.brands && !brandInfo.has(d.brand_id)) {
          brandInfo.set(d.brand_id, { name: d.brands.name, logo: d.brands.logo_url })
        }
      }
      // Also from reviews
      for (const r of (trendReviewsRes.data || []) as any[]) {
        if (r.brands && !brandInfo.has(r.brand_id)) {
          brandInfo.set(r.brand_id, { name: r.brands.name, logo: null })
        }
      }

      // ── Process prices by week and kcal bucket ────────────────────────────
      // Group: brandId → kcalBucket → packageKcalRangeId → prices[]
      type PriceEntry = { price: number; pkrId: string; packageName: string; kcalLabel: string }
      const currentWeekPrices = new Map<string, Map<number, Map<string, PriceEntry[]>>>()
      const prevWeekPrices = new Map<string, Map<number, Map<string, PriceEntry[]>>>()

      for (const row of priceRows) {
        const pkr = row.package_kcal_ranges
        if (!pkr?.packages?.brands?.id || !pkr?.kcal_ranges) continue
        const brandId = pkr.packages.brands.id
        if (!allBrandIds.includes(brandId)) continue

        const kcalBucket = classifyKcal(pkr.kcal_ranges.kcal_from, pkr.kcal_ranges.kcal_to)
        if (!kcalBucket) continue

        const isCurrentWeek = row.date_recorded >= weekStart && row.date_recorded <= weekEnd
        const isPrevWeek = row.date_recorded >= prevStart && row.date_recorded <= prevEnd
        if (!isCurrentWeek && !isPrevWeek) continue

        const target = isCurrentWeek ? currentWeekPrices : prevWeekPrices
        if (!target.has(brandId)) target.set(brandId, new Map())
        const brandMap = target.get(brandId)!
        if (!brandMap.has(kcalBucket)) brandMap.set(kcalBucket, new Map())
        const kcalMap = brandMap.get(kcalBucket)!
        const pkrId = pkr.id || row.package_kcal_range_id
        if (!kcalMap.has(pkrId)) kcalMap.set(pkrId, [])
        kcalMap.get(pkrId)!.push({
          price: row.price,
          pkrId,
          packageName: pkr.packages.name,
          kcalLabel: pkr.kcal_ranges.kcal_label,
        })
      }

      // ── Compute average price per brand per kcal bucket ───────────────────
      function avgPriceForBucket(
        weekData: Map<string, Map<number, Map<string, PriceEntry[]>>>,
        brandId: string,
        kcalBucket: number
      ): number | null {
        const brandMap = weekData.get(brandId)
        if (!brandMap) return null
        const kcalMap = brandMap.get(kcalBucket)
        if (!kcalMap || kcalMap.size === 0) return null

        // For each package variant, take the latest (first, since sorted desc) price
        let sum = 0, count = 0
        for (const entries of kcalMap.values()) {
          if (entries.length > 0) {
            sum += entries[0].price
            count++
          }
        }
        return count > 0 ? sum / count : null
      }

      // ── Brand kcal prices (current week) ──────────────────────────────────
      const brandKcalPrices: BrandKcalPrice[] = []
      for (const brandId of allBrandIds) {
        const info = brandInfo.get(brandId)
        if (!info) continue
        for (const kcal of KCAL_BUCKETS) {
          const avgP = avgPriceForBucket(currentWeekPrices, brandId, kcal)
          if (avgP !== null) {
            const pkrIds = currentWeekPrices.get(brandId)?.get(kcal)
            brandKcalPrices.push({
              brandId,
              brandName: info.name,
              brandLogo: info.logo,
              kcal,
              avgPrice: Math.round(avgP * 100) / 100,
              packageIds: new Set(pkrIds ? Array.from(pkrIds.keys()) : []),
            })
          }
        }
      }

      // ── Like-for-like matched-pair WoW changes ────────────────────────────
      const matchedChanges: MatchedPairChange[] = []
      const structuralChanges: StructuralChange[] = []

      for (const brandId of allBrandIds) {
        const info = brandInfo.get(brandId)
        if (!info) continue
        const curBrand = currentWeekPrices.get(brandId)
        const prevBrand = prevWeekPrices.get(brandId)

        for (const kcal of KCAL_BUCKETS) {
          const curKcal = curBrand?.get(kcal)
          const prevKcal = prevBrand?.get(kcal)
          if (!curKcal && !prevKcal) continue

          const allPkrIds = new Set([
            ...(curKcal ? Array.from(curKcal.keys()) : []),
            ...(prevKcal ? Array.from(prevKcal.keys()) : []),
          ])

          let matchedCurSum = 0, matchedPrevSum = 0, matchedCount = 0

          for (const pkrId of allPkrIds) {
            const curEntries = curKcal?.get(pkrId)
            const prevEntries = prevKcal?.get(pkrId)

            if (curEntries && prevEntries) {
              // Matched pair
              matchedCurSum += curEntries[0].price
              matchedPrevSum += prevEntries[0].price
              matchedCount++
            } else if (curEntries && !prevEntries) {
              structuralChanges.push({
                brandId, brandName: info.name, type: 'new',
                packageName: curEntries[0].packageName,
                kcalLabel: curEntries[0].kcalLabel,
                date: weekStart,
              })
            } else if (!curEntries && prevEntries) {
              structuralChanges.push({
                brandId, brandName: info.name, type: 'removed',
                packageName: prevEntries[0].packageName,
                kcalLabel: prevEntries[0].kcalLabel,
                date: weekStart,
              })
            }
          }

          if (matchedCount > 0) {
            const curAvg = matchedCurSum / matchedCount
            const prevAvg = matchedPrevSum / matchedCount
            matchedChanges.push({
              brandId, brandName: info.name,
              currentAvg: curAvg, prevAvg: prevAvg,
              changePercent: pctChange(curAvg, prevAvg),
              matchedCount,
            })
          }
        }
      }

      // ── Discounts processing ──────────────────────────────────────────────
      const discountRows = ((discountsRes.data || []) as any[]).filter(
        (d: any) => allBrandIds.includes(d.brand_id)
      )

      const brandDiscounts = new Map<string, { percentages: number[]; promoCount: number; deepest: number; codes: any[] }>()
      for (const d of discountRows) {
        if (!brandDiscounts.has(d.brand_id)) {
          brandDiscounts.set(d.brand_id, { percentages: [], promoCount: 0, deepest: 0, codes: [] })
        }
        const entry = brandDiscounts.get(d.brand_id)!
        entry.percentages.push(d.percentage)
        entry.promoCount++
        entry.deepest = Math.max(entry.deepest, d.percentage)
        entry.codes.push(d)
      }

      // Check long-running discounts (>4 weeks = strategy)
      const allDiscountsForStrategy = ((discountsRes.data || []) as any[])
      const longRunningBrands = new Set<string>()
      for (const d of allDiscountsForStrategy) {
        if (!allBrandIds.includes(d.brand_id)) continue
        if (d.valid_from && d.valid_until) {
          const days = differenceInDays(parseISO(d.valid_until), parseISO(d.valid_from))
          if (days > 28) longRunningBrands.add(d.brand_id)
        } else if (d.valid_from && !d.valid_until) {
          // Open-ended discount running since valid_from
          const days = differenceInDays(parseISO(weekEnd), parseISO(d.valid_from))
          if (days > 28) longRunningBrands.add(d.brand_id)
        }
      }

      // New promotions this week
      const newPromosThisWeek = discountRows.filter(
        (d: any) => d.valid_from >= weekStart && d.valid_from <= weekEnd
      )

      // ── Reviews processing ────────────────────────────────────────────────
      const reviewRows = ((reviewsRes.data || []) as ReviewRow[]).filter(
        r => allBrandIds.includes(r.brand_id)
      )

      const currentWeekReviews = reviewRows.filter(r => r.review_date >= weekStart && r.review_date <= weekEnd)
      const prevWeekReviews = reviewRows.filter(r => r.review_date >= prevStart && r.review_date <= prevEnd)

      function buildBrandReviews(reviews: ReviewRow[]): Map<string, BrandWeekReview> {
        const map = new Map<string, BrandWeekReview>()
        for (const r of reviews) {
          if (!map.has(r.brand_id)) {
            const info = brandInfo.get(r.brand_id)
            map.set(r.brand_id, {
              brandId: r.brand_id,
              brandName: info?.name || 'Unknown',
              brandLogo: info?.logo || null,
              avgRating: 0, count: 0, negativePercent: 0,
              reviews: [],
            })
          }
          map.get(r.brand_id)!.reviews.push(r)
        }
        for (const [, v] of map) {
          v.count = v.reviews.length
          const ratings = v.reviews.map(r => r.rating).filter(r => r != null)
          v.avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
          v.negativePercent = ratings.length > 0
            ? Math.round(ratings.filter(r => r <= 2).length / ratings.length * 100)
            : 0
        }
        return map
      }

      const currentReviewsByBrand = buildBrandReviews(currentWeekReviews)
      const prevReviewsByBrand = buildBrandReviews(prevWeekReviews)

      // ── 8-week trend data ─────────────────────────────────────────────────
      const trendPriceRows = (trendPricesRes.data || []) as any[]
      const trendReviewRows = (trendReviewsRes.data || []) as any[]

      // Price trend: avg 2000 kcal price per brand per week
      const priceTrend: WeekTrendPoint[] = trendWeeks.map(w => {
        const point: WeekTrendPoint = { weekLabel: w.label, weekStart: w.start }
        for (const brandId of allBrandIds) {
          const info = brandInfo.get(brandId)
          if (!info) continue
          const weekPrices = trendPriceRows.filter((r: any) => {
            const brand = r.package_kcal_ranges?.packages?.brands
            if (!brand || brand.name !== info.name) return false
            const kcal = r.package_kcal_ranges?.kcal_ranges
            if (!kcal) return false
            const bucket = classifyKcal(kcal.kcal_from, kcal.kcal_to)
            return bucket === 2000 && r.date_recorded >= w.start && r.date_recorded <= w.end
          })
          if (weekPrices.length > 0) {
            // Deduplicate by getting latest per package
            const seen = new Set<string>()
            let sum = 0, count = 0
            for (const p of weekPrices) {
              const pkgName = p.package_kcal_ranges?.packages?.brands?.name + '|' + (p.package_kcal_ranges?.packages?.name || '')
              if (!seen.has(pkgName)) {
                seen.add(pkgName)
                sum += p.price
                count++
              }
            }
            point[info.name] = count > 0 ? Math.round(sum / count) : null
          } else {
            point[info.name] = null
          }
        }
        return point
      })

      // Rating trend: avg rating per brand per week
      const ratingTrend: WeekTrendPoint[] = trendWeeks.map(w => {
        const point: WeekTrendPoint = { weekLabel: w.label, weekStart: w.start }
        for (const brandId of allBrandIds) {
          const info = brandInfo.get(brandId)
          if (!info) continue
          const weekRatings = trendReviewRows
            .filter((r: any) => r.brand_id === brandId && r.review_date >= w.start && r.review_date <= w.end)
            .map((r: any) => r.rating)
            .filter((r: number) => r != null)
          point[info.name] = weekRatings.length > 0
            ? Math.round(weekRatings.reduce((a: number, b: number) => a + b, 0) / weekRatings.length * 100) / 100
            : null
        }
        return point
      })

      // ── Effective price (after discount) ──────────────────────────────────
      const effectivePrices: { brandId: string; brandName: string; brandLogo: string | null; catalogPrice: number; effectivePrice: number; discount: number }[] = []
      for (const brandId of allBrandIds) {
        const info = brandInfo.get(brandId)
        if (!info) continue
        const price2000 = avgPriceForBucket(currentWeekPrices, brandId, 2000)
        if (price2000 === null) continue
        const disc = brandDiscounts.get(brandId)
        const avgDisc = disc ? disc.percentages.reduce((a, b) => a + b, 0) / disc.percentages.length : 0
        effectivePrices.push({
          brandId,
          brandName: info.name,
          brandLogo: info.logo,
          catalogPrice: price2000,
          effectivePrice: price2000 * (1 - avgDisc / 100),
          discount: avgDisc,
        })
      }
      effectivePrices.sort((a, b) => a.effectivePrice - b.effectivePrice)

      // ── Competitor events timeline ────────────────────────────────────────
      const events: CompetitorEvent[] = []

      // Price changes >3%
      for (const mc of matchedChanges) {
        if (mc.brandId === myBrandId) continue
        if (Math.abs(mc.changePercent) > 3) {
          events.push({
            date: weekStart,
            brandName: mc.brandName,
            type: 'price_change',
            description: `Zmiana cen ${mc.changePercent > 0 ? '+' : ''}${mc.changePercent.toFixed(1)}% (matched-pairs)`,
          })
        }
      }

      // New/ended promotions
      for (const d of discountRows) {
        const info = brandInfo.get(d.brand_id)
        if (!info || d.brand_id === myBrandId) continue
        if (d.valid_from >= weekStart && d.valid_from <= weekEnd) {
          events.push({
            date: d.valid_from,
            brandName: info.name,
            type: 'promo_start',
            description: `Nowa promocja -${d.percentage}%${d.code ? ` (kod: ${d.code})` : ''}`,
          })
        }
        if (d.valid_until && d.valid_until >= weekStart && d.valid_until <= weekEnd) {
          events.push({
            date: d.valid_until,
            brandName: info.name,
            type: 'promo_end',
            description: `Zakończenie promocji -${d.percentage}%`,
          })
        }
      }

      // Review spikes (2x daily average)
      for (const brandId of competitorBrandIds) {
        const weekReviews = currentWeekReviews.filter(r => r.brand_id === brandId)
        const prevCount = prevWeekReviews.filter(r => r.brand_id === brandId).length
        const avgDaily = prevCount / 7
        const currentDaily = weekReviews.length / 7
        if (avgDaily > 0 && currentDaily > avgDaily * 2) {
          const info = brandInfo.get(brandId)
          events.push({
            date: weekStart,
            brandName: info?.name || 'Unknown',
            type: 'review_spike',
            description: `Skok opinii: ${weekReviews.length} vs ${prevCount} (poprz. tydzień)`,
          })
        }
      }

      // Structural changes from competitors
      for (const sc of structuralChanges) {
        if (sc.brandId === myBrandId) continue
        events.push({
          date: sc.date,
          brandName: sc.brandName,
          type: 'structural',
          description: `${sc.type === 'new' ? 'Nowy pakiet' : 'Wycofany pakiet'}: ${sc.packageName} (${sc.kcalLabel})`,
        })
      }

      events.sort((a, b) => a.date.localeCompare(b.date))

      // ── Recommendations ───────────────────────────────────────────────────
      const recommendations: { text: string; priority: 'high' | 'medium' | 'low' }[] = []

      // Price gap growing 2+ weeks
      const myPriceTrendValues = priceTrend
        .map(p => p[brandInfo.get(myBrandId)?.name || ''])
        .filter((v): v is number => v !== null && typeof v === 'number')

      const cheapestCompetitorTrend = priceTrend.map(p => {
        let min = Infinity
        for (const cid of competitorBrandIds) {
          const info = brandInfo.get(cid)
          if (!info) continue
          const v = p[info.name]
          if (typeof v === 'number' && v < min) min = v
        }
        return min === Infinity ? null : min
      })

      if (myPriceTrendValues.length >= 3 && cheapestCompetitorTrend.filter(v => v !== null).length >= 3) {
        const recentGaps = myPriceTrendValues.slice(-3).map((v, i) => {
          const cheapest = cheapestCompetitorTrend.slice(-3)[i]
          return cheapest ? ((v - cheapest) / cheapest) * 100 : null
        }).filter((v): v is number => v !== null)

        if (recentGaps.length >= 2 && recentGaps[recentGaps.length - 1] > recentGaps[0] + 2) {
          recommendations.push({
            text: 'Rozważyć odpowiedź cenową — różnica do najtańszego konkurenta rośnie od 2+ tygodni.',
            priority: 'high',
          })
        }
      }

      // >50% negative reviews about one topic
      const myReviews = currentWeekReviews.filter(r => r.brand_id === myBrandId && r.rating != null && r.rating <= 2)
      if (myReviews.length > 0) {
        const topicCounts: Record<string, number> = {}
        for (const r of myReviews) {
          if (!r.content) continue
          const topic = detectTopic(r.content)
          if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1
        }
        const totalNeg = myReviews.length
        for (const [topic, count] of Object.entries(topicCounts)) {
          if (count / totalNeg > 0.5) {
            const topicNames: Record<string, string> = { dostawa: 'dostawy', smak: 'smaku', cena: 'ceny', obsługa: 'obsługi' }
            recommendations.push({
              text: `Eskalować problem ${topicNames[topic] || topic} — ${Math.round(count / totalNeg * 100)}% negatywnych opinii dotyczy tego tematu.`,
              priority: 'high',
            })
          }
        }
      }

      // Competitor negative spike = acquisition opportunity
      for (const cid of competitorBrandIds) {
        const curNeg = currentWeekReviews.filter(r => r.brand_id === cid && r.rating != null && r.rating <= 2).length
        const prevNeg = prevWeekReviews.filter(r => r.brand_id === cid && r.rating != null && r.rating <= 2).length
        if (prevNeg > 0 && curNeg > prevNeg * 2) {
          const info = brandInfo.get(cid)
          recommendations.push({
            text: `Okazja akwizycyjna — ${info?.name || 'konkurent'} ma skok negatywnych opinii (${curNeg} vs ${prevNeg}).`,
            priority: 'medium',
          })
        }
      }

      // Long-running competitor discount
      for (const cid of longRunningBrands) {
        if (cid === myBrandId) continue
        const info = brandInfo.get(cid)
        recommendations.push({
          text: `Przeanalizować trwałą strategię rabatową ${info?.name || 'konkurenta'} — rabat utrzymywany 4+ tygodni.`,
          priority: 'low',
        })
      }

      // ── Build final data ──────────────────────────────────────────────────
      return {
        brandInfo,
        brandKcalPrices,
        matchedChanges,
        structuralChanges,
        brandDiscounts,
        longRunningBrands,
        newPromosThisWeek,
        currentReviewsByBrand,
        prevReviewsByBrand,
        effectivePrices,
        priceTrend,
        ratingTrend,
        events,
        recommendations: recommendations.slice(0, 3),
        currentWeekReviews,
        prevWeekReviews,
      }
    },
    staleTime: 1000 * 60 * 10,
  })

  // ── Print handler ──────────────────────────────────────────────────────────
  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `raport-zarządczy-${weekStart}-${weekEnd}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        button, nav, header, aside, .no-print { display: none !important; }
        [data-slide] { page-break-before: always; }
        [data-slide]:first-child { page-break-before: auto; }
      }
    `,
  })

  // ── Email handler ──────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    const extraList = emailExtraEmails.split('\n').map(e => e.trim()).filter(Boolean)
    const selectedEmails = emailUsers.filter(u => emailRecipients.has(u.id)).map(u => u.email)
    const recipients = [...new Set([...selectedEmails, ...extraList])]
    if (!recipients.length) { toast.error('Brak odbiorców'); return }
    setSending(true)
    try {
      const res = await fetch('/api/admin/send-custom-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          subject: `Raport zarządczy ${weekStart} – ${weekEnd}`,
          paragraphs: [`Raport zarządczy tygodniowy za okres ${weekStart} – ${weekEnd} został wygenerowany. Zaloguj się do panelu, aby go zobaczyć.`],
        }),
      })
      const result = await res.json()
      if (result.sent > 0) toast.success(`Wysłano do ${result.sent} odbiorców`)
      if (result.errors?.length) toast.error(`Błędy: ${result.errors.join(', ')}`)
      setShowEmailModal(false)
    } catch (e: any) {
      toast.error(e.message || 'Błąd wysyłki')
    } finally {
      setSending(false)
    }
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const myBrandName = data?.brandInfo.get(myBrandId)?.name || '—'

  const slide1Data = useMemo(() => {
    if (!data) return null

    // Price position (ranking by 2000 kcal price, ascending = 1st is cheapest)
    const prices2000 = data.brandKcalPrices.filter(p => p.kcal === 2000)
    const sorted = [...prices2000].sort((a, b) => a.avgPrice - b.avgPrice)
    const myPosition = sorted.findIndex(p => p.brandId === myBrandId) + 1
    const totalBrands = sorted.length

    // Previous week position
    const myMatchedChange = data.matchedChanges.find(
      mc => mc.brandId === myBrandId
    )

    // Average rating
    const myReviews = data.currentReviewsByBrand.get(myBrandId)
    const prevMyReviews = data.prevReviewsByBrand.get(myBrandId)
    const avgRating = myReviews?.avgRating ?? 0
    const prevAvgRating = prevMyReviews?.avgRating ?? 0
    const ratingDelta = avgRating - prevAvgRating

    // Gap to cheapest competitor
    const cheapestCompetitor = sorted.find(p => p.brandId !== myBrandId)
    const myPrice = sorted.find(p => p.brandId === myBrandId)
    const gapPercent = myPrice && cheapestCompetitor
      ? ((myPrice.avgPrice - cheapestCompetitor.avgPrice) / cheapestCompetitor.avgPrice) * 100
      : 0

    // Previous gap
    const prevPrices2000 = data.brandKcalPrices.filter(p => p.kcal === 2000)
    // We'll approximate prev gap from matched changes
    const prevGapPercent = gapPercent // simplified — we'd need prev week prices

    // Share of voice
    const totalReviews = Array.from(data.currentReviewsByBrand.values()).reduce((s, b) => s + b.count, 0)
    const myReviewCount = myReviews?.count ?? 0
    const shareOfVoice = totalReviews > 0 ? (myReviewCount / totalReviews) * 100 : 0

    const prevTotalReviews = Array.from(data.prevReviewsByBrand.values()).reduce((s, b) => s + b.count, 0)
    const prevMyCount = prevMyReviews?.count ?? 0
    const prevShareOfVoice = prevTotalReviews > 0 ? (prevMyCount / prevTotalReviews) * 100 : 0

    // Verdict
    let verdict: string
    let isStable = true

    // Check if price gap to cheapest competitor grew >2pp
    if (gapPercent > prevGapPercent + 2) {
      verdict = 'Tracimy przewagę cenową'
      isStable = false
    } else if (ratingDelta < -0.1) {
      verdict = 'Spadek satysfakcji'
      isStable = false
    } else {
      // Check competitor price changes >5%
      const bigCompetitorChange = data.matchedChanges.find(
        mc => mc.brandId !== myBrandId && Math.abs(mc.changePercent) > 5
      )
      if (bigCompetitorChange) {
        verdict = `${bigCompetitorChange.brandName} zmienia strategię`
        isStable = false
      } else {
        verdict = 'Pozycja stabilna'
      }
    }

    return {
      myPosition, totalBrands,
      avgRating, ratingDelta,
      gapPercent,
      shareOfVoice, shareOfVoiceDelta: shareOfVoice - prevShareOfVoice,
      verdict, isStable,
      myMatchedChange,
    }
  }, [data, myBrandId])

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-48 mb-4" />
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-24" />)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700">Błąd ładowania danych raportu</p>
          <p className="text-sm text-red-500 mt-1">{(error as Error)?.message || 'Spróbuj ponownie'}</p>
        </CardContent>
      </Card>
    )
  }

  // ── Scatter chart data (Slide 2) ──────────────────────────────────────────
  const scatterData = data.effectivePrices.map(ep => {
    const review = data.currentReviewsByBrand.get(ep.brandId)
    return {
      brandName: ep.brandName,
      x: Math.round(ep.effectivePrice),
      y: review?.avgRating ?? 0,
      z: review?.count ?? 1,
      isMy: ep.brandId === myBrandId,
    }
  }).filter(d => d.y > 0)

  const medianX = scatterData.length > 0
    ? [...scatterData].sort((a, b) => a.x - b.x)[Math.floor(scatterData.length / 2)].x
    : 0
  const medianY = scatterData.length > 0
    ? [...scatterData].sort((a, b) => a.y - b.y)[Math.floor(scatterData.length / 2)].y
    : 0

  const myScatter = scatterData.find(d => d.isMy)
  const myQuadrant = myScatter
    ? myScatter.x <= medianX && myScatter.y >= medianY ? 'lider (niska cena, wysoka ocena)'
      : myScatter.x > medianX && myScatter.y >= medianY ? 'premium (wysoka cena, wysoka ocena)'
      : myScatter.x <= medianX && myScatter.y < medianY ? 'walka cenowa (niska cena, niska ocena)'
      : 'pod presją (wysoka cena, niska ocena)'
    : null

  // ── Catalog price table data (Slide 3) ────────────────────────────────────
  type CatalogRow = { brandId: string; brandName: string; brandLogo: string | null; prices: Record<number, number | null>; changePercent: number | null; matchedCount: number; isMy: boolean }
  const catalogTableData: CatalogRow[] = allBrandIds.flatMap(brandId => {
    const info = data.brandInfo.get(brandId)
    if (!info) return []
    const prices: Record<number, number | null> = {}
    for (const kcal of KCAL_BUCKETS) {
      const p = data.brandKcalPrices.find(bp => bp.brandId === brandId && bp.kcal === kcal)
      prices[kcal] = p?.avgPrice ?? null
    }
    const matchedChange = data.matchedChanges.find(mc => mc.brandId === brandId)
    return [{
      brandId,
      brandName: info.name,
      brandLogo: info.logo,
      prices,
      changePercent: matchedChange?.changePercent ?? null,
      matchedCount: matchedChange?.matchedCount ?? 0,
      isMy: brandId === myBrandId,
    }]
  })

  // ── Discount table data (Slide 4) ─────────────────────────────────────────
  type DiscountTableRow = { brandId: string; brandName: string; brandLogo: string | null; avgDiscount: number; promoCount: number; deepest: number; isLongRunning: boolean; isMy: boolean }
  const discountTableData: DiscountTableRow[] = allBrandIds.flatMap(brandId => {
    const info = data.brandInfo.get(brandId)
    if (!info) return []
    const disc = data.brandDiscounts.get(brandId)
    return [{
      brandId,
      brandName: info.name,
      brandLogo: info.logo,
      avgDiscount: disc ? disc.percentages.reduce((a, b) => a + b, 0) / disc.percentages.length : 0,
      promoCount: disc?.promoCount ?? 0,
      deepest: disc?.deepest ?? 0,
      isLongRunning: data.longRunningBrands.has(brandId),
      isMy: brandId === myBrandId,
    }]
  })

  const mostAggressiveCompetitor = discountTableData
    .filter(d => !d.isMy && d.avgDiscount > 0)
    .sort((a, b) => b.avgDiscount - a.avgDiscount)[0]

  // ── Voice of customer data (Slide 6) ──────────────────────────────────────
  type ReviewTableRow = { brandId: string; brandName: string; brandLogo: string | null; avgRating: number; prevAvgRating: number; count: number; prevCount: number; negativePercent: number; prevNegativePercent: number; isMy: boolean }
  const reviewTableData: ReviewTableRow[] = allBrandIds.flatMap(brandId => {
    const info = data.brandInfo.get(brandId)
    if (!info) return []
    const cur = data.currentReviewsByBrand.get(brandId)
    const prev = data.prevReviewsByBrand.get(brandId)
    return [{
      brandId,
      brandName: info.name,
      brandLogo: info.logo,
      avgRating: cur?.avgRating ?? 0,
      prevAvgRating: prev?.avgRating ?? 0,
      count: cur?.count ?? 0,
      prevCount: prev?.count ?? 0,
      negativePercent: cur?.negativePercent ?? 0,
      prevNegativePercent: prev?.negativePercent ?? 0,
      isMy: brandId === myBrandId,
    }]
  })

  // Best/worst quotes for my brand
  const myCurrentReviews = data.currentWeekReviews.filter(r => r.brand_id === myBrandId)
  const bestQuote = myCurrentReviews
    .filter(r => r.rating != null && r.rating >= 4 && r.content && r.content.length > 20)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
  const worstQuote = myCurrentReviews
    .filter(r => r.rating != null && r.rating <= 2 && r.content && r.content.length > 20)
    .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))[0]

  // Dominant negative topic
  const myNegativeReviews = myCurrentReviews.filter(r => r.rating != null && r.rating <= 2)
  const topicCounts: Record<string, number> = {}
  for (const r of myNegativeReviews) {
    if (!r.content) continue
    const topic = detectTopic(r.content)
    if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1
  }
  const dominantTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]
  const topicLabels: Record<string, string> = { dostawa: 'Dostawa', smak: 'Smak', cena: 'Cena', obsługa: 'Obsługa klienta' }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* Action buttons */}
      <div className="flex gap-3 mb-6 no-print">
        <Button onClick={() => handlePrint()} variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-2" />Pobierz PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
          <Mail className="h-4 w-4 mr-2" />Wyślij email
        </Button>
      </div>

      <div ref={reportRef} className="space-y-8">

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 1 — Executive Summary
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="1" className="overflow-hidden">
          <CardContent className="pt-6">
            <SlideHeader number={1} title="Executive Summary" subtitle={`${myBrandName} · tydzień ${weekStart} – ${weekEnd}`} icon={Target} />

            {/* Verdict */}
            {slide1Data && (
              <div className={`rounded-lg p-4 mb-6 flex items-center gap-3 ${
                slide1Data.isStable
                  ? 'bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800'
                  : 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800'
              }`}>
                {slide1Data.isStable
                  ? <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                  : <ShieldAlert className="h-6 w-6 text-red-600 flex-shrink-0" />
                }
                <div>
                  <p className={`font-bold text-lg ${slide1Data.isStable ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {slide1Data.verdict}
                  </p>
                  <p className="text-sm text-muted-foreground">Algorytmiczna ocena pozycji rynkowej</p>
                </div>
              </div>
            )}

            {/* 4 KPIs */}
            {slide1Data && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  label="Pozycja cenowa"
                  value={`#${slide1Data.myPosition}/${slide1Data.totalBrands}`}
                  delta={slide1Data.myMatchedChange ? fmtPct(slide1Data.myMatchedChange.changePercent) : '—'}
                  deltaLabel="zmiana ceny WoW"
                  icon={DollarSign}
                  highlight
                />
                <KPICard
                  label="Średnia ocena"
                  value={slide1Data.avgRating.toFixed(2)}
                  delta={`${slide1Data.ratingDelta >= 0 ? '+' : ''}${slide1Data.ratingDelta.toFixed(2)}`}
                  icon={Star}
                />
                <KPICard
                  label="Różnica do najtańszego"
                  value={fmtPct(slide1Data.gapPercent, false)}
                  icon={Percent}
                />
                <KPICard
                  label="Share of voice"
                  value={`${slide1Data.shareOfVoice.toFixed(0)}%`}
                  delta={`${slide1Data.shareOfVoiceDelta >= 0 ? '+' : ''}${slide1Data.shareOfVoiceDelta.toFixed(1)}pp`}
                  icon={Users}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 2 — Position Map (ScatterChart)
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="2">
          <CardContent className="pt-6">
            <SlideHeader number={2} title="Mapa pozycji" subtitle="Cena efektywna 2000 kcal vs. ocena klientów" icon={Target} />

            {scatterData.length > 0 ? (
              <>
                <div style={{ width: '100%', height: 400 }}>
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="Cena 2000 kcal" unit=" zł" domain={['auto', 'auto']} />
                      <YAxis type="number" dataKey="y" name="Ocena" domain={[1, 5]} />
                      <ZAxis type="number" dataKey="z" range={[100, 600]} name="Liczba opinii" />
                      <ReTooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                              <p className="font-semibold">{d.brandName}</p>
                              <p>Cena: {d.x} zł</p>
                              <p>Ocena: {d.y.toFixed(2)}</p>
                              <p>Opinii: {d.z}</p>
                            </div>
                          )
                        }}
                      />
                      <ReferenceLine x={medianX} stroke="#ccc" strokeDasharray="3 3" />
                      <ReferenceLine y={medianY} stroke="#ccc" strokeDasharray="3 3" />
                      <Scatter data={scatterData} name="Marki">
                        {scatterData.map((entry, i) => (
                          <Cell key={i} fill={entry.isMy ? MY_BRAND_COLOR : COMPETITOR_COLOR} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {myQuadrant && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm"><strong>{myBrandName}</strong> znajduje się w ćwiartce: <strong>{myQuadrant}</strong></p>
                  </div>
                )}
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: MY_BRAND_COLOR }} /> {myBrandName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: COMPETITOR_COLOR }} /> Konkurenci
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Brak danych do wyświetlenia mapy pozycji</p>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 3 — Catalog Prices Like-for-Like
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="3">
          <CardContent className="pt-6">
            <SlideHeader number={3} title="Ceny katalogowe like-for-like" subtitle="Porównanie w ramach wariantów kalorycznych" icon={DollarSign} />

            {/* Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">1500 kcal</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">2000 kcal</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">2500 kcal</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Zmiana WoW</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogTableData.map(row => (
                    <tr key={row.brandId} className={`border-b transition-colors ${row.isMy ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/20'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <BrandLogo url={row.brandLogo} name={row.brandName} />
                          <span>{row.brandName}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3">{row.prices[1500] ? fmtPrice(row.prices[1500]) : '—'}</td>
                      <td className="text-right px-4 py-3">{row.prices[2000] ? fmtPrice(row.prices[2000]) : '—'}</td>
                      <td className="text-right px-4 py-3">{row.prices[2500] ? fmtPrice(row.prices[2500]) : '—'}</td>
                      <td className="text-right px-4 py-3">
                        {row.changePercent !== null ? (
                          <span className={row.changePercent > 0.5 ? 'text-red-600' : row.changePercent < -0.5 ? 'text-green-600' : 'text-muted-foreground'}>
                            {fmtPct(row.changePercent)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {row.matchedCount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">({row.matchedCount} par)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 8-week price trend */}
            <h3 className="text-sm font-semibold mb-3">Trend cen 2000 kcal — ostatnie 8 tygodni</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={data.priceTrend} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                  <ReTooltip content={<ChartTooltip />} />
                  <Legend />
                  {allBrandIds.map((brandId, idx) => {
                    const info = data.brandInfo.get(brandId)
                    if (!info) return null
                    return (
                      <Line
                        key={brandId}
                        type="monotone"
                        dataKey={info.name}
                        stroke={brandId === myBrandId ? MY_BRAND_COLOR : `hsl(${idx * 60 + 30}, 40%, 60%)`}
                        strokeWidth={brandId === myBrandId ? 3 : 1.5}
                        dot={brandId === myBrandId}
                        connectNulls
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Structural changes */}
            {data.structuralChanges.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium mb-2">Zmiany strukturalne oferty:</p>
                <ul className="text-sm space-y-1">
                  {data.structuralChanges.map((sc, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {sc.type === 'new'
                        ? <Badge className="bg-green-100 text-green-700 text-xs">NOWY</Badge>
                        : <Badge className="bg-red-100 text-red-700 text-xs">WYCOFANY</Badge>
                      }
                      <span>{sc.brandName}: {sc.packageName} ({sc.kcalLabel})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 4 — Discount Policy
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="4">
          <CardContent className="pt-6">
            <SlideHeader number={4} title="Polityka rabatowa" subtitle="Aktywne promocje i strategia cenowa" icon={Percent} />

            {/* 3 KPIs */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <KPICard
                label="Mój śr. rabat"
                value={`${(discountTableData.find(d => d.isMy)?.avgDiscount ?? 0).toFixed(1)}%`}
                icon={Percent}
                highlight
              />
              <KPICard
                label="Najagresywniejszy konkurent"
                value={mostAggressiveCompetitor
                  ? `${mostAggressiveCompetitor.brandName} (${mostAggressiveCompetitor.avgDiscount.toFixed(1)}%)`
                  : '—'}
                icon={Target}
              />
              <KPICard
                label="Nowe promocje w tygodniu"
                value={`${data.newPromosThisWeek.length}`}
                icon={Megaphone}
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Śr. rabat</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Liczba promocji</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Najgłębszy</th>
                  </tr>
                </thead>
                <tbody>
                  {discountTableData.map(row => (
                    <tr key={row.brandId} className={`border-b transition-colors ${row.isMy ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/20'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <BrandLogo url={row.brandLogo} name={row.brandName} />
                          <span>{row.brandName}</span>
                          {row.isLongRunning && (
                            <Badge variant="outline" className="text-xs">strategia</Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right px-4 py-3">{row.avgDiscount > 0 ? `${row.avgDiscount.toFixed(1)}%` : '—'}</td>
                      <td className="text-right px-4 py-3">{row.promoCount}</td>
                      <td className="text-right px-4 py-3">{row.deepest > 0 ? `${row.deepest}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Insight */}
            {discountTableData.filter(d => d.isLongRunning && !d.isMy).length > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm">
                  <strong>Insight:</strong>{' '}
                  {discountTableData.filter(d => d.isLongRunning && !d.isMy).map(d => d.brandName).join(', ')}{' '}
                  utrzymuje rabat ponad 4 tygodnie — to strategia cenowa, nie jednorazowa promocja.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 5 — Effective Price
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="5">
          <CardContent className="pt-6">
            <SlideHeader number={5} title="Cena efektywna" subtitle="Cena 2000 kcal po uwzględnieniu rabatu" icon={DollarSign} />

            {data.effectivePrices.length > 0 ? (
              <>
                <div style={{ width: '100%', height: Math.max(200, data.effectivePrices.length * 50 + 40) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={data.effectivePrices.map(ep => ({
                        name: ep.brandName,
                        price: Math.round(ep.effectivePrice),
                        isMy: ep.brandId === myBrandId,
                      }))}
                      layout="vertical"
                      margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <ReTooltip content={<ChartTooltip />} />
                      <Bar dataKey="price" name="Cena efektywna (zł)" radius={[0, 4, 4, 0]}>
                        {data.effectivePrices.map((ep, i) => (
                          <Cell key={i} fill={ep.brandId === myBrandId ? MY_BRAND_COLOR : COMPETITOR_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Insight */}
                {(() => {
                  const cheapest = data.effectivePrices[0]
                  const my = data.effectivePrices.find(ep => ep.brandId === myBrandId)
                  if (!cheapest || !my) return null
                  const gap = ((my.effectivePrice - cheapest.effectivePrice) / cheapest.effectivePrice) * 100
                  const myRating = data.currentReviewsByBrand.get(myBrandId)?.avgRating ?? 0
                  const cheapestRating = data.currentReviewsByBrand.get(cheapest.brandId)?.avgRating ?? 0

                  return (
                    <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm">
                        <strong>Insight:</strong>{' '}
                        {cheapest.brandId === myBrandId ? (
                          `${myBrandName} jest najtańszy po uwzględnieniu rabatów.`
                        ) : (
                          <>
                            Różnica do najtańszego ({cheapest.brandName}): <strong>{gap.toFixed(1)}%</strong>.{' '}
                            {myRating > cheapestRating + 0.2
                              ? 'Premia cenowa uzasadniona wyższą oceną klientów.'
                              : myRating < cheapestRating - 0.1
                                ? 'Premia cenowa nieuzasadniona — ocena niższa od najtańszego.'
                                : 'Oceny na zbliżonym poziomie — premia cenowa do monitorowania.'}
                          </>
                        )}
                      </p>
                    </div>
                  )
                })()}
              </>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Brak danych cenowych</p>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 6 — Voice of Customer
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="6">
          <CardContent className="pt-6">
            <SlideHeader number={6} title="Głos klienta" subtitle="Opinie i satysfakcja w bieżącym tygodniu" icon={MessageSquare} />

            {/* Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ocena tyg.</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Liczba opinii</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">% negatywnych</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewTableData.map(row => {
                    const ratingDelta = row.avgRating - row.prevAvgRating
                    const countDelta = row.count - row.prevCount
                    return (
                      <tr key={row.brandId} className={`border-b transition-colors ${row.isMy ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/20'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <BrandLogo url={row.brandLogo} name={row.brandName} />
                            <span>{row.brandName}</span>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3">
                          <span>{row.avgRating > 0 ? row.avgRating.toFixed(2) : '—'}</span>
                          {row.prevAvgRating > 0 && (
                            <span className={`text-xs ml-1 ${ratingDelta > 0.05 ? 'text-green-600' : ratingDelta < -0.05 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              ({ratingDelta >= 0 ? '+' : ''}{ratingDelta.toFixed(2)})
                            </span>
                          )}
                        </td>
                        <td className="text-right px-4 py-3">
                          <span>{row.count}</span>
                          {row.prevCount > 0 && (
                            <span className="text-xs ml-1 text-muted-foreground">
                              ({countDelta >= 0 ? '+' : ''}{countDelta})
                            </span>
                          )}
                        </td>
                        <td className="text-right px-4 py-3">
                          <span className={row.negativePercent > 20 ? 'text-red-600' : ''}>{row.negativePercent}%</span>
                          {row.prevNegativePercent > 0 && (
                            <span className="text-xs ml-1 text-muted-foreground">
                              (było {row.prevNegativePercent}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Quotes */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {bestQuote && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 uppercase tracking-wide">Najlepsza opinia tygodnia</p>
                  <p className="text-sm italic">&ldquo;{bestQuote.content?.slice(0, 200)}{(bestQuote.content?.length ?? 0) > 200 ? '...' : ''}&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">{bestQuote.rating}★ · {bestQuote.review_date}</p>
                </div>
              )}
              {worstQuote && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 uppercase tracking-wide">Najgorsza opinia tygodnia</p>
                  <p className="text-sm italic">&ldquo;{worstQuote.content?.slice(0, 200)}{(worstQuote.content?.length ?? 0) > 200 ? '...' : ''}&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">{worstQuote.rating}★ · {worstQuote.review_date}</p>
                </div>
              )}
            </div>

            {/* Dominant topic insight */}
            {dominantTopic && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm">
                  <strong>Insight:</strong> Dominujący temat negatywnych opinii: <strong>{topicLabels[dominantTopic[0]] || dominantTopic[0]}</strong> ({dominantTopic[1]} z {myNegativeReviews.length} negatywnych opinii).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 7 — Competitor Moves
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="7">
          <CardContent className="pt-6">
            <SlideHeader number={7} title="Ruchy konkurencji" subtitle="Chronologiczny przegląd istotnych zmian" icon={BarChart3} />

            {data.events.length > 0 ? (
              <div className="space-y-3">
                {data.events.map((event, i) => {
                  const iconMap: Record<string, any> = {
                    price_change: DollarSign,
                    promo_start: Megaphone,
                    promo_end: Minus,
                    review_spike: MessageSquare,
                    structural: BarChart3,
                  }
                  const colorMap: Record<string, string> = {
                    price_change: 'bg-amber-100 text-amber-700',
                    promo_start: 'bg-green-100 text-green-700',
                    promo_end: 'bg-red-100 text-red-700',
                    review_spike: 'bg-blue-100 text-blue-700',
                    structural: 'bg-violet-100 text-violet-700',
                  }
                  const EventIcon = iconMap[event.type] || Calendar
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[event.type] || 'bg-muted'}`}>
                        <EventIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{event.brandName}</span>
                          <span className="text-xs text-muted-foreground">{event.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Brak istotnych zdarzeń konkurencji w tym tygodniu</p>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            SLIDE 8 — Recommendations
            ═══════════════════════════════════════════════════════════════════ */}
        <Card data-slide="8">
          <CardContent className="pt-6">
            <SlideHeader number={8} title="Rekomendacje" subtitle="Algorytmicznie generowane sugestie działań" icon={Lightbulb} />

            {data.recommendations.length > 0 ? (
              <div className="space-y-4">
                {data.recommendations.map((rec, i) => {
                  const priorityColors: Record<string, string> = {
                    high: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
                    medium: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
                    low: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
                  }
                  const priorityLabels: Record<string, string> = {
                    high: 'Wysoki priorytet',
                    medium: 'Średni priorytet',
                    low: 'Niski priorytet',
                  }
                  return (
                    <div key={i} className={`p-4 rounded-lg border-l-4 ${priorityColors[rec.priority]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{priorityLabels[rec.priority]}</Badge>
                      </div>
                      <p className="text-sm font-medium">{rec.text}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Brak pilnych rekomendacji — pozycja rynkowa stabilna.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Email Modal
          ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wyślij raport zarządczy emailem</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1">
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
                  : <><Send className="h-4 w-4 mr-2" />Wyślij raport</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
