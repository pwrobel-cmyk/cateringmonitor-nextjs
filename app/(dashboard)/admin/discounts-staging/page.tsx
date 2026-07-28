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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, RotateCcw, Loader2, BadgePercent, AlertTriangle, Clock, CheckCircle2, XCircle, ExternalLink, Coins, DatabaseZap, RefreshCw, PencilLine, ChevronDown, ChevronUp, Image } from 'lucide-react'

// ─── Admin Nav ────────────────────────────────────────────────────────────────

const adminLinks = [
  { href: '/admin/discounts', label: 'Rabaty' },
  { href: '/admin/discounts-staging', label: 'Rabaty techniczne' },
  { href: '/admin/social-sources', label: 'Źródła social' },
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
  additional_notes: string | null
  code_source: string[] | null
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
  // Social fields
  source_platform: string | null
  source_type: string | null
  source_name: string | null
  source_profile_url: string | null
  post_url: string | null
  post_published_at: string | null
  is_official: boolean | null
  source_text: string | null
  ocr_text: string | null
  screenshot_url: string | null
  // Grouping
  core_fingerprint: string | null
  related_staging_id: string | null
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
  valid_until: string | null
}

type StagingClass =
  | { kind: 'new' }
  | { kind: 'duplicate'; expired: boolean; dbUntil: string | null }
  | { kind: 'reissued'; prevUntil: string }
  | { kind: 'changed'; dbPct: number | null; dbAmt: number | null; dbUntil: string | null }

function normCode(c: string | null | undefined): string {
  return (c || '').trim().toUpperCase()
}

/** Normalize date to YYYY-MM-DD, handling TIMESTAMPTZ ("2026-07-27T21:59:00+00:00") and DATE ("2026-07-27"). */
function toDateOnly(v: string | null | undefined): string | null {
  if (!v) return null
  return v.slice(0, 10)  // "2026-07-27T21:59:00+00:00" → "2026-07-27"
}

function classifyStagingItem(s: StagingDiscount, existing: ExistingDiscount[], today: string): StagingClass {
  if (!s.brand_id) return { kind: 'new' }

  const sc = normCode(s.code)
  let matches: ExistingDiscount[]
  if (sc) {
    matches = existing.filter(e => e.brand_id === s.brand_id && normCode(e.code) === sc)
  } else {
    matches = existing.filter(e =>
      e.brand_id === s.brand_id &&
      e.percentage === s.percentage &&
      toDateOnly(e.valid_from) === toDateOnly(s.valid_from)
    )
  }

  if (matches.length === 0) return { kind: 'new' }

  const isActive = (m: ExistingDiscount) => {
    const d = toDateOnly(m.valid_until)
    return d == null || d >= today
  }

  const sUntil = toDateOnly(s.valid_until)

  // 1. DUPLICATE — identical terms exist in DB (active or expired)
  const identicalMatch = matches.find(m =>
    m.percentage === s.percentage &&
    m.fixed_amount === s.fixed_amount &&
    toDateOnly(m.valid_until) === sUntil
  )
  if (identicalMatch) {
    return {
      kind: 'duplicate',
      expired: !isActive(identicalMatch),
      dbUntil: toDateOnly(identicalMatch.valid_until),
    }
  }

  const activeMatches = matches.filter(isActive)
  const expiredMatches = matches.filter(m => !isActive(m))

  // 2. REISSUED — all matches expired, staging has later valid_until
  if (activeMatches.length === 0 && expiredMatches.length > 0) {
    const latestExpired = [...expiredMatches].sort((a, b) =>
      (toDateOnly(b.valid_until) || '').localeCompare(toDateOnly(a.valid_until) || '')
    )[0]

    const latestDate = toDateOnly(latestExpired.valid_until)
    const stagingLater = (() => {
      if (sUntil == null) return true
      if (latestDate == null) return false
      return sUntil > latestDate
    })()

    if (stagingLater) {
      return { kind: 'reissued', prevUntil: latestDate! }
    }
  }

  // 3. CHANGED — match exists but terms differ
  const bestMatch = activeMatches[0] || expiredMatches[0]
  if (bestMatch) {
    return {
      kind: 'changed',
      dbPct: bestMatch.percentage,
      dbAmt: bestMatch.fixed_amount,
      dbUntil: toDateOnly(bestMatch.valid_until),
    }
  }

  return { kind: 'new' }
}

