'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { useReviewAspects } from '@/hooks/supabase/useReviewAspects'
import { useMarketReviewAspects } from '@/hooks/supabase/useMarketReviewAspects'
import { useReviewsStatistics } from '@/hooks/supabase/useReviewsStatistics'
import { useBrands } from '@/hooks/supabase/useBrands'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'

const ASPECT_KEYWORDS: Record<string, string[]> = {
  smak:    ['smak', 'smaczn', 'pyszn', 'smaczne', 'pyszne', 'smaczny'],
  dostawa: ['dostaw', 'kurier', 'przesyłk', 'transport'],
  cena:    ['cen', 'drogie', 'tanie', 'kosztuj', 'drogo', 'tanio'],
  jakość:  ['jakość', 'jakości'],
  obsługa: ['obsług', 'kontakt', 'klient'],
  porcje:  ['porcj', 'ilość', 'wielkość'],
}

const ASPECT_LABELS: Record<string, string> = {
  smak:    '🍽️ Smak',
  dostawa: '🚚 Dostawa',
  cena:    '💰 Cena',
  jakość:  '⭐ Jakość',
  obsługa: '🤝 Obsługa',
  porcje:  '🍱 Porcje',
}

const ASPECT_CHART_COLORS: Record<string, string> = {
  smak:    '#f97316',
  dostawa: '#3b82f6',
  jakość:  '#8b5cf6',
  cena:    '#eab308',
  obsługa: '#22c55e',
  porcje:  '#ec4899',
}

const PL_MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

interface Quote {
  content: string
  rating: number
}

