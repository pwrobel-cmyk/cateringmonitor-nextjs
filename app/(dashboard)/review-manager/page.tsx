'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { useBrands } from '@/hooks/supabase/useBrands'
import { useReviews } from '@/hooks/supabase/useReviews'
import { useReviewsStatistics } from '@/hooks/supabase/useReviewsStatistics'
import { useReviewAspects } from '@/hooks/supabase/useReviewAspects'
import { useMarketReviewAspects } from '@/hooks/supabase/useMarketReviewAspects'
import { useTopWords } from '@/hooks/supabase/useTopWords'
import { Star, MessageSquare, TrendingUp, TrendingDown, Copy, Bot, Building2 } from 'lucide-react'

const LS_KEY = 'rm_brand_id'
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
    </span>
  )
}

function HealthScore({ score }: { score: number }) {
  const color = score < 50 ? 'text-red-500' : score < 70 ? 'text-yellow-500' : 'text-green-500'
  const label = score < 50 ? 'Wymaga uwagi' : score < 70 ? 'Przeciętny' : 'Dobry'
  return (
    <div className="flex flex-col items-center">
      <span className={`text-4xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-muted-foreground">/100</span>
      <Badge variant={score < 50 ? 'destructive' : score < 70 ? 'secondary' : 'default'} className="mt-1 text-xs">
        {label}
      </Badge>
    </div>
  )
}

export default function ReviewManagerPage() {
  const isAdmin = typeof window !== 'undefined'
    ? localStorage.getItem('user_email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    : false

  const [brandId, setBrandId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [inboxFilter, setInboxFilter] = useState<'all' | 'negative' | 'no_answer'>('all')
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({})

  const { data: brands = [] } = useBrands()
  const selectedBrand = brands.find(b => b.id === brandId)

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      setBrandId(saved)
    } else {
      setShowPicker(true)
    }
  }, [])

  const selectBrand = (id: string) => {
    setBrandId(id)
    localStorage.setItem(LS_KEY, id)
    setShowPicker(false)
  }

  // Data hooks
  const { data: reviewsData } = useReviews(0, 50, brandId || undefined)
  const { data: stats } = useReviewsStatistics(brandId, 'all')
  const { data: aspects } = useReviewAspects(brandId || undefined)
  const { data: marketAspects } = useMarketReviewAspects()
  const { data: positiveWords } = useTopWords(brandId, 'positive')
  const { data: negativeWords } = useTopWords(brandId, 'negative')

  const reviews = reviewsData?.reviews || []

  // Health Score calculation
  const avgRating = stats?.overview?.averageRating || 0
  const positivePct = stats?.overview?.positivePercentage || 0
  const healthScore = Math.round((avgRating / 5) * 40 + (positivePct / 100) * 30)

  // Inbox filtering
  const filteredReviews = reviews.filter(r => {
    if (inboxFilter === 'negative') return r.rating <= 2
    return true
  })

  // Generate AI response
  const generateResponse = async (reviewId: string, content: string, rating: number, brandName: string) => {
    setGeneratingFor(reviewId)
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
          system: `Jesteś menedżerem ds. obsługi klienta marki ${brandName}. Napisz profesjonalną, empatyczną odpowiedź na tę opinię. Odpowiedź powinna być po polsku, maks 3 zdania.`,
          messages: [{ role: 'user', content: `Ocena: ${rating}/5\nTreść: ${content}` }],
        }),
      })
      const json = await res.json()
      const text = json.content?.[0]?.text || 'Nie udało się wygenerować odpowiedzi.'
      setAiResponses(prev => ({ ...prev, [reviewId]: text }))
    } catch {
      setAiResponses(prev => ({ ...prev, [reviewId]: 'Błąd generowania odpowiedzi.' }))
    } finally {
      setGeneratingFor(null)
    }
  }

  // Radar data for vs Rynek
  const radarData = (aspects || []).map(a => {
    const market = (marketAspects || []).find(m => m.aspect === a.aspect)
    return {
      aspect: a.aspect,
      marka: a.positive,
      rynek: market?.positive || 0,
    }
  })

  // Brand picker modal
  if (showPicker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Wybierz markę do monitorowania
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {brands.map(b => (
              <button
                key={b.id}
                onClick={() => selectBrand(b.id)}
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

  return (
    <div className="space-y-6">
      {/* Header / Command Center */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Brand info */}
            <div className="flex items-center gap-3 flex-1">
              {selectedBrand?.logo_url && (
                <img src={selectedBrand.logo_url} alt={selectedBrand.name} className="h-12 w-12 object-contain rounded-lg border" />
              )}
              <div>
                <h1 className="text-xl font-bold">{selectedBrand?.name || 'Review Manager'}</h1>
                <p className="text-sm text-muted-foreground">Brand Health Monitor</p>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowPicker(true)} className="ml-2">
                  Zmień markę
                </Button>
              )}
            </div>

            {/* Health Score */}
            <div className="flex items-center gap-8">
              <HealthScore score={healthScore} />
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Łącznie opinii</p>
                  <p className="font-bold text-lg">{stats?.overview?.totalReviews || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Średnia ocena</p>
                  <p className="font-bold text-lg">{avgRating.toFixed(2)} ★</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">% pozytywnych</p>
                  <p className="font-bold text-lg">{positivePct.toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Health Score</p>
                  <p className={`font-bold text-lg ${healthScore >= 70 ? 'text-green-500' : healthScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {healthScore}/100
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="analytics">Analityka</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="market">vs Rynek</TabsTrigger>
        </TabsList>

        {/* INBOX */}
        <TabsContent value="inbox" className="space-y-4">
          <div className="flex gap-2">
            {(['all', 'negative', 'no_answer'] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={inboxFilter === f ? 'default' : 'outline'}
                onClick={() => setInboxFilter(f)}
              >
                {f === 'all' ? 'Wszystkie' : f === 'negative' ? 'Negatywne (1-2★)' : 'Bez odpowiedzi'}
              </Button>
            ))}
            <span className="text-sm text-muted-foreground self-center ml-2">{filteredReviews.length} opinii</span>
          </div>

          <div className="space-y-3">
            {filteredReviews.map(review => (
              <Card key={review.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                        {review.author_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{review.author_name || 'Anonim'}</p>
                        <div className="flex items-center gap-2">
                          <StarRow rating={review.rating} />
                          <span className="text-xs text-muted-foreground">
                            {review.review_date ? new Date(review.review_date).toLocaleDateString('pl-PL') : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">{review.source || 'inne'}</Badge>
                    </div>
                  </div>

                  {review.content && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateResponse(review.id, review.content || '', review.rating, selectedBrand?.name || '')}
                      disabled={generatingFor === review.id || !review.content}
                    >
                      <Bot className="h-3.5 w-3.5 mr-1.5" />
                      {generatingFor === review.id ? 'Generowanie...' : 'Generuj odpowiedź AI'}
                    </Button>
                  </div>

                  {aiResponses[review.id] && (
                    <div className="space-y-2">
                      <textarea
                        className="w-full text-sm border rounded-md p-3 min-h-[80px] bg-muted/30 resize-none"
                        value={aiResponses[review.id]}
                        onChange={e => setAiResponses(prev => ({ ...prev, [review.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigator.clipboard.writeText(aiResponses[review.id])}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Kopiuj
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredReviews.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Brak opinii spełniających kryteria</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ANALITYKA */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rating distribution */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Rozkład ocen</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats?.ratingDistribution || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="rating" type="category" width={30} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly trend */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Trend ocen miesięczny</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats?.monthlyTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[1, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg_rating" stroke="#6366f1" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Day of week */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Aktywność wg dnia tygodnia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats?.dayOfWeekActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Sources */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Źródła opinii</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats?.sourceBreakdown || []} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label={(props: any) => `${props.source} ${((props.percent || 0) * 100).toFixed(0)}%`}>
                      {(stats?.sourceBreakdown || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* INSIGHTS */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Aspects */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Kategorie i Sentyment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(aspects || []).map(a => (
                  <div key={a.aspect} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{a.aspect}</span>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600">{a.positive}% ▲</span>
                        <span className="text-red-500">{a.negative}% ▼</span>
                        <span className="text-muted-foreground">{a.mentions} wzmianek</span>
                      </div>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="bg-green-400 rounded-l-full" style={{ width: `${a.positive}%` }} />
                      <div className="bg-gray-200 flex-1" />
                      <div className="bg-red-400 rounded-r-full" style={{ width: `${a.negative}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top words */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm text-green-600">Słowa kluczowe — pozytywne</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {(positiveWords || []).map(w => (
                    <Badge key={w.word} variant="outline" className="text-green-600 border-green-300">
                      {w.word} <span className="ml-1 text-xs text-muted-foreground">{w.count}</span>
                    </Badge>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm text-red-500">Słowa kluczowe — negatywne</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {(negativeWords || []).map(w => (
                    <Badge key={w.word} variant="outline" className="text-red-500 border-red-300">
                      {w.word} <span className="ml-1 text-xs text-muted-foreground">{w.count}</span>
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* VS RYNEK */}
        <TabsContent value="market" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Radar chart */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Twoja marka vs Rynek</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="aspect" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name={selectedBrand?.name || 'Marka'} dataKey="marka" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    <Radar name="Rynek" dataKey="rynek" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Comparison table */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Porównanie parametrów</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-1 font-medium">Parametr</th>
                      <th className="text-right py-1 font-medium">Twoja</th>
                      <th className="text-right py-1 font-medium">Rynek</th>
                      <th className="text-right py-1 font-medium">Różnica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {radarData.map(row => {
                      const diff = row.marka - row.rynek
                      return (
                        <tr key={row.aspect} className="border-b last:border-0">
                          <td className="py-2 capitalize">{row.aspect}</td>
                          <td className="py-2 text-right">{row.marka}%</td>
                          <td className="py-2 text-right">{row.rynek}%</td>
                          <td className="py-2 text-right">
                            <span className={`flex items-center justify-end gap-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
