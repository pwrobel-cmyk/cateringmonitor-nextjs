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
  ChevronDown, ChevronUp, Building2, RefreshCw,
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
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
const STAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']

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

  // Inbox state
  const [inboxPage, setInboxPage] = useState(0)
  const [inboxFilter, setInboxFilter] = useState<'all' | 'negative' | 'neutral' | 'positive'>('all')
  const [inboxReviews, setInboxReviews] = useState<any[]>([])
  const [inboxTotal, setInboxTotal] = useState(0)
  const [inboxLoading, setInboxLoading] = useState(false)

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
    // get email from supabase session
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null))
  }, [])

  // ── Inbox fetch ──
  const fetchInbox = useCallback(async (page: number, filter: typeof inboxFilter, bid: string) => {
    setInboxLoading(true)
    const from = page * 10
    const to = from + 9
    let q = (supabase as any)
      .from('reviews')
      .select('id, content, rating, author_name, source, review_date', { count: 'exact' })
      .eq('brand_id', bid)
      .eq('is_approved', true)
    if (filter === 'negative') q = q.lte('rating', 2)
    else if (filter === 'neutral') q = q.eq('rating', 3)
    else if (filter === 'positive') q = q.gte('rating', 4)
    const { data, count } = await q.order('review_date', { ascending: false }).range(from, to)
    if (page === 0) setInboxReviews(data || [])
    else setInboxReviews(prev => [...prev, ...(data || [])])
    setInboxTotal(count || 0)
    setInboxLoading(false)
  }, [])

  useEffect(() => {
    if (!brandId) return
    setInboxPage(0)
    setInboxReviews([])
    fetchInbox(0, inboxFilter, brandId)
  }, [brandId, inboxFilter, fetchInbox])

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

  // Recent 7-day negative reviews (from inbox if filter=all)
  const recentNegative = inboxReviews.filter(r => r.rating <= 2).slice(0, 3)

  // ── AI generation ──
  const generateAI = async (review: any) => {
    if (!review.content) return
    setGeneratingFor(review.id)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_KEY || '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: `Jesteś menedżerem ds. obsługi klienta marki ${selectedBrand?.name || 'naszej firmy'}. Napisz profesjonalną, empatyczną odpowiedź na tę opinię. Odpowiedź powinna być po polsku, maks 3 zdania.`,
          messages: [{ role: 'user', content: `Ocena: ${review.rating}/5\nTreść: ${review.content}` }],
        }),
      })
      const json = await res.json()
      setAiResponses(prev => ({ ...prev, [review.id]: json.content?.[0]?.text || 'Błąd.' }))
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

      {/* ── ROW 1: ALERTY ── */}
      {recentNegative.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-red-600 text-sm">
                {recentNegative.length} negatywnych opinii wymaga uwagi
              </span>
            </div>
            <div className="space-y-2">
              {recentNegative.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-white dark:bg-background rounded-lg px-3 py-2 border border-red-100">
                  <Stars rating={r.rating} />
                  <p className="text-sm text-muted-foreground flex-1 truncate">{r.content || '(brak treści)'}</p>
                  <Button size="sm" variant="outline" className="flex-shrink-0 h-7 text-xs"
                    onClick={() => generateAI(r)} disabled={generatingFor === r.id || !r.content}>
                    <Bot className="h-3 w-3 mr-1" />
                    {generatingFor === r.id ? '...' : 'Odpowiedz AI'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ROW 2: TREND + ROZKŁAD ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trend ocen (12 miesięcy)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats?.monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                <Tooltip />
                {/* benchmark 4.0 */}
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

      {/* ── ROW 4: INBOX ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              Opinie wymagające odpowiedzi
              <Badge variant="secondary">{inboxTotal}</Badge>
            </CardTitle>
            <div className="flex gap-1">
              {(['all', 'negative', 'neutral', 'positive'] as const).map(f => (
                <Button key={f} size="sm" variant={inboxFilter === f ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2" onClick={() => setInboxFilter(f)}>
                  {f === 'all' ? 'Wszystkie' : f === 'negative' ? '1-2★' : f === 'neutral' ? '3★' : '4-5★'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {inboxReviews.map(r => {
            const initials = r.author_name?.[0]?.toUpperCase() || '?'
            const [expanded, setExpanded] = useState(false)
            const content = r.content || ''
            const isLong = content.length > 180
            return (
              <div key={r.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {initials}
                  </div>
                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{r.author_name || 'Anonim'}</span>
                      <Stars rating={r.rating} />
                      <span className="text-xs text-muted-foreground">
                        {r.review_date ? new Date(r.review_date).toLocaleDateString('pl-PL') : '—'}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.source || 'inne'}</Badge>
                    </div>
                    {content && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {isLong && !expanded ? content.slice(0, 180) + '…' : content}
                        {isLong && (
                          <button className="ml-1 text-primary text-xs hover:underline" onClick={() => setExpanded(v => !v)}>
                            {expanded ? 'zwiń' : 'więcej'}
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                  {/* AI button */}
                  <Button size="sm" variant="outline" className="flex-shrink-0 h-8 text-xs"
                    onClick={() => generateAI(r)} disabled={generatingFor === r.id || !content}>
                    <Bot className="h-3.5 w-3.5 mr-1" />
                    {generatingFor === r.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'AI'}
                  </Button>
                </div>
                {aiResponses[r.id] && (
                  <div className="ml-12 space-y-1">
                    <textarea
                      className="w-full text-sm border rounded-md p-2.5 min-h-[70px] bg-muted/30 resize-none"
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

          {inboxLoading && (
            <div className="text-center py-4 text-muted-foreground text-sm">Ładowanie…</div>
          )}

          {!inboxLoading && inboxReviews.length < inboxTotal && (
            <Button variant="outline" className="w-full" onClick={() => {
              const next = inboxPage + 1
              setInboxPage(next)
              fetchInbox(next, inboxFilter, brandId!)
            }}>
              Załaduj więcej ({inboxTotal - inboxReviews.length} pozostałych)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── ROW 5: VS RYNEK ── */}
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

      {/* ── ROW 6: ŹRÓDŁA + AKTYWNOŚĆ ── */}
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
