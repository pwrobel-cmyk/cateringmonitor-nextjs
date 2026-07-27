'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  AlertTriangle, ChevronLeft, ChevronRight, Maximize,
  FileDown, Mail, Loader2, Send, CheckCircle, ShieldAlert,
} from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import {
  BarChart, Bar, XAxis, YAxis,
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
const SLIDE_NAMES = ['PODSUMOWANIE', 'MAPA POZYCJI', 'CENY', 'RABATY', 'CENA EFEKTYWNA', 'OPINIE', 'KONKURENCJA', 'REKOMENDACJE']

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExecutiveReportProps { myBrandId: string; competitorBrandIds: string[]; weekStart: string; weekEnd: string }

interface PriceRow { price: number; promotional_price: number | null; discount_percentage: number | null; date_recorded: string; package_kcal_range_id: string; package_kcal_ranges: { id: string; package_id: string; packages: { id: string; name: string; brand_id: string; brands: { id: string; name: string; logo_url: string | null } }; kcal_ranges: { kcal_from: number; kcal_to: number; kcal_label: string } } }
interface DiscountRow { id: string; brand_id: string; percentage: number; valid_from: string; valid_until: string | null; code: string | null; description: string | null; brands: { name: string; logo_url: string | null } }
interface ReviewRow { brand_id: string; rating: number; content: string | null; review_date: string }
interface BrandKcalPrice { brandId: string; brandName: string; brandLogo: string | null; kcal: number; avgPrice: number; packageIds: Set<string> }
interface MatchedPairChange { brandId: string; brandName: string; kcal: number; currentAvg: number; prevAvg: number; changePercent: number; matchedCount: number }
interface StructuralChange { brandId: string; brandName: string; type: 'new' | 'removed'; packageName: string; kcalLabel: string; date: string }
interface BrandWeekReview { brandId: string; brandName: string; brandLogo: string | null; avgRating: number; count: number; negativePercent: number; reviews: ReviewRow[] }
interface CompetitorEvent { date: string; brandName: string; type: 'price_change' | 'promo_start' | 'promo_end' | 'review_spike' | 'structural'; description: string }
interface WeekTrendPoint { weekLabel: string; weekStart: string; [brandName: string]: string | number | null }

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyKcal(kcalFrom: number, kcalTo: number): number | null {
  const mid = (kcalFrom + kcalTo) / 2
  if (mid < 1750) return 1500; if (mid <= 2250) return 2000; if (mid <= 3000) return 2500; return null
}
function pctChange(current: number, previous: number): number { if (previous === 0) return 0; return ((current - previous) / previous) * 100 }
function fmtPct(v: number, withSign = true): string { const s = v.toFixed(1); return withSign && v > 0 ? `+${s}%` : `${s}%` }
function fmtPrice(v: number): string { return v.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł' }
function detectTopic(content: string): string | null { const lower = content.toLowerCase(); for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) { if (keywords.some(kw => lower.includes(kw))) return topic } return null }

function getWeekBounds(weekStart: string) {
  const ws = parseISO(weekStart); const prevEnd = new Date(ws); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - 6)
  return { prevStart: format(prevStart, 'yyyy-MM-dd'), prevEnd: format(prevEnd, 'yyyy-MM-dd') }
}
function get8WeekBounds(weekEnd: string) {
  const we = parseISO(weekEnd); const weeks: { start: string; end: string; label: string }[] = []
  for (let i = 7; i >= 0; i--) { const ws = startOfWeek(subWeeks(we, i), { weekStartsOn: 1 }); const wEnd = endOfWeek(subWeeks(we, i), { weekStartsOn: 1 }); weeks.push({ start: format(ws, 'yyyy-MM-dd'), end: format(wEnd, 'yyyy-MM-dd'), label: format(ws, 'd MMM', { locale: pl }) }) }
  return { start: weeks[0].start, weeks }
}

// ── Slide Frame ─────────────────────────────────────────────────────────────

function SlideFrame({ index, methodology, children }: { index: number; methodology: string; children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex flex-col p-8 lg:p-10">
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <div className="flex justify-between items-end pt-2 border-t border-border mt-2 flex-shrink-0">
        <span className="text-[10px] text-muted-foreground leading-tight max-w-[85%]">{methodology}</span>
        <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{index + 1}/{TOTAL_SLIDES}</span>
      </div>
    </div>
  )
}

// ── Brand Logo ──────────────────────────────────────────────────────────────

