'use client'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  Star, MessageSquare, TrendingUp, TrendingDown, Heart, ThumbsUp, ThumbsDown,
  AlertTriangle, Calendar, Sparkles, Clock, Target, Percent, DollarSign,
  Quote, FileDown, Mail, Loader2,
} from "lucide-react"
import { useReactToPrint } from 'react-to-print'
import { useState, useRef, useMemo } from "react"
import { format, startOfMonth, endOfMonth, subDays, differenceInDays, subMonths } from "date-fns"
import { pl } from "date-fns/locale"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts"
import { useReviewAspects, ASPECT_KEYWORDS, analyzeAspects } from "@/hooks/supabase/useReviewAspects"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DynamicReportProps {
  brandId: string | null
  brandName: string
  brandLogoUrl?: string | null
  dateFrom: string
  dateTo: string
}

interface ReviewRow {
  rating: number | null
  content: string | null
  review_date: string | null
  source: string | null
  author_name: string | null
}

interface PeriodStats {
  label: string
  count: number
  avgRating: string
  positivePercent: string
  negativePercent: string
  positive: number
  negative: number
  neutral: number
}

interface MonthlyPoint {
  month: string
  avgRating: number | null
  count: number
  positive: number
  negative: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTIMENT_COLORS = {
  positive: "hsl(142, 76%, 36%)",
  neutral:  "hsl(48, 96%, 53%)",
  negative: "hsl(0, 84%, 60%)",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAllReviews(
  brandId: string | null,
  dateFrom: string,
  dateTo: string,
): Promise<ReviewRow[]> {
  let all: ReviewRow[] = []
  let from = 0
  const size = 1000
  while (true) {
    let q = (supabase as any)
      .from("reviews")
      .select("rating, content, review_date, source, author_name")
      .eq("is_approved", true)
      .gte("review_date", dateFrom)
      .lte("review_date", dateTo)
      .order("review_date", { ascending: true })
    if (brandId) q = q.eq("brand_id", brandId)
    const { data, error } = await q.range(from, from + size - 1)
    if (error) throw error
    if (!data?.length) break
    all = [...all, ...data]
    if (data.length < size) break
    from += size
  }
  return all
}

function computeStats(reviews: ReviewRow[], label: string): PeriodStats {
  const total = reviews.length
  if (!total) return { label, count: 0, avgRating: "0.00", positivePercent: "0", negativePercent: "0", positive: 0, negative: 0, neutral: 0 }
  const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0)
  const positive = reviews.filter(r => (r.rating ?? 0) >= 4).length
  const negative = reviews.filter(r => (r.rating ?? 0) <= 2).length
  const neutral = reviews.filter(r => r.rating === 3).length
  return {
    label,
    count: total,
    avgRating: (sum / total).toFixed(2),
    positivePercent: ((positive / total) * 100).toFixed(1),
    negativePercent: ((negative / total) * 100).toFixed(1),
    positive, negative, neutral,
  }
}

function getEmotion(avgRating: number, positivePercent: number, negativePercent: number) {
  if (avgRating >= 4.5 && positivePercent >= 85) return { dominant: "Zaufanie",     secondary: "Lojalność",          type: "positive" as const }
  if (avgRating >= 4.2 && positivePercent >= 80) return { dominant: "Satysfakcja",  secondary: "Zadowolenie",        type: "positive" as const }
  if (avgRating >= 4.0 && negativePercent < 15)  return { dominant: "Nadzieja",     secondary: "Powrót zaufania",    type: "neutral"  as const }
  if (avgRating < 4.0  || negativePercent >= 20) return { dominant: "Frustracja",   secondary: "Rozczarowanie",      type: "negative" as const }
  return                                                 { dominant: "Ostrożność",   secondary: "Niepewność",         type: "neutral"  as const }
}

function fmtMonth(month: string) {
  const [y, m] = month.split("-")
  return `${m}/${y.slice(2)}`
}

function fmtDate(d: string | null) {
  if (!d) return ""
  try { return format(new Date(d), "LLLL yyyy", { locale: pl }) } catch { return "" }
}

// ─── Sub-component: Review Aspects ───────────────────────────────────────────

function ReviewAspectsSection({ brandId }: { brandId: string }) {
  const { data: aspects = [], isLoading } = useReviewAspects(brandId)
  const topAspect = aspects[0]
  const controversial = aspects.filter(a => a.negative >= 20)

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        Najczęstsze aspekty w opiniach
      </h2>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {aspects.map((item, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold capitalize">{item.aspect}</h3>
                      <p className="text-sm text-muted-foreground">{item.mentions} wzmianek</p>
                    </div>
                    {item.positive >= 85
                      ? <ThumbsUp className="h-5 w-5 text-green-500" />
                      : item.negative >= 20
                        ? <AlertTriangle className="h-5 w-5 text-orange-500" />
                        : <Heart className="h-5 w-5 text-primary" />
                    }
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted mb-1">
                    <div className="bg-green-500" style={{ width: `${item.positive}%` }} />
                    <div className="bg-red-500"   style={{ width: `${item.negative}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600 font-medium">P {item.positive}%</span>
                    <span className="text-red-600 font-medium">N {item.negative}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {topAspect && (
            <Card className="border-l-4 border-l-primary bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-sm">
                  <strong>Insight:</strong> {topAspect.aspect.charAt(0).toUpperCase() + topAspect.aspect.slice(1)} jest
                  najczęściej wymienianym aspektem ({topAspect.mentions} wzmianek) z {topAspect.positive}% pozytywnych opinii.
                  {controversial.length > 0 && (
                    <> {controversial.map(a => a.aspect.charAt(0).toUpperCase() + a.aspect.slice(1)).join(", ")} budzi więcej kontrowersji ({controversial.map(a => `${a.negative}%`).join("–")} negatywnych).</>
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DynamicReport({ brandId, brandName, brandLogoUrl, dateFrom, dateTo }: DynamicReportProps) {
  const [showEmail, setShowEmail] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; email: string }[]>([])
  const [extraEmails, setExtraEmails] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; errors: string[] } | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // ── Period helpers ──────────────────────────────────────────────────────────
  const fromMs = useMemo(() => new Date(dateFrom).getTime(), [dateFrom])
  const toMs   = useMemo(() => new Date(dateTo).getTime(),   [dateTo])
  const midMs  = useMemo(() => (fromMs + toMs) / 2,          [fromMs, toMs])
  const lastMonthStart = useMemo(() => startOfMonth(new Date(dateTo)), [dateTo])
  const lastMonthLabel = useMemo(() => format(lastMonthStart, "LLLL yyyy", { locale: pl }), [lastMonthStart])

  // ── Previous period helpers ─────────────────────────────────────────────────
  const prevPeriodTo   = useMemo(() => format(subDays(new Date(dateFrom), 1), 'yyyy-MM-dd'), [dateFrom])
  const prevPeriodFrom = useMemo(() => {
    const days = differenceInDays(new Date(dateTo), new Date(dateFrom))
    return format(subDays(new Date(dateFrom), days + 1), 'yyyy-MM-dd')
  }, [dateFrom, dateTo])
  const prevLastMonthStart = useMemo(() => subMonths(lastMonthStart, 1), [lastMonthStart])
  const prevMidMs = useMemo(() => {
    const f = new Date(prevPeriodFrom).getTime()
    const t = new Date(prevPeriodTo).getTime()
    return (f + t) / 2
  }, [prevPeriodFrom, prevPeriodTo])

  // ── Reviews query ───────────────────────────────────────────────────────────
  const { data: allReviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ["dynamic-report-reviews", brandId, dateFrom, dateTo],
    queryFn: () => fetchAllReviews(brandId, dateFrom, dateTo),
  })

  // ── Derived: period stats ───────────────────────────────────────────────────
  const periodStats = useMemo((): PeriodStats[] | null => {
    if (!allReviews.length) return null
    const firstHalf  = allReviews.filter(r => r.review_date && new Date(r.review_date).getTime() <= midMs)
    const secondHalf = allReviews.filter(r => r.review_date && new Date(r.review_date).getTime() >  midMs)
    const lastMonth  = allReviews.filter(r => {
      if (!r.review_date) return false
      const t = new Date(r.review_date).getTime()
      return t >= lastMonthStart.getTime()
    })
    return [
      computeStats(allReviews, "Wybrany okres"),
      computeStats(firstHalf,  "Pierwsza połowa"),
      computeStats(secondHalf, "Druga połowa"),
      computeStats(lastMonth,  lastMonthLabel),
    ]
  }, [allReviews, midMs, lastMonthStart, lastMonthLabel])

  // ── Previous period reviews & stats ────────────────────────────────────────
  const { data: prevReviews = [] } = useQuery({
    queryKey: ["dynamic-report-prev-reviews", brandId, prevPeriodFrom, prevPeriodTo],
    queryFn: () => fetchAllReviews(brandId, prevPeriodFrom, prevPeriodTo),
  })

  const prevPeriodStats = useMemo((): PeriodStats[] | null => {
    if (!prevReviews.length) return null
    const prevFirstHalf  = prevReviews.filter(r => r.review_date && new Date(r.review_date).getTime() <= prevMidMs)
    const prevSecondHalf = prevReviews.filter(r => r.review_date && new Date(r.review_date).getTime() >  prevMidMs)
    const prevLastMonth  = prevReviews.filter(r => {
      if (!r.review_date) return false
      const t = new Date(r.review_date).getTime()
      return t >= prevLastMonthStart.getTime() && t < lastMonthStart.getTime()
    })
    return [
      computeStats(prevReviews,    "prev"),
      computeStats(prevFirstHalf,  "prev"),
      computeStats(prevSecondHalf, "prev"),
      computeStats(prevLastMonth,  "prev"),
    ]
  }, [prevReviews, prevMidMs, prevLastMonthStart, lastMonthStart])

  // ── Derived: monthly trends ─────────────────────────────────────────────────
  const monthlyTrends = useMemo((): MonthlyPoint[] => {
    const buckets: Record<string, { ratings: number[]; positive: number; negative: number }> = {}
    allReviews.forEach(r => {
      if (!r.review_date) return
      const key = r.review_date.slice(0, 7)
      if (!buckets[key]) buckets[key] = { ratings: [], positive: 0, negative: 0 }
      buckets[key].ratings.push(r.rating ?? 0)
      if ((r.rating ?? 0) >= 4) buckets[key].positive++
      if ((r.rating ?? 0) <= 2) buckets[key].negative++
    })
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month,
        avgRating: parseFloat((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2)),
        count:     d.ratings.length,
        positive:  d.positive,
        negative:  d.negative,
      }))
  }, [allReviews])

  // ── Derived: rating distribution ───────────────────────────────────────────
  const ratingDist = useMemo(() => [5,4,3,2,1].map(star => {
    const count = allReviews.filter(r => r.rating === star).length
    return { star, count, percent: allReviews.length ? parseFloat(((count / allReviews.length) * 100).toFixed(1)) : 0 }
  }), [allReviews])

  // ── Derived: sentiment pie ──────────────────────────────────────────────────
  const sentimentData = useMemo(() => {
    const s = periodStats?.[0]
    if (!s || !s.count) return [
      { name: "Pozytywne (4–5★)", value: 0, color: SENTIMENT_COLORS.positive },
      { name: "Neutralne (3★)",   value: 0, color: SENTIMENT_COLORS.neutral  },
      { name: "Negatywne (1–2★)", value: 0, color: SENTIMENT_COLORS.negative },
    ]
    const neutralPct = parseFloat(((s.neutral / s.count) * 100).toFixed(1))
    return [
      { name: "Pozytywne (4–5★)", value: parseFloat(s.positivePercent), color: SENTIMENT_COLORS.positive },
      { name: "Neutralne (3★)",   value: neutralPct,                    color: SENTIMENT_COLORS.neutral  },
      { name: "Negatywne (1–2★)", value: parseFloat(s.negativePercent), color: SENTIMENT_COLORS.negative },
    ]
  }, [periodStats])

  // ── Derived: troubled months ────────────────────────────────────────────────
  const troubledMonths = useMemo(
    () => monthlyTrends.filter(m => m.avgRating !== null && m.avgRating < 3.5 && m.count > 0),
    [monthlyTrends]
  )

  // ── Derived: best / worst month ─────────────────────────────────────────────
  const trendInsight = useMemo(() => {
    const withData = monthlyTrends.filter(m => m.avgRating !== null && m.count > 0)
    if (!withData.length) return null
    const best  = withData.reduce((a, b) => (a.avgRating! > b.avgRating! ? a : b))
    const worst = withData.reduce((a, b) => (a.avgRating! < b.avgRating! ? a : b))
    const first = withData[0], last = withData[withData.length - 1]
    const diff  = (last.avgRating ?? 0) - (first.avgRating ?? 0)
    const trend = diff >  0.2 ? "rosnący" : diff < -0.2 ? "spadkowy" : "stabilny"
    return { best, worst, trend, diff: diff.toFixed(2) }
  }, [monthlyTrends])

  // ── Quotes query ────────────────────────────────────────────────────────────
  const { data: realQuotes, isLoading: isLoadingQuotes } = useQuery({
    queryKey: ["dynamic-report-quotes", brandId, dateFrom, dateTo],
    queryFn: async () => {
      const positive: ReviewRow[] = allReviews.filter(r => (r.rating ?? 0) >= 4 && (r.content?.length ?? 0) > 20).slice(-6).reverse()
      const negative: ReviewRow[] = allReviews.filter(r => (r.rating ?? 0) <= 2 && (r.content?.length ?? 0) > 20).slice(-4).reverse()
      return { positive, negative }
    },
    enabled: allReviews.length > 0,
  })

  // ── Discounts query ─────────────────────────────────────────────────────────
  const { data: discountData, isLoading: isLoadingDiscounts } = useQuery({
    queryKey: ["dynamic-report-discounts", brandId, dateFrom, dateTo],
    queryFn: async () => {
      // All brands: comparison chart
      const { data: all } = await (supabase as any)
        .from("discounts")
        .select("brand_id, percentage, valid_from, valid_until, code, description, brands(name)")
        .gte("valid_from", dateFrom)
        .lte("valid_from", dateTo)
        .not("percentage", "is", null)

      const rows = (all || []) as any[]

      // Per-brand avg discount
      const byBrand: Record<string, { sum: number; count: number; name: string }> = {}
      rows.forEach((d: any) => {
        const name = d.brands?.name || "Unknown"
        if (!byBrand[name]) byBrand[name] = { sum: 0, count: 0, name }
        byBrand[name].sum   += d.percentage
        byBrand[name].count++
      })
      const comparison = Object.values(byBrand)
        .map(b => ({ brand: b.name, avgDiscount: parseFloat((b.sum / b.count).toFixed(1)) }))
        .sort((a, b) => b.avgDiscount - a.avgDiscount)

      // Brand-specific codes
      const brandCodes = brandId
        ? rows.filter((d: any) => d.brand_id === brandId)
        : rows.slice(0, 10)

      // Brand-specific stats
      const brandRows = brandId
        ? rows.filter((d: any) => d.brand_id === brandId)
        : rows
      const pcts = brandRows.map((d: any) => d.percentage).filter(Boolean) as number[]
      const stats = pcts.length
        ? { count: pcts.length, avg: parseFloat((pcts.reduce((a,b)=>a+b,0)/pcts.length).toFixed(1)), min: Math.min(...pcts), max: Math.max(...pcts) }
        : null

      return { comparison, brandCodes, stats }
    },
  })

  // ── Prices query ────────────────────────────────────────────────────────────
  const { data: priceData, isLoading: isLoadingPrices } = useQuery({
    queryKey: ["dynamic-report-prices", brandId, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("price_history")
        .select(`
          price,
          date_recorded,
          package_kcal_ranges!price_history_package_kcal_range_id_fkey(
            packages(
              name,
              brands(id, name)
            )
          )
        `)
        .lte("date_recorded", dateTo)
        .not("price", "is", null)
        .order("date_recorded", { ascending: false })
        .limit(5000)

      // Results are ordered by date_recorded DESC — keep only the most recent record per (brand, package)
      const rows = (data || []) as any[]
      const seen = new Set<string>()
      const latestRows = rows.filter((p: any) => {
        const brandName = p.package_kcal_ranges?.packages?.brands?.name || "Unknown"
        const pkgName   = p.package_kcal_ranges?.packages?.name || ""
        const key = `${brandName}||${pkgName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // Aggregate avg price per brand
      const byBrand: Record<string, { sum: number; count: number; min: number; max: number; name: string }> = {}
      latestRows.forEach((p: any) => {
        const name = p.package_kcal_ranges?.packages?.brands?.name || "Unknown"
        if (!byBrand[name]) byBrand[name] = { sum: 0, count: 0, min: Infinity, max: -Infinity, name }
        byBrand[name].sum   += p.price
        byBrand[name].count++
        byBrand[name].min    = Math.min(byBrand[name].min, p.price)
        byBrand[name].max    = Math.max(byBrand[name].max, p.price)
      })

      const catalog = Object.values(byBrand)
        .filter(b => b.count > 0)
        .map(b => ({ brand: b.name, avgPrice: parseFloat((b.sum / b.count).toFixed(2)) }))
        .sort((a, b) => b.avgPrice - a.avgPrice)
        .slice(0, 12)

      // Discount map for after-discount chart
      const discountMap: Record<string, number> = {}
      if (discountData?.comparison) {
        discountData.comparison.forEach((d: any) => { discountMap[d.brand] = d.avgDiscount })
      }
      const afterDiscount = catalog.map(p => ({
        brand:    p.brand,
        avgPrice: parseFloat((p.avgPrice * (1 - (discountMap[p.brand] || 0) / 100)).toFixed(2)),
      })).sort((a, b) => b.avgPrice - a.avgPrice)

      // Selected brand stats
      const selectedBrandName = brandName
      const brandEntry = byBrand[selectedBrandName]
      const brandStats = brandEntry ? {
        avgPrice: parseFloat((brandEntry.sum / brandEntry.count).toFixed(2)),
        minPrice: parseFloat(brandEntry.min.toFixed(2)),
        maxPrice: parseFloat(brandEntry.max.toFixed(2)),
      } : null

      return { catalog, afterDiscount, brandStats }
    },
    staleTime: 1000 * 60 * 30,
  })

  // ── Brand ranking query ─────────────────────────────────────────────────────
  const { data: brandRanking } = useQuery({
    queryKey: ["report-brand-ranking", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("reviews")
        .select("brand_id, rating, brands(name, logo_url)")
        .eq("is_approved", true)
        .gte("review_date", dateFrom)
        .lte("review_date", dateTo)
      const rows = (data || []) as any[]

      const byBrand: Record<string, { name: string; logoUrl: string | null; brandId: string; ratings: number[] }> = {}
      rows.forEach((r: any) => {
        const bid = r.brand_id
        if (!bid) return
        if (!byBrand[bid]) byBrand[bid] = { name: r.brands?.name || "Unknown", logoUrl: r.brands?.logo_url || null, brandId: bid, ratings: [] }
        if (r.rating != null) byBrand[bid].ratings.push(r.rating)
      })

      return Object.values(byBrand)
        .filter(b => b.ratings.length > 0)
        .map(b => {
          const count = b.ratings.length
          const avg = b.ratings.reduce((a, c) => a + c, 0) / count
          const positive = b.ratings.filter(r => r >= 4).length
          const negative = b.ratings.filter(r => r <= 2).length
          return {
            brandId: b.brandId,
            name: b.name,
            logoUrl: b.logoUrl,
            count,
            avgRating: parseFloat(avg.toFixed(2)),
            positivePercent: parseFloat(((positive / count) * 100).toFixed(1)),
            negativePercent: parseFloat(((negative / count) * 100).toFixed(1)),
          }
        })
        .sort((a, b) => b.avgRating - a.avgRating)
    },
  })

  // ── Brand aspects (all-time, reuses same query key as ReviewAspectsSection) ──
  const { data: brandAspects = [] } = useReviewAspects(brandId ?? undefined)

  // ── Market reviews for aspect comparison (all-time, all brands) ──────────────
  const { data: marketReviews = [] } = useQuery({
    queryKey: ["dynamic-report-market-reviews-alltime"],
    queryFn: async () => {
      const all: Array<{ content: string | null; rating: number | null }> = []
      let from = 0
      const size = 1000
      while (true) {
        const { data, error } = await (supabase as any)
          .from("reviews")
          .select("content, rating")
          .not("content", "is", null)
          .range(from, from + size - 1)
        if (error) throw error
        if (!data?.length) break
        all.push(...data)
        if (data.length < size || all.length >= 5000) break
        from += size
      }
      return all
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 60, // 1h — rarely changes
  })

  const marketAspects = useMemo(() => analyzeAspects(marketReviews), [marketReviews])

  // ── Users (for email modal) ─────────────────────────────────────────────────
  const { data: usersData } = useQuery({
    queryKey: ["admin-users-for-email"],
    enabled: showEmail,
    queryFn: async () => {
      const res = await fetch("/api/admin/users")
      const json = await res.json()
      return json.users || []
    },
  })

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDownloadPDF = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `raport-${brandName}-${dateFrom}-${dateTo}`,
    pageStyle: `
      @page { size: A4; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        button, nav, header, aside, .no-print { display: none !important; }
        * { box-sizing: border-box; }
      }
    `,
  })

  const handleSendEmail = async () => {
    setSending(true)
    setSendResult(null)
    const extraRecipients = extraEmails
      .split("\n")
      .map(e => e.trim())
      .filter(Boolean)
      .map(email => ({ email }))
    const recipients = [
      ...selectedUsers.map(u => ({ userId: u.id, email: u.email })),
      ...extraRecipients,
    ]
    const stats = allTimeStats
      ? { count: allTimeStats.count, avgRating: allTimeStats.avgRating, positivePercent: allTimeStats.positivePercent, negativePercent: allTimeStats.negativePercent }
      : { count: 0, avgRating: "0.00", positivePercent: "0", negativePercent: "0" }
    const reportSummary = {
      brandId,
      brandName,
      brandLogoUrl,
      dateFrom,
      dateTo,
      title: `${brandName} · ${dateFrom} – ${dateTo}`,
      stats,
      trend: trendInsight?.trend,
      bestMonth: trendInsight?.best ? `${trendInsight.best.month} (${trendInsight.best.avgRating?.toFixed(2)})` : undefined,
      ranking: brandRanking?.map(b => ({
        name: b.name,
        count: b.count,
        avgRating: b.avgRating,
        positivePercent: b.positivePercent,
        negativePercent: b.negativePercent,
        isSelected: brandId ? b.brandId === brandId : false,
      })) ?? [],
    }
    const res = await fetch("/api/admin/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients, reportSummary }),
    })
    setSendResult(await res.json())
    setSending(false)
  }

  // ── Shortcuts ───────────────────────────────────────────────────────────────
  const allTimeStats  = periodStats?.[0]
  const firstHalf     = periodStats?.[1]
  const secondHalf    = periodStats?.[2]
  const lastMonthStat = periodStats?.[3]

  const brandRankPosition = useMemo(() => {
    if (!brandId || !brandRanking) return null
    const idx = brandRanking.findIndex(b => b.brandId === brandId)
    if (idx === -1) return null
    return { position: idx + 1, total: brandRanking.length }
  }, [brandId, brandRanking])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Action buttons */}
      <div className="flex gap-3 mb-6 no-print">
        <Button onClick={() => handleDownloadPDF()} variant="outline">
          <><FileDown className="mr-2 h-4 w-4" />Pobierz PDF</>
        </Button>
        <Button variant="outline" onClick={() => setShowEmail(true)}>
          <Mail className="h-4 w-4 mr-2" />Wyślij email
        </Button>
      </div>

      {/* ── Report content ── */}
      <div id="report-print-root" ref={reportRef} className="report-content space-y-10">

        {/* HEADER */}
        <div className="flex items-start gap-6 pb-6 border-b">
          {brandLogoUrl ? (
            <div className="h-20 w-20 rounded-lg bg-white p-2 flex items-center justify-center shadow-sm flex-shrink-0">
              <img src={brandLogoUrl} alt={brandName} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold mb-1">{brandName}</h1>
            <p className="text-lg text-muted-foreground mb-2">Raport analizy opinii klientów</p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {allTimeStats?.count?.toLocaleString("pl-PL") ?? "…"} opinii
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {dateFrom} – {dateTo}
              </span>
            </div>
          </div>
        </div>

        {/* ── SEKCJA: Executive Summary ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Executive Summary
          </h2>

          {/* Insight card — generative */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              {isLoadingReviews ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <p className="text-lg leading-relaxed">
                  <strong>{brandName}</strong> zebrał{" "}
                  <strong>{allTimeStats?.count?.toLocaleString("pl-PL") ?? "…"}</strong> opinii
                  w okresie {dateFrom}–{dateTo} ze średnią{" "}
                  <strong>{allTimeStats?.avgRating ?? "…"}/5</strong>.{" "}
                  {trendInsight && (
                    <>
                      Trend w analizowanym okresie jest <strong>{trendInsight.trend}</strong>.{" "}
                      Najlepszy miesiąc: <strong>{fmtMonth(trendInsight.best.month)}</strong> ({trendInsight.best.avgRating?.toFixed(2)}★).{" "}
                      {troubledMonths.length > 0 && (
                        <>Miesiące wymagające uwagi (poniżej 3.5★): <strong>{troubledMonths.map(m => fmtMonth(m.month)).join(", ")}</strong>.</>
                      )}
                    </>
                  )}
                  {allTimeStats && (
                    <span className="text-primary font-semibold">
                      {" "}Kluczowe: {parseFloat(allTimeStats.positivePercent) >= 70
                        ? "wysoki odsetek pozytywnych opinii."
                        : parseFloat(allTimeStats.negativePercent) >= 20
                          ? "wysoki odsetek negatywnych opinii wymaga działań."
                          : "wyniki na stabilnym poziomie."}
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Rank badge */}
          {brandRankPosition && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary text-primary font-semibold px-3 py-1 text-sm">
                <Target className="h-4 w-4 mr-1" />
                Pozycja #{brandRankPosition.position} z {brandRankPosition.total} marek w rankingu opinii
              </Badge>
            </div>
          )}

          {/* 4 period KPI cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoadingReviews ? (
              [1,2,3,4].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>)
            ) : (
              [
                { stats: allTimeStats,  prev: prevPeriodStats?.[0], label: "Wybrany okres",   icon: Clock,      color: "" },
                { stats: firstHalf,     prev: prevPeriodStats?.[1], label: "Pierwsza połowa", icon: TrendingUp, color: "" },
                { stats: secondHalf,    prev: prevPeriodStats?.[2], label: "Druga połowa",    icon: TrendingUp, color: "border-green-200 dark:border-green-800" },
                { stats: lastMonthStat, prev: prevPeriodStats?.[3], label: lastMonthLabel,    icon: Star,       color: "border-primary/30 bg-primary/5" },
              ].map(({ stats: s, prev: p, label, icon: Icon, color }, idx) => {
                const diff = s?.count && p?.count
                  ? parseFloat(s.avgRating) - parseFloat(p.avgRating)
                  : null
                const diffLabel = diff === null
                  ? "N/A"
                  : Math.abs(diff) < 0.005
                    ? "bez zmian"
                    : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`
                const diffColor = diff === null
                  ? "text-muted-foreground"
                  : diff > 0.005 ? "text-green-600" : diff < -0.005 ? "text-red-500" : "text-muted-foreground"
                return (
                  <Card key={idx} className={color}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium capitalize">{s?.label ?? label}</CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold ${idx === 3 ? "text-primary" : idx === 2 ? "text-green-600" : ""}`}>
                          {s?.avgRating ?? "—"}
                        </span>
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s?.count?.toLocaleString("pl-PL") ?? "0"} opinii
                      </p>
                      <p className={`text-xs font-medium mt-1 ${diffColor}`}>
                        {diffLabel} vs. poprzedni okres
                        {p?.count ? ` (${p.avgRating}★, ${p.count.toLocaleString("pl-PL")} op.)` : ""}
                      </p>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </section>

        <Separator />

        {/* ── SEKCJA: Podsumowanie ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Podsumowanie
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Sentiment pie */}
            <Card>
              <CardHeader>
                <CardTitle>Rozkład sentymentu</CardTitle>
                <CardDescription>Na podstawie {allTimeStats?.count?.toLocaleString("pl-PL") ?? "…"} opinii</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                           paddingAngle={2} dataKey="value" label={({ value }) => `${value}%`}>
                        {sentimentData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Generative insights */}
            <Card>
              <CardHeader>
                <CardTitle>Kluczowe wnioski</CardTitle>
                <CardDescription>Na podstawie danych z zakresu {dateFrom} – {dateTo}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trendInsight ? (
                  <>
                    {[
                      { num: 1, color: "primary", text: <>Łączna liczba opinii: <strong>{allTimeStats?.count?.toLocaleString("pl-PL")}</strong> ze średnią <strong>{allTimeStats?.avgRating}★</strong></> },
                      { num: 2, color: "primary", text: <>Trend: <strong>{trendInsight.trend}</strong> (zmiana {Number(trendInsight.diff) > 0 ? "+" : ""}{trendInsight.diff} ★ od pierwszego do ostatniego miesiąca)</> },
                      { num: 3, color: "primary", text: <>Najlepszy miesiąc: <strong>{fmtMonth(trendInsight.best.month)}</strong> ({trendInsight.best.avgRating?.toFixed(2)}★, {trendInsight.best.count} opinii)</> },
                      { num: 4, color: troubledMonths.length > 0 ? "orange" : "primary", text: troubledMonths.length > 0
                        ? <>Miesiące poniżej 3.5★: <strong>{troubledMonths.map(m => fmtMonth(m.month)).join(", ")}</strong></>
                        : <>Brak miesięcy poniżej 3.5★ — wyniki stabilne przez cały okres</> },
                      { num: 5, color: "green", text: <>{parseFloat(allTimeStats?.positivePercent ?? "0") >= 70
                        ? <><strong>{allTimeStats?.positivePercent}%</strong> opinii pozytywnych (≥4★) — wysoki poziom zadowolenia</>
                        : <><strong>{allTimeStats?.negativePercent}%</strong> opinii negatywnych (≤2★) — wymaga uwagi</> }</> },
                    ].map(({ num, color, text }) => (
                      <div key={num} className="flex gap-3">
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-${color}-500/10 flex items-center justify-center text-xs font-bold text-${color === "orange" ? "orange-600" : color === "green" ? "green-600" : "primary"}`}>{num}</div>
                        <p className="text-sm">{text}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Brak danych do analizy w wybranym zakresie.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rozkład ocen */}
          <Card>
            <CardHeader>
              <CardTitle>Rozkład ocen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ratingDist.map(({ star, count, percent }) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm w-8 text-right font-medium">{star}★</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${percent}%`,
                        backgroundColor: star >= 4 ? "hsl(142,76%,36%)" : star === 3 ? "hsl(43,96%,53%)" : "hsl(0,84%,60%)",
                      }} />
                    </div>
                    <span className="text-sm text-muted-foreground w-28 text-right">{count.toLocaleString()} ({percent}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* ── SEKCJA: Sentyment i emocje ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Sentyment i emocje klientów
          </h2>

          {/* Emotion timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Dynamika emocji w czasie</CardTitle>
              <CardDescription>Jak zmieniały się emocje klientów w podokresach</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingReviews ? (
                  [1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)
                ) : (
                  periodStats?.map((s, idx) => {
                    if (!s.count) return null
                    const emotion = getEmotion(parseFloat(s.avgRating), parseFloat(s.positivePercent), parseFloat(s.negativePercent))
                    return (
                      <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex-shrink-0 w-40">
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.count.toLocaleString("pl-PL")} opinii</p>
                        </div>
                        <div className="flex-1 flex gap-3">
                          <Badge variant="outline" className={
                            emotion.type === "positive" ? "border-green-500 text-green-600" :
                            emotion.type === "negative" ? "border-red-500   text-red-600"   :
                                                          "border-blue-500  text-blue-600"
                          }>{emotion.dominant}</Badge>
                          <Badge variant="secondary">{emotion.secondary}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-lg font-bold ${parseFloat(s.avgRating) < 4.0 ? "text-orange-600" : "text-green-600"}`}>
                            {s.avgRating}
                          </span>
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* ── SEKCJA: Aspekty (tylko jeśli brandId) ── */}
        {brandId && (
          <>
            <ReviewAspectsSection brandId={brandId} />
            <Separator />
          </>
        )}

        {/* ── SEKCJA: Co klienci chwalą, a co krytykują? ── */}
        {brandId && brandAspects.length > 0 && (
          <>
            <section className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ThumbsUp className="h-6 w-6 text-primary" />
                Co klienci chwalą, a co krytykują?
              </h2>
              <p className="text-sm text-muted-foreground">
                Analiza 6 kluczowych aspektów — porównanie Twojej marki z rynkiem ({marketReviews.length.toLocaleString("pl-PL")} opinii).
              </p>

              {/* Aspect cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(["smak", "dostawa", "cena", "jakość", "obsługa", "porcje"] as const).map(aspectKey => {
                  const ASPECT_ICONS: Record<string, string> = {
                    smak: "🍽️", dostawa: "🚚", cena: "💰", jakość: "⭐", obsługa: "🤝", porcje: "🍱",
                  }
                  const brand = brandAspects.find(a => a.aspect === aspectKey)
                  const market = marketAspects.find(a => a.aspect === aspectKey)
                  if (!brand || brand.mentions === 0) return null
                  const delta = market && market.positive > 0 ? brand.positive - market.positive : null
                  const quote = allReviews.find(r =>
                    (r.rating ?? 0) >= 4 &&
                    (r.content?.length ?? 0) > 20 &&
                    ASPECT_KEYWORDS[aspectKey]?.some(kw => r.content?.toLowerCase().includes(kw))
                  )?.content
                  const badQuote = allReviews.find(r =>
                    (r.rating ?? 0) <= 2 &&
                    (r.content?.length ?? 0) > 20 &&
                    ASPECT_KEYWORDS[aspectKey]?.some(kw => r.content?.toLowerCase().includes(kw))
                  )?.content
                  const displayQuote = brand.negative > brand.positive ? (badQuote || quote) : (quote || badQuote)
                  const isBetter = delta !== null && delta > 5
                  const isWorse  = delta !== null && delta < -5

                  return (
                    <Card key={aspectKey} className={isBetter ? "border-green-200 dark:border-green-800" : isWorse ? "border-red-200 dark:border-red-800" : ""}>
                      <CardContent className="pt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{ASPECT_ICONS[aspectKey]}</span>
                            <div>
                              <p className="font-semibold capitalize">{aspectKey}</p>
                              <p className="text-xs text-muted-foreground">{brand.mentions} wzmianek</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-green-600">{brand.positive}%</p>
                            <p className="text-xs text-muted-foreground">pozytywnych</p>
                          </div>
                        </div>

                        {/* sentiment bar */}
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="bg-green-500 transition-all" style={{ width: `${brand.positive}%` }} />
                          <div className="bg-red-500 transition-all"   style={{ width: `${brand.negative}%` }} />
                        </div>

                        {/* market comparison */}
                        {delta !== null && (
                          <p className={`text-xs font-medium ${isBetter ? "text-green-600" : isWorse ? "text-red-500" : "text-muted-foreground"}`}>
                            {isBetter
                              ? `+${delta}pp lepiej niż rynek (${market!.positive}%)`
                              : isWorse
                                ? `${delta}pp gorzej niż rynek (${market!.positive}%)`
                                : `Podobnie do rynku (${market!.positive}%)`
                            }
                          </p>
                        )}

                        {/* quote */}
                        {displayQuote && (
                          <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 line-clamp-2">
                            „{displayQuote}"
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Radar chart */}
              {marketAspects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Twoja marka vs Rynek — porównanie aspektów
                    </CardTitle>
                    <CardDescription>% pozytywnych wzmianek w każdym aspekcie</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={
                          (["smak", "dostawa", "cena", "jakość", "obsługa", "porcje"] as const)
                            .map(key => ({
                              subject: key,
                              brand: brandAspects.find(a => a.aspect === key)?.positive ?? 0,
                              rynek: marketAspects.find(a => a.aspect === key)?.positive ?? 0,
                            }))
                        }>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Radar name={brandName} dataKey="brand" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                          <Radar name="Rynek" dataKey="rynek" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comparison table */}
              <Card>
                <CardHeader>
                  <CardTitle>Tabela porównawcza aspektów</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-2 font-medium text-muted-foreground">Parametr</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground">Twoja marka</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground">Rynek</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground">Różnica</th>
                        <th className="text-right pb-2 font-medium text-muted-foreground">Ocena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["smak", "dostawa", "cena", "jakość", "obsługa", "porcje"] as const).map(key => {
                        const brand = brandAspects.find(a => a.aspect === key)
                        const market = marketAspects.find(a => a.aspect === key)
                        if (!brand || brand.mentions === 0) return null
                        const delta = market && market.positive > 0 ? brand.positive - market.positive : null
                        const ASPECT_ICONS: Record<string, string> = {
                          smak: "🍽️", dostawa: "🚚", cena: "💰", jakość: "⭐", obsługa: "🤝", porcje: "🍱",
                        }
                        return (
                          <tr key={key} className="border-b last:border-0">
                            <td className="py-2.5">{ASPECT_ICONS[key]} {key}</td>
                            <td className="text-right py-2.5 font-medium text-green-600">{brand.positive}%</td>
                            <td className="text-right py-2.5 text-muted-foreground">{market?.positive ?? "—"}%</td>
                            <td className={`text-right py-2.5 font-medium ${delta === null ? "text-muted-foreground" : delta > 5 ? "text-green-600" : delta < -5 ? "text-red-500" : "text-muted-foreground"}`}>
                              {delta === null ? "—" : delta > 0 ? `+${delta}pp` : `${delta}pp`}
                            </td>
                            <td className="text-right py-2.5">
                              {delta === null ? "—" : delta > 10 ? "✅ Mocna strona" : delta > 0 ? "👍 Powyżej" : delta > -10 ? "➡️ Podobnie" : "⚠️ Do poprawy"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </section>
            <Separator />
          </>
        )}

        {/* ── SEKCJA: Timeline ocen ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Timeline ocen
          </h2>

          {/* Line chart — avg rating */}
          <Card>
            <CardHeader>
              <CardTitle>Średnia ocena w czasie</CardTitle>
              <CardDescription>Trend miesięczny {dateFrom} – {dateTo}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingReviews ? <Skeleton className="h-[300px] w-full" /> : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={fmtMonth} interval="preserveStartEnd" />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as MonthlyPoint
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
                            <p className="font-medium">{label}</p>
                            {d.avgRating == null ? <p className="text-muted-foreground">Brak danych</p> : (
                              <>
                                <p>Średnia: {d.avgRating?.toFixed(2)} ★</p>
                                <p className="text-muted-foreground">{d.count} opinii</p>
                                <p className="text-green-600">Pozytywne: {d.positive}</p>
                                <p className="text-red-600">Negatywne: {d.negative}</p>
                              </>
                            )}
                          </div>
                        )
                      }} />
                      <Line type="monotone" dataKey="avgRating" connectNulls={false}
                            stroke="hsl(var(--primary))" strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar chart — volume */}
          <Card>
            <CardHeader>
              <CardTitle>Liczba opinii miesięcznie</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingReviews ? <Skeleton className="h-[250px] w-full" /> : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="positive" stackId="a" fill="hsl(142,76%,36%)" name="Pozytywne" />
                      <Bar dataKey="negative" stackId="a" fill="hsl(0,84%,60%)"   name="Negatywne" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Miesiące wymagające uwagi */}
          {troubledMonths.length > 0 && (
            <Card className="border-2 border-orange-500/30">
              <CardHeader className="bg-orange-500/5">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Miesiące wymagające uwagi (poniżej 3.5★)
                </CardTitle>
                <CardDescription>Okresy z obniżoną oceną w analizowanym zakresie</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {troubledMonths.map((m, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${m.avgRating! < 3.0 ? "bg-red-500/10 border-red-500/30" : "bg-orange-500/10 border-orange-500/30"}`}>
                      <div className="text-sm text-muted-foreground">{fmtMonth(m.month)}</div>
                      <div className={`text-2xl font-bold mt-1 ${m.avgRating! < 3.0 ? "text-red-600" : "text-orange-600"}`}>
                        {m.avgRating?.toFixed(2)} ★
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{m.count} opinii</div>
                    </div>
                  ))}
                </div>
                <Card className="mt-4 border-l-4 border-l-orange-500 bg-orange-500/5">
                  <CardContent className="pt-4">
                    <p className="text-sm">
                      <strong>Wniosek:</strong> W wybranym zakresie zaobserwowano {troubledMonths.length}{" "}
                      {troubledMonths.length === 1 ? "miesiąc" : troubledMonths.length < 5 ? "miesiące" : "miesięcy"} z ocenami
                      poniżej 3.5★. Analiza treści opinii z tych okresów może pomóc w identyfikacji problemów operacyjnych.
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {/* Best / worst month summary */}
          {trendInsight && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Podsumowanie okresu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                    <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Najlepszy miesiąc
                    </h4>
                    <p className="text-sm"><strong>{fmtMonth(trendInsight.best.month)}</strong></p>
                    <p className="text-2xl font-bold text-green-600">{trendInsight.best.avgRating?.toFixed(2)} ★</p>
                    <p className="text-xs text-muted-foreground">{trendInsight.best.count} opinii</p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                    <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" /> Najgorszy miesiąc
                    </h4>
                    <p className="text-sm"><strong>{fmtMonth(trendInsight.worst.month)}</strong></p>
                    <p className="text-2xl font-bold text-red-600">{trendInsight.worst.avgRating?.toFixed(2)} ★</p>
                    <p className="text-xs text-muted-foreground">{trendInsight.worst.count} opinii</p>
                  </div>
                </div>
                <Card className="mt-4 border-l-4 border-l-primary bg-primary/5">
                  <CardContent className="pt-4">
                    <p className="text-sm">
                      <strong>Insight strategiczny:</strong> Trend w analizowanym okresie jest <strong>{trendInsight.trend}</strong>{" "}
                      (zmiana {Number(trendInsight.diff) > 0 ? "+" : ""}{trendInsight.diff}★). Różnica między najlepszym
                      a najgorszym miesiącem wynosi{" "}
                      {(trendInsight.best.avgRating! - trendInsight.worst.avgRating!).toFixed(2)}★.
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* ── SEKCJA: Cytaty ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Quote className="h-6 w-6 text-primary" />
            Cytaty klientów
          </h2>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Quote className="h-5 w-5 text-green-500" />
                Cytaty pozytywne
              </CardTitle>
              <CardDescription>Najnowsze opinie zadowolonych klientów (4–5★)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingQuotes ? (
                [1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)
              ) : realQuotes?.positive?.length ? (
                realQuotes.positive.slice(0, 6).map((q, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="italic text-sm mb-1">„{q.content}"</p>
                    <p className="text-xs text-muted-foreground">{q.author_name && `${q.author_name} · `}{fmtDate(q.review_date)}</p>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground">Brak pozytywnych cytatów w wybranym zakresie.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Quote className="h-5 w-5 text-red-500" />
                Cytaty krytyczne
              </CardTitle>
              <CardDescription>Najnowsze opinie niezadowolonych klientów (1–2★)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingQuotes ? (
                [1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)
              ) : realQuotes?.negative?.length ? (
                realQuotes.negative.slice(0, 4).map((q, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-red-500/5 border-l-4 border-l-red-500">
                    <p className="italic text-sm mb-1">„{q.content}"</p>
                    <p className="text-xs text-muted-foreground">{q.author_name && `${q.author_name} · `}{fmtDate(q.review_date)}</p>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground">Brak negatywnych cytatów w wybranym zakresie.</p>}
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* ── SEKCJA: Ranking marek ── */}
        {brandRanking && brandRanking.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Ranking marek wg opinii w tym okresie
            </h2>
            {brandRankPosition && (
              <Badge variant="outline" className="border-primary text-primary font-semibold px-3 py-1 text-sm">
                Pozycja #{brandRankPosition.position} z {brandRankPosition.total} marek
              </Badge>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="py-2 pr-3 w-8">#</th>
                    <th className="py-2 pr-3 w-10"></th>
                    <th className="py-2 pr-4">Marka</th>
                    <th className="py-2 pr-4 text-right">Liczba opinii</th>
                    <th className="py-2 pr-4 text-right">Średnia ocena</th>
                    <th className="py-2 pr-4 text-right">% pozytywnych</th>
                    <th className="py-2 text-right">% negatywnych</th>
                  </tr>
                </thead>
                <tbody>
                  {brandRanking.map((b, idx) => {
                    const isSelected = brandId && b.brandId === brandId
                    return (
                      <tr
                        key={b.brandId}
                        className={isSelected ? "bg-primary/10 font-semibold border-l-4 border-l-primary" : "border-b border-border/40"}
                      >
                        <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 pr-3">
                          {b.logoUrl ? (
                            <img src={b.logoUrl} alt={b.name} className="h-6 w-6 object-contain rounded" />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                              <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <span>{b.name}</span>
                          {isSelected && (
                            <Badge className="ml-2 text-xs py-0" variant="default">Twoja marka</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">{b.count.toLocaleString("pl-PL")}</td>
                        <td className="py-2 pr-4 text-right">
                          <span className="flex items-center justify-end gap-1">
                            {b.avgRating.toFixed(2)}
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right text-green-600">{b.positivePercent}%</td>
                        <td className="py-2 text-right text-red-600">{b.negativePercent}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <Separator />

        {/* ── SEKCJA: Rabaty ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            Analiza rabatów
          </h2>

          {discountData?.stats && (
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { val: discountData.stats.count,                 label: "Aktywnych promocji",  color: "primary"  },
                { val: `${discountData.stats.avg}%`,             label: "Średni rabat",         color: "green"    },
                { val: `${discountData.stats.max}%`,             label: "Maksymalny rabat",     color: "orange"   },
                { val: `${discountData.stats.min}%`,             label: "Minimalny rabat",      color: "blue"     },
              ].map(({ val, label, color }, i) => (
                <Card key={i} className={`bg-gradient-to-br from-${color}-500/10 to-${color}-500/5 border-${color}-500/20`}>
                  <CardContent className="pt-6 text-center">
                    <div className={`text-3xl font-bold text-${color === "primary" ? "primary" : `${color}-600`} mb-1`}>{val}</div>
                    <div className="text-sm text-muted-foreground">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {discountData?.comparison && discountData.comparison.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Porównanie rabatów z konkurencją</CardTitle>
                <CardDescription>Średni rabat oferowany przez marki w okresie {dateFrom} – {dateTo}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDiscounts ? <Skeleton className="h-[300px] w-full" /> : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={discountData.comparison.slice(0, 10)} layout="vertical"
                                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={v => `${v}%`} />
                        <YAxis dataKey="brand" type="category" width={95} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => [`${v}%`, "Śr. rabat"]} />
                        <Bar dataKey="avgDiscount" radius={[0, 4, 4, 0]}>
                          {discountData.comparison.slice(0, 10).map((e: any, i: number) => (
                            <Cell key={i} fill={e.brand === brandName ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {discountData?.brandCodes && discountData.brandCodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Kody rabatowe w okresie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {discountData.brandCodes.slice(0, 6).map((code: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between items-start mb-2">
                        <code className="font-mono font-bold text-sm">{code.code || "Brak kodu"}</code>
                        <Badge variant="secondary">{code.percentage}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {code.description || "Brak opisu"}{" "}
                        | {code.valid_from ? format(new Date(code.valid_from), "d MMM", { locale: pl }) : "?"} –{" "}
                        {code.valid_until ? format(new Date(code.valid_until), "d MMM", { locale: pl }) : "?"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!discountData?.comparison?.length && !isLoadingDiscounts && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Brak danych o rabatach w wybranym zakresie dat
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* ── SEKCJA: Ceny ── */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Analiza cen
          </h2>

          {priceData?.brandStats && (
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { val: `${priceData.brandStats.avgPrice.toFixed(2)} zł`, label: "Śr. cena katalogowa", color: "primary" },
                { val: `${priceData.brandStats.minPrice.toFixed(2)} zł`, label: "Cena minimalna",      color: "blue"    },
                { val: `${priceData.brandStats.maxPrice.toFixed(2)} zł`, label: "Cena maksymalna",     color: "orange"  },
                { val: discountData?.stats
                    ? `~${(priceData.brandStats.avgPrice * (1 - discountData.stats.avg / 100)).toFixed(2)} zł`
                    : "—",
                  label: `Śr. cena po rabacie${discountData?.stats ? ` (${discountData.stats.avg}%)` : ""}`,
                  color: "green" },
              ].map(({ val, label, color }, i) => (
                <Card key={i} className={`bg-gradient-to-br from-${color}-500/10 to-${color}-500/5 border-${color}-500/20`}>
                  <CardContent className="pt-6 text-center">
                    <div className={`text-2xl font-bold text-${color === "primary" ? "primary" : `${color}-600`} mb-1`}>{val}</div>
                    <div className="text-sm text-muted-foreground">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {priceData?.catalog && priceData.catalog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Porównanie cen katalogowych</CardTitle>
                <CardDescription>Średnia cena za dzień diety w okresie {dateFrom} – {dateTo}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPrices ? <Skeleton className="h-[300px] w-full" /> : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priceData.catalog} layout="vertical"
                                margin={{ top: 5, right: 30, left: 110, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={v => `${v} zł`} />
                        <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => [`${(+v).toFixed(2)} zł`, "Śr. cena"]} />
                        <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                          {priceData.catalog.map((e: any, i: number) => (
                            <Cell key={i} fill={e.brand === brandName ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {priceData?.afterDiscount && priceData.afterDiscount.length > 0 && discountData?.stats && (
            <Card>
              <CardHeader>
                <CardTitle>Porównanie cen po rabacie</CardTitle>
                <CardDescription>Cena efektywna uwzględniając średnie rabaty</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceData.afterDiscount} layout="vertical"
                              margin={{ top: 5, right: 30, left: 110, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={v => `${v} zł`} />
                      <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [`${(+v).toFixed(2)} zł`, "Cena po rabacie"]} />
                      <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                        {priceData.afterDiscount.map((e: any, i: number) => (
                          <Cell key={i} fill={e.brand === brandName ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {!priceData?.catalog?.length && !isLoadingPrices && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Brak danych cenowych w wybranym zakresie dat
              </CardContent>
            </Card>
          )}
        </section>

      </div>

      {/* ── Email Modal ── */}
      <Dialog open={showEmail} onOpenChange={open => { setShowEmail(open); if (!open) { setSendResult(null); setSelectedUsers([]); setExtraEmails("") } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wyślij raport emailem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Użytkownicy systemu</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-3">
                {!usersData ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie…
                  </div>
                ) : usersData.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2.5 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50">
                    <Checkbox
                      checked={selectedUsers.some(s => s.id === u.id)}
                      onCheckedChange={checked => setSelectedUsers(prev =>
                        checked ? [...prev, { id: u.id, email: u.email }] : prev.filter(s => s.id !== u.id)
                      )}
                    />
                    <span className="text-sm flex-1 truncate">{u.full_name || u.email}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="extra-emails" className="text-sm font-medium mb-2 block">Dodatkowe adresy email</Label>
              <Textarea id="extra-emails" placeholder={"email@example.com\nkolejny@email.pl"}
                        value={extraEmails} onChange={e => setExtraEmails(e.target.value)} rows={3} />
            </div>
            {sendResult && (
              <div className={`text-sm p-3 rounded-lg ${sendResult.errors.length === 0
                ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"}`}>
                Wysłano: {sendResult.sent}.{sendResult.errors.length > 0 && ` Błędy: ${sendResult.errors.join("; ")}`}
              </div>
            )}
            <Button className="w-full" onClick={handleSendEmail}
              disabled={sending || (selectedUsers.length === 0 && !extraEmails.trim())}>
              {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wysyłanie…</> : "Wyślij"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
