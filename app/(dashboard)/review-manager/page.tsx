'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase/client'
import { useBrands } from '@/hooks/supabase/useBrands'
import { useReviewsStatistics } from '@/hooks/supabase/useReviewsStatistics'
import { useReviewAspects } from '@/hooks/supabase/useReviewAspects'
import { useMarketReviewAspects } from '@/hooks/supabase/useMarketReviewAspects'
import {
  Star, Bot, Copy, AlertTriangle, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Building2, RefreshCw, CheckCircle2,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'rm_brand_id'
const ASPECT_KEYWORDS: Record<string, string[]> = {
  smak: ['smak', 'smaczn', 'pyszn', 'smaczne', 'pyszne'],
  jakość: ['jakość', 'jakości', 'quality'],
  dostawa: ['dostaw', 'kurier', 'przesyłk', 'transport'],
  cena: ['cen', 'drogie', 'tanie', 'drogo', 'tanio'],
  obsługa: ['obsług', 'kontakt', 'support', 'klient'],
  porcje: ['porcj', 'ilość', 'portion', 'wielkość'],
}
const ALERT_KEYWORDS = [
  'dostawa', 'opóźnienie', 'zimne', 'nieświeże', 'zbyt mało', 'za drogo',
  'brak', 'nie dotarło', 'obsługa', 'reklamacja',
]
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
const STAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']

function extractProblems(content: string): string[] {
  return ALERT_KEYWORDS.filter(kw => content.toLowerCase().includes(kw))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
      ))}
    </span>
  )
}

function HealthBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'
  const label = score >= 70 ? 'Dobry' : score >= 50 ? 'Przeciętny' : 'Wymaga uwagi'
  return (
    <div className="flex flex-col items-center">
      <span className={`text-5xl font-black tabular-nums ${color}`}>{score}</span>
      <span className="text-xs text-muted-foreground leading-none">/100 · {label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewManagerPage() {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  // Brand selection
  const [brandId, setBrandId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Alert centrum state
  const [alertReviews, setAlertReviews] = useState<any[]>([])
  const [alertLoading, setAlertLoading] = useState(false)

  // Trend state
  const [trendData, setTrendData] = useState<{ month: string; avg_rating: number }[]>([])

  // AI state
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({})

  // Expanded aspect citations
  const [expandedAspect, setExpandedAspect] = useState<string | null>(null)
  const [aspectCitations, setAspectCitations] = useState<Record<string, string[]>>({})

  // Brands
  const { data: brands = [] } = useBrands()
  const selectedBrand = brands.find(b => b.id === brandId)
  const isAdmin = userEmail === adminEmail

  // Stats & aspects
  const { data: stats } = useReviewsStatistics(brandId, 'all')
  const { data: aspects } = useReviewAspects(brandId || undefined)
  const { data: marketAspects } = useMarketReviewAspects()

  // ── Init ──
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) setBrandId(saved)
    else setShowPicker(true)
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null))
  }, [])

  // ── Alert centrum fetch ──
  const fetchAlerts = useCallback(async (bid: string) => {
    setAlertLoading(true)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const { data } = await (supabase as any)
      .from('reviews')
      .select('id, author_name, content, rating, review_date, source')
      .eq('brand_id', bid)
      .eq('is_approved', true)
      .lte('rating', 3)
      .gte('review_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('rating', { ascending: true })
      .order('review_date', { ascending: false })
      .limit(20)
    setAlertReviews(data || [])
    setAlertLoading(false)
  }, [])

  // ── Trend fetch ──
  const fetchTrend = useCallback(async (bid: string) => {
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const { data } = await (supabase as any)
      .from('reviews')
      .select('rating, review_date')
      .eq('brand_id', bid)
      .eq('is_approved', true)
      .gte('review_date', twelveMonthsAgo.toISOString().split('T')[0])
      .order('review_date', { ascending: true })
    if (!data || data.length === 0) { setTrendData([]); return }
    const byMonth: Record<string, number[]> = {}
    for (const r of data) {
      if (!r.review_date) continue
      const month = r.review_date.slice(0, 7) // YYYY-MM
      if (!byMonth[month]) byMonth[month] = []
      byMonth[month].push(Number(r.rating))
    }
    const result = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, ratings]) => ({
        month: month.slice(2), // YY-MM for display
        avg_rating: Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 100) / 100,
      }))
    setTrendData(result)
  }, [])

  useEffect(() => {
    if (!brandId) return
    fetchAlerts(brandId)
    fetchTrend(brandId)
  }, [brandId, fetchAlerts, fetchTrend])

  // ── Aspect citations ──
  const loadCitations = async (aspect: string) => {
    if (aspectCitations[aspect] || !brandId) return
    const keywords = ASPECT_KEYWORDS[aspect] || []
    const { data } = await (supabase as any)
      .from('reviews')
      .select('content, rating')
      .eq('brand_id', brandId)
      .eq('is_approved', true)
      .not('content', 'is', null)
      .limit(500)
    const matched = (data || [])
      .filter((r: any) => r.content && keywords.some((k: string) => r.content.toLowerCase().includes(k)))
      .slice(0, 3)
      .map((r: any) => r.content as string)
    setAspectCitations(prev => ({ ...prev, [aspect]: matched }))
  }

  const toggleAspect = (aspect: string) => {
    if (expandedAspect === aspect) {
      setExpandedAspect(null)
    } else {
      setExpandedAspect(aspect)
      loadCitations(aspect)
    }
  }

  // ── Derived values ──
  const avgRating = stats?.overview?.averageRating || 0
  const positivePct = stats?.overview?.positivePercentage || 0
  const totalReviews = stats?.overview?.totalReviews || 0
  const healthScore = Math.min(100, Math.round((avgRating / 5) * 40 + (positivePct / 100) * 60))

  // ── AI generation ──
  const generateAI = async (review: any) => {
    if (!review.content) return
    setGeneratingFor(review.id)
    try {
      const brandName = selectedBrand?.name || 'naszej firmy'
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `Jesteś customer success managerem marki ${brandName}. Napisz profesjonalną empatyczną odpowiedź na negatywną opinię klienta po polsku. Max 4 zdania.` },
            { role: 'user', content: `Opinia (${review.rating}★): ${review.content}` },
          ],
          max_tokens: 300,
        }),
      })
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || 'Błąd.'
      setAiResponses(prev => ({ ...prev, [review.id]: text }))
    } catch {
      setAiResponses(prev => ({ ...prev, [review.id]: 'Błąd generowania.' }))
    } finally {
      setGeneratingFor(null)
    }
  }

  // ── Radar data ──
  const radarData = (aspects || []).map(a => {
    const market = (marketAspects || []).find(m => m.aspect === a.aspect)
    return { aspect: a.aspect, marka: a.positive, rynek: market?.positive || 0 }
  })

  // ── Brand picker ──
  if (showPicker) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Wybierz markę
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {brands.map(b => (
              <button
                key={b.id}
                onClick={() => { setBrandId(b.id); localStorage.setItem(LS_KEY, b.id); setShowPicker(false) }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border hover:bg-accent transition-colors text-left"
              >
                {b.logo_url && <img src={b.logo_url} alt={b.name} className="h-8 w-8 object-contain rounded" />}
                <span className="font-medium">{b.name}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">

      {/* ── HEADER ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-4">
              {selectedBrand?.logo_url && (
                <img src={selectedBrand.logo_url} alt={selectedBrand.name} className="h-14 w-14 object-contain rounded-xl border" />
              )}
              <div>
                <h1 className="text-2xl font-bold">{selectedBrand?.name || '—'}</h1>
                <p className="text-sm text-muted-foreground">Review Manager</p>
                {isAdmin && (
                  <button onClick={() => setShowPicker(true)} className="text-xs text-primary hover:underline mt-0.5">
                    Zmień markę
                  </button>
                )}
              </div>
            </div>

            {/* Health Score */}
            <HealthBadge score={healthScore} />

            {/* Metrics */}
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{totalReviews}</p>
                <p className="text-xs text-muted-foreground">Łącznie opinii</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{avgRating.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Średnia ocena</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums text-green-500">{positivePct.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Pozytywnych</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── ROW 1: ALERT CENTRUM ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Opinie wymagające uwagi
            <span className="text-xs font-normal text-muted-foreground">(ostatnie 14 dni, ocena ≤ 3★)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertLoading && (
            <div className="text-center py-6 text-muted-foreground text-sm">Ładowanie…</div>
          )}

          {!alertLoading && alertReviews.length === 0 && (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                Świetnie! Brak negatywnych opinii z ostatnich 14 dni.
              </p>
            </div>
          )}

          {!alertLoading && alertReviews.length > 0 && (
            <div className="space-y-4">
              {alertReviews.map(r => {
                const problems = extractProblems(r.content || '')
                const isRed = r.rating <= 2
                return (
                  <div
                    key={r.id}
                    className={`border rounded-lg p-4 space-y-3 ${isRed ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10'}`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`text-xs ${isRed ? 'bg-red-500 hover:bg-red-500' : 'bg-yellow-500 hover:bg-yellow-500'} text-white`}>
                        {r.rating}★
                      </Badge>
                      <span className="font-medium text-sm">{r.author_name || 'Anonim'}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.review_date ? new Date(r.review_date).toLocaleDateString('pl-PL') : '—'}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.source || 'inne'}</Badge>
                      <Stars rating={r.rating} />
                    </div>

                    {/* Full content */}
                    {r.content && (
                      <p className="text-sm leading-relaxed">{r.content}</p>
                    )}

                    {/* Główne problemy */}
                    {problems.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-xs text-muted-foreground font-medium">Główne problemy:</span>
                        {problems.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* AI button */}
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs"
                        onClick={() => generateAI(r)} disabled={generatingFor === r.id || !r.content}>
                        <Bot className="h-3.5 w-3.5 mr-1" />
                        {generatingFor === r.id
                          ? <><RefreshCw className="h-3 w-3 animate-spin mr-1" />Generuję…</>
                          : 'Generuj odpowiedź AI'
                        }
                      </Button>
                    </div>

                    {/* AI response */}
                    {aiResponses[r.id] && (
                      <div className="space-y-1.5">
                        <textarea
                          className="w-full text-sm border rounded-md p-2.5 min-h-[80px] bg-white dark:bg-background resize-none"
                          value={aiResponses[r.id]}
                          onChange={e => setAiResponses(prev => ({ ...prev, [r.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="ghost" className="h-6 text-xs"
                          onClick={() => navigator.clipboard.writeText(aiResponses[r.id])}>
                          <Copy className="h-3 w-3 mr-1" /> Kopiuj
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ROW 2: TREND + ROZKŁAD ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trend ocen (12 miesięcy)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_rating" stroke="#6366f1" strokeWidth={2} dot={false} name="Ocena" />
                <Line dataKey={() => 4} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} dot={false} name="Benchmark 4.0" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rating distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rozkład ocen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {[5, 4, 3, 2, 1].map((star, idx) => {
              const entry = (stats?.ratingDistribution || []).find((r: any) => r.rating === star)
              const count = entry?.count || 0
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-xs w-4 text-right font-medium">{star}★</span>
                  <Progress value={pct} className="flex-1 h-3" style={{ '--progress-color': STAR_COLORS[idx] } as any} />
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}% ({count})</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 3: KATEGORIE ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Co mówią klienci</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(aspects || []).map(a => {
              const market = (marketAspects || []).find(m => m.aspect === a.aspect)
              const diff = market ? a.positive - market.positive : null
              const barColor = a.positive >= 80 ? '#22c55e' : a.positive >= 60 ? '#f59e0b' : '#ef4444'
              const isExpanded = expandedAspect === a.aspect
              return (
                <div
                  key={a.aspect}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleAspect(a.aspect)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold capitalize">{a.aspect}</span>
                    {diff !== null && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${diff >= 0 ? 'text-green-600 border-green-300' : 'text-red-500 border-red-300'}`}>
                        {diff >= 0 ? '↑' : '↓'} {diff > 0 ? '+' : ''}{diff}% vs rynek
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold" style={{ color: barColor }}>{a.positive}%</p>
                  <Progress value={a.positive} className="h-1.5 mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">{a.mentions} wzmianek</p>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t pt-2" onClick={e => e.stopPropagation()}>
                      {(aspectCitations[a.aspect] || []).length === 0
                        ? <p className="text-xs text-muted-foreground italic">Brak cytatów</p>
                        : (aspectCitations[a.aspect] || []).map((c, i) => (
                          <p key={i} className="text-xs text-muted-foreground italic leading-relaxed">„{c.slice(0, 120)}{c.length > 120 ? '…' : ''}"</p>
                        ))
                      }
                    </div>
                  )}

                  <div className="flex justify-center mt-1">
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── ROW 4: VS RYNEK ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Twoja marka vs Rynek</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="aspect" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name={selectedBrand?.name || 'Marka'} dataKey="marka" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                <Radar name="Rynek" dataKey="rynek" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.2} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Porównanie parametrów</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1.5 font-medium">Parametr</th>
                  <th className="text-right py-1.5 font-medium">Twoja</th>
                  <th className="text-right py-1.5 font-medium">Rynek</th>
                  <th className="text-right py-1.5 font-medium">Różnica</th>
                </tr>
              </thead>
              <tbody>
                {radarData.map(row => {
                  const diff = row.marka - row.rynek
                  return (
                    <tr key={row.aspect} className="border-b last:border-0">
                      <td className="py-2 capitalize">{row.aspect}</td>
                      <td className="py-2 text-right font-medium">{row.marka}%</td>
                      <td className="py-2 text-right text-muted-foreground">{row.rynek}%</td>
                      <td className="py-2 text-right">
                        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {diff > 0 ? '+' : ''}{diff}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 5: ŹRÓDŁA + AKTYWNOŚĆ ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Źródła opinii</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats?.sourceBreakdown || []}
                  dataKey="count"
                  nameKey="source"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  label={(props: any) => `${props.source} ${((props.percent || 0) * 100).toFixed(0)}%`}
                >
                  {(stats?.sourceBreakdown || []).map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Aktywność wg dnia tygodnia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.dayOfWeekActivity || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
