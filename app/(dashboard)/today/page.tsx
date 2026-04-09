'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { useBrands } from '@/hooks/supabase/useBrands'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, AlertTriangle, Info, RefreshCw, Zap, Building2 } from 'lucide-react'

type Priority = 'critical' | 'warning' | 'info'

interface Recommendation {
  priority: Priority
  category: string
  title: string
  description: string
  action_label: string
  action_href: string
}

const PL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'critical') return <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
  if (priority === 'warning') return <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
  return <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
}

function borderColor(priority: Priority) {
  if (priority === 'critical') return 'border-l-red-500'
  if (priority === 'warning') return 'border-l-yellow-400'
  return 'border-l-blue-300'
}

export default function TodayPage() {
  const { user } = useAuth()
  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const { data: allBrands = [] } = useBrands()
  const [brandId, setBrandId] = useState<string | undefined>()
  const [brandName, setBrandName] = useState<string>('')
  const [hasAssignment, setHasAssignment] = useState<boolean | null>(null) // null = loading
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // Load brandId from user_brand_assignments (or first brand for admin)
  useEffect(() => {
    if (!user) return
    if (isAdmin) {
      if (allBrands.length > 0 && !brandId) {
        const first = allBrands[0] as any
        setBrandId(first.id)
        setBrandName(first.name || '')
        setHasAssignment(true)
      }
      return
    }
    ;(supabase as any)
      .from('user_brand_assignments')
      .select('brand_id, brands(name)')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: any) => {
        if (data?.brand_id) {
          setBrandId(data.brand_id)
          setBrandName(data.brands?.name || '')
          setHasAssignment(true)
        } else {
          setHasAssignment(false)
          setLoading(false)
        }
      })
  }, [user, isAdmin, allBrands, brandId])

  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)

    const now = new Date()
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const [negRes, priceRes, discRes, currReviews, prevReviews] = await Promise.all([
      // A) Negatywne opinie bez odpowiedzi — ostatnie 48h
      (supabase as any)
        .from('reviews')
        .select('id,author_name,rating,content,source,review_date,status,brand_id,brands(name)')
        .lte('rating', 3)
        .gte('review_date', twoDaysAgo)
        .not('status', 'in', '("done","skipped")')
        .eq('is_approved', true)
        .eq('brand_id', brandId)
        .limit(20),

      // B) Zmiany cen — ostatnie 7 dni
      (supabase as any)
        .from('price_history')
        .select('id,price,recorded_at,package_id,packages(name,kcal_from,kcal_to,brands(name,logo_url))')
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false })
        .limit(100),

      // C) Aktywne rabaty uruchomione w ostatnich 7 dniach
      (supabase as any)
        .from('discounts')
        .select('id,discount_percentage,valid_from,valid_until,is_active,brands(name,logo_url)')
        .eq('is_active', true)
        .gte('valid_from', sevenDaysAgo.slice(0, 10))
        .order('discount_percentage', { ascending: false })
        .limit(10),

      // D) Oceny bieżące 30 dni
      (supabase as any)
        .from('reviews')
        .select('rating')
        .eq('brand_id', brandId)
        .eq('is_approved', true)
        .gte('review_date', thirtyDaysAgo.slice(0, 10)),

      // E) Oceny poprzednie 30 dni
      (supabase as any)
        .from('reviews')
        .select('rating')
        .eq('brand_id', brandId)
        .eq('is_approved', true)
        .gte('review_date', sixtyDaysAgo.slice(0, 10))
        .lt('review_date', thirtyDaysAgo.slice(0, 10)),
    ])

    const negativeReviews: any[] = negRes.data || []
    const priceHistory: any[] = priceRes.data || []
    const discounts: any[] = discRes.data || []

    const recs: Recommendation[] = []

    // 1. Negatywne opinie bez odpowiedzi
    if (negativeReviews.length >= 1) {
      const sample = negativeReviews
        .slice(0, 2)
        .map((r: any) => `"${r.author_name}" (${r.rating}★)`)
        .join(', ')
      recs.push({
        priority: 'critical',
        category: 'Opinie',
        title: `${negativeReviews.length} ${negativeReviews.length === 1 ? 'opinia wymaga' : 'opinii wymaga'} odpowiedzi`,
        description: `Ostatnie 48h — ${sample}${negativeReviews.length > 2 ? ` i ${negativeReviews.length - 2} więcej` : ''}`,
        action_label: 'Odpowiedz w Review Manager',
        action_href: '/review-manager',
      })
    }

    // 2. Zmiany cen >5%
    const packagePrices: Record<string, { price: number; recorded_at: string; name: string; brandName: string }[]> = {}
    priceHistory.forEach((ph: any) => {
      const pkgId = ph.package_id
      if (!pkgId) return
      if (!packagePrices[pkgId]) packagePrices[pkgId] = []
      packagePrices[pkgId].push({
        price: ph.price,
        recorded_at: ph.recorded_at,
        name: ph.packages?.name || '',
        brandName: ph.packages?.brands?.name || '',
      })
    })

    const significantChanges: { brand: string; pkg: string; oldPrice: number; newPrice: number; pct: number }[] = []
    Object.values(packagePrices).forEach(prices => {
      if (prices.length < 2) return
      const sorted = [...prices].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      const oldest = sorted[0]
      const newest = sorted[sorted.length - 1]
      if (!oldest.price) return
      const pct = ((newest.price - oldest.price) / oldest.price) * 100
      if (Math.abs(pct) > 5) {
        significantChanges.push({
          brand: newest.brandName,
          pkg: newest.name,
          oldPrice: oldest.price,
          newPrice: newest.price,
          pct,
        })
      }
    })

    if (significantChanges.length > 0) {
      const byBrand: Record<string, typeof significantChanges> = {}
      significantChanges.forEach(c => {
        if (!byBrand[c.brand]) byBrand[c.brand] = []
        byBrand[c.brand].push(c)
      })
      Object.entries(byBrand).forEach(([brand, changes]) => {
        const biggest = [...changes].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0]
        recs.push({
          priority: 'warning',
          category: 'Ceny',
          title: `Zmiana ceny u ${brand}`,
          description: `${biggest.pkg}: ${biggest.oldPrice.toFixed(0)} → ${biggest.newPrice.toFixed(0)} zł (${biggest.pct > 0 ? '+' : ''}${biggest.pct.toFixed(1)}%)${changes.length > 1 ? ` · ${changes.length - 1} więcej pakietów` : ''}`,
          action_label: 'Sprawdź ceny',
          action_href: '/compare',
        })
      })
    }

    // 3. Aktywne rabaty
    if (discounts.length > 0) {
      const top = discounts[0]
      recs.push({
        priority: 'info',
        category: 'Rabaty',
        title: `Rynek aktywuje promocje — ${discounts.length} aktywnych rabatów`,
        description: `Największy: ${top.brands?.name} −${top.discount_percentage}% (do ${top.valid_until ? new Date(top.valid_until).toLocaleDateString('pl-PL') : '?'})`,
        action_label: 'Zobacz rabaty',
        action_href: '/discounts',
      })
    }

    // 4. Spadek oceny / velocity
    const currRatings: any[] = currReviews.data || []
    const prevRatings: any[] = prevReviews.data || []
    const currAvg = currRatings.length > 0 ? currRatings.reduce((s: number, r: any) => s + r.rating, 0) / currRatings.length : 0
    const prevAvg = prevRatings.length > 0 ? prevRatings.reduce((s: number, r: any) => s + r.rating, 0) / prevRatings.length : 0
    if (prevAvg > 0 && currAvg > 0 && currAvg - prevAvg < -0.2) {
      recs.push({
        priority: 'warning',
        category: 'Ocena',
        title: 'Spadek średniej oceny marki',
        description: `Poprzednie 30 dni: ${prevAvg.toFixed(2)}★ → Bieżące 30 dni: ${currAvg.toFixed(2)}★`,
        action_label: 'Sprawdź opinie',
        action_href: '/review-manager?tab=analytics',
      })
    }
    if (prevRatings.length > 0 && currRatings.length < prevRatings.length * 0.7) {
      recs.push({
        priority: 'info',
        category: 'Aktywność',
        title: 'Spada aktywność opinii',
        description: `Bieżące 30 dni: ${currRatings.length} opinii vs poprzednie: ${prevRatings.length} (−${Math.round((1 - currRatings.length / prevRatings.length) * 100)}%)`,
        action_label: 'Zobacz trendy',
        action_href: '/reports',
      })
    }

    setRecommendations(recs)
    setUpdatedAt(new Date())

    // Store urgent count in localStorage for navigation badge
    const urgentCount = recs.filter(r => r.priority === 'critical' || r.priority === 'warning').length
    if (typeof window !== 'undefined') {
      localStorage.setItem('urgentCount', urgentCount > 0 ? String(urgentCount) : '')
    }

    setLoading(false)
  }, [brandId])

  useEffect(() => {
    if (hasAssignment === false) return
    if (hasAssignment === null) return
    loadData()
  }, [loadData, brandId, hasAssignment])

  const urgent = recommendations.filter(r => r.priority === 'critical' || r.priority === 'warning')
  const observations = recommendations.filter(r => r.priority === 'info')

  const today = new Date().toLocaleDateString('pl-PL', PL_DATE_OPTIONS)
  const updatedStr = updatedAt
    ? updatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : null

  // Brak przypisania marki
  if (hasAssignment === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center p-6">
        <Zap className="h-14 w-14 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Wybierz swoją markę</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          Aby zobaczyć rekomendacje dla Twojej marki, najpierw skonfiguruj konto w Review Manager.
        </p>
        <Link href="/review-manager">
          <Button>Przejdź do Review Manager →</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
            <Zap className="h-6 w-6 text-yellow-500" />
            Co zrobić dziś
            <span className="text-muted-foreground font-normal text-base">· {today}</span>
          </h1>
          {/* Brand pill / admin dropdown */}
          <div className="mt-2">
            {isAdmin && allBrands.length > 0 ? (
              <select
                className="text-sm border rounded-full px-3 py-1 bg-muted font-medium focus:outline-none"
                value={brandId || ''}
                onChange={e => {
                  const b = allBrands.find((b: any) => b.id === e.target.value) as any
                  setBrandId(e.target.value)
                  setBrandName(b?.name || '')
                  setRecommendations([])
                }}
              >
                {allBrands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : brandName ? (
              <span className="inline-flex items-center gap-1.5 text-sm bg-muted rounded-full px-3 py-1 font-medium">
                <Building2 className="h-3.5 w-3.5" />
                {brandName}
              </span>
            ) : null}
          </div>
          {updatedStr && !loading && (
            <p className="text-sm text-muted-foreground mt-1.5">
              {recommendations.length} działań · zaktualizowano {updatedStr}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Pilne działania */}
          {urgent.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pilne działania ({urgent.length})
              </h2>
              {urgent.map((rec, i) => (
                <Card key={i} className={`border-l-4 ${borderColor(rec.priority)}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <PriorityIcon priority={rec.priority} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground font-medium">{rec.category}</span>
                        <p className="font-semibold text-sm mt-0.5">{rec.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{rec.description}</p>
                      </div>
                      <Link href={rec.action_href} className="flex-shrink-0">
                        <Button size="sm" variant={rec.priority === 'critical' ? 'default' : 'outline'}>
                          {rec.action_label}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Obserwacje */}
          {observations.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Obserwacje ({observations.length})
              </h2>
              {observations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-muted/50 border">
                  <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">{rec.category} · </span>
                    <span className="text-sm font-medium">{rec.title}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                  </div>
                  <Link href={rec.action_href} className="flex-shrink-0">
                    <Button size="sm" variant="ghost" className="text-xs">
                      {rec.action_label} →
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {recommendations.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 text-green-500" />
              <p className="font-semibold">Wszystko pod kontrolą!</p>
              <p className="text-sm mt-1">Brak pilnych działań na dziś.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