function BrandLogo({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'w-7 h-7' : 'w-5 h-5'
  const text = size === 'md' ? 'text-[10px]' : 'text-[9px]'
  if (url) return <img src={url} alt={name} className={`${s} rounded-full object-cover flex-shrink-0`} />
  return <div className={`${s} rounded-full bg-primary/10 flex items-center justify-center ${text} font-semibold text-primary flex-shrink-0`}>{name.slice(0, 2).toUpperCase()}</div>
}

// ── Scatter Bubble ──────────────────────────────────────────────────────────

function ScatterBubble(props: any) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  const r = payload.isMy ? 26 : 20
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={payload.isMy ? MY_BRAND_COLOR : COMPETITOR_COLOR} opacity={0.9} stroke={payload.isMy ? '#0e4a86' : '#94a3b8'} strokeWidth={1.5} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fill={payload.isMy ? 'white' : '#334155'} fontSize={payload.isMy ? 11 : 9} fontWeight={700}>{(payload.brandName || '').slice(0, 3).toUpperCase()}</text>
      <text x={cx + r + 4} y={cy} textAnchor="start" dominantBaseline="central" fill="#374151" fontSize={11} fontWeight={500}>{payload.brandName}</text>
    </g>
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

  const goPrev = useCallback(() => setCurrentSlide(s => Math.max(0, s - 1)), [])
  const goNext = useCallback(() => setCurrentSlide(s => Math.min(TOTAL_SLIDES - 1, s + 1)), [])
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') goPrev(); if (e.key === 'ArrowRight') goNext() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [goPrev, goNext])

  const toggleFullscreen = useCallback(() => { if (document.fullscreenElement) { document.exitFullscreen() } else { containerRef.current?.requestFullscreen() } }, [])
  useEffect(() => { const h = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])

  const { data: emailUsers = [] } = useQuery({ queryKey: ['exec-email-users'], enabled: showEmailModal, queryFn: async () => { const res = await fetch('/api/admin/users'); const json = await res.json(); return (json.users || []) as { id: string; email: string; full_name?: string; status?: string }[] } })

  // ══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING — unchanged
  // ══════════════════════════════════════════════════════════════════════════

  const { data, isLoading, error } = useQuery({
    queryKey: ['executive-report', myBrandId, competitorBrandIds, weekStart, weekEnd],
    queryFn: async () => {
      const [pricesRes, discountsRes, reviewsRes, trendPricesRes, trendReviewsRes] = await Promise.all([
        (supabase as any).from('price_history').select(`price, promotional_price, discount_percentage, date_recorded, package_kcal_range_id, package_kcal_ranges!price_history_package_kcal_range_id_fkey(id, package_id, packages(id, name, brand_id, brands(id, name, logo_url)), kcal_ranges(kcal_from, kcal_to, kcal_label))`).gte('date_recorded', prevStart).lte('date_recorded', weekEnd).order('date_recorded', { ascending: false }).limit(10000),
        (supabase as any).from('discounts').select('id, brand_id, percentage, valid_from, valid_until, code, description, brands(name, logo_url)').lte('valid_from', weekEnd).or(`valid_until.gte.${weekStart},valid_until.is.null`).not('percentage', 'is', null),
        (supabase as any).from('reviews').select('brand_id, rating, content, review_date').eq('is_approved', true).gte('review_date', prevStart).lte('review_date', weekEnd).limit(5000),
        (supabase as any).from('price_history').select(`price, date_recorded, package_kcal_ranges!price_history_package_kcal_range_id_fkey(packages(brand_id, brands(name)), kcal_ranges(kcal_from, kcal_to))`).gte('date_recorded', trend8Start).lte('date_recorded', weekEnd).order('date_recorded', { ascending: false }).limit(20000),
        (supabase as any).from('reviews').select('brand_id, rating, review_date, brands(name)').eq('is_approved', true).gte('review_date', trend8Start).lte('review_date', weekEnd).limit(10000),
      ])

      const brandInfo = new Map<string, { name: string; logo: string | null }>()
      const priceRows = (pricesRes.data || []) as any[]
      for (const row of priceRows) { const brand = row.package_kcal_ranges?.packages?.brands; if (brand && !brandInfo.has(brand.id)) brandInfo.set(brand.id, { name: brand.name, logo: brand.logo_url }) }
      for (const d of (discountsRes.data || []) as any[]) { if (d.brands && !brandInfo.has(d.brand_id)) brandInfo.set(d.brand_id, { name: d.brands.name, logo: d.brands.logo_url }) }
      for (const r of (trendReviewsRes.data || []) as any[]) { if (r.brands && !brandInfo.has(r.brand_id)) brandInfo.set(r.brand_id, { name: r.brands.name, logo: null }) }

      type PriceEntry = { price: number; pkrId: string; packageName: string; kcalLabel: string }
      const currentWeekPrices = new Map<string, Map<number, Map<string, PriceEntry[]>>>()
      const prevWeekPrices = new Map<string, Map<number, Map<string, PriceEntry[]>>>()

      for (const row of priceRows) {
        const pkr = row.package_kcal_ranges; if (!pkr?.packages?.brands?.id || !pkr?.kcal_ranges) continue
        const brandId = pkr.packages.brands.id; if (!allBrandIds.includes(brandId)) continue
        const kcalBucket = classifyKcal(pkr.kcal_ranges.kcal_from, pkr.kcal_ranges.kcal_to); if (!kcalBucket) continue
        const isCurrentWeek = row.date_recorded >= weekStart && row.date_recorded <= weekEnd
        const isPrevWeek = row.date_recorded >= prevStart && row.date_recorded <= prevEnd
        if (!isCurrentWeek && !isPrevWeek) continue
        const target = isCurrentWeek ? currentWeekPrices : prevWeekPrices
        if (!target.has(brandId)) target.set(brandId, new Map())
        const brandMap = target.get(brandId)!; if (!brandMap.has(kcalBucket)) brandMap.set(kcalBucket, new Map())
        const kcalMap = brandMap.get(kcalBucket)!; const pkrId = pkr.id || row.package_kcal_range_id
        if (!kcalMap.has(pkrId)) kcalMap.set(pkrId, [])
        kcalMap.get(pkrId)!.push({ price: row.price, pkrId, packageName: pkr.packages.name, kcalLabel: pkr.kcal_ranges.kcal_label })
      }

      function avgPriceForBucket(weekData: Map<string, Map<number, Map<string, PriceEntry[]>>>, brandId: string, kcalBucket: number): number | null {
        const brandMap = weekData.get(brandId); if (!brandMap) return null
        const kcalMap = brandMap.get(kcalBucket); if (!kcalMap || kcalMap.size === 0) return null
        let sum = 0, count = 0; for (const entries of kcalMap.values()) { if (entries.length > 0) { sum += entries[0].price; count++ } }
        return count > 0 ? sum / count : null
      }

      const brandKcalPrices: BrandKcalPrice[] = []
      for (const brandId of allBrandIds) { const info = brandInfo.get(brandId); if (!info) continue; for (const kcal of KCAL_BUCKETS) { const avgP = avgPriceForBucket(currentWeekPrices, brandId, kcal); if (avgP !== null) { const pkrIds = currentWeekPrices.get(brandId)?.get(kcal); brandKcalPrices.push({ brandId, brandName: info.name, brandLogo: info.logo, kcal, avgPrice: Math.round(avgP * 100) / 100, packageIds: new Set(pkrIds ? Array.from(pkrIds.keys()) : []) }) } } }

      const matchedChanges: MatchedPairChange[] = []; const structuralChanges: StructuralChange[] = []
      for (const brandId of allBrandIds) { const info = brandInfo.get(brandId); if (!info) continue; const curBrand = currentWeekPrices.get(brandId); const prevBrand = prevWeekPrices.get(brandId)
        for (const kcal of KCAL_BUCKETS) { const curKcal = curBrand?.get(kcal); const prevKcal = prevBrand?.get(kcal); if (!curKcal && !prevKcal) continue
          const allPkrIds = new Set([...(curKcal ? Array.from(curKcal.keys()) : []), ...(prevKcal ? Array.from(prevKcal.keys()) : [])])
          let matchedCurSum = 0, matchedPrevSum = 0, matchedCount = 0
          for (const pkrId of allPkrIds) { const curEntries = curKcal?.get(pkrId); const prevEntries = prevKcal?.get(pkrId)
            if (curEntries && prevEntries) { matchedCurSum += curEntries[0].price; matchedPrevSum += prevEntries[0].price; matchedCount++ }
            else if (curEntries && !prevEntries) { structuralChanges.push({ brandId, brandName: info.name, type: 'new', packageName: curEntries[0].packageName, kcalLabel: curEntries[0].kcalLabel, date: weekStart }) }
            else if (!curEntries && prevEntries) { structuralChanges.push({ brandId, brandName: info.name, type: 'removed', packageName: prevEntries[0].packageName, kcalLabel: prevEntries[0].kcalLabel, date: weekStart }) }
          }
          if (matchedCount > 0) { const curAvg = matchedCurSum / matchedCount; const prevAvg = matchedPrevSum / matchedCount; matchedChanges.push({ brandId, brandName: info.name, kcal, currentAvg: curAvg, prevAvg, changePercent: pctChange(curAvg, prevAvg), matchedCount }) }
        }
      }

      const discountRows = ((discountsRes.data || []) as any[]).filter((d: any) => allBrandIds.includes(d.brand_id))
      const brandDiscounts = new Map<string, { percentages: number[]; promoCount: number; deepest: number; codes: any[] }>()
      for (const d of discountRows) { if (!brandDiscounts.has(d.brand_id)) brandDiscounts.set(d.brand_id, { percentages: [], promoCount: 0, deepest: 0, codes: [] }); const entry = brandDiscounts.get(d.brand_id)!; entry.percentages.push(d.percentage); entry.promoCount++; entry.deepest = Math.max(entry.deepest, d.percentage); entry.codes.push(d) }

      const longRunningBrands = new Set<string>()
      for (const d of ((discountsRes.data || []) as any[])) { if (!allBrandIds.includes(d.brand_id)) continue; if (d.valid_from && d.valid_until) { if (differenceInDays(parseISO(d.valid_until), parseISO(d.valid_from)) > 28) longRunningBrands.add(d.brand_id) } else if (d.valid_from && !d.valid_until) { if (differenceInDays(parseISO(weekEnd), parseISO(d.valid_from)) > 28) longRunningBrands.add(d.brand_id) } }
      const newPromosThisWeek = discountRows.filter((d: any) => d.valid_from >= weekStart && d.valid_from <= weekEnd)

      const reviewRows = ((reviewsRes.data || []) as ReviewRow[]).filter(r => allBrandIds.includes(r.brand_id))
      const currentWeekReviews = reviewRows.filter(r => r.review_date >= weekStart && r.review_date <= weekEnd)
      const prevWeekReviews = reviewRows.filter(r => r.review_date >= prevStart && r.review_date <= prevEnd)

      function buildBrandReviews(reviews: ReviewRow[]): Map<string, BrandWeekReview> {
        const map = new Map<string, BrandWeekReview>()
        for (const r of reviews) { if (!map.has(r.brand_id)) { const info = brandInfo.get(r.brand_id); map.set(r.brand_id, { brandId: r.brand_id, brandName: info?.name || 'Unknown', brandLogo: info?.logo || null, avgRating: 0, count: 0, negativePercent: 0, reviews: [] }) }; map.get(r.brand_id)!.reviews.push(r) }
        for (const [, v] of map) { v.count = v.reviews.length; const ratings = v.reviews.map(r => r.rating).filter(r => r != null); v.avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0; v.negativePercent = ratings.length > 0 ? Math.round(ratings.filter(r => r <= 2).length / ratings.length * 100) : 0 }
        return map
      }
      const currentReviewsByBrand = buildBrandReviews(currentWeekReviews); const prevReviewsByBrand = buildBrandReviews(prevWeekReviews)

      const trendPriceRows = (trendPricesRes.data || []) as any[]; const trendReviewRows = (trendReviewsRes.data || []) as any[]
      const priceTrend: WeekTrendPoint[] = trendWeeks.map(w => { const point: WeekTrendPoint = { weekLabel: w.label, weekStart: w.start }; for (const brandId of allBrandIds) { const info = brandInfo.get(brandId); if (!info) continue; const weekPrices = trendPriceRows.filter((r: any) => { const brand = r.package_kcal_ranges?.packages?.brands; if (!brand || brand.name !== info.name) return false; const kcal = r.package_kcal_ranges?.kcal_ranges; if (!kcal) return false; return classifyKcal(kcal.kcal_from, kcal.kcal_to) === 2000 && r.date_recorded >= w.start && r.date_recorded <= w.end }); if (weekPrices.length > 0) { const seen = new Set<string>(); let sum = 0, count = 0; for (const p of weekPrices) { const pkgName = p.package_kcal_ranges?.packages?.brands?.name + '|' + (p.package_kcal_ranges?.packages?.name || ''); if (!seen.has(pkgName)) { seen.add(pkgName); sum += p.price; count++ } }; point[info.name] = count > 0 ? Math.round(sum / count) : null } else { point[info.name] = null } }; return point })
      const ratingTrend: WeekTrendPoint[] = trendWeeks.map(w => { const point: WeekTrendPoint = { weekLabel: w.label, weekStart: w.start }; for (const brandId of allBrandIds) { const info = brandInfo.get(brandId); if (!info) continue; const weekRatings = trendReviewRows.filter((r: any) => r.brand_id === brandId && r.review_date >= w.start && r.review_date <= w.end).map((r: any) => r.rating).filter((r: number) => r != null); point[info.name] = weekRatings.length > 0 ? Math.round(weekRatings.reduce((a: number, b: number) => a + b, 0) / weekRatings.length * 100) / 100 : null }; return point })

      const effectivePrices: { brandId: string; brandName: string; brandLogo: string | null; catalogPrice: number; effectivePrice: number; discount: number }[] = []
      for (const brandId of allBrandIds) { const info = brandInfo.get(brandId); if (!info) continue; const price2000 = avgPriceForBucket(currentWeekPrices, brandId, 2000); if (price2000 === null) continue; const disc = brandDiscounts.get(brandId); const avgDisc = disc ? disc.percentages.reduce((a, b) => a + b, 0) / disc.percentages.length : 0; effectivePrices.push({ brandId, brandName: info.name, brandLogo: info.logo, catalogPrice: price2000, effectivePrice: price2000 * (1 - avgDisc / 100), discount: avgDisc }) }
      effectivePrices.sort((a, b) => a.effectivePrice - b.effectivePrice)

      const events: CompetitorEvent[] = []
      for (const mc of matchedChanges) { if (mc.brandId === myBrandId) continue; if (Math.abs(mc.changePercent) > 3 && mc.kcal === 2000) events.push({ date: weekStart, brandName: mc.brandName, type: 'price_change', description: `Zmiana cen katalogowych ${mc.changePercent > 0 ? '+' : ''}${mc.changePercent.toFixed(1)}% (te same warianty 2000 kcal, WoW)` }) }
      for (const d of discountRows) { const info = brandInfo.get(d.brand_id); if (!info || d.brand_id === myBrandId) continue; if (d.valid_from >= weekStart && d.valid_from <= weekEnd) events.push({ date: d.valid_from, brandName: info.name, type: 'promo_start', description: `Nowa promocja -${d.percentage}%${d.code ? ` (kod: ${d.code})` : ''}` }); if (d.valid_until && d.valid_until >= weekStart && d.valid_until <= weekEnd) events.push({ date: d.valid_until, brandName: info.name, type: 'promo_end', description: `Zakończenie promocji -${d.percentage}%` }) }
      for (const brandId of competitorBrandIds) { const wr = currentWeekReviews.filter(r => r.brand_id === brandId); const prevCount = prevWeekReviews.filter(r => r.brand_id === brandId).length; if (prevCount > 0 && wr.length / 7 > (prevCount / 7) * 2) { const info = brandInfo.get(brandId); events.push({ date: weekStart, brandName: info?.name || 'Unknown', type: 'review_spike', description: `Wzrost opinii: ${wr.length} vs ${prevCount} poprz. tyg.` }) } }
      for (const sc of structuralChanges) { if (sc.brandId === myBrandId) continue; events.push({ date: sc.date, brandName: sc.brandName, type: 'structural', description: `${sc.type === 'new' ? 'Nowy pakiet' : 'Wycofany pakiet'}: ${sc.packageName} (${sc.kcalLabel})` }) }
      events.sort((a, b) => a.date.localeCompare(b.date))

      const recommendations: { text: string; priority: 'high' | 'medium' | 'low'; title: string; owner: string; deadline: string }[] = []
      const myPriceTrendValues = priceTrend.map(p => p[brandInfo.get(myBrandId)?.name || '']).filter((v): v is number => v !== null && typeof v === 'number')
      const cheapestCompetitorTrend = priceTrend.map(p => { let min = Infinity; for (const cid of competitorBrandIds) { const info = brandInfo.get(cid); if (!info) continue; const v = p[info.name]; if (typeof v === 'number' && v < min) min = v }; return min === Infinity ? null : min })
      if (myPriceTrendValues.length >= 3 && cheapestCompetitorTrend.filter(v => v !== null).length >= 3) {
        const recentGaps = myPriceTrendValues.slice(-3).map((v, i) => { const c = cheapestCompetitorTrend.slice(-3)[i]; return c ? ((v - c) / c) * 100 : null }).filter((v): v is number => v !== null)
        if (recentGaps.length >= 2 && recentGaps[recentGaps.length - 1] > recentGaps[0] + 2) { const myP = brandKcalPrices.find(p => p.brandId === myBrandId && p.kcal === 2000); const cc = brandKcalPrices.filter(p => p.brandId !== myBrandId && p.kcal === 2000).sort((a, b) => a.avgPrice - b.avgPrice)[0]; const cg = myP && cc ? ((myP.avgPrice - cc.avgPrice) / cc.avgPrice * 100) : null; recommendations.push({ title: 'Decyzja cenowa dot. pakietów 2000+ kcal', text: `Dystans do najtańszego (${cc?.brandName || '?'}) wzrósł do ${cg != null ? cg.toFixed(1) + '%' : 'b.d.'} (${myP ? fmtPrice(myP.avgPrice) : 'b.d.'} vs ${cc ? fmtPrice(cc.avgPrice) : 'b.d.'}). Trend rosnący od 2+ tygodni — próg alarmowy 15%.`, priority: 'high', owner: 'Dział pricing', deadline: 'Do piątku' }) }
      }
      const myNegReviews = currentWeekReviews.filter(r => r.brand_id === myBrandId && r.rating != null && r.rating <= 2)
      if (myNegReviews.length > 0) { const tc: Record<string, number> = {}; for (const r of myNegReviews) { if (!r.content) continue; const t = detectTopic(r.content); if (t) tc[t] = (tc[t] || 0) + 1 }; for (const [topic, count] of Object.entries(tc)) { if (count / myNegReviews.length > 0.5) { const tn: Record<string, string> = { dostawa: 'dostawy', smak: 'jakości smaku', cena: 'ceny', obsługa: 'obsługi klienta' }; recommendations.push({ title: `Eskalacja: problem ${tn[topic] || topic}`, text: `${count} z ${myNegReviews.length} negatywnych opinii (${Math.round(count / myNegReviews.length * 100)}%) dotyczy ${tn[topic] || topic}. Jeden temat >50% = eskalacja.`, priority: 'high', owner: 'Dział operacji', deadline: 'Natychmiast' }) } } }
      for (const cid of competitorBrandIds) { const curNeg = currentWeekReviews.filter(r => r.brand_id === cid && r.rating != null && r.rating <= 2).length; const prevNeg = prevWeekReviews.filter(r => r.brand_id === cid && r.rating != null && r.rating <= 2).length; if (prevNeg > 0 && curNeg > prevNeg * 2) { const info = brandInfo.get(cid); recommendations.push({ title: `Okazja akwizycyjna — ${info?.name || '?'}`, text: `${info?.name || '?'} zanotował ${curNeg} negatywnych opinii (2x więcej niż ${prevNeg} poprz. tyg.). Spike negatywnych u konkurenta = okno akwizycyjne.`, priority: 'medium', owner: 'Dział marketingu', deadline: 'Ten tydzień' }) } }
      for (const cid of longRunningBrands) { if (cid === myBrandId) continue; const info = brandInfo.get(cid); const disc = brandDiscounts.get(cid); const ad = disc ? (disc.percentages.reduce((a, b) => a + b, 0) / disc.percentages.length).toFixed(1) : '?'; recommendations.push({ title: `Strategia rabatowa ${info?.name || '?'}`, text: `${info?.name || '?'} utrzymuje rabat ${ad}% od 4+ tygodni — trwała zmiana pozycjonowania, nie promocja.`, priority: 'low', owner: 'Dział strategii', deadline: 'Następny przegląd' }) }

      return { brandInfo, brandKcalPrices, matchedChanges, structuralChanges, brandDiscounts, longRunningBrands, newPromosThisWeek, currentReviewsByBrand, prevReviewsByBrand, effectivePrices, priceTrend, ratingTrend, events, recommendations: recommendations.slice(0, 3), currentWeekReviews, prevWeekReviews }
    },
    staleTime: 1000 * 60 * 10,
  })

  const handlePrint = useReactToPrint({ contentRef: reportRef, documentTitle: `raport-zarzadczy-${weekStart}-${weekEnd}`, pageStyle: `@page { size: A4 landscape; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } [data-slide] { display: flex !important; page-break-after: always; aspect-ratio: auto !important; height: 190mm !important; max-width: none !important; box-shadow: none !important; border-radius: 0 !important; } .no-print { display: none !important; } }` })

  const handleSendEmail = async () => { const extraList = emailExtraEmails.split('\n').map(e => e.trim()).filter(Boolean); const selectedEmails = emailUsers.filter(u => emailRecipients.has(u.id)).map(u => u.email); const recipients = [...new Set([...selectedEmails, ...extraList])]; if (!recipients.length) { toast.error('Brak odbiorców'); return }; setSending(true); try { const res = await fetch('/api/admin/send-custom-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipients, subject: `Raport zarządczy ${weekStart} \u2013 ${weekEnd}`, paragraphs: [`Raport zarządczy tygodniowy za okres ${weekStart} \u2013 ${weekEnd} został wygenerowany.`] }) }); const result = await res.json(); if (result.sent > 0) toast.success(`Wysłano do ${result.sent} odbiorców`); if (result.errors?.length) toast.error(`Błędy: ${result.errors.join(', ')}`); setShowEmailModal(false) } catch (e: any) { toast.error(e.message || 'Błąd wysyłki') } finally { setSending(false) } }

  // ── Computed values ────────────────────────────────────────────────────────
  const myBrandName = data?.brandInfo.get(myBrandId)?.name || '—'

  const slide1Data = useMemo(() => {
    if (!data) return null
    const totalBrands = allBrandIds.length
    const prices2000 = data.brandKcalPrices.filter(p => p.kcal === 2000)
    const sorted2000 = [...prices2000].sort((a, b) => a.avgPrice - b.avgPrice)
    const brandsWithPricing = sorted2000.length
    const myPrice2000Entry = sorted2000.find(p => p.brandId === myBrandId)
    const myPosition = myPrice2000Entry ? sorted2000.indexOf(myPrice2000Entry) + 1 : 0
    const myPriceValue = myPrice2000Entry?.avgPrice ?? null
    const cheapestCompetitorEntry = sorted2000.find(p => p.brandId !== myBrandId)
    const cheapestName = cheapestCompetitorEntry?.brandName ?? null
    const cheapestPrice = cheapestCompetitorEntry?.avgPrice ?? null
    const gapPercent = myPriceValue != null && cheapestPrice != null ? ((myPriceValue - cheapestPrice) / cheapestPrice) * 100 : 0
    const mc2000 = data.matchedChanges.filter(mc => mc.kcal === 2000)
    const myMc2000 = mc2000.find(mc => mc.brandId === myBrandId)
    const competitorMc2000 = mc2000.filter(mc => mc.brandId !== myBrandId)
    const myPrevPrice = myMc2000?.prevAvg ?? null
    const cheapestPrevComp = competitorMc2000.length > 0 ? competitorMc2000.reduce((min, mc) => mc.prevAvg < min.prevAvg ? mc : min) : null
    const prevGapPercent = myPrevPrice != null && cheapestPrevComp ? ((myPrevPrice - cheapestPrevComp.prevAvg) / cheapestPrevComp.prevAvg) * 100 : null
    const myReviews = data.currentReviewsByBrand.get(myBrandId); const prevMyReviews = data.prevReviewsByBrand.get(myBrandId)
    const avgRating = myReviews?.avgRating ?? 0; const myReviewCount = myReviews?.count ?? 0
    const prevAvgRating = prevMyReviews?.avgRating ?? 0; const prevMyReviewCount = prevMyReviews?.count ?? 0
    const isSmallSample = myReviewCount < 10; const ratingDelta = prevMyReviewCount > 0 ? avgRating - prevAvgRating : null
    const totalMarketReviews = Array.from(data.currentReviewsByBrand.values()).reduce((s, b) => s + b.count, 0)
    const shareOfVoice = totalMarketReviews > 0 ? (myReviewCount / totalMarketReviews) * 100 : 0
    const prevTotalReviews = Array.from(data.prevReviewsByBrand.values()).reduce((s, b) => s + b.count, 0)
    const shareOfVoiceDelta = prevTotalReviews > 0 ? shareOfVoice - ((prevMyReviewCount / prevTotalReviews) * 100) : null
    const myMatchedChange = data.matchedChanges.find(mc => mc.brandId === myBrandId && mc.kcal === 2000)
    const eventCount = data.events.length
    const bigCompetitorChange = data.matchedChanges.filter(mc => mc.brandId !== myBrandId && mc.kcal === 2000 && Math.abs(mc.changePercent) > 5).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0]

    let verdict: string; let verdictColor: 'green' | 'amber' | 'red' = 'green'
    if (prevGapPercent != null && gapPercent > prevGapPercent + 2 && gapPercent > 15 && cheapestName) { verdict = `Premia cenowa vs ${cheapestName} wzrosła do ${gapPercent.toFixed(1)}% (${myPriceValue != null ? fmtPrice(myPriceValue) : 'b.d.'} vs ${cheapestPrice != null ? fmtPrice(cheapestPrice) : 'b.d.'}) — przekroczony próg alarmowy 15%`; verdictColor = 'red' }
    else if (ratingDelta != null && ratingDelta < -0.3 && !isSmallSample) { verdict = `Ocena klientów spadła z ${prevAvgRating.toFixed(1)} do ${avgRating.toFixed(1)}\u2605 (n=${myReviewCount}) — przeanalizować przyczyny`; verdictColor = 'red' }
    else if (bigCompetitorChange) { const dir = bigCompetitorChange.changePercent > 0 ? 'podniósł' : 'obniżył'; verdict = `${bigCompetitorChange.brandName} ${dir} ceny o ${Math.abs(bigCompetitorChange.changePercent).toFixed(1)}% — monitorować wpływ na naszą pozycję #${myPosition || '?'}/${totalBrands}`; verdictColor = 'amber' }
    else { const rn = myReviewCount > 0 ? (isSmallSample ? `, ocena ${avgRating.toFixed(1)}\u2605 (n=${myReviewCount}, mała próba)` : `, ocena ${avgRating.toFixed(1)}\u2605 (n=${myReviewCount})`) : ''; verdict = `Pozycja stabilna — #${myPosition || '?'} z ${totalBrands} cenowo${rn}${eventCount > 0 ? `, ${eventCount} ruchów konkurencji` : ''}`; verdictColor = 'green' }

    return { myPosition, totalBrands, brandsWithPricing, myPriceValue, cheapestName, cheapestPrice, gapPercent, prevGapPercent, avgRating, myReviewCount, prevAvgRating, prevMyReviewCount, ratingDelta, isSmallSample, shareOfVoice, shareOfVoiceDelta, totalMarketReviews, verdict, verdictColor, myMatchedChange, eventCount }
  }, [data, myBrandId, allBrandIds])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="text-center space-y-4"><Skeleton className="h-12 w-12 rounded-full mx-auto" /><Skeleton className="h-4 w-48 mx-auto" /><Skeleton className="h-3 w-32 mx-auto" /></div></div>
  if (error || !data) return <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" /><p className="text-destructive font-medium">Błąd ładowania danych raportu</p><p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message || 'Spróbuj ponownie'}</p></CardContent></Card>

  // ── Render data ────────────────────────────────────────────────────────────
  const weekRange = `${weekStart} \u2013 ${weekEnd}`

  const scatterData = data.effectivePrices.map(ep => { const review = data.currentReviewsByBrand.get(ep.brandId); return { brandName: ep.brandName, x: Math.round(ep.effectivePrice), y: review?.avgRating ?? 0, z: review?.count ?? 1, isMy: ep.brandId === myBrandId } }).filter(d => d.y > 0)
  const medianX = scatterData.length > 0 ? [...scatterData].sort((a, b) => a.x - b.x)[Math.floor(scatterData.length / 2)].x : 0
  const medianY = scatterData.length > 0 ? [...scatterData].sort((a, b) => a.y - b.y)[Math.floor(scatterData.length / 2)].y : 0
  const myScatter = scatterData.find(d => d.isMy)
  const cheapestScatter = scatterData.filter(d => !d.isMy).sort((a, b) => a.x - b.x)[0]

  type CatalogRow = { brandId: string; brandName: string; brandLogo: string | null; prices: Record<number, number | null>; changePercent: number | null; matchedCount: number; isMy: boolean }
  const catalogTableData: CatalogRow[] = allBrandIds.flatMap(brandId => { const info = data.brandInfo.get(brandId); if (!info) return []; const prices: Record<number, number | null> = {}; for (const kcal of KCAL_BUCKETS) { const p = data.brandKcalPrices.find(bp => bp.brandId === brandId && bp.kcal === kcal); prices[kcal] = p?.avgPrice ?? null }; const mc = data.matchedChanges.find(m => m.brandId === brandId && m.kcal === 2000); return [{ brandId, brandName: info.name, brandLogo: info.logo, prices, changePercent: mc?.changePercent ?? null, matchedCount: mc?.matchedCount ?? 0, isMy: brandId === myBrandId }] })

  const myCatalogRow = catalogTableData.find(r => r.isMy)
  const myPrice2000 = myCatalogRow?.prices[2000]
  const cheapestCatalogRow = catalogTableData.filter(r => !r.isMy && r.prices[2000] != null).sort((a, b) => (a.prices[2000] ?? Infinity) - (b.prices[2000] ?? Infinity))[0]
  const pricGapPct = myPrice2000 != null && cheapestCatalogRow?.prices[2000] != null ? ((myPrice2000 - cheapestCatalogRow.prices[2000]!) / cheapestCatalogRow.prices[2000]!) * 100 : null

  type DiscountTableRow = { brandId: string; brandName: string; brandLogo: string | null; avgDiscount: number; promoCount: number; deepest: number; isLongRunning: boolean; isMy: boolean }
  const discountTableData: DiscountTableRow[] = allBrandIds.flatMap(brandId => { const info = data.brandInfo.get(brandId); if (!info) return []; const disc = data.brandDiscounts.get(brandId); return [{ brandId, brandName: info.name, brandLogo: info.logo, avgDiscount: disc ? disc.percentages.reduce((a, b) => a + b, 0) / disc.percentages.length : 0, promoCount: disc?.promoCount ?? 0, deepest: disc?.deepest ?? 0, isLongRunning: data.longRunningBrands.has(brandId), isMy: brandId === myBrandId }] })
  const mostAggressiveCompetitor = discountTableData.filter(d => !d.isMy && d.avgDiscount > 0).sort((a, b) => b.avgDiscount - a.avgDiscount)[0]

  type ReviewTableRow = { brandId: string; brandName: string; brandLogo: string | null; avgRating: number; prevAvgRating: number; count: number; prevCount: number; isMy: boolean }
  const reviewTableData: ReviewTableRow[] = allBrandIds.flatMap(brandId => { const info = data.brandInfo.get(brandId); if (!info) return []; const cur = data.currentReviewsByBrand.get(brandId); const prev = data.prevReviewsByBrand.get(brandId); return [{ brandId, brandName: info.name, brandLogo: info.logo, avgRating: cur?.avgRating ?? 0, prevAvgRating: prev?.avgRating ?? 0, count: cur?.count ?? 0, prevCount: prev?.count ?? 0, isMy: brandId === myBrandId }] })

  const myCurrentReviews = data.currentWeekReviews.filter(r => r.brand_id === myBrandId)
  const bestQuote = myCurrentReviews.filter(r => r.rating != null && r.rating >= 4 && r.content && r.content.length > 20).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
  const worstQuote = myCurrentReviews.filter(r => r.rating != null && r.rating <= 2 && r.content && r.content.length > 20).sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))[0]

  const myNegativeReviews = myCurrentReviews.filter(r => r.rating != null && r.rating <= 2)
  const topicCounts: Record<string, number> = {}; for (const r of myNegativeReviews) { if (!r.content) continue; const t = detectTopic(r.content); if (t) topicCounts[t] = (topicCounts[t] || 0) + 1 }
  const dominantTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]
  const topicLabels: Record<string, string> = { dostawa: 'Dostawa', smak: 'Smak', cena: 'Cena', obsługa: 'Obsługa klienta' }

  const barChartData = data.effectivePrices.map(ep => ({ name: ep.brandName, price: Math.round(ep.effectivePrice), isMy: ep.brandId === myBrandId }))
  const cheapestEffective = data.effectivePrices[0]; const myEffective = data.effectivePrices.find(ep => ep.brandId === myBrandId)
  const effectiveGap = myEffective && cheapestEffective ? ((myEffective.effectivePrice - cheapestEffective.effectivePrice) / cheapestEffective.effectivePrice) * 100 : null
  const myEffRating = myEffective ? (data.currentReviewsByBrand.get(myEffective.brandId)?.avgRating ?? 0) : 0
  const cheapEffRating = cheapestEffective ? (data.currentReviewsByBrand.get(cheapestEffective.brandId)?.avgRating ?? 0) : 0
  const topEvents = data.events.slice(0, 5)

  // ── Action titles ──────────────────────────────────────────────────────────
  const slide2Title = (() => { if (!myScatter || !cheapestScatter) return 'Brak danych do analizy pozycji rynkowej'; const diff = myScatter.x - cheapestScatter.x; if (diff > 0) return myScatter.y < cheapestScatter.y - 0.1 ? `Płacimy premię premium bez premium jakości — ${cheapestScatter.brandName} oferuje wyższą ocenę przy cenie niższej o ${diff} zł/dzień` : `Premia cenowa ${diff} zł/dzień vs ${cheapestScatter.brandName} — ${myScatter.y > cheapestScatter.y + 0.2 ? 'uzasadniona wyższą oceną' : 'oceny porównywalne, do monitorowania'}`; return `${myBrandName} jest liderem cenowym (${myScatter.x} zł/dzień)` })()
  const biggestWoW = catalogTableData.filter(r => r.changePercent != null && Math.abs(r.changePercent!) > 0.5).sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!))[0]
  const slide3Title = biggestWoW ? `${biggestWoW.isMy ? 'Nasze ceny' : biggestWoW.brandName} ${biggestWoW.changePercent! > 0 ? 'w górę' : 'w dół'} o ${Math.abs(biggestWoW.changePercent!).toFixed(1)}% w wariancie 2000 kcal` : 'Stabilizacja cenowa — brak istotnych zmian tygodniowych'
  const slide4Title = mostAggressiveCompetitor ? `${mostAggressiveCompetitor.brandName} prowadzi najagresywniejszą politykę rabatową (śr. ${mostAggressiveCompetitor.avgDiscount.toFixed(1)}%)` : 'Brak istotnych zmian w polityce rabatowej'
  const slide5Title = myEffective && cheapestEffective ? (myEffective.brandId === cheapestEffective.brandId ? `Po rabatach jesteśmy najtańsi (${Math.round(myEffective.effectivePrice)} zł/dzień)` : `Po rabatach jesteśmy ${effectiveGap!.toFixed(0)}% ${effectiveGap! > 0 ? 'drożsi' : 'tańsi'} od lidera cenowego ${cheapestEffective.brandName}`) : 'Brak danych cenowych do analizy'
  const myRevRow = reviewTableData.find(r => r.isMy); const slide6Title = myRevRow && myRevRow.count > 0 ? `Ocena tygodnia ${myRevRow.avgRating.toFixed(2)}\u2605 (n=${myRevRow.count})${myRevRow.count < 10 ? ' — próba poniżej progu statystycznego' : ''}` : 'Brak nowych opinii w tym tygodniu'
  const slide7Title = topEvents.length > 0 ? `${topEvents.length} istotnych ruchów konkurencji w tygodniu` : 'Spokojny tydzień — brak istotnych ruchów konkurencji'
  const slide8Title = data.recommendations.length > 0 ? `${data.recommendations.length} ${data.recommendations.length === 1 ? 'decyzja' : data.recommendations.length < 5 ? 'decyzje' : 'decyzji'} na ten tydzień` : 'Utrzymać obecną strategię — brak pilnych działań'

  const verdictCls: Record<string, string> = { green: 'bg-primary/5 border-primary/20 text-primary', amber: 'bg-warning/10 border-warning/30 text-warning-foreground', red: 'bg-destructive/10 border-destructive/30 text-destructive' }
  const slideStyle = (active: boolean): React.CSSProperties => ({ aspectRatio: '16/9', width: '100%', maxWidth: 1100, display: active ? 'flex' : 'none' })

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="flex gap-3 mb-4 no-print">
        <Button onClick={() => handlePrint()} variant="outline" size="sm"><FileDown className="h-4 w-4 mr-2" />PDF</Button>
        <Button onClick={toggleFullscreen} variant="outline" size="sm"><Maximize className="h-4 w-4 mr-2" />Tryb prezentacji</Button>
        <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}><Mail className="h-4 w-4 mr-2" />Email</Button>
      </div>

      <div ref={containerRef} className={isFullscreen ? 'flex flex-col items-center justify-center' : ''} style={isFullscreen ? { background: 'hsl(var(--background))', height: '100%', width: '100%' } : undefined}>
        <div className="relative w-full" style={{ maxWidth: 1240, margin: '0 auto' }}>
          <button onClick={goPrev} disabled={currentSlide === 0} className="no-print absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all disabled:opacity-20 bg-card hover:bg-muted" style={{ left: 0 }}><ChevronLeft className="h-5 w-5" /></button>

          <div ref={reportRef} className="mx-auto" style={{ maxWidth: 1100 }}>

            {/* ═══ SLIDE 1 — Executive Summary ════════════════════════════════ */}
            <div data-slide="1" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 0)}>
              <SlideFrame index={0} methodology={`Źródło: ceny katalogowe i opinie · ${allBrandIds.length} marek · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 1/8 &middot; PODSUMOWANIE</Badge>

                {slide1Data && <>
                  <div className={`rounded-lg border px-4 py-3 mb-4 ${verdictCls[slide1Data.verdictColor]}`}>
                    <div className="flex items-start gap-3">
                      {slide1Data.verdictColor === 'green' ? <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" /> : <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                      <p className="text-sm font-semibold leading-snug">{slide1Data.verdict}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 flex-1">
                    {/* KPI 1 */}
                    <Card><CardContent className="pt-3 pb-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">cena kat. 2000 kcal, 1 = najtańsza{slide1Data.brandsWithPricing < slide1Data.totalBrands ? ` (dane ${slide1Data.brandsWithPricing}/${slide1Data.totalBrands})` : ''}</p>
                      <p className="text-2xl font-bold">{slide1Data.myPosition > 0 ? `#${slide1Data.myPosition}` : 'b.d.'}<span className="text-base font-normal text-muted-foreground"> z {slide1Data.totalBrands}</span></p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">Pozycja cenowa</p>
                      {slide1Data.myMatchedChange && <p className={`text-xs font-medium mt-0.5 ${slide1Data.myMatchedChange.changePercent > 0.5 ? 'text-destructive' : slide1Data.myMatchedChange.changePercent < -0.5 ? 'text-green-600' : 'text-muted-foreground'}`}>{fmtPct(slide1Data.myMatchedChange.changePercent)} zmiana WoW</p>}
                    </CardContent></Card>

                    {/* KPI 2 */}
                    <Card><CardContent className="pt-3 pb-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{slide1Data.myPriceValue != null && slide1Data.cheapestName ? `${fmtPrice(slide1Data.myPriceValue)} vs ${slide1Data.cheapestName} ${slide1Data.cheapestPrice != null ? fmtPrice(slide1Data.cheapestPrice) : ''}` : 'brak danych'}</p>
                      <p className={`text-2xl font-bold ${slide1Data.gapPercent > 15 ? 'text-destructive' : slide1Data.gapPercent <= 0 ? 'text-green-600' : ''}`}>{slide1Data.myPriceValue != null ? fmtPct(slide1Data.gapPercent, true) : 'b.d.'}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">Premia vs najtańszy</p>
                    </CardContent></Card>

                    {/* KPI 3 */}
                    <Card><CardContent className="pt-3 pb-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">nowe opinie, n={slide1Data.myReviewCount}{slide1Data.prevMyReviewCount > 0 ? `; poprz.: ${slide1Data.prevAvgRating.toFixed(2)}\u2605 (n=${slide1Data.prevMyReviewCount})` : '; brak danych poprz. tyg.'}</p>
                      <p className="text-2xl font-bold">{slide1Data.myReviewCount > 0 ? `${slide1Data.avgRating.toFixed(2)}\u2605` : 'b.d.'}{slide1Data.isSmallSample && slide1Data.myReviewCount > 0 && <Badge variant="destructive" className="ml-2 text-[9px]">mała próba, n&lt;10</Badge>}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">Ocena tygodnia</p>
                      {slide1Data.ratingDelta != null && <p className={`text-xs font-medium mt-0.5 ${slide1Data.ratingDelta > 0.05 ? 'text-green-600' : slide1Data.ratingDelta < -0.05 ? 'text-destructive' : 'text-muted-foreground'}`}>{slide1Data.ratingDelta >= 0 ? '+' : ''}{slide1Data.ratingDelta.toFixed(2)} WoW</p>}
                    </CardContent></Card>

                    {/* KPI 4 */}
                    <Card><CardContent className="pt-3 pb-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{slide1Data.totalMarketReviews > 0 ? `${slide1Data.myReviewCount} z ${slide1Data.totalMarketReviews} opinii ${allBrandIds.length} marek` : 'brak opinii'}</p>
                      <p className="text-2xl font-bold">{slide1Data.totalMarketReviews > 0 ? `${slide1Data.shareOfVoice.toFixed(0)}%` : 'b.d.'}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">Udział w opiniach rynku</p>
                      {slide1Data.shareOfVoiceDelta != null && <p className={`text-xs font-medium mt-0.5 ${slide1Data.shareOfVoiceDelta > 1 ? 'text-green-600' : slide1Data.shareOfVoiceDelta < -1 ? 'text-destructive' : 'text-muted-foreground'}`}>{slide1Data.shareOfVoiceDelta >= 0 ? '+' : ''}{slide1Data.shareOfVoiceDelta.toFixed(1)}pp WoW</p>}
                    </CardContent></Card>
                  </div>
                </>}
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 2 — Position Map ═════════════════════════════════════ */}
            <div data-slide="2" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 1)}>
              <SlideFrame index={1} methodology={`Bańka = marka · Oś X: cena 2000 kcal po rabacie · Oś Y: śr. ocena · Przerywana = mediana · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 2/8 &middot; MAPA POZYCJI</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-3">{slide2Title}</h2>
                {scatterData.length > 0 ? (
                  <div className="flex gap-4 flex-1 min-h-0">
                    <div className="flex-[3] relative min-h-0">
                      <div className="absolute top-0 left-14 text-[10px] text-muted-foreground pointer-events-none">Niska cena, wysoka ocena</div>
                      <div className="absolute top-0 right-0 text-[10px] text-muted-foreground pointer-events-none">Wysoka cena, wysoka ocena</div>
                      <div className="absolute bottom-6 left-14 text-[10px] text-muted-foreground pointer-events-none">Niska cena, niska ocena</div>
                      <div className="absolute bottom-6 right-0 text-[10px] text-muted-foreground pointer-events-none">Wysoka cena, niska ocena</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 16, right: 16, bottom: 20, left: 16 }}>
                          <XAxis type="number" dataKey="x" domain={['auto', 'auto']} tick={{ fontSize: 11 }} label={{ value: 'Cena za 2000 kcal po rabacie, zł/dzień', position: 'insideBottom', offset: -8, style: { fontSize: 10, fill: 'hsl(215,15%,45%)' } }} />
                          <YAxis type="number" dataKey="y" domain={[1, 5]} tick={{ fontSize: 11 }} label={{ value: 'Średnia ocena klientów', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: 'hsl(215,15%,45%)' } }} />
                          <ZAxis type="number" dataKey="z" range={[200, 800]} />
                          <ReTooltip content={({ active, payload }: any) => { if (!active || !payload?.length) return null; const d = payload[0].payload; return <div className="bg-card border rounded-lg shadow-lg p-2 text-xs"><p className="font-bold">{d.brandName}</p><p>Cena: {d.x} zł</p><p>Ocena: {d.y.toFixed(2)}\u2605</p><p>Opinii: {d.z}</p></div> }} />
                          <ReferenceLine x={medianX} stroke="hsl(215,20%,85%)" strokeDasharray="3 3" label={{ value: 'mediana cen', position: 'top', style: { fontSize: 9, fill: 'hsl(215,15%,60%)' } }} />
                          <ReferenceLine y={medianY} stroke="hsl(215,20%,85%)" strokeDasharray="3 3" label={{ value: 'mediana ocen', position: 'right', style: { fontSize: 9, fill: 'hsl(215,15%,60%)' } }} />
                          <Scatter data={scatterData} shape={ScatterBubble} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-[2] flex flex-col gap-2">
                      <Card className="flex-1"><CardContent className="pt-3 pb-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Co widzimy</p><p className="text-xs text-foreground">{myScatter ? `${myBrandName}: ${myScatter.x} zł, ${myScatter.y.toFixed(1)}\u2605.${cheapestScatter ? ` ${cheapestScatter.brandName}: ${cheapestScatter.x} zł, ${cheapestScatter.y.toFixed(1)}\u2605.` : ''}` : 'Brak danych.'}</p></CardContent></Card>
                      <Card className="flex-1"><CardContent className="pt-3 pb-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Co to oznacza</p><p className="text-xs text-foreground">{myScatter && cheapestScatter ? (myScatter.x > cheapestScatter.x ? (myScatter.y > cheapestScatter.y + 0.2 ? 'Premia cenowa uzasadniona wyższą oceną klientów.' : myScatter.y < cheapestScatter.y - 0.1 ? 'Premia cenowa bez wyższej jakości — ryzyko utraty klientów.' : 'Porównywalna jakość przy wyższej cenie.') : 'Pozycja lidera cenowego.') : 'Brak danych do analizy.'}</p></CardContent></Card>
                      <Card className="flex-1"><CardContent className="pt-3 pb-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Decyzja do podjęcia</p><p className="text-xs text-foreground">{myScatter && cheapestScatter && myScatter.x > cheapestScatter.x && myScatter.y < cheapestScatter.y ? 'Obniżka ceny lub inwestycja w jakość — utrzymanie obecnej pozycji jest ryzykowne.' : 'Monitorować. Brak pilnych działań.'}</p></CardContent></Card>
                    </div>
                  </div>
                ) : <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">Brak danych do wyświetlenia mapy pozycji</p></div>}
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 3 — Prices ═══════════════════════════════════════════ */}
            <div data-slide="3" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 2)}>
              <SlideFrame index={2} methodology={`\u00B9 Zmiana WoW na parach dopasowanych — tylko pakiety obecne w obu tygodniach · \u00B2 Brak wariantu w ofercie · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 3/8 &middot; CENY</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-3">{slide3Title}</h2>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Marka</TableHead><TableHead className="text-right">1500 kcal</TableHead><TableHead className="text-right">2000 kcal</TableHead><TableHead className="text-right">2500 kcal</TableHead><TableHead className="text-right">Zmiana WoW\u00B9</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{catalogTableData.map(row => (
                    <TableRow key={row.brandId} className={row.isMy ? 'bg-primary/5 font-semibold' : ''}>
                      <TableCell><div className="flex items-center gap-2"><BrandLogo url={row.brandLogo} name={row.brandName} size="md" />{row.brandName}</div></TableCell>
                      <TableCell className="text-right">{row.prices[1500] != null ? fmtPrice(row.prices[1500]) : <span className="text-muted-foreground">b.d.\u00B2</span>}</TableCell>
                      <TableCell className="text-right">{row.prices[2000] != null ? fmtPrice(row.prices[2000]) : <span className="text-muted-foreground">b.d.\u00B2</span>}</TableCell>
                      <TableCell className="text-right">{row.prices[2500] != null ? fmtPrice(row.prices[2500]) : <span className="text-muted-foreground">b.d.\u00B2</span>}</TableCell>
                      <TableCell className="text-right">{row.changePercent != null ? <span className={row.changePercent > 0.5 ? 'text-destructive' : row.changePercent < -0.5 ? 'text-green-600' : 'text-muted-foreground'}>{fmtPct(row.changePercent)}</span> : <span className="text-muted-foreground">b.d.</span>}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
                <div className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg px-4 py-2.5 mt-auto">
                  <p className="text-xs text-foreground">{pricGapPct != null && myPrice2000 != null && cheapestCatalogRow ? (pricGapPct <= 0 ? <><strong>{myBrandName}</strong> ({fmtPrice(myPrice2000)}) jest najtańszy w wariancie 2000 kcal.</> : <>Nasza cena 2000 kcal ({fmtPrice(myPrice2000)}) jest o <strong>{pricGapPct.toFixed(1)}%</strong> wyższa niż {cheapestCatalogRow.brandName} ({fmtPrice(cheapestCatalogRow.prices[2000]!)}). {pricGapPct > 15 ? 'Próg 15% przekroczony.' : 'W akceptowalnym przedziale.'}</>) : <>Brak pełnych danych cenowych 2000 kcal.</>}</p>
                </div>
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 4 — Discounts ════════════════════════════════════════ */}
            <div data-slide="4" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 3)}>
              <SlideFrame index={3} methodology={`Źródło: aktywne kody rabatowe i promocje cenowe · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 4/8 &middot; RABATY</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-3">{slide4Title}</h2>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Marka</TableHead><TableHead className="text-right">Śr. rabat</TableHead><TableHead className="text-right">L. promocji</TableHead><TableHead className="text-right">Najgłębszy</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{discountTableData.map(row => (
                    <TableRow key={row.brandId} className={row.isMy ? 'bg-primary/5 font-semibold' : ''}>
                      <TableCell><div className="flex items-center gap-2"><BrandLogo url={row.brandLogo} name={row.brandName} />{row.brandName}{row.isLongRunning && !row.isMy && <Badge variant="outline" className="text-[9px] ml-1">4+ tyg.</Badge>}</div></TableCell>
                      <TableCell className="text-right">{row.avgDiscount > 0 ? `${row.avgDiscount.toFixed(1)}%` : '\u2014'}</TableCell>
                      <TableCell className="text-right">{row.promoCount}</TableCell>
                      <TableCell className="text-right">{row.deepest > 0 ? `${row.deepest}%` : '\u2014'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
                <div className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg px-4 py-2.5 mt-auto">
                  <p className="text-xs text-foreground">{(() => { const lr = discountTableData.filter(d => d.isLongRunning && !d.isMy); return lr.length > 0 ? <>{lr.map(d => d.brandName).join(', ')} utrzymuje rabat ponad 4 tygodnie — strategia cenowa, nie jednorazowa promocja.</> : <>Brak długotrwałych strategii rabatowych u konkurencji.</>})()}</p>
                </div>
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 5 — Effective Price ══════════════════════════════════ */}
            <div data-slide="5" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 4)}>
              <SlideFrame index={4} methodology={`Cena efektywna = cena kat. 2000 kcal × (1 − śr. rabat) · Sortowanie rosnąco · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 5/8 &middot; CENA EFEKTYWNA</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-3">{slide5Title}</h2>
                {barChartData.length > 0 ? (<>
                  <div className="flex-1 min-h-0" style={{ minHeight: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 70, top: 5, bottom: 5 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                        <ReTooltip content={({ active, payload }: any) => { if (!active || !payload?.length) return null; const ep = data.effectivePrices.find(e => e.brandName === payload[0].payload.name); return <div className="bg-card border rounded-lg shadow-lg p-2 text-xs"><p className="font-bold">{payload[0].payload.name}</p><p>Cena efektywna: {payload[0].value} zł/dzień</p>{ep && ep.discount > 0 && <p>Rabat: {ep.discount.toFixed(1)}% (kat. {fmtPrice(ep.catalogPrice)})</p>}</div> }} />
                        <Bar dataKey="price" radius={[0, 6, 6, 0]}>
                          {barChartData.map((entry, i) => <Cell key={i} fill={entry.isMy ? MY_BRAND_COLOR : COMPETITOR_COLOR} />)}
                          <LabelList dataKey="price" position="right" style={{ fontSize: 14, fontWeight: 700, fill: 'hsl(215,25%,16%)' }} formatter={(v: any) => `${v} zł`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg px-4 py-2.5 mt-auto">
                    <p className="text-xs text-foreground">{myEffective && cheapestEffective && myEffective.brandId === cheapestEffective.brandId ? <><strong>{myBrandName}</strong> najtańszy po rabatach.</> : effectiveGap != null && cheapestEffective ? <>Koszt efektywny {Math.round(myEffective!.effectivePrice)} zł jest o <strong>{effectiveGap.toFixed(1)}%</strong> wyższy niż {cheapestEffective.brandName} ({Math.round(cheapestEffective.effectivePrice)} zł). {myEffRating > cheapEffRating + 0.2 ? `Premia częściowo uzasadniona oceną (${myEffRating.toFixed(1)}\u2605 vs ${cheapEffRating.toFixed(1)}\u2605).` : myEffRating < cheapEffRating - 0.1 ? `Premia nieuzasadniona — nasza ocena niższa.` : `Oceny porównywalne — monitorować.`}</> : <>Brak danych.</>}</p>
                  </div>
                </>) : <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">Brak danych cenowych</p></div>}
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 6 — Voice of Customer ════════════════════════════════ */}
            <div data-slide="6" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 5)}>
              <SlideFrame index={5} methodology={`Źródło: zatwierdzone opinie · Delta = zmiana śr. oceny WoW · n<10 = mała próba · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 6/8 &middot; OPINIE</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-3">{slide6Title}</h2>
                <div className="flex gap-4 flex-1 min-h-0">
                  <div className="flex-1">
                    <Table>
                      <TableHeader><TableRow><TableHead>Marka</TableHead><TableHead className="text-right">Ocena</TableHead><TableHead className="text-right">Delta</TableHead><TableHead className="text-right">Opinii</TableHead></TableRow></TableHeader>
                      <TableBody>{reviewTableData.map(row => { const hasPrev = row.prevCount > 0; const delta = hasPrev ? row.avgRating - row.prevAvgRating : null; return (
                        <TableRow key={row.brandId} className={row.isMy ? 'bg-primary/5 font-semibold' : ''}>
                          <TableCell><div className="flex items-center gap-2"><BrandLogo url={row.brandLogo} name={row.brandName} />{row.brandName}</div></TableCell>
                          <TableCell className="text-right">{row.avgRating > 0 ? row.avgRating.toFixed(2) : '\u2014'}</TableCell>
                          <TableCell className="text-right">{delta != null ? <span className={delta > 0.05 ? 'text-green-600' : delta < -0.05 ? 'text-destructive' : 'text-muted-foreground'}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</span> : <span className="text-muted-foreground">\u2014</span>}</TableCell>
                          <TableCell className="text-right">{row.count}{row.count > 0 && row.count < 10 && <Badge variant="destructive" className="ml-1 text-[8px]">n&lt;10</Badge>}</TableCell>
                        </TableRow>
                      )})}</TableBody>
                    </Table>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {bestQuote ? <Card className="flex-1 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10"><CardContent className="pt-3 pb-3"><p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Najlepsza opinia</p><p className="text-xs italic text-foreground">&ldquo;{bestQuote.content?.slice(0, 120)}{(bestQuote.content?.length ?? 0) > 120 ? '...' : ''}&rdquo;</p><p className="text-[10px] text-muted-foreground mt-1">{bestQuote.rating}\u2605</p></CardContent></Card> : <Card className="flex-1"><CardContent className="pt-3 pb-3 flex items-center justify-center h-full"><p className="text-xs text-muted-foreground">Brak opinii 4\u2605+</p></CardContent></Card>}
                    {worstQuote ? <Card className="flex-1 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10"><CardContent className="pt-3 pb-3"><p className="text-[10px] font-semibold text-destructive uppercase tracking-wide mb-1">Najgorsza opinia</p><p className="text-xs italic text-foreground">&ldquo;{worstQuote.content?.slice(0, 120)}{(worstQuote.content?.length ?? 0) > 120 ? '...' : ''}&rdquo;</p><p className="text-[10px] text-muted-foreground mt-1">{worstQuote.rating}\u2605</p></CardContent></Card> : <Card className="flex-1"><CardContent className="pt-3 pb-3 flex items-center justify-center h-full"><p className="text-xs text-muted-foreground">Brak opinii 1-2\u2605</p></CardContent></Card>}
                  </div>
                </div>
                <div className="border-l-4 border-l-primary bg-primary/5 rounded-r-lg px-4 py-2.5 mt-auto">
                  <p className="text-xs text-foreground">{dominantTopic ? <>{dominantTopic[1]} z {myNegativeReviews.length} negatywnych opinii ({Math.round(dominantTopic[1] / myNegativeReviews.length * 100)}%) dotyczy tematu <strong>{topicLabels[dominantTopic[0]] || dominantTopic[0]}</strong>. {dominantTopic[1] / myNegativeReviews.length > 0.5 ? 'Jeden temat >50% — eskalacja.' : 'Monitorować.'}</> : myNegativeReviews.length === 0 ? <>Brak negatywnych opinii w tym tygodniu.</> : <>Brak dominującego tematu w negatywnych opiniach.</>}</p>
                </div>
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 7 — Competitor Moves ═════════════════════════════════ */}
            <div data-slide="7" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 6)}>
              <SlideFrame index={6} methodology={`Progi: zmiana cen >3% WoW · Nowe/zakończone promocje · Opinie >2\u00D7 śr. tyg. · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 7/8 &middot; KONKURENCJA</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-4">{slide7Title}</h2>
                {topEvents.length > 0 ? (
                  <div className="space-y-2">
                    {topEvents.map((event, i) => (
                      <div key={i} className="flex items-baseline gap-3 text-sm">
                        <span className="font-mono text-muted-foreground flex-shrink-0 text-xs" style={{ minWidth: 64 }}>{event.date.slice(5)}</span>
                        <span className="font-semibold text-foreground flex-shrink-0" style={{ minWidth: 110 }}>{event.brandName}</span>
                        <span className="text-muted-foreground">{event.description}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center"><div className="text-center"><CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" /><p className="text-sm font-medium text-muted-foreground">Żaden konkurent nie zmienił cen &gt;3% ani nie uruchomił nowych promocji.</p></div></div>
                )}
              </SlideFrame>
            </div>

            {/* ═══ SLIDE 8 — Recommendations ══════════════════════════════════ */}
            <div data-slide="8" className="bg-card rounded-xl ring-1 ring-foreground/10 overflow-hidden" style={slideStyle(currentSlide === 7)}>
              <SlideFrame index={7} methodology={`Reguły: premia >15% dwa tygodnie = decyzja cenowa · Jeden temat >50% neg. = eskalacja ops · Spike neg. u konkurenta = akcja akw. · ${weekRange}`}>
                <Badge variant="outline" className="w-fit text-[10px] font-mono tracking-widest mb-2">SLAJD 8/8 &middot; REKOMENDACJE</Badge>
                <h2 className="text-base font-semibold text-foreground leading-snug mb-4">{slide8Title}</h2>
                {data.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {data.recommendations.map((rec, i) => {
                      const bc: Record<string, string> = { high: 'border-l-destructive bg-destructive/5', medium: 'border-l-warning bg-warning/5', low: 'border-l-primary bg-primary/5' }
                      return (
                        <div key={i} className={`border-l-4 rounded-r-lg px-4 py-3 ${bc[rec.priority]}`}>
                          <p className="text-sm font-semibold text-foreground">{i + 1}. {rec.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{rec.text}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5">Właściciel: {rec.owner} &middot; Termin: {rec.deadline}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center"><div className="text-center"><CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" /><p className="text-sm font-semibold text-foreground">Utrzymać obecną strategię</p><p className="text-xs text-muted-foreground mt-1">Kontynuować monitoring. Brak pilnych działań.</p></div></div>
                )}
              </SlideFrame>
            </div>

          </div>

          <button onClick={goNext} disabled={currentSlide === TOTAL_SLIDES - 1} className="no-print absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all disabled:opacity-20 bg-card hover:bg-muted" style={{ right: 0 }}><ChevronRight className="h-5 w-5" /></button>
        </div>

        <div className="no-print flex justify-center gap-2.5 mt-5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => <button key={i} onClick={() => setCurrentSlide(i)} className={`rounded-full transition-all ${i === currentSlide ? 'w-3 h-3 bg-primary scale-110' : 'w-2.5 h-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'}`} />)}
        </div>
      </div>

      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Wyślij raport zarządczy emailem</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-1">
            <div className="space-y-2"><div className="flex items-center justify-between"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Użytkownicy systemu</Label><div className="flex gap-1"><button className="text-xs text-primary hover:underline" onClick={() => setEmailRecipients(new Set(emailUsers.filter(u => u.status === 'active').map(u => u.id)))}>Zaznacz aktywnych</button><span className="text-muted-foreground text-xs">&middot;</span><button className="text-xs text-muted-foreground hover:underline" onClick={() => setEmailRecipients(new Set())}>Wyczyść</button></div></div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto border rounded-md p-1">{emailUsers.filter(u => u.status === 'active' || u.status === 'trial').map(u => <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1.5 rounded"><input type="checkbox" checked={emailRecipients.has(u.id)} onChange={e => setEmailRecipients(prev => { const next = new Set(prev); e.target.checked ? next.add(u.id) : next.delete(u.id); return next })} className="rounded flex-shrink-0" /><span className="flex-1 min-w-0"><span className="font-medium truncate block">{u.full_name || u.email}</span>{u.full_name && <span className="text-xs text-muted-foreground">{u.email}</span>}</span></label>)}</div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dodatkowe emaile (jeden na linię)</Label><Textarea placeholder={"email@example.com\nkolejny@firma.pl"} value={emailExtraEmails} onChange={e => setEmailExtraEmails(e.target.value)} rows={3} className="text-sm" /></div>
            <div className="pt-1 border-t flex gap-2 justify-end"><Button variant="outline" onClick={() => setShowEmailModal(false)}>Anuluj</Button><Button onClick={handleSendEmail} disabled={sending}>{sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wysyłam...</> : <><Send className="h-4 w-4 mr-2" />Wyślij raport</>}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
