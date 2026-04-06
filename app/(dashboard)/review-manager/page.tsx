'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase/client'
import { useBrands } from '@/hooks/supabase/useBrands'
import { useReviewsStatistics } from '@/hooks/supabase/useReviewsStatistics'
import { useReviewAspects } from '@/hooks/supabase/useReviewAspects'
import { useMarketReviewAspects } from '@/hooks/supabase/useMarketReviewAspects'
import {
  Star, Bot, Copy, Check, Building2, RefreshCw, TrendingUp, TrendingDown, BarChart2, X, Settings,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'rm_brand_id'
const PAGE_SIZE = 30
const PIE_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']

const TOPIC_REGEXES: Record<string, RegExp> = {
  smak:    /smak|jedzeni|pyszn|smaczn|niesmaczn/i,
  dostawa: /dostaw|kurier|paczk|transport|opóźni/i,
  jakość:  /jakość|jakości|śwież|nieśwież/i,
  cena:    /cen|drogie|tanie|drogo|tanio/i,
  obsługa: /obsług|kontakt|support|klient/i,
  porcje:  /porcj|ilość|mało|dużo|wielkość/i,
}

const TOPIC_EMOJIS: Record<string, string> = {
  smak: '🍽️', dostawa: '🚚', jakość: '⭐', cena: '💰', obsługa: '🤝', porcje: '🍱',
}

const TOPIC_COLORS: Record<string, string> = {
  smak:    'bg-orange-100 text-orange-700',
  dostawa: 'bg-blue-100 text-blue-700',
  jakość:  'bg-purple-100 text-purple-700',
  cena:    'bg-yellow-100 text-yellow-700',
  obsługa: 'bg-green-100 text-green-700',
  porcje:  'bg-pink-100 text-pink-700',
}

const ASPECT_BAR_COLORS: Record<string, string> = {
  smak: '#f97316', dostawa: '#3b82f6', jakość: '#8b5cf6',
  cena: '#eab308', obsługa: '#22c55e', porcje: '#ec4899',
}

const TONE_LABELS: Record<Tone, string> = {
  professional: 'Profesjonalny', empathetic: 'Empatyczny', casual: 'Swobodny',
}

const TONE_PROMPTS: Record<Tone, string> = {
  professional: 'Ton: profesjonalny, rzeczowy, formalny.',
  empathetic:   'Ton: empatyczny, ciepły, rozumiejący.',
  casual:       'Ton: swobodny, przyjazny, nieformalny.',
}

const PL_MONTHS = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']
const PL_MONTHS_FULL = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień']

function detectTopics(text: string): string[] {
  if (!text) return []
  return Object.entries(TOPIC_REGEXES).filter(([, re]) => re.test(text)).map(([t]) => t)
}

function fmtDate(d: Date) {
  return `${d.getDate()} ${PL_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function groupByMonth(reviews: Array<{ rating: number; review_date: string }>) {
  const map: Record<string, number[]> = {}
  reviews.forEach(r => {
    if (!r.review_date) return
    const d = new Date(r.review_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map[key]) map[key] = []
    map[key].push(r.rating)
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, ratings]) => ({
      month,
      avg_rating: Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 100) / 100,
      count: ratings.length,
    }))
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Review = {
  id: string; author_name: string | null; content: string | null
  rating: number; review_date: string | null; source: string | null
  status: Status; priority: string | null
}
type ReviewResponse = { id: string; body: string; status: string; tone: string }
type Status = 'new' | 'draft' | 'done'
type Filter = 'all' | 'critical' | 'needs-response' | 'positive'
type Sort   = 'newest' | 'sla' | 'rating'
type Tone   = 'professional' | 'empathetic' | 'casual'
type ProgressData = {
  currentAvg: number; previousAvg: number
  currentCount: number; previousCount: number
  currentPosPct: number; previousPosPct: number
  currentNeg: number
  currentMonthLabel: string; previousMonthLabel: string
  currentPeriod: string; previousPeriod: string
}
type SourceStat = { source: string; count: number; avgRating: number; posPct: number }
type NotificationSettings = {
  email: string
  dailyEnabled: boolean; dailyHour: string
  weeklyEnabled: boolean; weeklyDay: string; weeklyHour: string
  alertEnabled: boolean; alertThreshold: string
}

const DEFAULT_NOTIF: NotificationSettings = {
  email: '', dailyEnabled: false, dailyHour: '7',
  weeklyEnabled: false, weeklyDay: '1', weeklyHour: '8',
  alertEnabled: false, alertThreshold: '3',
}

const WEEK_DAYS = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela']
const HOURS = ['6','7','8','9']

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3 w-3'
  return (
    <span className="flex gap-0.5 items-center">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${cls} ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
      ))}
    </span>
  )
}

function ReviewAvatar({ name, rating }: { name: string; rating: number }) {
  const bg = rating <= 2 ? 'bg-red-100 text-red-700' : rating === 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${bg}`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'done') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ zrobione</span>
  if (status === 'draft') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">draft</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">nowa</span>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold mb-1">{children}</h2>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewManagerPage() {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  const [brandId, setBrandId]       = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [userEmail, setUserEmail]   = useState<string | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Reviews list
  const [reviews, setReviews]               = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [hasMore, setHasMore]               = useState(false)
  const [offset, setOffset]                 = useState(0)
  const [filter, setFilter]                 = useState<Filter>('all')
  const [sort, setSort]                     = useState<Sort>('newest')

  // Selected review
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedReview = reviews.find(r => r.id === selectedId) ?? null

  // Responses from Supabase
  const [responses, setResponses]   = useState<Record<string, ReviewResponse>>({})
  const [userId, setUserId]         = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  // Composer
  const [tone, setTone]             = useState<Tone>('professional')
  const [aiResponse, setAiResponse] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)

  // Context panel
  const [similarReviews, setSimilarReviews]   = useState<Review[]>([])
  const [recentResponses, setRecentResponses] = useState<{ id: string; author: string; text: string }[]>([])

  // Analytics data
  const [progressData, setProgressData]     = useState<ProgressData | null>(null)
  const [trendData, setTrendData]           = useState<{ month: string; avg_rating: number }[]>([])
  const [sourceStats, setSourceStats]       = useState<SourceStat[]>([])
  const [aspectQuotes, setAspectQuotes]     = useState<Record<string, string>>({})
  const [analyticsSummary, setAnalyticsSummary] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Realtime unread
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIF)
  const [sendingTest, setSendingTest] = useState(false)

  // Hooks
  const { data: brands = [] }            = useBrands()
  const selectedBrand                    = brands.find(b => b.id === brandId)
  const isAdmin                          = userEmail === adminEmail
  const { data: stats }                  = useReviewsStatistics(brandId, 'all')
  const { data: aspects = [] }           = useReviewAspects(brandId || undefined)
  const { data: marketAspects = [] }     = useMarketReviewAspects()

  const avgRating    = stats?.overview?.averageRating || 0
  const positivePct  = stats?.overview?.positivePercentage || 0
  const totalReviews = stats?.overview?.totalReviews || 0

  // ── Debounce search ──
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery])

  const displayedReviews = debouncedSearch
    ? reviews.filter(r => {
        const q = debouncedSearch.toLowerCase()
        return (r.content || '').toLowerCase().includes(q) || (r.author_name || '').toLowerCase().includes(q)
      })
    : reviews

  // ── Init ──
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) setBrandId(saved)
    else setShowPicker(true)
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null)
      setUserId(data.user?.id || null)
    })
  }, [])

  // ── Load notification settings when brandId changes ──
  useEffect(() => {
    if (!brandId) return
    const raw = localStorage.getItem(`rm_notification_settings_${brandId}`)
    if (raw) {
      try { setNotifSettings({ ...DEFAULT_NOTIF, ...JSON.parse(raw) }) } catch { /* ignore */ }
    } else {
      setNotifSettings({ ...DEFAULT_NOTIF, email: userEmail || '' })
    }
  }, [brandId, userEmail])

  // ── Fetch progress + trend + sourceStats on brandId ──
  useEffect(() => {
    if (!brandId) return
    const now = new Date()
    const t12m = new Date(now); t12m.setMonth(t12m.getMonth() - 12)
    const today = now.toISOString().split('T')[0]
    const d12m = t12m.toISOString().split('T')[0]

    // Calendar month labels (for display only)
    const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0) // last day of prev month
    const currKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevKey = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, '0')}`

    // Single query for trend + progress (last 12 months)
    ;(supabase as any).from('reviews').select('rating, review_date')
      .eq('brand_id', brandId).eq('is_approved', true)
      .gte('review_date', d12m).order('review_date', { ascending: true })
      .then(({ data }: { data: any[] }) => {
        const rows = (data || []).map((r: any) => ({ rating: Number(r.rating), review_date: r.review_date as string }))

        // Trend chart — uses groupByMonth
        const grouped = groupByMonth(rows)
        setTrendData(grouped.map(g => ({ month: g.month.slice(2), avg_rating: g.avg_rating })))

        // Progress — derived from same raw data, same month-key logic as groupByMonth
        const calcMonth = (key: string) => {
          const monthRows = rows.filter(r => {
            if (!r.review_date) return false
            const d = new Date(r.review_date)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === key
          })
          if (!monthRows.length) return { avg: 0, count: 0, posPct: 0, neg: 0 }
          const avg = monthRows.reduce((s, r) => s + r.rating, 0) / monthRows.length
          const pos = monthRows.filter(r => r.rating >= 4).length
          const neg = monthRows.filter(r => r.rating <= 2).length
          return { avg, count: monthRows.length, posPct: (pos / monthRows.length) * 100, neg }
        }
        const c = calcMonth(currKey)
        const p = calcMonth(prevKey)
        setProgressData({
          currentAvg: c.avg, previousAvg: p.avg,
          currentCount: c.count, previousCount: p.count,
          currentPosPct: c.posPct, previousPosPct: p.posPct,
          currentNeg: c.neg,
          currentMonthLabel: PL_MONTHS_FULL[now.getMonth()],
          previousMonthLabel: PL_MONTHS_FULL[(now.getMonth() + 11) % 12],
          currentPeriod: `${fmtDate(currMonthStart)} – ${fmtDate(now)}`,
          previousPeriod: `${fmtDate(prevMonthStart)} – ${fmtDate(prevMonthEnd)}`,
        })
      })

    // Source stats
    ;(supabase as any).from('reviews').select('source, rating')
      .eq('brand_id', brandId).eq('is_approved', true)
      .then(({ data }: { data: any[] }) => {
        const map: Record<string, number[]> = {}
        for (const r of (data || [])) {
          const src = r.source || 'inne'
          if (!map[src]) map[src] = []
          map[src].push(Number(r.rating))
        }
        setSourceStats(Object.entries(map).map(([source, ratings]) => ({
          source,
          count: ratings.length,
          avgRating: Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 100) / 100,
          posPct: Math.round((ratings.filter(v => v >= 4).length / ratings.length) * 100),
        })).sort((a, b) => b.count - a.count))
      })

    // Aspect quotes
    ;(supabase as any).from('reviews').select('content').eq('brand_id', brandId).eq('is_approved', true)
      .not('content', 'is', null).limit(300)
      .then(({ data }: { data: any[] }) => {
        const quotes: Record<string, string> = {}
        for (const [aspect, re] of Object.entries(TOPIC_REGEXES)) {
          const match = (data || []).find((r: any) => r.content && re.test(r.content))
          if (match) {
            const sentences = (match.content as string).split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean)
            quotes[aspect] = sentences.find((s: string) => re.test(s)) || sentences[0] || ''
          }
        }
        setAspectQuotes(quotes)
      })
  }, [brandId])

  // ── Fetch reviews ──
  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }

  const fetchReviews = useCallback(async (bid: string, f: Filter, s: Sort, off: number, append = false) => {
    setReviewsLoading(true)
    let q = (supabase as any).from('reviews')
      .select('id, author_name, content, rating, review_date, source, status, priority')
      .eq('brand_id', bid).eq('is_approved', true)
    if (f === 'critical')            q = q.lte('rating', 2)
    else if (f === 'needs-response') q = q.eq('rating', 3)
    else if (f === 'positive')       q = q.gte('rating', 4)
    if (s === 'rating') q = q.order('rating', { ascending: true }).order('review_date', { ascending: false })
    else                q = q.order('review_date', { ascending: false })
    q = q.range(off, off + PAGE_SIZE - 1)
    const { data } = await q
    let rows: Review[] = data || []
    if (s === 'sla') {
      rows = [...rows].sort((a, b) =>
        (PRIORITY_ORDER[a.priority || 'low'] ?? 3) - (PRIORITY_ORDER[b.priority || 'low'] ?? 3)
      )
    }
    if (append) setReviews(prev => [...prev, ...rows])
    else setReviews(rows)
    setHasMore(rows.length === PAGE_SIZE)
    setReviewsLoading(false)
  }, [])

  useEffect(() => {
    if (!brandId) return
    setOffset(0); setSelectedId(null); setAiResponse('')
    fetchReviews(brandId, filter, sort, 0)
  }, [brandId, filter, sort, fetchReviews])

  // ── Load similar reviews ──
  useEffect(() => {
    if (!selectedReview) { setSimilarReviews([]); return }
    const topics = detectTopics(selectedReview.content || '')
    setSimilarReviews(reviews.filter(r => r.id !== selectedReview.id && detectTopics(r.content || '').some(t => topics.includes(t))).slice(0, 3))
  }, [selectedId, reviews, selectedReview])

  // ── Load response from Supabase when review selected ──
  useEffect(() => {
    if (!selectedId) { setAiResponse(''); return }
    const cached = responses[selectedId]
    if (cached) { setAiResponse(cached.body); setTone((cached.tone as Tone) || 'professional'); return }
    ;(supabase as any).from('review_responses')
      .select('id, body, status, tone')
      .eq('review_id', selectedId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: { data: ReviewResponse[] }) => {
        if (data?.[0]) {
          setResponses(prev => ({ ...prev, [selectedId]: data[0] }))
          setAiResponse(data[0].body)
          setTone((data[0].tone as Tone) || 'professional')
        } else {
          setAiResponse('')
        }
      })
  }, [selectedId])

  // ── Recent AI responses (from responses state) ──
  useEffect(() => {
    const recent = Object.entries(responses)
      .filter(([, r]) => r.body)
      .slice(-3)
      .reverse()
      .map(([reviewId, r]) => ({
        id: reviewId,
        author: reviews.find(rv => rv.id === reviewId)?.author_name || 'Anonim',
        text: r.body,
      }))
    setRecentResponses(recent)
  }, [responses, reviews])

  // ── Realtime: new reviews ──
  useEffect(() => {
    if (!brandId) return
    const channel = supabase
      .channel('new-reviews-' + brandId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reviews',
        filter: `brand_id=eq.${brandId}`,
      }, (payload: any) => {
        const review = payload.new
        if (review.rating <= 3) {
          toast.error(`🚨 Nowa negatywna opinia (${review.rating}★) od ${review.author_name}`)
          setReviews(prev => [{ ...review, status: review.status || 'new' } as Review, ...prev])
          setUnreadCount(prev => prev + 1)
          setUnreadIds(prev => new Set([...prev, review.id]))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [brandId])

  // ── Settings helpers ──
  const saveNotifSettings = (patch?: Partial<NotificationSettings>) => {
    const updated = patch ? { ...notifSettings, ...patch } : notifSettings
    if (patch) setNotifSettings(updated)
    if (brandId) localStorage.setItem(`rm_notification_settings_${brandId}`, JSON.stringify(updated))
    toast.success('Ustawienia zapisane')
  }

  const sendTestReport = async () => {
    if (!brandId) return
    setSendingTest(true)
    try {
      const res = await fetch('/api/send-test-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, brandName: selectedBrand?.name, email: notifSettings.email || userEmail }),
      })
      if (res.ok) toast.success('Testowy email wysłany!')
      else toast.error('Błąd wysyłki testowego emaila')
    } catch {
      toast.error('Błąd wysyłki testowego emaila')
    } finally {
      setSendingTest(false)
    }
  }

  // ── Helpers ──
  const setStatus = async (id: string, status: Status) => {
    await (supabase as any).from('reviews').update({ status }).eq('id', id)
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const publishResponse = async (reviewId: string) => {
    const resp = responses[reviewId]
    if (!resp) return
    setPublishing(true)
    await (supabase as any).from('review_responses')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', resp.id)
    setResponses(prev => ({ ...prev, [reviewId]: { ...resp, status: 'published' } }))
    await setStatus(reviewId, 'done')
    setPublishing(false)
  }

  const loadMore = () => {
    if (!brandId) return
    const next = offset + PAGE_SIZE; setOffset(next)
    fetchReviews(brandId, filter, sort, next, true)
  }

  // ── Generate AI response ──
  const generateAI = async () => {
    if (!selectedReview?.content) return
    setGenerating(true)
    try {
      const topics = detectTopics(selectedReview.content)
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', max_tokens: 500,
          messages: [
            { role: 'system', content: `Jesteś customer success managerem marki ${selectedBrand?.name || 'naszej firmy'}. ${TONE_PROMPTS[tone]} Zasady: używaj imienia klienta, max 4096 znaków, jeśli negatywna: empatia→zrozumienie→rozwiązanie→zaproszenie do kontaktu, jeśli pozytywna: podziękowanie→personalizacja→CTA. Nigdy nie pisz że jesteś AI. Język: polski.` },
            { role: 'user', content: `Autor: ${selectedReview.author_name || 'Klient'}\nOcena: ${selectedReview.rating}/5\nTreść: ${selectedReview.content}\nWykryte tematy: ${topics.join(', ') || 'brak'}` },
          ],
        }),
      })
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || 'Błąd generowania.'
      setAiResponse(text)
      // Save to Supabase review_responses
      const existing = responses[selectedReview.id]
      let saved: ReviewResponse | null = null
      if (existing?.id) {
        const { data: upd } = await (supabase as any).from('review_responses')
          .update({ body: text, tone, status: 'draft' })
          .eq('id', existing.id)
          .select('id, body, status, tone').single()
        saved = upd
      } else {
        const { data: ins } = await (supabase as any).from('review_responses')
          .insert({ review_id: selectedReview.id, brand_id: brandId, body: text, tone, source: 'ai_generated', status: 'draft', created_by: userId })
          .select('id, body, status, tone').single()
        saved = ins
      }
      if (saved) setResponses(prev => ({ ...prev, [selectedReview.id]: saved! }))
      await setStatus(selectedReview.id, 'draft')
    } catch { setAiResponse('Błąd generowania.') }
    finally { setGenerating(false) }
  }

  // ── Generate AI analytics summary ──
  const generateAnalyticsSummary = async () => {
    if (!progressData) return
    setGeneratingSummary(true)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', max_tokens: 200,
          messages: [
            { role: 'system', content: 'Jesteś analitykiem customer experience. Na podstawie danych napisz krótkie (2-3 zdania) podsumowanie po polsku. Bądź konkretny, wskaż trendy i rekomendacje.' },
            { role: 'user', content: `Dane marki ${selectedBrand?.name}:\nŚrednia ocena: ${progressData.previousAvg.toFixed(2)} → ${progressData.currentAvg.toFixed(2)}\nLiczba opinii: ${progressData.previousCount} → ${progressData.currentCount}\n% pozytywnych: ${progressData.previousPosPct.toFixed(0)}% → ${progressData.currentPosPct.toFixed(0)}%\nNegatywne bez odpowiedzi: ${progressData.currentNeg}` },
          ],
        }),
      })
      const data = await res.json()
      setAnalyticsSummary(data.choices?.[0]?.message?.content || '')
    } catch { setAnalyticsSummary('Błąd generowania podsumowania.') }
    finally { setGeneratingSummary(false) }
  }

  const copyResponse = () => {
    navigator.clipboard.writeText(aiResponse)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // ── Brand picker ──
  if (showPicker) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><Building2 className="h-5 w-5" /> Wybierz markę</h2>
            <div className="space-y-2">
              {brands.map(b => (
                <button key={b.id} onClick={() => { setBrandId(b.id); localStorage.setItem(LS_KEY, b.id); setShowPicker(false) }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border hover:bg-accent transition-colors text-left">
                  {b.logo_url && <img src={b.logo_url} alt={b.name} className="h-8 w-8 object-contain rounded" />}
                  <span className="font-medium">{b.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const topics = detectTopics(selectedReview?.content || '')
  const radarData = aspects.map(a => {
    const market = (marketAspects as any[]).find(m => m.aspect === a.aspect)
    return { aspect: a.aspect, marka: a.positive, rynek: market?.positive || 0 }
  })

  // ── Settings view ──
  const settingsView = (
    <div className="max-w-xl mx-auto space-y-6 py-2">
      <div>
        <h1 className="text-xl font-bold">Ustawienia powiadomień</h1>
        <p className="text-sm text-muted-foreground">Skonfiguruj raporty email dla marki {selectedBrand?.name}</p>
      </div>

      {/* S1: Email */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <p className="text-sm font-semibold">Adres email do raportów</p>
          <input
            type="email"
            value={notifSettings.email}
            onChange={e => setNotifSettings(s => ({ ...s, email: e.target.value }))}
            placeholder="twoj@email.pl"
            className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Raporty będą wysyłane na ten adres</p>
          <Button size="sm" onClick={() => saveNotifSettings()}>Zapisz</Button>
        </CardContent>
      </Card>

      {/* S2: Daily */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Raport dzienny</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={notifSettings.dailyEnabled}
                onChange={e => setNotifSettings(s => ({ ...s, dailyEnabled: e.target.checked }))} />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          {notifSettings.dailyEnabled && (
            <div className="space-y-2">
              <select value={notifSettings.dailyHour}
                onChange={e => setNotifSettings(s => ({ ...s, dailyHour: e.target.value }))}
                className="px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Będziesz otrzymywać raport codziennie o {notifSettings.dailyHour}:00</p>
            </div>
          )}
          <Button size="sm" onClick={() => saveNotifSettings()}>Zapisz</Button>
        </CardContent>
      </Card>

      {/* S3: Weekly */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Raport tygodniowy</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={notifSettings.weeklyEnabled}
                onChange={e => setNotifSettings(s => ({ ...s, weeklyEnabled: e.target.checked }))} />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          {notifSettings.weeklyEnabled && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={notifSettings.weeklyDay}
                  onChange={e => setNotifSettings(s => ({ ...s, weeklyDay: e.target.value }))}
                  className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                  {WEEK_DAYS.map((d, i) => <option key={i} value={String(i + 1)}>{d}</option>)}
                </select>
                <select value={notifSettings.weeklyHour}
                  onChange={e => setNotifSettings(s => ({ ...s, weeklyHour: e.target.value }))}
                  className="px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                  {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Będziesz otrzymywać raport w każdy {WEEK_DAYS[Number(notifSettings.weeklyDay) - 1]} o {notifSettings.weeklyHour}:00
              </p>
            </div>
          )}
          <Button size="sm" onClick={() => saveNotifSettings()}>Zapisz</Button>
        </CardContent>
      </Card>

      {/* S4: Alert */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Alert: nowa negatywna opinia</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={notifSettings.alertEnabled}
                onChange={e => setNotifSettings(s => ({ ...s, alertEnabled: e.target.checked }))} />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
          {notifSettings.alertEnabled && (
            <div className="space-y-2">
              <select value={notifSettings.alertThreshold}
                onChange={e => setNotifSettings(s => ({ ...s, alertThreshold: e.target.value }))}
                className="px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="2">1★ i 2★</option>
                <option value="3">1★, 2★ i 3★</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Otrzymasz email gdy pojawi się opinia 1–{notifSettings.alertThreshold}★
              </p>
            </div>
          )}
          <Button size="sm" onClick={() => saveNotifSettings()}>Zapisz</Button>
        </CardContent>
      </Card>

      {/* S5: Test */}
      <Card className="bg-muted/30">
        <CardContent className="pt-5 pb-5 space-y-3">
          <p className="text-sm font-semibold">Testowy email</p>
          <p className="text-xs text-muted-foreground">Wyślij testowy raport na {notifSettings.email || userEmail || '—'} aby sprawdzić wygląd.</p>
          <Button size="sm" variant="outline" onClick={sendTestReport} disabled={sendingTest}>
            {sendingTest ? <><RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />Wysyłam…</> : 'Wyślij testowy raport teraz'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  // ── Analytics view ──
  const analyticsView = (
    <div className="max-w-3xl mx-auto space-y-8 py-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pełna analityka marki {selectedBrand?.name}</h1>
          <p className="text-sm text-muted-foreground">Kompleksowy przegląd opinii i trendów</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAnalytics(false)}>← Wróć do opinii</Button>
      </div>

      {/* BLOK 1: Oceny w czasie */}
      <section>
        <SectionTitle>📈 Oceny w czasie — czy klienci są coraz bardziej zadowoleni?</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">Wykres pokazuje jak zmieniała się średnia ocena klientów w ciągu ostatniego roku. Linia przerywana = średnia rynkowa (4.0).</p>
        <Card>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: 'Miesiąc', position: 'insideBottomRight', offset: -5, fontSize: 11 }} />
                <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 11 }} label={{ value: 'Średnia ocena (1-5)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg_rating" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Twoja marka" />
                <Line dataKey={() => 4} stroke="#9ca3af" strokeDasharray="5 3" strokeWidth={1} dot={false} name="Średnia rynkowa" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* BLOK 2: Źródła */}
      <section>
        <SectionTitle>🔍 Skąd pochodzą opinie naszych klientów?</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sourceStats} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80}
                    label={(props: any) => `${props.source} ${((props.percent || 0) * 100).toFixed(0)}%`}>
                    {sourceStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Źródło</th>
                    <th className="text-right py-1.5 font-medium">Opinii</th>
                    <th className="text-right py-1.5 font-medium">Avg ★</th>
                    <th className="text-right py-1.5 font-medium">% Pozyt.</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStats.map(s => (
                    <tr key={s.source} className="border-b last:border-0">
                      <td className="py-2 font-medium">{s.source}</td>
                      <td className="py-2 text-right">{s.count}</td>
                      <td className="py-2 text-right">{s.avgRating.toFixed(1)}</td>
                      <td className="py-2 text-right">
                        <span className={s.posPct >= 70 ? 'text-green-600 font-semibold' : s.posPct >= 50 ? 'text-yellow-600' : 'text-red-500'}>
                          {s.posPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BLOK 3: Aspekty */}
      <section>
        <SectionTitle>💬 Co klienci chwalą, a co krytykują?</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {aspects.map(a => {
            const market = (marketAspects as any[]).find(m => m.aspect === a.aspect)
            const diff = market ? a.positive - market.positive : null
            const barColor = ASPECT_BAR_COLORS[a.aspect] || '#6366f1'
            return (
              <Card key={a.aspect}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-lg">{TOPIC_EMOJIS[a.aspect] || '📊'}</span>
                    <span className="text-sm font-semibold capitalize">{a.aspect}</span>
                  </div>
                  <p className="text-3xl font-black tabular-nums mb-1" style={{ color: barColor }}>{a.positive}%</p>
                  <Progress value={a.positive} className="h-2 mb-2" />
                  <p className="text-[10px] text-muted-foreground mb-2">{a.mentions} wzmianek w opiniach</p>
                  {diff !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-2 ${
                      diff > 0 ? 'bg-green-100 text-green-700' : diff < 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : diff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                      {diff > 0 ? `+${diff}% lepiej niż rynek` : diff < 0 ? `${diff}% gorzej niż rynek` : 'Na poziomie rynku'}
                    </span>
                  )}
                  {aspectQuotes[a.aspect] && (
                    <p className="text-[10px] text-muted-foreground italic leading-snug border-t pt-2 line-clamp-2">
                      „{aspectQuotes[a.aspect]}"
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* BLOK 4: Radar vs Rynek */}
      <section>
        <SectionTitle>🎯 Twoja marka vs Rynek — porównanie 6 wymiarów</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="aspect" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                  <Radar name={selectedBrand?.name || 'Marka'} dataKey="marka" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                  <Radar name="Rynek" dataKey="rynek" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.2} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Parametr</th>
                    <th className="text-right py-1.5 font-medium">Twoja</th>
                    <th className="text-right py-1.5 font-medium">Rynek</th>
                    <th className="text-right py-1.5 font-medium">Różnica</th>
                    <th className="text-right py-1.5 font-medium">Ocena</th>
                  </tr>
                </thead>
                <tbody>
                  {radarData.map(row => {
                    const diff = row.marka - row.rynek
                    const label = diff > 3 ? 'Przewaga' : diff < -3 ? 'Poniżej rynku' : 'Na poziomie'
                    const cls = diff > 3 ? 'text-green-600' : diff < -3 ? 'text-red-500' : 'text-gray-500'
                    return (
                      <tr key={row.aspect} className="border-b last:border-0">
                        <td className="py-2 capitalize">{row.aspect}</td>
                        <td className="py-2 text-right font-medium">{row.marka}%</td>
                        <td className="py-2 text-right text-muted-foreground">{row.rynek}%</td>
                        <td className="py-2 text-right">
                          <span className={`font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {diff > 0 ? '+' : ''}{diff}%
                          </span>
                        </td>
                        <td className={`py-2 text-right text-[10px] font-semibold ${cls}`}>{label}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BLOK 5: Progress */}
      {progressData && (() => {
        const avgDiff = progressData.currentAvg - progressData.previousAvg
        const countDiff = progressData.currentCount - progressData.previousCount
        const countDiffPct = progressData.previousCount > 0
          ? Math.round((countDiff / progressData.previousCount) * 100)
          : 0
        const posDiff = progressData.currentPosPct - progressData.previousPosPct

        return (
          <section>
            <SectionTitle>📊 Czy się poprawiamy? {progressData.previousMonthLabel} vs {progressData.currentMonthLabel}</SectionTitle>
            <p className="text-xs text-muted-foreground mb-4">
              <span className="font-medium">{progressData.previousPeriod}</span>
              {' '}vs{' '}
              <span className="font-medium">{progressData.currentPeriod}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                {
                  label: 'Średnia ocena',
                  desc: 'Jak zmieniła się satysfakcja klientów?',
                  prev: progressData.previousAvg.toFixed(2),
                  curr: progressData.currentAvg.toFixed(2),
                  diff: avgDiff, badge: (avgDiff > 0 ? '+' : '') + avgDiff.toFixed(2),
                  note: null,
                },
                {
                  label: 'Liczba opinii',
                  desc: 'Czy klienci częściej dzielą się opinią?',
                  prev: String(progressData.previousCount),
                  curr: String(progressData.currentCount),
                  diff: countDiffPct, badge: (countDiffPct > 0 ? '+' : '') + countDiffPct + '%',
                  note: 'Miesiąc jeszcze trwa — niepełne dane',
                },
                {
                  label: '% pozytywnych',
                  desc: 'Jaki odsetek klientów poleca markę?',
                  prev: progressData.previousPosPct.toFixed(0) + '%',
                  curr: progressData.currentPosPct.toFixed(0) + '%',
                  diff: posDiff, badge: (posDiff > 0 ? '+' : '') + posDiff.toFixed(0) + 'pp',
                  note: 'Miesiąc jeszcze trwa — niepełne dane',
                },
                {
                  label: 'Negatywne bez odpowiedzi',
                  desc: 'Ile krytycznych opinii czeka na reakcję?',
                  prev: '—',
                  curr: String(progressData.currentNeg),
                  diff: -progressData.currentNeg,
                  badge: progressData.currentNeg === 0 ? '✓ Brak' : `${progressData.currentNeg} oczekuje`,
                  note: null,
                },
              ].map(m => (
                <Card key={m.label}>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs font-semibold mb-0.5">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground mb-2 leading-tight">{m.desc}</p>
                    <div className="flex items-center gap-1.5">
                      {m.prev !== '—' && <span className="text-xs text-muted-foreground">{m.prev} →</span>}
                      <span className="text-lg font-bold">{m.curr}</span>
                    </div>
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 ${
                      m.diff > 0 ? 'bg-green-100 text-green-700' : m.diff < 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : m.diff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                      {m.badge}
                    </span>
                    {m.note && <p className="text-[10px] text-muted-foreground mt-1 italic">{m.note}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI summary */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">Na podstawie danych z {progressData.currentMonthLabel}:</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={generateAnalyticsSummary} disabled={generatingSummary}>
                    {generatingSummary ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Generuję…</> : <><Bot className="h-3 w-3 mr-1" />Generuj AI</>}
                  </Button>
                </div>
                {analyticsSummary
                  ? <p className="text-sm leading-relaxed">{analyticsSummary}</p>
                  : <p className="text-xs text-muted-foreground italic">Kliknij "Generuj AI" aby otrzymać podsumowanie.</p>
                }
              </CardContent>
            </Card>
          </section>
        )
      })()}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

      {/* ════ LEFT PANEL ════ */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col bg-background overflow-hidden">

        {/* Brand header */}
        <div className="p-4 border-b flex items-center gap-3 flex-shrink-0">
          {selectedBrand?.logo_url && (
            <img src={selectedBrand.logo_url} alt={selectedBrand.name} className="h-8 w-8 object-contain rounded flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm truncate">{selectedBrand?.name || '—'}</p>
              {unreadCount > 0 && (
                <span className="flex-shrink-0 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{reviews.length} opinii</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowPicker(true)} className="text-xs text-primary hover:underline flex-shrink-0">Zmień</button>
          )}
        </div>

        {/* Filters */}
        <div className="p-3 border-b flex-shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-1">
            {([
              ['all', 'Wszystkie'], ['critical', 'Krytyczne 1-2★'],
              ['needs-response', '3★'], ['positive', 'Pozytywne'],
            ] as [Filter, string][]).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-1.5 text-xs rounded-md transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([['newest', 'Najnowsze'], ['rating', 'Rating'], ['sla', 'SLA']] as [Sort, string][]).map(([s, label]) => (
              <button key={s} onClick={() => setSort(s)}
                className={`flex-1 px-2 py-1 text-[11px] rounded transition-colors ${sort === s ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Szukaj w opiniach..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-md border bg-background pr-7 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {debouncedSearch && (
            <p className="text-[10px] text-muted-foreground mt-1">{displayedReviews.length} wyników</p>
          )}
        </div>

        {/* Review list */}
        <div className="flex-1 overflow-y-auto">
          {reviewsLoading && reviews.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Ładowanie…</div>
          )}
          {displayedReviews.map(r => (
            <button key={r.id} onClick={() => {
              setSelectedId(r.id); setShowAnalytics(false); setShowSettings(false)
              if (unreadIds.has(r.id)) {
                setUnreadCount(prev => Math.max(0, prev - 1))
                setUnreadIds(prev => { const s = new Set(prev); s.delete(r.id); return s })
              }
            }}
              className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${selectedId === r.id && !showAnalytics ? 'bg-accent' : ''} ${unreadIds.has(r.id) ? 'bg-red-50/60' : ''}`}>
              <div className="flex items-start gap-2">
                <ReviewAvatar name={r.author_name || '?'} rating={r.rating} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-medium truncate">{r.author_name || 'Anonim'}</span>
                      {unreadIds.has(r.id) && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-red-500" />}
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {r.review_date ? new Date(r.review_date).toLocaleDateString('pl-PL') : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
                    {(r.content || '').slice(0, 60)}{(r.content || '').length > 60 ? '…' : ''}
                  </p>
                  <div className="mt-1.5"><StatusBadge status={r.status || 'new'} /></div>
                </div>
              </div>
            </button>
          ))}
          {hasMore && (
            <button onClick={loadMore} disabled={reviewsLoading}
              className="w-full py-3 text-xs text-primary hover:bg-accent transition-colors border-t">
              {reviewsLoading ? 'Ładowanie…' : 'Załaduj więcej'}
            </button>
          )}
        </div>

        {/* Analytics + Settings buttons */}
        <div className="p-3 border-t flex-shrink-0 space-y-1.5">
          <button
            onClick={() => { setShowAnalytics(v => !v); setShowSettings(false); setSelectedId(null) }}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              showAnalytics ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            📊 Pełna analityka
          </button>
          <button
            onClick={() => { setShowSettings(v => !v); setShowAnalytics(false); setSelectedId(null) }}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showSettings ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            <Settings className="h-4 w-4" />
            Ustawienia
          </button>
        </div>
      </div>

      {/* ════ MIDDLE PANEL ════ */}
      <div className="flex-1 overflow-y-auto p-6 bg-background">
        {showSettings ? settingsView : showAnalytics ? analyticsView : !selectedReview ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Star className="h-14 w-14 mx-auto mb-3 opacity-15" />
              <p className="text-sm">Wybierz opinię z listy</p>
              <p className="text-xs mt-1 opacity-60">lub kliknij "📊 Pełna analityka"</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <ReviewAvatar name={selectedReview.author_name || '?'} rating={selectedReview.rating} />
              <div>
                <p className="font-semibold">{selectedReview.author_name || 'Anonim'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <Stars rating={selectedReview.rating} size="lg" />
                  <span className="text-sm text-muted-foreground">
                    {selectedReview.review_date ? new Date(selectedReview.review_date).toLocaleDateString('pl-PL') : '—'}
                  </span>
                  <Badge variant="outline" className="text-xs">{selectedReview.source || 'inne'}</Badge>
                  {selectedReview.rating <= 2 && <Badge className="bg-red-500 hover:bg-red-500 text-white text-xs">Krytyczna</Badge>}
                  {selectedReview.rating === 3 && <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white text-xs">Wymaga uwagi</Badge>}
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm leading-relaxed">{selectedReview.content || '(brak treści)'}</p>
              </CardContent>
            </Card>

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground font-medium">Wykryte tematy:</span>
                {topics.map(t => (
                  <span key={t} className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TOPIC_COLORS[t] || 'bg-gray-100 text-gray-600'}`}>{t}</span>
                ))}
              </div>
            )}

            <hr />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Odpowiedź</p>
                <div className="flex gap-1">
                  {(['professional', 'empathetic', 'casual'] as Tone[]).map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${tone === t ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
                      {TONE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={generateAI} disabled={generating || !selectedReview.content}>
                {generating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generuję…</> : <><Bot className="h-4 w-4 mr-2" />Generuj odpowiedź AI</>}
              </Button>

              <div className="space-y-1.5">
                <textarea
                  className="w-full text-sm border rounded-lg p-3 min-h-[150px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Tu pojawi się wygenerowana odpowiedź…"
                  value={aiResponse}
                  onChange={e => {
                    setAiResponse(e.target.value)
                    if (responses[selectedReview.id]) {
                      setResponses(prev => ({ ...prev, [selectedReview.id]: { ...prev[selectedReview.id], body: e.target.value } }))
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${aiResponse.length > 4096 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                    {aiResponse.length} / 4096 znaków
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyResponse} disabled={!aiResponse}>
                      {copied ? <><Check className="h-3.5 w-3.5 mr-1" />Skopiowano</> : <><Copy className="h-3.5 w-3.5 mr-1" />Kopiuj</>}
                    </Button>
                    {responses[selectedReview.id]?.status === 'published' ? (
                      <span className="text-xs text-green-600 font-medium px-2">✓ Opublikowano</span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => publishResponse(selectedReview.id)} disabled={publishing || !responses[selectedReview.id]}>
                        {publishing ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        Opublikuj
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setStatus(selectedReview.id, 'done')} disabled={selectedReview.status === 'done'}>
                      {selectedReview.status === 'done' ? '✓ Zrobione' : 'Oznacz jako zrobione'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════ RIGHT PANEL ════ */}
      <div className="w-72 flex-shrink-0 border-l overflow-y-auto p-4 bg-muted/30">

        {/* Brand stats */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Statystyki marki</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-background rounded-lg p-2 border">
              <p className="text-lg font-bold tabular-nums">{avgRating.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Avg ★</p>
            </div>
            <div className="bg-background rounded-lg p-2 border">
              <p className="text-lg font-bold tabular-nums">{totalReviews}</p>
              <p className="text-[10px] text-muted-foreground">Opinii</p>
            </div>
            <div className="bg-background rounded-lg p-2 border">
              <p className="text-lg font-bold tabular-nums text-green-600">{positivePct.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">Pozyt.</p>
            </div>
          </div>
        </div>

        {/* Similar reviews */}
        {similarReviews.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Podobne opinie</p>
            <div className="space-y-2">
              {similarReviews.map(r => (
                <button key={r.id} onClick={() => setSelectedId(r.id)}
                  className="w-full text-left bg-background rounded-lg p-3 border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Stars rating={r.rating} />
                    <span className="text-[10px] text-muted-foreground truncate">{r.author_name || 'Anonim'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">
                    {(r.content || '').slice(0, 80)}{(r.content || '').length > 80 ? '…' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent AI responses */}
        {recentResponses.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ostatnie odpowiedzi AI</p>
            <div className="space-y-2">
              {recentResponses.map(r => (
                <div key={r.id} className="bg-background rounded-lg p-3 border">
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium">{r.author}</p>
                  <p className="text-xs leading-tight line-clamp-3 text-muted-foreground">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Radar */}
        {aspects.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Radar — parametry marki</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="aspect" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                <Radar name="Twoja marka" dataKey="marka" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                <Radar name="Rynek" dataKey="rynek" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-1">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />Twoja marka
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-gray-400" />Rynek
              </span>
            </div>
          </div>
        )}

        {/* Progress */}
        {progressData && (() => {
          const avgDiff = progressData.currentAvg - progressData.previousAvg
          const countDiff = progressData.currentCount - progressData.previousCount
          const posDiff = progressData.currentPosPct - progressData.previousPosPct
          const summary = Math.abs(avgDiff) < 0.05
            ? '➡️ Stabilna sytuacja. Kontynuuj dotychczasowe działania.'
            : avgDiff > 0
            ? `✅ Dobry trend! Średnia ocena wzrosła o ${avgDiff.toFixed(2)} pkt.`
            : `⚠️ Średnia ocena spadła o ${Math.abs(avgDiff).toFixed(2)} pkt. Sprawdź negatywne opinie.`

          return (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Czy się poprawiamy?</p>
              <p className="text-[10px] text-muted-foreground mb-1">{progressData.previousMonthLabel} vs {progressData.currentMonthLabel}</p>
              <p className="text-[10px] text-muted-foreground mb-3 italic">{progressData.currentPeriod}</p>
              <div className="space-y-2 mb-3">
                {[
                  { label: 'Średnia ocena', prevVal: progressData.previousAvg.toFixed(2), currVal: progressData.currentAvg.toFixed(2), diff: avgDiff, badge: (avgDiff > 0 ? '+' : '') + avgDiff.toFixed(2), note: null },
                  { label: 'Liczba opinii', prevVal: String(progressData.previousCount), currVal: String(progressData.currentCount), diff: countDiff, badge: (countDiff > 0 ? '+' : '') + String(countDiff), note: 'Miesiąc jeszcze trwa — niepełne dane' },
                  { label: '% pozytywnych', prevVal: progressData.previousPosPct.toFixed(0) + '%', currVal: progressData.currentPosPct.toFixed(0) + '%', diff: posDiff, badge: (posDiff > 0 ? '+' : '') + posDiff.toFixed(0) + '%', note: 'Miesiąc jeszcze trwa — niepełne dane' },
                ].map(m => (
                  <div key={m.label} className="bg-background rounded-lg p-2.5 border">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1.5">{m.label}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">{m.prevVal} ({progressData.previousMonthLabel})</span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <span className="text-sm font-bold">{m.currVal} ({progressData.currentMonthLabel})</span>
                    </div>
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      m.diff > 0.001 ? 'bg-green-100 text-green-700' : m.diff < -0.001 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.diff > 0.001 ? <TrendingUp className="h-2.5 w-2.5" /> : m.diff < -0.001 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                      {m.badge} vs {progressData.previousMonthLabel}
                    </span>
                    {m.note && <p className="text-[10px] text-muted-foreground mt-1 italic">{m.note}</p>}
                  </div>
                ))}
                <div className="bg-background rounded-lg p-2.5 border">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Czas odpowiedzi</p>
                  <p className="text-xs text-muted-foreground italic">Brak danych</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground bg-muted/50 rounded-lg p-2.5 border">{summary}</p>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