export default function InsightsPage() {
  const { user } = useAuth()
  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const { data: brands = [] } = useBrands()

  const [brandId, setBrandId] = useState<string | undefined>()
  const [brandName, setBrandName] = useState<string>('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [quotes, setQuotes] = useState<Record<string, Quote[]>>({})
  const [trendData, setTrendData] = useState<Record<string, string | number>[]>([])

  // Load brand from assignment or first brand for admin
  useEffect(() => {
    if (!user) return
    if (isAdmin) {
      if (brands.length > 0 && !brandId) {
        setBrandId(brands[0].id)
        setBrandName((brands[0] as any).name || '')
      }
      return
    }
    ;(supabase as any)
      .from('user_brand_assignments')
      .select('brand_id, brands(name)')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setBrandId(data.brand_id)
          setBrandName(data.brands?.name || '')
        }
      })
  }, [user, isAdmin, brands, brandId])

  const { data: aspects = [] } = useReviewAspects(brandId)
  const { data: marketAspects = [] } = useMarketReviewAspects()
  const { data: stats } = useReviewsStatistics(brandId)

  // Fetch 6-month trend data
  useEffect(() => {
    if (!brandId) return
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    ;(supabase as any)
      .from('reviews')
      .select('content, review_date')
      .eq('brand_id', brandId)
      .gte('review_date', sixMonthsAgo.toISOString().slice(0, 10))
      .then(({ data }: any) => {
        if (!data) return

        const byMonth: Record<string, { total: number; aspects: Record<string, number> }> = {}
        data.forEach((r: any) => {
          if (!r.review_date) return
          const d = new Date(r.review_date)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (!byMonth[key]) byMonth[key] = { total: 0, aspects: {} }
          byMonth[key].total++

          const content = (r.content || '').toLowerCase()
          Object.entries(ASPECT_KEYWORDS).forEach(([aspect, keywords]) => {
            if (keywords.some(k => content.includes(k))) {
              byMonth[key].aspects[aspect] = (byMonth[key].aspects[aspect] || 0) + 1
            }
          })
        })

        const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
        const chartData = sorted.map(([key, val]) => {
          const m = parseInt(key.split('-')[1]) - 1
          const y = key.split('-')[0]
          const entry: Record<string, string | number> = { month: `${PL_MONTHS[m]} ${y}` }
          Object.keys(ASPECT_KEYWORDS).forEach(aspect => {
            entry[aspect] = val.total > 0 ? Math.round(((val.aspects[aspect] || 0) / val.total) * 100) : 0
          })
          return entry
        })

        setTrendData(chartData)
      })
  }, [brandId])

  async function loadQuotes(aspect: string) {
    if (!brandId || quotes[aspect] !== undefined) return
    const keyword = ASPECT_KEYWORDS[aspect][0]
    const { data } = await (supabase as any)
      .from('reviews')
      .select('content, rating')
      .eq('brand_id', brandId)
      .ilike('content', `%${keyword}%`)
      .order('rating', { ascending: true })
      .limit(3)
    setQuotes(prev => ({ ...prev, [aspect]: data || [] }))
  }

  function toggleExpand(aspect: string) {
    const next = !expanded[aspect]
    setExpanded(prev => ({ ...prev, [aspect]: next }))
    if (next) loadQuotes(aspect)
  }

  const marketMap = Object.fromEntries(marketAspects.map(a => [a.aspect, a]))
  const totalReviews = stats?.overview?.totalReviews ?? 0

  function cardBorder(positive: number) {
    if (positive >= 80) return 'border-green-300 bg-green-50'
    if (positive >= 60) return 'border-yellow-300 bg-yellow-50'
    return 'border-red-300 bg-red-50'
  }

  function positiveColor(positive: number) {
    if (positive >= 80) return 'text-green-700'
    if (positive >= 60) return 'text-yellow-700'
    return 'text-red-700'
  }

  const comparisonRows = aspects
    .map(a => {
      const market = marketMap[a.aspect]
      const diff = market ? a.positive - market.positive : null
      return { ...a, marketPositive: market?.positive ?? null, diff }
    })
    .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* SEKCJA 1 — Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" /> Mapa problemów operacyjnych
          </h1>
          <p className="text-muted-foreground mt-1">
            Analiza {totalReviews.toLocaleString()} opinii · {brandName || '—'} · ostatnie 12 miesięcy
          </p>
        </div>
        {isAdmin && brands.length > 0 && (
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-background"
            value={brandId || ''}
            onChange={e => {
              const b = brands.find((b: any) => b.id === e.target.value) as any
              setBrandId(e.target.value)
              setBrandName(b?.name || '')
              setQuotes({})
              setExpanded({})
            }}
          >
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* SEKCJA 2 — Karty aspektów */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Analiza aspektów</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aspects.map(a => {
            const market = marketMap[a.aspect]
            const diff = market ? a.positive - market.positive : null
            const isExpanded = expanded[a.aspect]
            return (
              <Card
                key={a.aspect}
                className={`border-2 ${cardBorder(a.positive)} cursor-pointer transition-all`}
                onClick={() => toggleExpand(a.aspect)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{ASPECT_LABELS[a.aspect] || a.aspect}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{a.mentions} wzmianek</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  <div className={`text-3xl font-bold mb-2 ${positiveColor(a.positive)}`}>{a.positive}%</div>
                  <Progress value={a.positive} className="h-2 mb-3" />

                  {diff !== null && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${diff >= 0 ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`}
                    >
                      {diff >= 0 ? `↑ +${diff}%` : `↓ ${diff}%`} vs rynek
                    </Badge>
                  )}

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {quotes[a.aspect] === undefined ? (
                        <p className="text-xs text-muted-foreground">Ładowanie cytatów…</p>
                      ) : quotes[a.aspect].length === 0 ? (
                        <p className="text-xs text-muted-foreground">Brak cytatów dla tego aspektu</p>
                      ) : (
                        quotes[a.aspect].map((q, i) => (
                          <div key={i} className="text-xs bg-white rounded p-2 border">
                            <span className="text-yellow-500">{'★'.repeat(q.rating)}</span>
                            <p className="mt-1 text-gray-700 line-clamp-3">{q.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* SEKCJA 3 — Trend w czasie */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trend wzmianek w czasie (ostatnie 6 miesięcy)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} width={40} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Legend />
                {Object.keys(ASPECT_KEYWORDS).map(aspect => (
                  <Line
                    key={aspect}
                    type="monotone"
                    dataKey={aspect}
                    stroke={ASPECT_CHART_COLORS[aspect]}
                    strokeWidth={2}
                    dot={false}
                    name={ASPECT_LABELS[aspect] || aspect}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* SEKCJA 4 — Tabela porównawcza */}
      {comparisonRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Porównanie vs rynek (sortowanie: najgorsze aspekty pierwsze)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Aspekt</th>
                    <th className="text-right py-2 font-medium">Twoja marka</th>
                    <th className="text-right py-2 font-medium">Rynek</th>
                    <th className="text-right py-2 font-medium">Różnica</th>
                    <th className="text-right py-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(row => (
                    <tr key={row.aspect} className="border-b hover:bg-muted/50">
                      <td className="py-2.5">{ASPECT_LABELS[row.aspect] || row.aspect}</td>
                      <td className="text-right py-2.5 font-medium">{row.positive}%</td>
                      <td className="text-right py-2.5 text-muted-foreground">
                        {row.marketPositive !== null ? `${row.marketPositive}%` : '—'}
                      </td>
                      <td className={`text-right py-2.5 font-medium ${row.diff !== null && row.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {row.diff !== null ? (row.diff >= 0 ? `+${row.diff}%` : `${row.diff}%`) : '—'}
                      </td>
                      <td className="text-right py-2.5 text-lg">
                        {row.diff === null ? '→' : row.diff > 2 ? '↑' : row.diff < -2 ? '↓' : '→'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
