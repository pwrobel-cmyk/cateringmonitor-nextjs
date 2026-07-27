'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, RotateCcw, Loader2, BadgePercent, AlertTriangle, Clock, CheckCircle2, XCircle, ExternalLink, Coins, DatabaseZap } from 'lucide-react'

// ─── Admin Nav ────────────────────────────────────────────────────────────────

const adminLinks = [
  { href: '/admin/discounts', label: 'Rabaty' },
  { href: '/admin/discounts-staging', label: 'Rabaty techniczne' },
  { href: '/admin/prices', label: 'Ceny' },
  { href: '/admin/reviews', label: 'Opinie' },
  { href: '/admin/scrapers', label: 'Scrapery' },
]

function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-2 mb-6">
      {adminLinks.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link key={link.href} href={link.href}>
            <Button variant={isActive ? 'default' : 'outline'} size="sm">{link.label}</Button>
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StagingDiscount {
  id: string
  brand_name_raw: string | null
  brand_id: string | null
  code: string | null
  percentage: number | null
  fixed_amount: number | null
  description: string | null
  valid_from: string | null
  valid_until: string | null
  min_days: number | null
  max_days: number | null
  min_order_value: number | null
  requirements: string | null
  exclusions_limits: string | null
  communication_channels: string | null
  is_cashback: boolean
  source: string | null
  source_url: string | null
  import_batch_id: string | null
  status: 'pending' | 'accepted' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  accepted_discount_id: string | null
  created_at: string
  brands: { name: string; logo_url: string | null } | null
}

interface Brand {
  id: string
  name: string
  logo_url: string | null
}

interface ExistingDiscount {
  brand_id: string | null
  code: string
  percentage: number | null
  fixed_amount: number | null
  valid_from: string | null
}

function normCode(c: string | null | undefined): string {
  return (c || '').trim().toUpperCase()
}

function isAlreadyInDiscounts(s: StagingDiscount, existing: ExistingDiscount[]): boolean {
  if (!s.brand_id) return false
  const sc = normCode(s.code)
  if (sc) {
    return existing.some(e => e.brand_id === s.brand_id && normCode(e.code) === sc)
  }
  return existing.some(e =>
    e.brand_id === s.brand_id &&
    e.percentage === s.percentage &&
    (e.valid_from ?? null) === (s.valid_from ?? null)
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiscountStagingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<StagingDiscount[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [brandSelections, setBrandSelections] = useState<Record<string, string>>({})
  const [kpi, setKpi] = useState({ pending: 0, acceptedToday: 0, rejectedToday: 0, alreadyInDb: 0 })
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set())

  // Auth guard
  useEffect(() => {
    if (user && user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      router.replace('/dashboard')
    }
  }, [user, router])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)

    const [{ data: stagingData }, { data: brandsData }, { data: discountsData }] = await Promise.all([
      supabase
        .from('discount_staging')
        .select('*')
        .in('status', ['pending', 'rejected'])
        .order('created_at', { ascending: false }),
      supabase
        .from('brands')
        .select('id, name, logo_url')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('discounts')
        .select('brand_id, code, percentage, fixed_amount, valid_from')
        .eq('is_active', true),
    ])

    const brandsList = (brandsData || []) as Brand[]
    setBrands(brandsList)
    const existingDiscounts = (discountsData || []) as ExistingDiscount[]

    // Join brands in JS (no FK on discount_staging → brands)
    const brandById = new Map(brandsList.map(b => [b.id, b]))
    const all = ((stagingData || []) as Array<Omit<StagingDiscount, 'brands'>>).map(row => {
      const brand = row.brand_id ? brandById.get(row.brand_id) : null
      return { ...row, brands: brand ? { name: brand.name, logo_url: brand.logo_url } : null } as StagingDiscount
    })

    // Detect duplicates against final discounts table
    const dupIds = new Set<string>()
    for (const item of all) {
      if (item.status === 'pending' && isAlreadyInDiscounts(item, existingDiscounts)) {
        dupIds.add(item.id)
      }
    }
    setDuplicateIds(dupIds)

    // Sort: pending (not dup) → pending (dup, "already in db") → rejected
    const pendingNew = all.filter(i => i.status === 'pending' && !dupIds.has(i.id))
    const pendingDup = all.filter(i => i.status === 'pending' && dupIds.has(i.id))
    const rejected = all.filter(i => i.status === 'rejected')
    setItems([...pendingNew, ...pendingDup, ...rejected])

    // KPI
    const today = new Date().toISOString().slice(0, 10)
    const { count: acceptedToday } = await supabase
      .from('discount_staging')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .gte('reviewed_at', today)

    const { count: rejectedToday } = await supabase
      .from('discount_staging')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected')
      .gte('reviewed_at', today)

    setKpi({
      pending: pendingNew.length,
      alreadyInDb: dupIds.size,
      acceptedToday: acceptedToday || 0,
      rejectedToday: rejectedToday || 0,
    })

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Actions
  const handleAction = async (action: 'accept' | 'reject' | 'restore', stagingId: string) => {
    setActionLoading(prev => ({ ...prev, [stagingId]: true }))
    try {
      const res = await fetch('/api/admin/discount-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, stagingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Błąd')
        return
      }

      if (action === 'accept') {
        setItems(prev => prev.filter(i => i.id !== stagingId))
        setKpi(prev => ({ ...prev, pending: prev.pending - 1, acceptedToday: prev.acceptedToday + 1 }))
        toast.success('Rabat dodany')
      } else if (action === 'reject') {
        setItems(prev => {
          const updated = prev.map(i => i.id === stagingId ? { ...i, status: 'rejected' as const } : i)
          const pending = updated.filter(i => i.status === 'pending')
          const rejected = updated.filter(i => i.status === 'rejected')
          return [...pending, ...rejected]
        })
        setKpi(prev => ({ ...prev, pending: prev.pending - 1, rejectedToday: prev.rejectedToday + 1 }))
        toast.success('Rabat odrzucony')
      } else if (action === 'restore') {
        setItems(prev => {
          const updated = prev.map(i => i.id === stagingId ? { ...i, status: 'pending' as const } : i)
          const pending = updated.filter(i => i.status === 'pending')
          const rejected = updated.filter(i => i.status === 'rejected')
          return [...pending, ...rejected]
        })
        setKpi(prev => ({ ...prev, pending: prev.pending + 1, rejectedToday: Math.max(0, prev.rejectedToday - 1) }))
        toast.success('Rabat przywrócony do weryfikacji')
      }
    } catch {
      toast.error('Błąd sieci')
    } finally {
      setActionLoading(prev => ({ ...prev, [stagingId]: false }))
    }
  }

  const handleAssignBrand = async (stagingId: string, brandId: string) => {
    setBrandSelections(prev => ({ ...prev, [stagingId]: brandId }))
    try {
      const res = await fetch('/api/admin/discount-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-brand', stagingId, brandId }),
      })
      if (!res.ok) {
        toast.error('Błąd przypisywania marki')
        return
      }
      // Update local state with the brand info
      const brand = brands.find(b => b.id === brandId)
      setItems(prev => prev.map(i =>
        i.id === stagingId
          ? { ...i, brand_id: brandId, brands: brand ? { name: brand.name, logo_url: brand.logo_url } : null }
          : i
      ))
      toast.success('Marka przypisana')
    } catch {
      toast.error('Błąd sieci')
    }
  }

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <AdminNav />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <BadgePercent className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Rabaty techniczne</h1>
        </div>
        <p className="text-muted-foreground ml-10">Weryfikacja rabatów z automatycznego importu</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{kpi.pending}</div>
              <div className="text-xs text-muted-foreground">Oczekujące</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <DatabaseZap className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{kpi.alreadyInDb}</div>
              <div className="text-xs text-muted-foreground">Już w bazie</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{kpi.acceptedToday}</div>
              <div className="text-xs text-muted-foreground">Zaakceptowane dziś</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <div>
              <div className="text-2xl font-bold">{kpi.rejectedToday}</div>
              <div className="text-xs text-muted-foreground">Odrzucone dziś</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Brak rabatów do weryfikacji
          </CardContent>
        </Card>
      )}

      {/* Discount list */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const isRejected = item.status === 'rejected'
            const isDuplicate = duplicateIds.has(item.id)
            const isLoading = actionLoading[item.id]
            const hasBrand = !!item.brand_id
            const isGrayed = isRejected || isDuplicate

            return (
              <Card
                key={item.id}
                className={`transition-all duration-300 ${isGrayed ? 'opacity-50 grayscale' : ''}`}
              >
                <CardContent className="py-4 flex items-center gap-4">
                  {/* Brand logo / name */}
                  <div className="flex-shrink-0 w-48">
                    {hasBrand && item.brands ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.brands.logo_url ? (
                            <img src={item.brands.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                              {item.brands.name.charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-sm truncate">{item.brands.name}</span>
                        </div>
                        {isDuplicate && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1.5">
                            <DatabaseZap className="h-3 w-3 mr-0.5" />
                            Już w bazie
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{item.brand_name_raw || '—'}</span>
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            nierozpoznana
                          </Badge>
                        </div>
                        {!isRejected && !isDuplicate && (
                          <Select
                            value={brandSelections[item.id] || ''}
                            onValueChange={(v) => v && handleAssignBrand(item.id, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-44">
                              <SelectValue placeholder="Przypisz markę..." />
                            </SelectTrigger>
                            <SelectContent>
                              {brands.map(b => (
                                <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Code */}
                  <div className="flex-shrink-0 w-28">
                    {item.code ? (
                      <span className="font-mono font-bold text-sm">{item.code}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Percentage / amount badge */}
                  <div className="flex-shrink-0 w-20">
                    {item.percentage != null ? (
                      <Badge className="text-base px-2.5 py-0.5">-{item.percentage}%</Badge>
                    ) : item.fixed_amount != null ? (
                      <Badge variant="secondary" className="text-base px-2.5 py-0.5">{item.fixed_amount} zł</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-sm px-2.5 py-0.5">benefit</Badge>
                    )}
                    {item.is_cashback && (
                      <Badge variant="outline" className="text-[10px] mt-1 flex items-center gap-0.5 w-fit">
                        <Coins className="h-3 w-3" />cashback
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Date range */}
                    <div className="text-xs text-muted-foreground">
                      {item.valid_from || '—'} – {item.valid_until || 'bezterminowy'}
                    </div>
                    {/* Days range */}
                    {(item.min_days != null || item.max_days != null) && (
                      <div className="text-xs text-muted-foreground">
                        {item.min_days != null && item.max_days != null
                          ? `${item.min_days}–${item.max_days} dni`
                          : item.min_days != null
                            ? `min. ${item.min_days} dni`
                            : `max. ${item.max_days} dni`}
                      </div>
                    )}
                    {/* Min order value */}
                    {item.min_order_value != null && (
                      <div className="text-xs text-muted-foreground">min. zamówienie: {item.min_order_value} zł</div>
                    )}
                    {item.requirements && (
                      <div className="text-xs text-muted-foreground truncate" title={item.requirements}>
                        {item.requirements}
                      </div>
                    )}
                    {item.exclusions_limits && (
                      <div className="text-xs text-muted-foreground truncate" title={item.exclusions_limits}>
                        Wykluczenia: {item.exclusions_limits}
                      </div>
                    )}
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate" title={item.description}>
                        {item.description}
                      </div>
                    )}
                    {item.communication_channels && (
                      <div className="text-xs text-muted-foreground truncate">
                        Kanały: {item.communication_channels}
                      </div>
                    )}
                    {/* Source & import date */}
                    <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                      {item.source && <span>Źródło: {item.source}</span>}
                      {item.source && item.created_at && <span> · </span>}
                      {item.created_at && <span>Import: {new Date(item.created_at).toLocaleDateString('pl-PL')}</span>}
                      {item.source_url && (
                        <>
                          <span> · </span>
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
                            URL<ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {item.status === 'pending' && !isDuplicate && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleAction('accept', item.id)}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                          Zaakceptuj
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={isLoading}
                          onClick={() => handleAction('reject', item.id)}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                          Odrzuć
                        </Button>
                      </div>
                    )}
                    {isDuplicate && (
                      <div className="text-[10px] text-muted-foreground text-right max-w-[180px]">
                        Rabat o tym kodzie istnieje już w{' '}
                        <Link href="/admin/discounts" className="underline hover:text-foreground">Rabatach</Link>
                      </div>
                    )}
                    {item.status === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => handleAction('restore', item.id)}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                        Przywróć
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