// ─── Accept Form ──────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = ['Total', 'WWW', 'FB Grupa', 'FB Profil', 'Instagram', 'CRM']

type AcceptForm = {
  code: string
  brand_id: string
  percentage: string
  fixed_amount: string
  valid_from: string
  valid_until: string
  requirements: string
  min_days: string
  max_days: string
  min_order_value: string
  code_source: string[]
  exclusions_limits: string
  description: string
  communication_channels: string
  additional_notes: string
  is_cashback: boolean
}

function stagingToForm(s: StagingDiscount): AcceptForm {
  return {
    code: s.code || '',
    brand_id: s.brand_id || '',
    percentage: s.percentage != null ? String(s.percentage) : '',
    fixed_amount: s.fixed_amount != null ? String(s.fixed_amount) : '',
    valid_from: s.valid_from || '',
    valid_until: s.valid_until || '',
    requirements: s.requirements || '',
    min_days: s.min_days != null ? String(s.min_days) : '',
    max_days: s.max_days != null ? String(s.max_days) : '',
    min_order_value: s.min_order_value != null ? String(s.min_order_value) : '',
    code_source: s.code_source || [],
    exclusions_limits: s.exclusions_limits || '',
    description: s.description || '',
    communication_channels: s.communication_channels || '',
    additional_notes: s.additional_notes || '',
    is_cashback: s.is_cashback || false,
  }
}

