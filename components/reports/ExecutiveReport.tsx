'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle, ChevronLeft, ChevronRight, Maximize,
  FileDown, Mail, Loader2, Send, CheckCircle, ShieldAlert,
} from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ScatterChart, Scatter,
  Cell, ReferenceLine, ZAxis, LabelList,
} from 'recharts'
import { format, subWeeks, startOfWeek, endOfWeek, parseISO, differenceInDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Constants ────────────────────────────────────────────────────────────────

const MY_BRAND_COLOR = '#185FA5'
const COMPETITOR_COLOR = '#CBD5E1'
const KCAL_BUCKETS = [1500, 2000, 2500] as const
const TOTAL_SLIDES = 8
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
  kcal: number
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

// ── Slide Frame ─────────────────────────────────────────────────────────────

function SlideFrame({ index, brand, weekRange, children }: {
  index: number; brand: string; weekRange: string; children: React.ReactNode
}) {
  return (
    <div className="h-full w-full flex flex-col" style={{ padding: 48 }}>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <div className="flex justify-between items-end pt-2 flex-shrink-0">
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{brand} &middot; {weekRange}</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{index + 1} / {TOTAL_SLIDES}</span>
      </div>
    </div>
  )
}

// ── Brand Logo ──────────────────────────────────────────────────────────────

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

// ── Scatter Bubble (custom shape with name label) ───────────────────────────

function ScatterBubble(props: any) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  const abbr = (payload.brandName || '').slice(0, 3).toUpperCase()
  const r = payload.isMy ? 28 : 22
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={payload.isMy ? MY_BRAND_COLOR : COMPETITOR_COLOR} opacity={0.9} stroke={payload.isMy ? '#0e4a86' : '#94a3b8'} strokeWidth={1.5} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fill={payload.isMy ? 'white' : '#334155'} fontSize={payload.isMy ? 12 : 10} fontWeight={700}>
        {abbr}
      </text>
      <text x={cx + r + 5} y={cy} textAnchor="start" dominantBaseline="central" fill="#374151" fontSize={11} fontWeight={500}>
        {payload.brandName}
      </text>
    </g>
  )
}

// ── Insight box ─────────────────────────────────────────────────────────────

function InsightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto pt-3 flex-shrink-0">
      <div className="rounded-lg px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <p style={{ fontSize: 13, lineHeight: 1.5 }} className="text-gray-700 dark:text-gray-300">{children}</p>
      </div>
    </div>
  )
}

// ── Small sample badge ──────────────────────────────────────────────────────

function SmallSampleBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ml-1.5" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4 }}>
      MAŁA PRÓBA
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function ExecutiveReport({ myBrandId, competitorBrandIds, weekStart, weekEnd }: ExecutiveReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState<Set<string>>(new Set())
  const [emailExtraEmails, setEmailExtraEmails] = useState('')
  const [sending, setSending] = useState(false)

  const allBrandIds = useMemo(() => [myBrandId, ...competitorBrandIds], [myBrandId, competitorBrandIds])
  const { prevStart, prevEnd } = useMemo(() => getWeekBounds(weekStart), [weekStart])
  const { start: trend8Start, weeks: trendWeeks } = useMemo(() => get8WeekBounds(weekEnd), [weekEnd])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goPrev = useCallback(() => setCurrentSlide(s => Math.max(0, s - 1)), [])
  const goNext = useCallback(() => setCurrentSlide(s => Math.min(TOTAL_SLIDES - 1, s + 1)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goPrev, goNext])

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

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
      const [pricesRes, discountsRes, reviewsRes, trendPricesRes, trendReviewsRes] = await Promise.all([
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

        (supabase as any)
          .from('discounts')
          .select('id, brand_id, percentage, valid_from, valid_until, code, description, brands(name, logo_url)')
          .lte('valid_from', weekEnd)
          .or(`valid_until.gte.${weekStart},valid_until.is.null`)
          .not('percentage', 'is', null),

        (supabase as any)
          .from('reviews')
          .select('brand_id, rating, content, review_date')
          .eq('is_approved', true)
          .gte('review_date', prevStart)
          .lte('review_date', weekEnd)
          .limit(5000),

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
      for (const d of (discountsRes.data || []) as any[]) {
        if (d.brands && !brandInfo.has(d.brand_id)) {
          brandInfo.set(d.brand_id, { name: d.brands.name, logo: d.brands.logo_url })
        }
      }
      for (const r of (trendReviewsRes.data || []) as any[]) {
        if (r.brands && !brandInfo.has(r.brand_id)) {
          brandInfo.set(r.brand_id, { name: r.brands.name, logo: null })
        }
      }

      // ── Process prices by week and kcal bucket ────────────────────────────
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

      function avgPriceForBucket(
        weekData: Map<string, Map<number, Map<string, PriceEntry[]>>>,
        brandId: string,
        kcalBucket: number
      ): number | null {
        const brandMap = weekData.get(brandId)
        if (!brandMap) return null
        const kcalMap = brandMap.get(kcalBucket)
        if (!kcalMap || kcalMap.size === 0) return null
        let sum = 0, count = 0
        for (const entries of kcalMap.values()) {
          if (entries.length > 0) {
            sum += entries[0].price
            count++
          }
        }
        return count > 0 ? sum / count : null
      }

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
              kcal,
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

      const allDiscountsForStrategy = ((discountsRes.data || []) as any[])
      const longRunningBrands = new Set<string>()
      for (const d of allDiscountsForStrategy) {
        if (!allBrandIds.includes(d.brand_id)) continue
        if (d.valid_from && d.valid_until) {
          const days = differenceInDays(parseISO(d.valid_until), parseISO(d.valid_from))
          if (days > 28) longRunningBrands.add(d.brand_id)
        } else if (d.valid_from && !d.valid_until) {
          const days = differenceInDays(parseISO(weekEnd), parseISO(d.valid_from))
          if (days > 28) longRunningBrands.add(d.brand_id)
        }
      }

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

      for (const mc of matchedChanges) {
        if (mc.brandId === myBrandId) continue
        if (Math.abs(mc.changePercent) > 3 && mc.kcal === 2000) {
          events.push({
            date: weekStart,
            brandName: mc.brandName,
            type: 'price_change',
            description: `Zmiana cen katalogowych ${mc.changePercent > 0 ? '+' : ''}${mc.changePercent.toFixed(1)}% (te same warianty 2000 kcal, WoW)`,
          })
        }
      }

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
            description: `Wzrost liczby opinii: ${weekReviews.length} w tym tyg. vs ${prevCount} w poprz. (${(currentDaily / avgDaily).toFixed(1)}x)`,
          })
        }
      }

      for (const sc of structuralChanges) {
        if (sc.brandId === myBrandId) continue
        events.push({
          date: sc.date,
          brandName: sc.brandName,
          type: 'structural',
          description: `${sc.type === 'new' ? 'Nowy pakiet w ofercie' : 'Wycofany pakiet z oferty'}: ${sc.packageName} (${sc.kcalLabel})`,
        })
      }

      events.sort((a, b) => a.date.localeCompare(b.date))

      // ── Recommendations ───────────────────────────────────────────────────
      const recommendations: { text: string; priority: 'high' | 'medium' | 'low'; title: string; owner: string; deadline: string }[] = []

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
          const myP = brandKcalPrices.find(p => p.brandId === myBrandId && p.kcal === 2000)
          const cheapComp = brandKcalPrices
            .filter(p => p.brandId !== myBrandId && p.kcal === 2000)
            .sort((a, b) => a.avgPrice - b.avgPrice)[0]
          const currentGap = myP && cheapComp ? ((myP.avgPrice - cheapComp.avgPrice) / cheapComp.avgPrice * 100) : null
          recommendations.push({
            title: 'Decyzja cenowa dot. pakietów 2000+ kcal',
            text: `Dystans do najtańszego (${cheapComp?.brandName || 'konkurenta'}) wzrósł do ${currentGap != null ? currentGap.toFixed(1) + '%' : 'b.d.'} (${myP ? fmtPrice(myP.avgPrice) : 'b.d.'} vs ${cheapComp ? fmtPrice(cheapComp.avgPrice) : 'b.d.'}). Trend rosnący od 2+ tygodni.`,
            priority: 'high',
            owner: 'Dział pricing',
            deadline: 'Do piątku',
          })
        }
      }

      const myNegReviews = currentWeekReviews.filter(r => r.brand_id === myBrandId && r.rating != null && r.rating <= 2)
      if (myNegReviews.length > 0) {
        const topicCountsLocal: Record<string, number> = {}
        for (const r of myNegReviews) {
          if (!r.content) continue
          const topic = detectTopic(r.content)
          if (topic) topicCountsLocal[topic] = (topicCountsLocal[topic] || 0) + 1
        }
        const totalNeg = myNegReviews.length
        for (const [topic, count] of Object.entries(topicCountsLocal)) {
          if (count / totalNeg > 0.5) {
            const topicNames: Record<string, string> = { dostawa: 'dostawy', smak: 'jakości smaku', cena: 'ceny', obsługa: 'obsługi klienta' }
            recommendations.push({
              title: `Eskalacja: problem ${topicNames[topic] || topic}`,
              text: `${count} z ${totalNeg} negatywnych opinii (${Math.round(count / totalNeg * 100)}%) dotyczy ${topicNames[topic] || topic}. Wymaga natychmiastowej interwencji operacyjnej.`,
              priority: 'high',
              owner: 'Dział operacji',
              deadline: 'Natychmiast',
            })
          }
        }
      }

      for (const cid of competitorBrandIds) {
        const curNeg = currentWeekReviews.filter(r => r.brand_id === cid && r.rating != null && r.rating <= 2).length
        const prevNeg = prevWeekReviews.filter(r => r.brand_id === cid && r.rating != null && r.rating <= 2).length
        if (prevNeg > 0 && curNeg > prevNeg * 2) {
          const info = brandInfo.get(cid)
          recommendations.push({
            title: `Okazja akwizycyjna — ${info?.name || 'konkurent'} traci klientów`,
            text: `${info?.name || 'Konkurent'} zanotował ${curNeg} negatywnych opinii w tym tygodniu (2x więcej niż poprz. ${prevNeg}). Okno na kampanię retargetingową skierowaną do ich niezadowolonych klientów.`,
            priority: 'medium',
            owner: 'Dział marketingu',
            deadline: 'Ten tydzień',
          })
        }
      }

      for (const cid of longRunningBrands) {
        if (cid === myBrandId) continue
        const info = brandInfo.get(cid)
        const disc = brandDiscounts.get(cid)
        const avgDisc = disc ? (disc.percentages.reduce((a, b) => a + b, 0) / disc.percentages.length).toFixed(1) : '?'
        recommendations.push({
          title: `Analiza strategii rabatowej ${info?.name || 'konkurenta'}`,
          text: `${info?.name || 'Konkurent'} utrzymuje średni rabat ${avgDisc}% od ponad 4 tygodni — to trwała zmiana pozycjonowania cenowego, nie jednorazowa promocja. Przeanalizować wpływ na naszą pozycję efektywną.`,
          priority: 'low',
          owner: 'Dział strategii',
          deadline: 'Następny przegląd tygodniowy',
        })
      }

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
    documentTitle: `raport-zarzadczy-${weekStart}-${weekEnd}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [data-slide] {
          display: flex !important;
          page-break-after: always;
          aspect-ratio: auto !important;
          height: 190mm !important;
          max-width: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .no-print { display: none !important; }
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
          subject: `Raport zarządczy ${weekStart} \u2013 ${weekEnd}`,
          paragraphs: [`Raport zarządczy tygodniowy za okres ${weekStart} \u2013 ${weekEnd} został wygenerowany. Zaloguj się do panelu, aby go zobaczyć.`],
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

    // Price position — count ALL analyzed brands, not just those with 2000 kcal
    const totalBrands = allBrandIds.length
    const prices2000 = data.brandKcalPrices.filter(p => p.kcal === 2000)
    const sorted2000 = [...prices2000].sort((a, b) => a.avgPrice - b.avgPrice)
    const brandsWithPricing = sorted2000.length
    const myPrice2000Entry = sorted2000.find(p => p.brandId === myBrandId)
    const myPosition = myPrice2000Entry ? sorted2000.indexOf(myPrice2000Entry) + 1 : 0
    const myPriceValue = myPrice2000Entry?.avgPrice ?? null

    // Cheapest competitor (for gap computation)
    const cheapestCompetitorEntry = sorted2000.find(p => p.brandId !== myBrandId)
    const cheapestName = cheapestCompetitorEntry?.brandName ?? null
    const cheapestPrice = cheapestCompetitorEntry?.avgPrice ?? null

    const gapPercent = myPriceValue != null && cheapestPrice != null
      ? ((myPriceValue - cheapestPrice) / cheapestPrice) * 100
      : 0

    // Previous week gap (from matchedChanges with kcal=2000)
    const mc2000 = data.matchedChanges.filter(mc => mc.kcal === 2000)
    const myMc2000 = mc2000.find(mc => mc.brandId === myBrandId)
    const competitorMc2000 = mc2000.filter(mc => mc.brandId !== myBrandId)
    const myPrevPrice = myMc2000?.prevAvg ?? null
    const cheapestPrevCompetitor = competitorMc2000.length > 0
      ? competitorMc2000.reduce((min, mc) => mc.prevAvg < min.prevAvg ? mc : min)
      : null
    const prevGapPercent = myPrevPrice != null && cheapestPrevCompetitor
      ? ((myPrevPrice - cheapestPrevCompetitor.prevAvg) / cheapestPrevCompetitor.prevAvg) * 100
      : null

    // Reviews
    const myReviews = data.currentReviewsByBrand.get(myBrandId)
    const prevMyReviews = data.prevReviewsByBrand.get(myBrandId)
    const avgRating = myReviews?.avgRating ?? 0
    const myReviewCount = myReviews?.count ?? 0
    const prevAvgRating = prevMyReviews?.avgRating ?? 0
    const prevMyReviewCount = prevMyReviews?.count ?? 0
    const isSmallSample = myReviewCount < 10
    // Guard: delta only meaningful if prev had reviews
    const ratingDelta = prevMyReviewCount > 0 ? avgRating - prevAvgRating : null

    // Share of voice
    const totalMarketReviews = Array.from(data.currentReviewsByBrand.values()).reduce((s, b) => s + b.count, 0)
    const shareOfVoice = totalMarketReviews > 0 ? (myReviewCount / totalMarketReviews) * 100 : 0
    const prevTotalReviews = Array.from(data.prevReviewsByBrand.values()).reduce((s, b) => s + b.count, 0)
    const prevShareOfVoice = prevTotalReviews > 0 ? (prevMyReviewCount / prevTotalReviews) * 100 : 0
    const shareOfVoiceDelta = prevTotalReviews > 0 ? shareOfVoice - prevShareOfVoice : null

    const myMatchedChange = data.matchedChanges.find(mc => mc.brandId === myBrandId && mc.kcal === 2000)
    const eventCount = data.events.length

    // ── Build verdict (full sentence with numbers) ────────────────────────
    const bigCompetitorChange = data.matchedChanges
      .filter(mc => mc.brandId !== myBrandId && mc.kcal === 2000 && Math.abs(mc.changePercent) > 5)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0]

    let verdict: string
    let verdictColor: 'green' | 'amber' | 'red' = 'green'

    if (prevGapPercent != null && gapPercent > prevGapPercent + 2 && gapPercent > 15 && cheapestName) {
      verdict = `Dystans cenowy do ${cheapestName} wzrósł do ${gapPercent.toFixed(1)}% (${myPriceValue != null ? fmtPrice(myPriceValue) : 'b.d.'} vs ${cheapestPrice != null ? fmtPrice(cheapestPrice) : 'b.d.'}). Wymaga decyzji cenowej.`
      verdictColor = 'red'
    } else if (ratingDelta != null && ratingDelta < -0.3 && !isSmallSample) {
      verdict = `Ocena klientów spadła z ${prevAvgRating.toFixed(1)} do ${avgRating.toFixed(1)}\u2605 na bazie ${myReviewCount} opinii. Przeanalizować przyczyny spadku.`
      verdictColor = 'red'
    } else if (bigCompetitorChange) {
      const dir = bigCompetitorChange.changePercent > 0 ? 'podniósł' : 'obniżył'
      verdict = `${bigCompetitorChange.brandName} ${dir} ceny o ${Math.abs(bigCompetitorChange.changePercent).toFixed(1)}%. Monitorować wpływ na naszą pozycję #${myPosition || '?'} z ${totalBrands}.`
      verdictColor = 'amber'
    } else {
      const posNote = myPosition > 0 ? `Pozycja #${myPosition} z ${totalBrands} cenowo` : `Brak danych cenowych 2000 kcal`
      const ratingNote = myReviewCount > 0
        ? isSmallSample
          ? `, ocena ${avgRating.toFixed(1)}\u2605 (${myReviewCount} opinii \u2014 mała próba)`
          : `, ocena ${avgRating.toFixed(1)}\u2605 (${myReviewCount} opinii)`
        : ''
      const evtNote = eventCount > 0 ? `. ${eventCount} ruchów konkurencji.` : '. Brak istotnych ruchów konkurencji.'
      verdict = `${posNote}${ratingNote}${evtNote}`
      verdictColor = 'green'
    }

    return {
      myPosition, totalBrands, brandsWithPricing,
      myPriceValue, cheapestName, cheapestPrice,
      gapPercent, prevGapPercent,
      avgRating, myReviewCount, prevAvgRating, prevMyReviewCount,
      ratingDelta, isSmallSample,
      shareOfVoice, shareOfVoiceDelta, totalMarketReviews,
      verdict, verdictColor,
      myMatchedChange, eventCount,
    }
  }, [data, myBrandId, allBrandIds])

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-3 w-32 mx-auto" />
        </div>
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

  // ── Render data ────────────────────────────────────────────────────────────

  const weekRange = `${weekStart} \u2013 ${weekEnd}`

  // Scatter chart data (Slide 2)
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
  const cheapestScatter = scatterData.filter(d => !d.isMy).sort((a, b) => a.x - b.x)[0]

  // Catalog price table (Slide 3)
  type CatalogRow = { brandId: string; brandName: string; brandLogo: string | null; prices: Record<number, number | null>; changePercent: number | null; matchedCount: number; isMy: boolean }
  const catalogTableData: CatalogRow[] = allBrandIds.flatMap(brandId => {
    const info = data.brandInfo.get(brandId)
    if (!info) return []
    const prices: Record<number, number | null> = {}
    for (const kcal of KCAL_BUCKETS) {
      const p = data.brandKcalPrices.find(bp => bp.brandId === brandId && bp.kcal === kcal)
      prices[kcal] = p?.avgPrice ?? null
    }
    const matchedChange = data.matchedChanges.find(mc => mc.brandId === brandId && mc.kcal === 2000)
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

  // Gap to cheapest with names and prices (Slide 3)
  const myCatalogRow = catalogTableData.find(r => r.isMy)
  const myPrice2000 = myCatalogRow?.prices[2000]
  const cheapestCatalogRow = catalogTableData
    .filter(r => !r.isMy && r.prices[2000] != null)
    .sort((a, b) => (a.prices[2000] ?? Infinity) - (b.prices[2000] ?? Infinity))[0]
  const cheapestCompetitorPrice = cheapestCatalogRow?.prices[2000]
  const pricGapPct = myPrice2000 != null && cheapestCompetitorPrice != null
    ? ((myPrice2000 - cheapestCompetitorPrice) / cheapestCompetitorPrice) * 100
    : null

  // Discount table (Slide 4)
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

  // Review table (Slide 6)
  type ReviewTableRow = { brandId: string; brandName: string; brandLogo: string | null; avgRating: number; prevAvgRating: number; count: number; prevCount: number; isMy: boolean }
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
      isMy: brandId === myBrandId,
    }]
  })

  // Quotes (Slide 6)
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

  // Effective price bar data (Slide 5) — sorted ascending
  const barChartData = data.effectivePrices.map(ep => ({
    name: ep.brandName,
    price: Math.round(ep.effectivePrice),
    isMy: ep.brandId === myBrandId,
  }))

  // Effective price insight (Slide 5)
  const cheapestEffective = data.effectivePrices[0]
  const myEffective = data.effectivePrices.find(ep => ep.brandId === myBrandId)
  const effectiveGap = myEffective && cheapestEffective
    ? ((myEffective.effectivePrice - cheapestEffective.effectivePrice) / cheapestEffective.effectivePrice) * 100
    : null
  const myEffRating = myEffective ? (data.currentReviewsByBrand.get(myEffective.brandId)?.avgRating ?? 0) : 0
  const cheapEffRating = cheapestEffective ? (data.currentReviewsByBrand.get(cheapestEffective.brandId)?.avgRating ?? 0) : 0

  // Events limited to 5 (Slide 7)
  const topEvents = data.events.slice(0, 5)

  // Verdict colors
  const verdictBg: Record<string, string> = {
    green: 'bg-emerald-100 dark:bg-emerald-950/30',
    amber: 'bg-amber-100 dark:bg-amber-950/30',
    red: 'bg-red-100 dark:bg-red-950/30',
  }
  const verdictText: Record<string, string> = {
    green: 'text-emerald-800 dark:text-emerald-300',
    amber: 'text-amber-800 dark:text-amber-300',
    red: 'text-red-800 dark:text-red-300',
  }
  const verdictIcon: Record<string, typeof CheckCircle> = {
    green: CheckCircle,
    amber: ShieldAlert,
    red: ShieldAlert,
  }

  // ── Slide wrapper style ────────────────────────────────────────────────────
  const slideStyle = (active: boolean): React.CSSProperties => ({
    aspectRatio: '16/9',
    width: '100%',
    maxWidth: 1100,
    display: active ? 'flex' : 'none',
  })

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-4 no-print">
        <Button onClick={() => handlePrint()} variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-2" />PDF
        </Button>
        <Button onClick={toggleFullscreen} variant="outline" size="sm">
          <Maximize className="h-4 w-4 mr-2" />Tryb prezentacji
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
          <Mail className="h-4 w-4 mr-2" />Email
        </Button>
      </div>

      {/* ── Presentation container ─────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={isFullscreen ? 'flex flex-col items-center justify-center' : ''}
        style={isFullscreen ? { background: '#0a0a0a', height: '100%', width: '100%' } : undefined}
      >
        {/* Slide area with arrows */}
        <div className="relative w-full" style={{ maxWidth: 1240, margin: '0 auto' }}>
          {/* Left arrow */}
          <button
            onClick={goPrev}
            disabled={currentSlide === 0}
            className="no-print absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all disabled:opacity-20 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700"
            style={{ left: 0 }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Slides */}
          <div ref={reportRef} className="mx-auto" style={{ maxWidth: 1100 }}>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 1 — Executive Summary
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="1" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 0)}>
              <SlideFrame index={0} brand={myBrandName} weekRange={weekRange}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }} className="text-gray-900 dark:text-gray-100">
                    Raport konkurencyjny
                  </h1>
                  <p style={{ fontSize: 16 }} className="text-gray-500 dark:text-gray-400 mt-1">
                    {myBrandName} &middot; tydzień {weekRange}
                  </p>
                </div>

                {slide1Data && (
                  <>
                    {/* Verdict banner — full sentence */}
                    <div className={`rounded-xl px-6 py-4 mt-5 flex items-start gap-4 ${verdictBg[slide1Data.verdictColor]}`}>
                      {(() => {
                        const VIcon = verdictIcon[slide1Data.verdictColor]
                        return <VIcon className={`h-7 w-7 flex-shrink-0 mt-0.5 ${verdictText[slide1Data.verdictColor]}`} />
                      })()}
                      <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45 }} className={verdictText[slide1Data.verdictColor]}>
                        {slide1Data.verdict}
                      </p>
                    </div>

                    {/* 4 KPIs with full context */}
                    <div className="grid grid-cols-4 gap-5 mt-6">
                      {/* KPI 1: Pozycja cenowa */}
                      <div>
                        <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className="text-gray-900 dark:text-gray-100">
                          {slide1Data.myPosition > 0 ? `#${slide1Data.myPosition}` : 'b.d.'}<span style={{ fontSize: 20, fontWeight: 500 }} className="text-gray-400"> z {slide1Data.totalBrands}</span>
                        </p>
                        <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">Pozycja cenowa</p>
                        <p style={{ fontSize: 11, lineHeight: 1.4 }} className="text-gray-400 mt-0.5">
                          Ranking ceny 2000 kcal (1&nbsp;=&nbsp;najtańsza){slide1Data.brandsWithPricing < slide1Data.totalBrands ? `. Dane dla ${slide1Data.brandsWithPricing} z ${slide1Data.totalBrands} marek.` : ''}
                        </p>
                        {slide1Data.myMatchedChange && (
                          <p style={{ fontSize: 13 }} className={`mt-1 font-medium ${slide1Data.myMatchedChange.changePercent > 0.5 ? 'text-red-500' : slide1Data.myMatchedChange.changePercent < -0.5 ? 'text-green-600' : 'text-gray-400'}`}>
                            {fmtPct(slide1Data.myMatchedChange.changePercent)} zmiana ceny WoW
                          </p>
                        )}
                      </div>

                      {/* KPI 2: Cena vs najtańszy */}
                      <div>
                        <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className={slide1Data.gapPercent > 15 ? 'text-red-600' : slide1Data.gapPercent <= 0 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}>
                          {slide1Data.myPriceValue != null ? fmtPct(slide1Data.gapPercent, true) : 'b.d.'}
                        </p>
                        <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">Cena vs najtańszy</p>
                        <p style={{ fontSize: 11, lineHeight: 1.4 }} className="text-gray-400 mt-0.5">
                          {slide1Data.myPriceValue != null && slide1Data.cheapestName && slide1Data.cheapestPrice != null
                            ? `${myBrandName} ${fmtPrice(slide1Data.myPriceValue)} vs ${slide1Data.cheapestName} ${fmtPrice(slide1Data.cheapestPrice)} (2000 kcal)`
                            : 'Brak danych cenowych do porównania'
                          }
                        </p>
                      </div>

                      {/* KPI 3: Ocena tygodnia */}
                      <div>
                        <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className="text-gray-900 dark:text-gray-100">
                          {slide1Data.myReviewCount > 0 ? `${slide1Data.avgRating.toFixed(2)}\u2605` : 'b.d.'}
                          {slide1Data.isSmallSample && slide1Data.myReviewCount > 0 && <SmallSampleBadge />}
                        </p>
                        <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">
                          Ocena tygodnia{slide1Data.myReviewCount > 0 ? ` (${slide1Data.myReviewCount} opinii)` : ''}
                        </p>
                        <p style={{ fontSize: 11, lineHeight: 1.4 }} className="text-gray-400 mt-0.5">
                          {slide1Data.prevMyReviewCount > 0
                            ? `Poprz. tydz.: ${slide1Data.prevAvgRating.toFixed(2)}\u2605 (${slide1Data.prevMyReviewCount} opinii)`
                            : 'Brak danych z poprz. tygodnia'
                          }
                        </p>
                        {slide1Data.ratingDelta != null && (
                          <p style={{ fontSize: 13 }} className={`mt-1 font-medium ${slide1Data.ratingDelta > 0.05 ? 'text-green-600' : slide1Data.ratingDelta < -0.05 ? 'text-red-500' : 'text-gray-400'}`}>
                            {slide1Data.ratingDelta >= 0 ? '+' : ''}{slide1Data.ratingDelta.toFixed(2)} vs poprz. tydz.
                          </p>
                        )}
                      </div>

                      {/* KPI 4: Udział w opiniach rynku */}
                      <div>
                        <p style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }} className="text-gray-900 dark:text-gray-100">
                          {slide1Data.totalMarketReviews > 0 ? `${slide1Data.shareOfVoice.toFixed(0)}%` : 'b.d.'}
                        </p>
                        <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">Udział w opiniach rynku</p>
                        <p style={{ fontSize: 11, lineHeight: 1.4 }} className="text-gray-400 mt-0.5">
                          {slide1Data.totalMarketReviews > 0
                            ? `${slide1Data.myReviewCount} z ${slide1Data.totalMarketReviews} nowych opinii na rynku dotyczyło nas`
                            : 'Brak opinii w tym tygodniu'
                          }
                        </p>
                        {slide1Data.shareOfVoiceDelta != null && (
                          <p style={{ fontSize: 13 }} className={`mt-1 font-medium ${slide1Data.shareOfVoiceDelta > 1 ? 'text-green-600' : slide1Data.shareOfVoiceDelta < -1 ? 'text-red-500' : 'text-gray-400'}`}>
                            {slide1Data.shareOfVoiceDelta >= 0 ? '+' : ''}{slide1Data.shareOfVoiceDelta.toFixed(1)}pp vs poprz. tydz.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 2 — Market Position Map
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="2" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 1)}>
              <SlideFrame index={1} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Mapa pozycji rynkowej
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-2">Każda bańka = marka. Oś X: cena po rabatach. Oś Y: ocena klientów. Linie przerywane: mediana rynku.</p>

                {scatterData.length > 0 ? (
                  <>
                    <div className="relative flex-1 min-h-0">
                      {/* Quadrant labels */}
                      <div className="absolute top-1 left-16 pointer-events-none" style={{ fontSize: 11, color: '#9ca3af' }}>Niska cena, wysoka ocena</div>
                      <div className="absolute top-1 right-2 pointer-events-none" style={{ fontSize: 11, color: '#9ca3af' }}>Wysoka cena, wysoka ocena</div>
                      <div className="absolute bottom-7 left-16 pointer-events-none" style={{ fontSize: 11, color: '#9ca3af' }}>Niska cena, niska ocena</div>
                      <div className="absolute bottom-7 right-2 pointer-events-none" style={{ fontSize: 11, color: '#9ca3af' }}>Wysoka cena, niska ocena</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 20 }}>
                          <CartesianGrid horizontal={true} vertical={false} stroke="#f3f4f6" />
                          <XAxis
                            type="number" dataKey="x" domain={['auto', 'auto']}
                            tick={{ fontSize: 13 }}
                            label={{ value: 'Cena za 2000 kcal po rabacie, zł/dzień', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#6b7280' } }}
                          />
                          <YAxis
                            type="number" dataKey="y" domain={[1, 5]}
                            tick={{ fontSize: 13 }}
                            label={{ value: 'Średnia ocena klientów', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 12, fill: '#6b7280' } }}
                          />
                          <ZAxis type="number" dataKey="z" range={[200, 800]} />
                          <ReTooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              return (
                                <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-3 text-sm">
                                  <p className="font-bold">{d.brandName}</p>
                                  <p>Cena efektywna: {d.x} zł/dzień</p>
                                  <p>Ocena: {d.y.toFixed(2)}\u2605</p>
                                  <p>Liczba opinii: {d.z}</p>
                                </div>
                              )
                            }}
                          />
                          <ReferenceLine x={medianX} stroke="#d1d5db" strokeDasharray="3 3" label={{ value: 'mediana cen', position: 'top', style: { fontSize: 10, fill: '#9ca3af' } }} />
                          <ReferenceLine y={medianY} stroke="#d1d5db" strokeDasharray="3 3" label={{ value: 'mediana ocen', position: 'right', style: { fontSize: 10, fill: '#9ca3af' } }} />
                          <Scatter data={scatterData} shape={ScatterBubble} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>

                    <InsightBox>
                      {myScatter && cheapestScatter ? (
                        myScatter.x > cheapestScatter.x ? (
                          <>Płacimy premię cenową {myScatter.x - cheapestScatter.x} zł/dzień vs {cheapestScatter.brandName} przy {
                            myScatter.y > cheapestScatter.y + 0.2 ? 'wyższej ocenie — premia uzasadniona jakością'
                            : myScatter.y < cheapestScatter.y - 0.1 ? 'niższej ocenie — premia nieuzasadniona, do decyzji: obniżka lub inwestycja w jakość'
                            : 'porównywalnej ocenie — premia do monitorowania'
                          } ({myScatter.y.toFixed(1)}\u2605 vs {cheapestScatter.y.toFixed(1)}\u2605).</>
                        ) : (
                          <><strong>{myBrandName}</strong> ma najniższą cenę efektywną ({myScatter.x} zł/dzień) przy ocenie {myScatter.y.toFixed(1)}\u2605. Pozycja lidera cenowego.</>
                        )
                      ) : (
                        <>Brak wystarczających danych do analizy pozycji.</>
                      )}
                    </InsightBox>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p style={{ fontSize: 16 }} className="text-gray-400">Brak danych cenowych i opinii do wyświetlenia mapy pozycji</p>
                  </div>
                )}
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 3 — Prices
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="3" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 2)}>
              <SlideFrame index={2} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Porównanie cen katalogowych
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-3">Identyczne warianty kaloryczne, porównanie tydzień do tygodnia (WoW = zmiana vs poprzedni tydzień)</p>

                <table className="w-full" style={{ fontSize: 15 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th className="text-left py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase" style={{ fontSize: 12, letterSpacing: 0.5 }}>Marka</th>
                      <th className="text-right py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase" style={{ fontSize: 12 }}>1500 kcal</th>
                      <th className="text-right py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase" style={{ fontSize: 12 }}>2000 kcal</th>
                      <th className="text-right py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase" style={{ fontSize: 12 }}>2500 kcal</th>
                      <th className="text-right py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase" style={{ fontSize: 12 }}>Zmiana tydz.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogTableData.map(row => (
                      <tr
                        key={row.brandId}
                        className={row.isMy ? 'bg-blue-50 dark:bg-blue-950/30 font-semibold' : ''}
                        style={{ borderBottom: '1px solid #f3f4f6' }}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <BrandLogo url={row.brandLogo} name={row.brandName} size="md" />
                            <span className="text-gray-900 dark:text-gray-100">{row.brandName}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 text-gray-700 dark:text-gray-300">{row.prices[1500] != null ? fmtPrice(row.prices[1500]) : <span className="text-gray-400">b.d.</span>}</td>
                        <td className="text-right py-3 text-gray-700 dark:text-gray-300">{row.prices[2000] != null ? fmtPrice(row.prices[2000]) : <span className="text-gray-400">b.d.</span>}</td>
                        <td className="text-right py-3 text-gray-700 dark:text-gray-300">{row.prices[2500] != null ? fmtPrice(row.prices[2500]) : <span className="text-gray-400">b.d.</span>}</td>
                        <td className="text-right py-3">
                          {row.changePercent != null ? (
                            <span className={row.changePercent > 0.5 ? 'text-red-600' : row.changePercent < -0.5 ? 'text-green-600' : 'text-gray-400'}>
                              {fmtPct(row.changePercent)}
                            </span>
                          ) : (
                            <span className="text-gray-400">b.d.</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <InsightBox>
                  {pricGapPct != null && myPrice2000 != null && cheapestCatalogRow ? (
                    pricGapPct <= 0 ? (
                      <><strong>{myBrandName}</strong> ({fmtPrice(myPrice2000)}) jest najtańszy w wariancie 2000 kcal.</>
                    ) : (
                      <>Nasza cena 2000 kcal ({fmtPrice(myPrice2000)}) jest o <strong>{pricGapPct.toFixed(1)}%</strong> wyższa niż {cheapestCatalogRow.brandName} ({fmtPrice(cheapestCatalogRow.prices[2000]!)}). {pricGapPct > 15 ? 'Przekroczony próg 15% — rozważyć korektę.' : 'W akceptowalnym przedziale.'}</>
                    )
                  ) : (
                    <>Brak pełnych danych cenowych wariantu 2000 kcal do obliczenia dystansu.</>
                  )}
                </InsightBox>
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 4 — Discounts
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="4" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 3)}>
              <SlideFrame index={3} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Polityka rabatowa
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-4">Przegląd aktywnych rabatów i strategii cenowej konkurencji w bieżącym tygodniu</p>

                {/* 3 KPIs */}
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }} className="text-gray-900 dark:text-gray-100">
                      {(discountTableData.find(d => d.isMy)?.avgDiscount ?? 0).toFixed(1)}%
                    </p>
                    <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">Nasz średni rabat</p>
                    <p style={{ fontSize: 11 }} className="text-gray-400 mt-0.5">Średnia z aktywnych promocji {myBrandName}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }} className="text-gray-900 dark:text-gray-100">
                      {mostAggressiveCompetitor ? `${mostAggressiveCompetitor.avgDiscount.toFixed(1)}%` : '\u2014'}
                    </p>
                    <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">Najagresywniejszy konkurent</p>
                    <p style={{ fontSize: 11 }} className="text-gray-400 mt-0.5">{mostAggressiveCompetitor ? `${mostAggressiveCompetitor.brandName} — największy średni rabat` : 'Brak aktywnych rabatów konkurencji'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }} className="text-gray-900 dark:text-gray-100">
                      {data.newPromosThisWeek.length}
                    </p>
                    <p style={{ fontSize: 13 }} className="text-gray-900 dark:text-gray-200 mt-1.5 font-semibold">Nowe promocje w tygodniu</p>
                    <p style={{ fontSize: 11 }} className="text-gray-400 mt-0.5">Promocje uruchomione w okresie {weekRange}</p>
                  </div>
                </div>

                {/* Compact table */}
                <table className="w-full" style={{ fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th className="text-left py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>Marka</th>
                      <th className="text-right py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>Śr. rabat</th>
                      <th className="text-right py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>L. promocji</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountTableData.map(row => (
                      <tr
                        key={row.brandId}
                        className={row.isMy ? 'bg-blue-50 dark:bg-blue-950/30 font-semibold' : ''}
                        style={{ borderBottom: '1px solid #f3f4f6' }}
                      >
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <BrandLogo url={row.brandLogo} name={row.brandName} />
                            <span className="text-gray-900 dark:text-gray-100">{row.brandName}</span>
                          </div>
                        </td>
                        <td className="text-right py-2 text-gray-700 dark:text-gray-300">{row.avgDiscount > 0 ? `${row.avgDiscount.toFixed(1)}%` : '\u2014'}</td>
                        <td className="text-right py-2 text-gray-700 dark:text-gray-300">{row.promoCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(() => {
                  const longRunners = discountTableData.filter(d => d.isLongRunning && !d.isMy)
                  return longRunners.length > 0 ? (
                    <InsightBox>
                      {longRunners.map(d => d.brandName).join(', ')} utrzymuje rabat ponad 4 tygodnie ({longRunners.map(d => `${d.avgDiscount.toFixed(1)}%`).join(', ')}). To trwała zmiana strategii cenowej, nie jednorazowa promocja — ich cena efektywna jest stale niższa od katalogowej.
                    </InsightBox>
                  ) : (
                    <InsightBox>Brak długotrwałych strategii rabatowych u konkurencji. Obecne promocje mają charakter taktyczny.</InsightBox>
                  )
                })()}
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 5 — Effective Price
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="5" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 4)}>
              <SlideFrame index={4} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Cena efektywna
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-3">Cena 2000 kcal po uwzględnieniu obowiązujących rabatów, zł/dzień. Sortowanie od najtańszego.</p>

                {barChartData.length > 0 ? (
                  <>
                    <div className="flex-1 min-h-0" style={{ minHeight: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={barChartData}
                          layout="vertical"
                          margin={{ left: 10, right: 70, top: 5, bottom: 20 }}
                        >
                          <CartesianGrid horizontal={false} vertical={true} stroke="#f3f4f6" />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 13 }}
                            label={{ value: 'Cena w zł/dzień', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#6b7280' } }}
                          />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 14 }} />
                          <ReTooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null
                              const ep = data.effectivePrices.find(e => e.brandName === payload[0].payload.name)
                              return (
                                <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-3 text-sm">
                                  <p className="font-bold">{payload[0].payload.name}</p>
                                  <p>Cena efektywna: {payload[0].value} zł/dzień</p>
                                  {ep && ep.discount > 0 && <p>Rabat: {ep.discount.toFixed(1)}% (katalog: {fmtPrice(ep.catalogPrice)})</p>}
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="price" name="Cena efektywna" radius={[0, 6, 6, 0]}>
                            {barChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.isMy ? MY_BRAND_COLOR : COMPETITOR_COLOR} />
                            ))}
                            <LabelList dataKey="price" position="right" style={{ fontSize: 16, fontWeight: 700, fill: '#374151' }} formatter={(v: any) => `${v} zł`} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <InsightBox>
                      {myEffective && cheapestEffective && myEffective.brandId === cheapestEffective.brandId ? (
                        <><strong>{myBrandName}</strong> ({Math.round(myEffective.effectivePrice)} zł/dzień) jest najtańszy po uwzględnieniu rabatów. Przewaga cenowa utrzymana.</>
                      ) : effectiveGap != null && cheapestEffective ? (
                        <>Nasz koszt efektywny ({Math.round(myEffective!.effectivePrice)} zł) jest o <strong>{effectiveGap.toFixed(1)}%</strong> wyższy niż {cheapestEffective.brandName} ({Math.round(cheapestEffective.effectivePrice)} zł). {
                          myEffRating > cheapEffRating + 0.2
                            ? `Premia częściowo uzasadniona oceną (${myEffRating.toFixed(1)}\u2605 vs ${cheapEffRating.toFixed(1)}\u2605).`
                            : myEffRating < cheapEffRating - 0.1
                              ? `Premia nieuzasadniona — nasza ocena niższa (${myEffRating.toFixed(1)}\u2605 vs ${cheapEffRating.toFixed(1)}\u2605).`
                              : `Oceny porównywalne (${myEffRating.toFixed(1)}\u2605 vs ${cheapEffRating.toFixed(1)}\u2605) — premia do monitorowania.`
                        }</>
                      ) : (
                        <>Brak danych do porównania cen efektywnych.</>
                      )}
                    </InsightBox>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p style={{ fontSize: 16 }} className="text-gray-400">Brak danych cenowych 2000 kcal do wykresu</p>
                  </div>
                )}
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 6 — Voice of Customer
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="6" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 5)}>
              <SlideFrame index={5} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Głos klienta
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-3">Nowe opinie z bieżącego tygodnia. Delta = zmiana średniej oceny vs poprzedni tydzień.</p>

                <div className="flex gap-6 flex-1 min-h-0">
                  {/* Left: rating table */}
                  <div className="flex-1">
                    <table className="w-full" style={{ fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th className="text-left py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>Marka</th>
                          <th className="text-right py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>Ocena</th>
                          <th className="text-right py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>Delta</th>
                          <th className="text-right py-2 font-semibold text-gray-500 uppercase" style={{ fontSize: 11 }}>Opinii</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTableData.map(row => {
                          const hasPrev = row.prevCount > 0
                          const delta = hasPrev ? row.avgRating - row.prevAvgRating : null
                          const isSmall = row.count < 10
                          return (
                            <tr
                              key={row.brandId}
                              className={row.isMy ? 'bg-blue-50 dark:bg-blue-950/30 font-semibold' : ''}
                              style={{ borderBottom: '1px solid #f3f4f6' }}
                            >
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <BrandLogo url={row.brandLogo} name={row.brandName} />
                                  <span className="text-gray-900 dark:text-gray-100">{row.brandName}</span>
                                </div>
                              </td>
                              <td className="text-right py-2 text-gray-700 dark:text-gray-300">
                                {row.avgRating > 0 ? row.avgRating.toFixed(2) : '\u2014'}
                              </td>
                              <td className="text-right py-2">
                                {delta != null ? (
                                  <span className={delta > 0.05 ? 'text-green-600' : delta < -0.05 ? 'text-red-500' : 'text-gray-400'}>
                                    {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400" title="Brak danych z poprzedniego tygodnia">\u2014</span>
                                )}
                              </td>
                              <td className="text-right py-2 text-gray-700 dark:text-gray-300">
                                {row.count}{isSmall && row.count > 0 && <SmallSampleBadge />}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Right: quotes */}
                  <div className="flex-1 flex flex-col gap-3">
                    {bestQuote ? (
                      <div className="rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex-1">
                        <p style={{ fontSize: 11 }} className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1.5">
                          Najlepsza opinia tygodnia
                        </p>
                        <p style={{ fontSize: 14, lineHeight: 1.4 }} className="italic text-gray-700 dark:text-gray-300">
                          &ldquo;{bestQuote.content?.slice(0, 120)}{(bestQuote.content?.length ?? 0) > 120 ? '...' : ''}&rdquo;
                        </p>
                        <p style={{ fontSize: 11 }} className="text-gray-400 mt-1">{bestQuote.rating}&#9733; &middot; {bestQuote.review_date}</p>
                      </div>
                    ) : (
                      <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-900 flex-1 flex items-center justify-center">
                        <p style={{ fontSize: 13 }} className="text-gray-400">Brak pozytywnych opinii (4\u2605+) w tym tygodniu</p>
                      </div>
                    )}
                    {worstQuote ? (
                      <div className="rounded-lg p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex-1">
                        <p style={{ fontSize: 11 }} className="font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1.5">
                          Najgorsza opinia tygodnia
                        </p>
                        <p style={{ fontSize: 14, lineHeight: 1.4 }} className="italic text-gray-700 dark:text-gray-300">
                          &ldquo;{worstQuote.content?.slice(0, 120)}{(worstQuote.content?.length ?? 0) > 120 ? '...' : ''}&rdquo;
                        </p>
                        <p style={{ fontSize: 11 }} className="text-gray-400 mt-1">{worstQuote.rating}&#9733; &middot; {worstQuote.review_date}</p>
                      </div>
                    ) : (
                      <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-900 flex-1 flex items-center justify-center">
                        <p style={{ fontSize: 13 }} className="text-gray-400">Brak negatywnych opinii (1-2\u2605) w tym tygodniu</p>
                      </div>
                    )}
                  </div>
                </div>

                {dominantTopic ? (
                  <InsightBox>
                    {dominantTopic[1]} z {myNegativeReviews.length} negatywnych opinii ({Math.round(dominantTopic[1] / myNegativeReviews.length * 100)}%) dotyczy tematu <strong>{topicLabels[dominantTopic[0]] || dominantTopic[0]}</strong>.{' '}
                    {dominantTopic[1] / myNegativeReviews.length > 0.5
                      ? 'Koncentracja powyżej 50% — wymaga eskalacji operacyjnej.'
                      : 'Warto monitorować trend w kolejnych tygodniach.'
                    }
                  </InsightBox>
                ) : myNegativeReviews.length === 0 ? (
                  <InsightBox>Brak negatywnych opinii (1-2\u2605) w tym tygodniu — pozytywny sygnał jakościowy.</InsightBox>
                ) : (
                  <InsightBox>Brak wyraźnego dominującego tematu w negatywnych opiniach — problemy rozproszone.</InsightBox>
                )}
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 7 — Competitor Moves
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="7" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 6)}>
              <SlideFrame index={6} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Ruchy konkurencji
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-5">Istotne zdarzenia: zmiany cen &gt;3%, nowe/zakończone promocje, skoki opinii, zmiany oferty pakietów</p>

                {topEvents.length > 0 ? (
                  <div className="space-y-3">
                    {topEvents.map((event, i) => (
                      <div key={i} className="flex items-baseline gap-4" style={{ fontSize: 15 }}>
                        <span className="font-mono text-gray-400 flex-shrink-0" style={{ fontSize: 13, minWidth: 80 }}>
                          {event.date.slice(5)}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0" style={{ minWidth: 120 }}>
                          {event.brandName}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {event.description}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                      <p style={{ fontSize: 18, fontWeight: 600 }} className="text-gray-600 dark:text-gray-400">
                        Spokojny tydzień — brak istotnych ruchów konkurencji
                      </p>
                      <p style={{ fontSize: 13 }} className="text-gray-400 mt-1">
                        Żaden konkurent nie zmienił cen o więcej niż 3% ani nie uruchomił nowych promocji.
                      </p>
                    </div>
                  </div>
                )}
              </SlideFrame>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SLIDE 8 — Recommendations
                ═══════════════════════════════════════════════════════════════ */}
            <div data-slide="8" className="bg-white dark:bg-gray-950 rounded-2xl shadow-xl border overflow-hidden" style={slideStyle(currentSlide === 7)}>
              <SlideFrame index={7} brand={myBrandName} weekRange={weekRange}>
                <h2 style={{ fontSize: 28, fontWeight: 700 }} className="text-gray-900 dark:text-gray-100 mb-1">
                  Rekomendacje
                </h2>
                <p style={{ fontSize: 13 }} className="text-gray-500 mb-6">Sugerowane działania wynikające z danych tygodnia. Max 3 najważniejsze.</p>

                {data.recommendations.length > 0 ? (
                  <div className="space-y-5">
                    {data.recommendations.map((rec, i) => {
                      const priorityBorder: Record<string, string> = {
                        high: 'border-l-red-500',
                        medium: 'border-l-amber-500',
                        low: 'border-l-blue-400',
                      }
                      const priorityBg: Record<string, string> = {
                        high: 'bg-red-50 dark:bg-red-950/10',
                        medium: 'bg-amber-50 dark:bg-amber-950/10',
                        low: 'bg-blue-50 dark:bg-blue-950/10',
                      }
                      return (
                        <div key={i} className={`border-l-4 rounded-r-lg px-5 py-4 ${priorityBorder[rec.priority]} ${priorityBg[rec.priority]}`}>
                          <div className="flex items-baseline gap-3">
                            <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }} className="text-gray-300 flex-shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }} className="text-gray-900 dark:text-gray-100">
                                {rec.title}
                              </p>
                              <p style={{ fontSize: 13, lineHeight: 1.5 }} className="text-gray-600 dark:text-gray-400 mt-1">
                                {rec.text}
                              </p>
                              <p style={{ fontSize: 11 }} className="text-gray-400 mt-2">
                                Właściciel: {rec.owner} &middot; Termin: {rec.deadline}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                      <p style={{ fontSize: 20, fontWeight: 600 }} className="text-gray-600 dark:text-gray-400">
                        Utrzymać obecną strategię
                      </p>
                      <p style={{ fontSize: 14 }} className="text-gray-400 mt-1">
                        Pozycja rynkowa stabilna, brak alarmujących sygnałów. Kontynuować monitoring.
                      </p>
                    </div>
                  </div>
                )}
              </SlideFrame>
            </div>

          </div>

          {/* Right arrow */}
          <button
            onClick={goNext}
            disabled={currentSlide === TOTAL_SLIDES - 1}
            className="no-print absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all disabled:opacity-20 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700"
            style={{ right: 0 }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dot navigation */}
        <div className="no-print flex justify-center gap-2.5 mt-5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`rounded-full transition-all ${i === currentSlide ? 'w-3 h-3 bg-primary scale-110' : 'w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'}`}
            />
          ))}
        </div>
      </div>

      {/* ── Email Modal ────────────────────────────────────────────────────── */}
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
                  <span className="text-muted-foreground text-xs">&middot;</span>
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
