'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { useBrands } from '@/hooks/supabase/useBrands'
import { useReviewsStatistics } from '@/hooks/supabase/useReviewsStatistics'
import { useReviewAspects } from '@/hooks/supabase/useReviewAspects'
import { useMarketReviewAspects } from '@/hooks/supabase/useMarketReviewAspects'
import { Star, Bot, Copy, Check, Building2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'rm_brand_id'
const PAGE_SIZE = 30

const TOPIC_REGEXES: Record<string, RegExp> = {
  smak:    /smak|jedzeni|pyszn|smaczn|niesmaczn/i,
  dostawa: /dostaw|kurier|paczk|transport|opóźni/i,
  jakość:  /jakość|jakości|śwież|nieśwież/i,
  cena:    /cen|drogie|tanie|drogo|tanio/i,
  obsługa: /obsług|kontakt|support|klient/i,
  porcje:  /porcj|ilość|mało|dużo|wielkość/i,
}

const TOPIC_COLORS: Record<string, string> = {
  smak:    'bg-orange-100 text-orange-700',
  dostawa: 'bg-blue-100 text-blue-700',
  jakość:  'bg-purple-100 text-purple-700',
  cena:    'bg-yellow-100 text-yellow-700',
  obsługa: 'bg-green-100 text-green-700',
  porcje:  'bg-pink-100 text-pink-700',
}

const TONE_LABELS: Record<Tone, string> = {
  professional: 'Profesjonalny',
  empathetic:   'Empatyczny',
  casual:       'Swobodny',
}

const TONE_PROMPTS: Record<Tone, string> = {
  professional: 'Ton: profesjonalny, rzeczowy, formalny.',
  empathetic:   'Ton: empatyczny, ciepły, rozumiejący.',
  casual:       'Ton: swobodny, przyjazny, nieformalny.',
}

function detectTopics(text: string): string[] {
  if (!text) return []
  return Object.entries(TOPIC_REGEXES)
    .filter(([, re]) => re.test(text))
    .map(([topic]) => topic)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Review = {
  id: string
  author_name: string | null
  content: string | null
  rating: number
  review_date: string | null
  source: string | null
}

type Status = 'new' | 'draft' | 'done'
type Filter = 'all' | 'critical' | 'needs-response' | 'positive'
type Sort   = 'newest' | 'sla' | 'rating'
type Tone   = 'professional' | 'empathetic' | 'casual'

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
  const bg = rating <= 2
    ? 'bg-red-100 text-red-700'
    : rating === 3
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-green-100 text-green-700'
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${bg}`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'done')
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ zrobione</span>
  if (status === 'draft')
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">draft</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">nowa</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewManagerPage() {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  // Brand
  const [brandId, setBrandId]     = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [userEmail, setUserEmail]  = useState<string | null>(null)

  // Reviews list
  const [reviews, setReviews]         = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [hasMore, setHasMore]         = useState(false)
  const [offset, setOffset]           = useState(0)

  // Filters / sort
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort]     = useState<Sort>('newest')

  // Selected review
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedReview = reviews.find(r => r.id === selectedId) ?? null

  // Statuses (localStorage)
  const [statuses, setStatuses] = useState<Record<string, Status>>({})

  // Composer
  const [tone, setTone]           = useState<Tone>('professional')
  const [aiResponse, setAiResponse] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)

  // Context panel
  const [similarReviews, setSimilarReviews]   = useState<Review[]>([])
  const [recentResponses, setRecentResponses] = useState<{ id: string; author: string; text: string }[]>([])

  // Progress state
  type ProgressData = {
    currentAvg: number; previousAvg: number
    currentCount: number; previousCount: number
    currentPosPct: number; previousPosPct: number
  }
  const [progressData, setProgressData] = useState<ProgressData | null>(null)

  // Hooks
  const { data: brands = [] }   = useBrands()
  const selectedBrand           = brands.find(b => b.id === brandId)
  const isAdmin                 = userEmail === adminEmail
  const { data: stats }         = useReviewsStatistics(brandId, 'all')
  const { data: aspects = [] }  = useReviewAspects(brandId || undefined)
  const { data: marketAspects = [] } = useMarketReviewAspects()

  const avgRating    = stats?.overview?.averageRating || 0
  const positivePct  = stats?.overview?.positivePercentage || 0
  const totalReviews = stats?.overview?.totalReviews || 0

  // ── Init ──
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) setBrandId(saved)
    else setShowPicker(true)
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null))
  }, [])

  // ── Fetch progress data ──
  useEffect(() => {
    if (!brandId) return
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo  = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const t30 = thirtyDaysAgo.toISOString().split('T')[0]
    const t60 = sixtyDaysAgo.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    Promise.all([
      (supabase as any).from('reviews').select('rating').eq('brand_id', brandId).eq('is_approved', true).gte('review_date', t30).lte('review_date', today),
      (supabase as any).from('reviews').select('rating').eq('brand_id', brandId).eq('is_approved', true).gte('review_date', t60).lt('review_date', t30),
    ]).then(([curr, prev]) => {
      const calc = (rows: { rating: number }[]) => {
        if (!rows.length) return { avg: 0, count: 0, posPct: 0 }
        const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length
        const pos = rows.filter(r => r.rating >= 4).length
        return { avg, count: rows.length, posPct: (pos / rows.length) * 100 }
      }
      const c = calc(curr.data || [])
      const p = calc(prev.data || [])
      setProgressData({
        currentAvg: c.avg, previousAvg: p.avg,
        currentCount: c.count, previousCount: p.count,
        currentPosPct: c.posPct, previousPosPct: p.posPct,
      })
    })
  }, [brandId])

  // ── Load statuses from localStorage ──
  useEffect(() => {
    const loaded: Record<string, Status> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('rm_status_')) {
        loaded[key.replace('rm_status_', '')] = localStorage.getItem(key) as Status
      }
    }
    setStatuses(loaded)
  }, [brandId])

  // ── Fetch reviews ──
  const fetchReviews = useCallback(async (
    bid: string, f: Filter, s: Sort, off: number, append = false
  ) => {
    setReviewsLoading(true)
    let q = (supabase as any)
      .from('reviews')
      .select('id, author_name, content, rating, review_date, source')
      .eq('brand_id', bid)
      .eq('is_approved', true)

    if (f === 'critical')        q = q.lte('rating', 2)
    else if (f === 'needs-response') q = q.eq('rating', 3)
    else if (f === 'positive')   q = q.gte('rating', 4)

    if (s === 'rating') q = q.order('rating', { ascending: true }).order('review_date', { ascending: false })
    else                q = q.order('review_date', { ascending: false })

    q = q.range(off, off + PAGE_SIZE - 1)

    const { data } = await q
    const rows: Review[] = data || []
    if (append) setReviews(prev => [...prev, ...rows])
    else setReviews(rows)
    setHasMore(rows.length === PAGE_SIZE)
    setReviewsLoading(false)
  }, [])

  useEffect(() => {
    if (!brandId) return
    setOffset(0)
    setSelectedId(null)
    setAiResponse('')
    fetchReviews(brandId, filter, sort, 0)
  }, [brandId, filter, sort, fetchReviews])

  // ── Load similar + saved response when review changes ──
  useEffect(() => {
    if (!selectedReview) { setSimilarReviews([]); return }
    const topics = detectTopics(selectedReview.content || '')
    const similar = reviews
      .filter(r => r.id !== selectedReview.id && detectTopics(r.content || '').some(t => topics.includes(t)))
      .slice(0, 3)
    setSimilarReviews(similar)
    const saved = localStorage.getItem(`rm_response_${selectedReview.id}`)
    setAiResponse(saved || '')
  }, [selectedId, reviews, selectedReview])

  // ── Load recent AI responses ──
  useEffect(() => {
    const responses: { id: string; author: string; text: string }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('rm_response_')) {
        const id   = key.replace('rm_response_', '')
        const text = localStorage.getItem(key) || ''
        if (!text) continue
        const review = reviews.find(r => r.id === id)
        responses.push({ id, author: review?.author_name || 'Anonim', text })
      }
    }
    setRecentResponses(responses.slice(-3).reverse())
  }, [reviews, aiResponse])

  // ── Helpers ──
  const setStatus = (id: string, status: Status) => {
    localStorage.setItem(`rm_status_${id}`, status)
    setStatuses(prev => ({ ...prev, [id]: status }))
  }

  const loadMore = () => {
    if (!brandId) return
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchReviews(brandId, filter, sort, next, true)
  }

  // ── Generate AI ──
  const generateAI = async () => {
    if (!selectedReview?.content) return
    setGenerating(true)
    try {
      const topics = detectTopics(selectedReview.content)
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: `Jesteś customer success managerem marki ${selectedBrand?.name || 'naszej firmy'}. ${TONE_PROMPTS[tone]} Zasady: używaj imienia klienta, max 4096 znaków, jeśli negatywna: empatia→zrozumienie→rozwiązanie→zaproszenie do kontaktu, jeśli pozytywna: podziękowanie→personalizacja→CTA. Nigdy nie pisz że jesteś AI. Język: polski.`,
            },
            {
              role: 'user',
              content: `Autor: ${selectedReview.author_name || 'Klient'}\nOcena: ${selectedReview.rating}/5\nTreść: ${selectedReview.content}\nWykryte tematy: ${topics.join(', ') || 'brak'}`,
            },
          ],
        }),
      })
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || 'Błąd generowania.'
      setAiResponse(text)
      localStorage.setItem(`rm_response_${selectedReview.id}`, text)
      setStatus(selectedReview.id, 'draft')
    } catch {
      setAiResponse('Błąd generowania.')
    } finally {
      setGenerating(false)
    }
  }

  const copyResponse = () => {
    navigator.clipboard.writeText(aiResponse)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Brand picker ──
  if (showPicker) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5" /> Wybierz markę
            </h2>
            <div className="space-y-2">
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
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const topics = detectTopics(selectedReview?.content || '')

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

      {/* ════ LEFT PANEL — ReviewQueue ════ */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col bg-background overflow-hidden">

        {/* Brand header */}
        <div className="p-4 border-b flex items-center gap-3 flex-shrink-0">
          {selectedBrand?.logo_url && (
            <img src={selectedBrand.logo_url} alt={selectedBrand.name} className="h-8 w-8 object-contain rounded flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{selectedBrand?.name || '—'}</p>
            <p className="text-xs text-muted-foreground">{reviews.length} opinii</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowPicker(true)} className="text-xs text-primary hover:underline flex-shrink-0">
              Zmień
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="p-3 border-b flex-shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-1">
            {([
              ['all',             'Wszystkie'],
              ['critical',        'Krytyczne 1-2★'],
              ['needs-response',  '3★'],
              ['positive',        'Pozytywne'],
            ] as [Filter, string][]).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([
              ['newest',  'Najnowsze'],
              ['rating',  'Rating'],
              ['sla',     'SLA'],
            ] as [Sort, string][]).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex-1 px-2 py-1 text-[11px] rounded transition-colors ${
                  sort === s ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Review list */}
        <div className="flex-1 overflow-y-auto">
          {reviewsLoading && reviews.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Ładowanie…</div>
          )}

          {reviews.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                selectedId === r.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <ReviewAvatar name={r.author_name || '?'} rating={r.rating} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-xs font-medium truncate">{r.author_name || 'Anonim'}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {r.review_date ? new Date(r.review_date).toLocaleDateString('pl-PL') : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
                    {(r.content || '').slice(0, 60)}{(r.content || '').length > 60 ? '…' : ''}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge status={statuses[r.id] || 'new'} />
                  </div>
                </div>
              </div>
            </button>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={reviewsLoading}
              className="w-full py-3 text-xs text-primary hover:bg-accent transition-colors border-t"
            >
              {reviewsLoading ? 'Ładowanie…' : 'Załaduj więcej'}
            </button>
          )}
        </div>
      </div>

      {/* ════ MIDDLE PANEL — Detail + Composer ════ */}
      <div className="flex-1 overflow-y-auto p-6 bg-background">
        {!selectedReview ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Star className="h-14 w-14 mx-auto mb-3 opacity-15" />
              <p className="text-sm">Wybierz opinię z listy</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Header */}
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
                  {selectedReview.rating <= 2 && (
                    <Badge className="bg-red-500 hover:bg-red-500 text-white text-xs">Krytyczna</Badge>
                  )}
                  {selectedReview.rating === 3 && (
                    <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white text-xs">Wymaga uwagi</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm leading-relaxed">{selectedReview.content || '(brak treści)'}</p>
              </CardContent>
            </Card>

            {/* Topics */}
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground font-medium">Wykryte tematy:</span>
                {topics.map(t => (
                  <span
                    key={t}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TOPIC_COLORS[t] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <hr />

            {/* Composer */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Odpowiedź</p>
                <div className="flex gap-1">
                  {(['professional', 'empathetic', 'casual'] as Tone[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        tone === t ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {TONE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={generateAI}
                disabled={generating || !selectedReview.content}
              >
                {generating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generuję…</>
                ) : (
                  <><Bot className="h-4 w-4 mr-2" />Generuj odpowiedź AI</>
                )}
              </Button>

              <div className="space-y-1.5">
                <textarea
                  className="w-full text-sm border rounded-lg p-3 min-h-[150px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Tu pojawi się wygenerowana odpowiedź…"
                  value={aiResponse}
                  onChange={e => {
                    setAiResponse(e.target.value)
                    localStorage.setItem(`rm_response_${selectedReview.id}`, e.target.value)
                    if (statuses[selectedReview.id] !== 'done') setStatus(selectedReview.id, 'draft')
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${aiResponse.length > 4096 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                    {aiResponse.length} / 4096 znaków
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyResponse} disabled={!aiResponse}>
                      {copied
                        ? <><Check className="h-3.5 w-3.5 mr-1" />Skopiowano</>
                        : <><Copy className="h-3.5 w-3.5 mr-1" />Kopiuj</>
                      }
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setStatus(selectedReview.id, 'done')}
                      disabled={statuses[selectedReview.id] === 'done'}
                    >
                      {statuses[selectedReview.id] === 'done' ? '✓ Zrobione' : 'Oznacz jako zrobione'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ════ RIGHT PANEL — Context ════ */}
      <div className="w-72 flex-shrink-0 border-l overflow-y-auto p-4 bg-muted/30">

        {/* Brand stats */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Statystyki marki
          </p>
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Podobne opinie
            </p>
            <div className="space-y-2">
              {similarReviews.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="w-full text-left bg-background rounded-lg p-3 border hover:bg-accent/50 transition-colors"
                >
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Ostatnie odpowiedzi AI
            </p>
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

        {/* Radar — parametry marki */}
        {aspects.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Radar — parametry marki
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={aspects.map(a => {
                const market = marketAspects.find((m: any) => m.aspect === a.aspect)
                return { aspect: a.aspect, marka: a.positive, rynek: market?.positive || 0 }
              })}>
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

        {/* Progress — czy się poprawiamy? */}
        {progressData && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Czy się poprawiamy?
            </p>
            <div className="space-y-2">
              {[
                {
                  label: 'Średnia ocena',
                  prev: progressData.previousAvg.toFixed(2),
                  curr: progressData.currentAvg.toFixed(2),
                  diff: progressData.currentAvg - progressData.previousAvg,
                  format: (v: number) => v.toFixed(2),
                },
                {
                  label: 'Liczba opinii',
                  prev: String(progressData.previousCount),
                  curr: String(progressData.currentCount),
                  diff: progressData.currentCount - progressData.previousCount,
                  format: (v: number) => String(v),
                },
                {
                  label: '% pozytywnych',
                  prev: progressData.previousPosPct.toFixed(0) + '%',
                  curr: progressData.currentPosPct.toFixed(0) + '%',
                  diff: progressData.currentPosPct - progressData.previousPosPct,
                  format: (v: number) => v.toFixed(0) + '%',
                },
              ].map(m => (
                <div key={m.label} className="bg-background rounded-lg p-2.5 border">
                  <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{m.prev} →</span>
                    <span className="text-sm font-bold">{m.curr}</span>
                    <span className={`flex items-center gap-0.5 text-xs font-semibold ${m.diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.diff >= 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />
                      }
                      {m.diff > 0 ? '+' : ''}{m.format(m.diff)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