function formToOverrides(f: AcceptForm) {
  return {
    brand_id: f.brand_id || null,
    code: f.code,
    percentage: f.percentage ? Number(f.percentage) : null,
    fixed_amount: f.fixed_amount ? Number(f.fixed_amount) : null,
    valid_from: f.valid_from || null,
    valid_until: f.valid_until || null,
    description: f.description || null,
    min_days: f.min_days ? Number(f.min_days) : null,
    max_days: f.max_days ? Number(f.max_days) : null,
    min_order_value: f.min_order_value ? Number(f.min_order_value) : null,
    requirements: f.requirements || null,
    exclusions_limits: f.exclusions_limits || null,
    communication_channels: f.communication_channels || null,
    additional_notes: f.additional_notes || null,
    code_source: f.code_source.length > 0 ? f.code_source : null,
    is_cashback: f.is_cashback,
  }
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

function richness(s: StagingDiscount): number {
  let count = 0
  if (s.code) count++
  if (s.percentage != null) count++
  if (s.fixed_amount != null) count++
  if (s.valid_from) count++
  if (s.valid_until) count++
  if (s.min_days != null || s.max_days != null) count++
  if (s.min_order_value != null) count++
  if (s.requirements) count++
  if (s.exclusions_limits) count++
  return count
}

interface GroupedItem {
  primary: StagingDiscount
  related: StagingDiscount[]
}

function groupItems(items: StagingDiscount[]): GroupedItem[] {
  const result: GroupedItem[] = []
  const grouped = new Set<string>()

  // Pass 1: group by core_fingerprint (cross-source dedup)
  const coreGroups = new Map<string, StagingDiscount[]>()
  for (const item of items) {
    if (item.core_fingerprint) {
      const group = coreGroups.get(item.core_fingerprint) || []
      group.push(item)
      coreGroups.set(item.core_fingerprint, group)
    }
  }
  for (const group of coreGroups.values()) {
    if (group.length > 1) {
      const sorted = [...group].sort((a, b) => richness(b) - richness(a))
      result.push({ primary: sorted[0], related: sorted.slice(1) })
      for (const item of group) grouped.add(item.id)
    }
  }

  // Pass 2: group remaining by brand_id + code (same code variants)
  const remaining = items.filter(i => !grouped.has(i.id))
  const codeGroups = new Map<string, StagingDiscount[]>()
  const ungrouped: StagingDiscount[] = []

  for (const item of remaining) {
    const code = normCode(item.code)
    if (code && item.brand_id) {
      const key = `${item.brand_id}:${code}`
      const group = codeGroups.get(key) || []
      group.push(item)
      codeGroups.set(key, group)
    } else {
      ungrouped.push(item)
    }
  }

  for (const group of codeGroups.values()) {
    if (group.length === 1) {
      result.push({ primary: group[0], related: [] })
    } else {
      const sorted = [...group].sort((a, b) => richness(b) - richness(a))
      result.push({ primary: sorted[0], related: sorted.slice(1) })
    }
  }

  for (const item of ungrouped) {
    result.push({ primary: item, related: [] })
  }

  return result
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
  const [classMap, setClassMap] = useState<Record<string, StagingClass>>({})

  // Grouping and social display state
  const [expandedTexts, setExpandedTexts] = useState<Set<string>>(new Set())
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null)

  // Accept modal state
  const [acceptItem, setAcceptItem] = useState<StagingDiscount | null>(null)
  const [acceptForm, setAcceptForm] = useState<AcceptForm | null>(null)
  const [acceptSaving, setAcceptSaving] = useState(false)

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
        .select('brand_id, code, percentage, fixed_amount, valid_from, valid_until')
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

    // Classify pending items against final discounts table
    const today = new Date().toISOString().slice(0, 10)
    const cmap: Record<string, StagingClass> = {}
    for (const item of all) {
      if (item.status === 'pending') {
        cmap[item.id] = classifyStagingItem(item, existingDiscounts, today)
      }
    }
    setClassMap(cmap)

    // Sort: changed/reissued (need attention) → new → duplicate (gray) → rejected
    const changed = all.filter(i => i.status === 'pending' && (cmap[i.id]?.kind === 'changed' || cmap[i.id]?.kind === 'reissued'))
    const newItems = all.filter(i => i.status === 'pending' && cmap[i.id]?.kind === 'new')
    const dupes = all.filter(i => i.status === 'pending' && cmap[i.id]?.kind === 'duplicate')
    const rejected = all.filter(i => i.status === 'rejected')
    setItems([...changed, ...newItems, ...dupes, ...rejected])

    // KPI
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
      pending: changed.length + newItems.length,
      alreadyInDb: dupes.length,
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

  const openAcceptModal = (item: StagingDiscount) => {
    setAcceptItem(item)
    setAcceptForm(stagingToForm(item))
  }

  const closeAcceptModal = () => {
    setAcceptItem(null)
    setAcceptForm(null)
    setAcceptSaving(false)
  }

  const toggleSource = (s: string) => {
    if (!acceptForm) return
    setAcceptForm(f => f ? {
      ...f,
      code_source: f.code_source.includes(s) ? f.code_source.filter(x => x !== s) : [...f.code_source, s],
    } : f)
  }

  const handleAcceptSubmit = async () => {
    if (!acceptItem || !acceptForm) return
    if (!acceptForm.brand_id) {
      toast.error('Wybierz markę')
      return
    }
    if (!acceptForm.percentage && !acceptForm.fixed_amount && !acceptForm.requirements.trim()) {
      toast.error('Podaj procent, kwotę lub warunki')
      return
    }
    setAcceptSaving(true)
    try {
      const res = await fetch('/api/admin/discount-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          stagingId: acceptItem.id,
          overrides: formToOverrides(acceptForm),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Błąd')
        setAcceptSaving(false)
        return
      }
      setItems(prev => prev.filter(i => i.id !== acceptItem.id))
      setKpi(prev => ({ ...prev, pending: prev.pending - 1, acceptedToday: prev.acceptedToday + 1 }))
      toast.success('Rabat dodany')
      closeAcceptModal()
    } catch {
      toast.error('Błąd sieci')
      setAcceptSaving(false)
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
          {groupItems(items).map(({ primary: item, related }) => {
            const isRejected = item.status === 'rejected'
            const cls = classMap[item.id] || { kind: 'new' as const }
            const isDuplicate = cls.kind === 'duplicate'
            const isReissued = cls.kind === 'reissued'
            const isChanged = cls.kind === 'changed'
            const isLoading = actionLoading[item.id]
            const hasBrand = !!item.brand_id
            const isGrayed = isRejected || isDuplicate

            return (
              <div key={item.id}>
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
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1.5">
                              <DatabaseZap className="h-3 w-3 mr-0.5" />
                              Już w bazie
                            </Badge>
                            {cls.kind === 'duplicate' && cls.expired && (
                              <div className="text-[9px] text-muted-foreground">wygasł {cls.dbUntil || '—'}</div>
                            )}
                          </div>
                        )}
                        {isReissued && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5">
                            <RefreshCw className="h-3 w-3 mr-0.5" />
                            Wznowiony
                          </Badge>
                        )}
                        {isChanged && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5">
                            <PencilLine className="h-3 w-3 mr-0.5" />
                            Zmienione warunki
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
                        {!isRejected && !isGrayed && (
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
                    {/* Source info */}
                    {item.source_platform ? (
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1 flex-wrap">
                          <span className="capitalize font-medium">{item.source_platform}</span>
                          {item.source_type && <span>/ {item.source_type}</span>}
                          {item.source_name && <span>· {item.source_name}</span>}
                          {item.is_official != null && (
                            <Badge variant={item.is_official ? 'default' : 'outline'} className="text-[8px] px-1 py-0">
                              {item.is_official ? 'Oficjalne' : 'Nieoficjalne'}
                            </Badge>
                          )}
                          {item.post_published_at && <span>· {new Date(item.post_published_at).toLocaleDateString('pl-PL')}</span>}
                          {item.post_url && (
                            <a href={item.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline text-primary">
                              Otwórz post<ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                        {(item.source_text || item.ocr_text) && (
                          <div>
                            <button
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                              onClick={() => setExpandedTexts(prev => {
                                const next = new Set(prev)
                                next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                                return next
                              })}
                            >
                              {expandedTexts.has(item.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {item.source_text ? 'Tekst posta' : 'OCR'}
                            </button>
                            {expandedTexts.has(item.id) && (
                              <div className="mt-1 space-y-1">
                                {item.source_text && (
                                  <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                                    {item.source_text}
                                  </div>
                                )}
                                {item.ocr_text && (
                                  <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                                    <span className="font-medium">OCR:</span> {item.ocr_text}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {item.screenshot_url && (
                          <button onClick={() => setScreenshotModal(item.screenshot_url)} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                            <Image className="h-3 w-3" />Screenshot
                          </button>
                        )}
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5 max-w-[220px]">
                    {item.status === 'pending' && !isDuplicate && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => openAcceptModal(item)}
                        >
                          <Check className="h-4 w-4 mr-1" />
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
                      <div className="text-[10px] text-muted-foreground text-right">
                        {cls.kind === 'duplicate' && cls.expired
                          ? <>Identyczny wygasły rabat w{' '}<Link href="/admin/discounts" className="underline hover:text-foreground">Rabatach</Link> (do {cls.dbUntil})</>
                          : <>Rabat o tym kodzie istnieje już w{' '}<Link href="/admin/discounts" className="underline hover:text-foreground">Rabatach</Link></>
                        }
                      </div>
                    )}
                    {isReissued && cls.kind === 'reissued' && (
                      <div className="text-[10px] text-muted-foreground text-right">
                        Kod istniał wcześniej, ważny do {cls.prevUntil} — marka wznowiła promocję
                      </div>
                    )}
                    {isChanged && cls.kind === 'changed' && (
                      <div className="text-[10px] text-muted-foreground text-right">
                        W bazie: {cls.dbPct != null ? `-${cls.dbPct}%` : cls.dbAmt != null ? `${cls.dbAmt} zł` : 'benefit'} do {cls.dbUntil || 'bezterminowy'}.
                        {' '}Nowa oferta: {item.percentage != null ? `-${item.percentage}%` : item.fixed_amount != null ? `${item.fixed_amount} zł` : 'benefit'} do {item.valid_until || 'bezterminowy'}
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
              {/* Related items */}
              {related.length > 0 && (() => {
                // Determine if this is a cross-source group or same-code variant group
                const isCrossSource = related.some(r => r.core_fingerprint && r.core_fingerprint === item.core_fingerprint)
                const isCodeVariant = !isCrossSource && related.some(r =>
                  normCode(r.code) === normCode(item.code) && r.brand_id === item.brand_id
                )

                return (
                  <div className="ml-6 mt-1 space-y-1">
                    {isCrossSource && (() => {
                      const labels = [...new Set([item, ...related].map(r =>
                        r.source_platform
                          ? `${r.source_platform}${r.source_name ? ' · ' + r.source_name : ''}`
                          : 'WWW'
                      ))]
                      return labels.length > 1 ? (
                        <div className="text-[10px] text-muted-foreground font-medium">
                          Wykryto w: {labels.join(' + ')}
                        </div>
                      ) : null
                    })()}
                    {isCodeVariant && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {related.length + 1} wariantów kodu {normCode(item.code)}
                        </Badge>
                      </div>
                    )}
                    {related.map(rel => (
                      <Card key={rel.id} className={isCrossSource ? 'opacity-60' : ''}>
                        <CardContent className="py-2 px-4 text-xs text-muted-foreground">
                          {isCrossSource && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] px-1">
                                {rel.source_platform ? `${rel.source_platform}/${rel.source_type || ''}` : (rel.source || 'WWW')}
                              </Badge>
                              {rel.source_name && <span>{rel.source_name}</span>}
                              {rel.post_url && (
                                <a href={rel.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                                  Post<ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          )}
                          {isCodeVariant && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  {rel.percentage != null && <Badge className="text-xs">-{rel.percentage}%</Badge>}
                                  {rel.fixed_amount != null && <Badge variant="secondary" className="text-xs">{rel.fixed_amount} zł</Badge>}
                                  <span>{rel.valid_from || '—'} – {rel.valid_until || 'bezterminowy'}</span>
                                </div>
                                {rel.min_days != null && <div className="text-[10px]">min. {rel.min_days} dni</div>}
                                {rel.requirements && <div className="text-[10px] truncate max-w-md" title={rel.requirements}>{rel.requirements}</div>}
                              </div>
                              {rel.status === 'pending' && !isDuplicate && (
                                <Button size="sm" variant="outline" onClick={() => openAcceptModal(rel)} className="text-xs flex-shrink-0">
                                  <Check className="h-3 w-3 mr-1" />Zaakceptuj
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              })()}
              </div>
            )
          })}
        </div>
      )}

      {/* Accept modal */}
      {acceptItem && acceptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeAcceptModal} />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">
                  Zaakceptuj rabat — {acceptItem.brands?.name || acceptItem.brand_name_raw || 'nieznana marka'}
                </h2>
                {classMap[acceptItem.id]?.kind === 'reissued' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Kod istniał wcześniej, ważny do {(classMap[acceptItem.id] as { kind: 'reissued'; prevUntil: string }).prevUntil} — marka wznowiła promocję
                  </p>
                )}
                {classMap[acceptItem.id]?.kind === 'changed' && (() => {
                  const c = classMap[acceptItem.id] as { kind: 'changed'; dbPct: number | null; dbAmt: number | null; dbUntil: string | null }
                  return (
                    <p className="text-xs text-amber-600 mt-1">
                      W bazie istnieje: {c.dbPct != null ? `-${c.dbPct}%` : c.dbAmt != null ? `${c.dbAmt} zł` : 'benefit'} do {c.dbUntil || 'bezterminowy'}
                    </p>
                  )
                })()}
              </div>
              {acceptItem.source_url && (
                <a href={acceptItem.source_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />Zobacz źródło
                  </Button>
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Kod rabatowy</Label>
                <Input
                  value={acceptForm.code}
                  onChange={e => setAcceptForm(f => f ? { ...f, code: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.code && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.code}</p>}
              </div>
              <div className="space-y-1">
                <Label>Marka *</Label>
                <Select
                  value={acceptForm.brand_id || '_none'}
                  onValueChange={v => setAcceptForm(f => f ? { ...f, brand_id: (!v || v === '_none') ? '' : v } : f)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz markę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— brak —</SelectItem>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {acceptItem.brand_name_raw && !acceptItem.brand_id && (
                  <p className="text-[10px] text-amber-600">Scraper: &quot;{acceptItem.brand_name_raw}&quot; (nierozpoznana)</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Procent zniżki (%)</Label>
                <Input
                  type="number"
                  value={acceptForm.percentage}
                  onChange={e => setAcceptForm(f => f ? { ...f, percentage: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.percentage != null && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.percentage}%</p>}
              </div>
              <div className="space-y-1">
                <Label>Kwota zniżki (opcjonalnie)</Label>
                <Input
                  type="number"
                  value={acceptForm.fixed_amount}
                  onChange={e => setAcceptForm(f => f ? { ...f, fixed_amount: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.fixed_amount != null && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.fixed_amount} zł</p>}
              </div>
              <div className="space-y-1">
                <Label>Data od</Label>
                <Input
                  type="date"
                  value={acceptForm.valid_from}
                  onChange={e => setAcceptForm(f => f ? { ...f, valid_from: e.target.value } : f)}
                />
                {acceptItem.valid_from && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.valid_from}</p>}
              </div>
              <div className="space-y-1">
                <Label>Data do (opcjonalnie)</Label>
                <Input
                  type="date"
                  value={acceptForm.valid_until}
                  onChange={e => setAcceptForm(f => f ? { ...f, valid_until: e.target.value } : f)}
                />
                {acceptItem.valid_until && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.valid_until}</p>}
              </div>
              <div className="space-y-1">
                <Label>Min. dni</Label>
                <Input
                  type="number"
                  value={acceptForm.min_days}
                  onChange={e => setAcceptForm(f => f ? { ...f, min_days: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.min_days != null && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.min_days}</p>}
              </div>
              <div className="space-y-1">
                <Label>Max. dni (opcjonalnie)</Label>
                <Input
                  type="number"
                  value={acceptForm.max_days}
                  onChange={e => setAcceptForm(f => f ? { ...f, max_days: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.max_days != null && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.max_days}</p>}
              </div>
              <div className="space-y-1">
                <Label>Min. wartość zamówienia (opcjonalnie)</Label>
                <Input
                  type="number"
                  value={acceptForm.min_order_value}
                  onChange={e => setAcceptForm(f => f ? { ...f, min_order_value: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.min_order_value != null && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.min_order_value} zł</p>}
              </div>
              <div className="space-y-1">
                <Label>Kanały</Label>
                <Input
                  value={acceptForm.communication_channels}
                  onChange={e => setAcceptForm(f => f ? { ...f, communication_channels: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                />
                {acceptItem.communication_channels && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.communication_channels}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Źródło</Label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map(s => (
                    <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptForm.code_source.includes(s)}
                        onChange={() => toggleSource(s)}
                        className="rounded"
                      />
                      <span className="text-sm">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Warunki</Label>
                <Textarea
                  value={acceptForm.requirements}
                  onChange={e => setAcceptForm(f => f ? { ...f, requirements: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                  rows={2}
                />
                {acceptItem.requirements && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.requirements}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Wykluczenia</Label>
                <Textarea
                  value={acceptForm.exclusions_limits}
                  onChange={e => setAcceptForm(f => f ? { ...f, exclusions_limits: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                  rows={2}
                />
                {acceptItem.exclusions_limits && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.exclusions_limits}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Opis</Label>
                <Textarea
                  value={acceptForm.description}
                  onChange={e => setAcceptForm(f => f ? { ...f, description: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                  rows={2}
                />
                {acceptItem.description && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.description}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Uwagi</Label>
                <Textarea
                  value={acceptForm.additional_notes}
                  onChange={e => setAcceptForm(f => f ? { ...f, additional_notes: e.target.value } : f)}
                  placeholder="nie wykryto — uzupełnij"
                  rows={2}
                />
                {acceptItem.additional_notes && <p className="text-[10px] text-muted-foreground">Scraper: {acceptItem.additional_notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="accept_is_cashback"
                  type="checkbox"
                  checked={acceptForm.is_cashback}
                  onChange={e => setAcceptForm(f => f ? { ...f, is_cashback: e.target.checked } : f)}
                  className="rounded"
                />
                <Label htmlFor="accept_is_cashback">Cashback</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeAcceptModal}>
                Anuluj
              </Button>
              <Button onClick={handleAcceptSubmit} disabled={acceptSaving}>
                {acceptSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Zapisywanie...</> : 'Zapisz i zaakceptuj'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot modal */}
      {screenshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setScreenshotModal(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <img src={screenshotModal} alt="Screenshot" className="relative max-w-[90vw] max-h-[90vh] object-contain rounded shadow-xl" />
        </div>
      )}
    </div>
  )
}
