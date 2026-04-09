'use client'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Star, MessageSquare, TrendingUp, TrendingDown, Printer, Mail, Loader2 } from "lucide-react"
import { useState, useRef, useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"

interface DynamicReportProps {
  brandId: string | null
  brandName: string
  brandLogoUrl?: string | null
  dateFrom: string
  dateTo: string
}

async function fetchAllReviews(brandId: string | null, dateFrom: string, dateTo: string) {
  let all: any[] = []
  let from = 0
  const size = 1000

  while (true) {
    let q = (supabase as any)
      .from('reviews')
      .select('rating, content, review_date, source, author_name')
      .eq('is_approved', true)
      .gte('review_date', dateFrom)
      .lte('review_date', dateTo)
      .order('review_date', { ascending: true })

    if (brandId) q = q.eq('brand_id', brandId)

    const { data, error } = await q.range(from, from + size - 1)
    if (error) throw error
    if (!data?.length) break
    all = [...all, ...data]
    if (data.length < size) break
    from += size
  }

  return all
}

export function DynamicReport({ brandId, brandName, brandLogoUrl, dateFrom, dateTo }: DynamicReportProps) {
  const [showEmail, setShowEmail] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([])
  const [extraEmails, setExtraEmails] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; errors: string[] } | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['dynamic-report-reviews', brandId, dateFrom, dateTo],
    queryFn: () => fetchAllReviews(brandId, dateFrom, dateTo),
  })

  const stats = useMemo(() => {
    if (!reviews.length) return null
    const total = reviews.length
    const avgRating = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / total
    const positive = reviews.filter((r: any) => r.rating >= 4).length
    const negative = reviews.filter((r: any) => r.rating <= 2).length
    return {
      total,
      avgRating: avgRating.toFixed(2),
      positivePercent: ((positive / total) * 100).toFixed(1),
      negativePercent: ((negative / total) * 100).toFixed(1),
    }
  }, [reviews])

  const monthlyTrends = useMemo(() => {
    const buckets: Record<string, number[]> = {}
    reviews.forEach((r: any) => {
      if (!r.review_date) return
      const key = r.review_date.slice(0, 7)
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(r.rating || 0)
    })
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, ratings]) => ({
        month,
        avgRating: parseFloat((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2)),
        count: ratings.length,
      }))
  }, [reviews])

  const ratingDist = useMemo(() => {
    return [5, 4, 3, 2, 1].map(star => {
      const count = reviews.filter((r: any) => r.rating === star).length
      return {
        star,
        count,
        percent: reviews.length ? parseFloat(((count / reviews.length) * 100).toFixed(1)) : 0,
      }
    })
  }, [reviews])

  const quotes = useMemo(() => {
    const positive = reviews.filter((r: any) => r.rating >= 4 && r.content?.length > 20).slice(-6).reverse()
    const negative = reviews.filter((r: any) => r.rating <= 2 && r.content?.length > 20).slice(-4).reverse()
    return { positive, negative }
  }, [reviews])

  const { data: discounts = [] } = useQuery({
    queryKey: ['dynamic-report-discounts', brandId, dateFrom, dateTo],
    queryFn: async () => {
      let q = (supabase as any)
        .from('discounts')
        .select('code, percentage, valid_from, valid_until, description, brands(name)')
        .gte('valid_from', dateFrom)
        .lte('valid_from', dateTo)
        .order('valid_from', { ascending: false })
      if (brandId) q = q.eq('brand_id', brandId)
      const { data } = await q
      return data || []
    },
  })

  const { data: prices = [] } = useQuery({
    queryKey: ['dynamic-report-prices', brandId, dateFrom, dateTo],
    enabled: !!brandId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('price_history')
        .select(`
          price,
          date_recorded,
          package_kcal_ranges!fk_price_history_package_kcal_range(
            kcal_from,
            packages!inner(
              name,
              brands!inner(id, name)
            )
          )
        `)
        .gte('date_recorded', dateFrom)
        .lte('date_recorded', dateTo)
        .order('date_recorded', { ascending: false })
        .limit(50)
      if (!data) return []
      return data.filter((p: any) => {
        const bid = p.package_kcal_ranges?.packages?.brands?.id
        return !brandId || bid === brandId
      })
    },
  })

  const { data: usersData } = useQuery({
    queryKey: ['admin-users-for-email'],
    enabled: showEmail,
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      return json.users || []
    },
  })

  const handlePrint = () => window.print()

  const handleSendEmail = async () => {
    setSending(true)
    setSendResult(null)
    const emails = [
      ...selectedUserEmails,
      ...extraEmails.split('\n').map((e: string) => e.trim()).filter(Boolean),
    ]
    const reportHtml = reportRef.current?.outerHTML || ''
    const subject = `Raport ${brandName} · ${dateFrom} – ${dateTo}`
    const res = await fetch('/api/admin/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, reportHtml, subject }),
    })
    const result = await res.json()
    setSendResult(result)
    setSending(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    )
  }

  return (
    <>
      {/* Action buttons */}
      <div className="flex gap-3 mb-6 no-print">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Pobierz PDF
        </Button>
        <Button variant="outline" onClick={() => setShowEmail(true)}>
          <Mail className="h-4 w-4 mr-2" />
          Wyślij email
        </Button>
      </div>

      {/* Report content */}
      <div ref={reportRef} className="report-content space-y-8">

        {/* SEKCJA 1 — Header */}
        <div className="flex items-start gap-6 pb-6 border-b">
          {brandLogoUrl ? (
            <div className="h-16 w-16 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm flex-shrink-0">
              <img src={brandLogoUrl} alt={brandName} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Raport {brandName}</h1>
            <p className="text-muted-foreground mt-1">{dateFrom} – {dateTo}</p>
          </div>
        </div>

        {/* SEKCJA 1 — KPI Cards */}
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">Łączna liczba opinii</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold">{Number(stats.total).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">Średnia ocena</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold flex items-center gap-1">
                  {stats.avgRating}
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">% pozytywnych</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
                  {stats.positivePercent}%
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal">% negatywnych</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold text-red-600 flex items-center gap-1">
                  {stats.negativePercent}%
                  <TrendingDown className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Brak opinii w wybranym zakresie dat
            </CardContent>
          </Card>
        )}

        {/* SEKCJA 2 — Monthly Trends */}
        {monthlyTrends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Trendy miesięczne</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="rating" domain={[0, 5]} width={30} />
                  <YAxis yAxisId="count" orientation="right" width={40} />
                  <Tooltip />
                  <Line
                    yAxisId="rating"
                    type="monotone"
                    dataKey="avgRating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Śr. ocena"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    name="Liczba opinii"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* SEKCJA 3 — Rating Distribution */}
        {stats && (
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
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percent}%`,
                          backgroundColor:
                            star >= 4 ? 'hsl(142,76%,36%)' : star === 3 ? 'hsl(43,96%,53%)' : 'hsl(0,84%,60%)',
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-28 text-right">
                      {count.toLocaleString()} ({percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SEKCJA 4 — Quotes */}
        {(quotes.positive.length > 0 || quotes.negative.length > 0) && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Wybrane opinie</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide">Pozytywne</h3>
                {quotes.positive.slice(0, 3).map((q: any, i: number) => (
                  <Card key={i} className="border-green-200 dark:border-green-900">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                          {(q.author_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate">{q.author_name || 'Anonimowy'}</span>
                        <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">{q.rating}★</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {q.content?.slice(0, 200)}{q.content?.length > 200 ? '…' : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide">Negatywne</h3>
                {quotes.negative.slice(0, 3).map((q: any, i: number) => (
                  <Card key={i} className="border-red-200 dark:border-red-900">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-300">
                          {(q.author_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate">{q.author_name || 'Anonimowy'}</span>
                        <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">{q.rating}★</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {q.content?.slice(0, 200)}{q.content?.length > 200 ? '…' : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEKCJA 5 — Discounts */}
        {discounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rabaty w okresie</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Marka</th>
                    <th className="pb-2 text-left font-medium">Kod</th>
                    <th className="pb-2 text-right font-medium">Rabat</th>
                    <th className="pb-2 text-right font-medium">Od</th>
                    <th className="pb-2 text-right font-medium">Do</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((d: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{d.brands?.name || brandName}</td>
                      <td className="py-2 font-mono text-xs">{d.code || '—'}</td>
                      <td className="py-2 text-right font-medium">{d.percentage != null ? `${d.percentage}%` : '—'}</td>
                      <td className="py-2 text-right text-muted-foreground">{d.valid_from?.slice(0, 10) || '—'}</td>
                      <td className="py-2 text-right text-muted-foreground">{d.valid_until?.slice(0, 10) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* SEKCJA 6 — Prices */}
        {brandId && prices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ceny w okresie</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Pakiet</th>
                    <th className="pb-2 text-right font-medium">Kcal od</th>
                    <th className="pb-2 text-right font-medium">Cena</th>
                    <th className="pb-2 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.slice(0, 20).map((p: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{p.package_kcal_ranges?.packages?.name || '—'}</td>
                      <td className="py-2 text-right">{p.package_kcal_ranges?.kcal_from ?? '—'}</td>
                      <td className="py-2 text-right font-medium">
                        {p.price != null ? `${Number(p.price).toFixed(2)} zł` : '—'}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {p.date_recorded?.slice(0, 10) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Email Modal */}
      <Dialog open={showEmail} onOpenChange={open => { setShowEmail(open); if (!open) { setSendResult(null); setSelectedUserEmails([]); setExtraEmails('') } }}>
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie...
                  </div>
                ) : usersData.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2.5 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50">
                    <Checkbox
                      checked={selectedUserEmails.includes(u.email)}
                      onCheckedChange={checked => {
                        setSelectedUserEmails(prev =>
                          checked ? [...prev, u.email] : prev.filter(e => e !== u.email)
                        )
                      }}
                    />
                    <span className="text-sm flex-1 truncate">{u.full_name || u.email}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="extra-emails" className="text-sm font-medium mb-2 block">
                Dodatkowe adresy email
              </Label>
              <Textarea
                id="extra-emails"
                placeholder={"email@example.com\nkolejny@email.pl"}
                value={extraEmails}
                onChange={e => setExtraEmails(e.target.value)}
                rows={3}
              />
            </div>
            {sendResult && (
              <div className={`text-sm p-3 rounded-lg ${sendResult.errors.length === 0 ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}`}>
                Wysłano: {sendResult.sent}.{sendResult.errors.length > 0 && ` Błędy: ${sendResult.errors.join('; ')}`}
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleSendEmail}
              disabled={sending || (selectedUserEmails.length === 0 && !extraEmails.trim())}
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wysyłanie…</>
              ) : 'Wyślij'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
