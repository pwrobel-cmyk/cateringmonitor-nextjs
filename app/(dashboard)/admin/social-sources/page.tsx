'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Loader2, ExternalLink, Radio } from 'lucide-react'

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
    <nav className="flex gap-2 mb-6 flex-wrap">
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

interface SocialSource {
  id: string
  brand_id: string
  platform: string
  source_type: string
  source_name: string
  url: string
  is_official: boolean
  active: boolean
  created_at: string
  brands: { name: string; logo_url: string | null } | null
}

interface Brand {
  id: string
  name: string
  logo_url: string | null
}

interface FormData {
  brand_id: string
  platform: string
  source_type: string
  source_name: string
  url: string
  is_official: boolean
  active: boolean
}

const emptyForm: FormData = {
  brand_id: '',
  platform: 'facebook',
  source_type: 'profile',
  source_name: '',
  url: '',
  is_official: false,
  active: true,
}

const PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
]

const TYPE_OPTIONS = [
  { value: 'profile', label: 'Profil' },
  { value: 'group', label: 'Grupa' },
  { value: 'page', label: 'Strona' },
  { value: 'channel', label: 'Kanał' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SocialSourcesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [sources, setSources] = useState<SocialSource[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [brandFilter, setBrandFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [activeOnly, setActiveOnly] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  useEffect(() => {
    if (user && user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      router.replace('/dashboard')
    }
  }, [user, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: srcData }, { data: brandsData }] = await Promise.all([
      supabase
        .from('social_sources')
        .select('*, brands(name, logo_url)')
        .order('source_name'),
      supabase
        .from('brands')
        .select('id, name, logo_url')
        .eq('is_active', true)
        .order('name'),
    ])
    setSources((srcData || []) as SocialSource[])
    setBrands((brandsData || []) as Brand[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = sources.filter(s => {
    if (brandFilter !== 'all' && s.brand_id !== brandFilter) return false
    if (platformFilter !== 'all' && s.platform !== platformFilter) return false
    if (activeOnly && !s.active) return false
    return true
  })

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (s: SocialSource) => {
    setEditingId(s.id)
    setForm({
      brand_id: s.brand_id,
      platform: s.platform,
      source_type: s.source_type,
      source_name: s.source_name,
      url: s.url,
      is_official: s.is_official,
      active: s.active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.brand_id) { toast.error('Wybierz markę'); return }
    if (!form.source_name.trim()) { toast.error('Podaj nazwę źródła'); return }
    if (!form.url.trim()) { toast.error('Podaj URL'); return }
    try { new URL(form.url) } catch { toast.error('Nieprawidłowy URL'); return }

    setSaving(true)
    const payload = {
      brand_id: form.brand_id,
      platform: form.platform,
      source_type: form.source_type,
      source_name: form.source_name.trim(),
      url: form.url.trim(),
      is_official: form.is_official,
      active: form.active,
    }

    let error
    if (editingId) {
      ({ error } = await supabase.from('social_sources').update(payload).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('social_sources').insert(payload))
    }

    setSaving(false)
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Źródło o takim URL już istnieje' : error.message)
      return
    }
    toast.success(editingId ? 'Źródło zaktualizowane' : 'Źródło dodane')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('social_sources').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Źródło usunięte')
    setSources(prev => prev.filter(s => s.id !== id))
  }

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('social_sources').update({ active }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setSources(prev => prev.map(s => s.id === id ? { ...s, active } : s))
  }

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) return null

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <AdminNav />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="h-6 w-6" />Źródła social</h1>
          <p className="text-muted-foreground text-sm">Konfiguracja profili i grup do monitoringu rabatów</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Dodaj źródło</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Select value={brandFilter} onValueChange={v => setBrandFilter(v || 'all')}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Marka" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie marki</SelectItem>
            {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={v => setPlatformFilter(v || 'all')}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Platforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {PLATFORM_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded" />
          Tylko aktywne
        </label>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Brak źródeł</CardContent></Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Marka</th>
                <th className="pb-2 font-medium">Platforma</th>
                <th className="pb-2 font-medium">Typ</th>
                <th className="pb-2 font-medium">Nazwa</th>
                <th className="pb-2 font-medium">URL</th>
                <th className="pb-2 font-medium">Oficjalne</th>
                <th className="pb-2 font-medium">Aktywne</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b hover:bg-muted/20 transition">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {s.brands?.logo_url ? (
                        <img src={s.brands.logo_url} alt="" className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold">
                          {(s.brands?.name || '?').charAt(0)}
                        </div>
                      )}
                      <span className="truncate max-w-[120px]">{s.brands?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="py-3 capitalize">{s.platform}</td>
                  <td className="py-3">{TYPE_OPTIONS.find(t => t.value === s.source_type)?.label || s.source_type}</td>
                  <td className="py-3 font-medium">{s.source_name}</td>
                  <td className="py-3">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[200px]">
                      {s.url.replace(/^https?:\/\//, '').slice(0, 40)}<ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </td>
                  <td className="py-3">
                    {s.is_official ? (
                      <Badge variant="default" className="text-[10px]">Oficjalne</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Nieoficjalne</Badge>
                    )}
                  </td>
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={e => toggleActive(s.id, e.target.checked)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Edytuj źródło' : 'Dodaj źródło'}</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Marka *</Label>
                <Select value={form.brand_id || '_none'} onValueChange={v => setForm(f => ({ ...f, brand_id: (!v || v === '_none') ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz markę" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— brak —</SelectItem>
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Platforma</Label>
                  <Select value={form.platform} onValueChange={v => v && setForm(f => ({ ...f, platform: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Typ</Label>
                  <Select value={form.source_type} onValueChange={v => v && setForm(f => ({ ...f, source_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nazwa źródła *</Label>
                <Input value={form.source_name} onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} placeholder="np. MaczFit kody rabatowe" />
              </div>
              <div className="space-y-1">
                <Label>URL *</Label>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://facebook.com/groups/..." />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_official} onChange={e => setForm(f => ({ ...f, is_official: e.target.checked }))} className="rounded" />
                  Oficjalne źródło marki
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                  Aktywne
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Anuluj</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Zapisywanie...</> : editingId ? 'Zapisz zmiany' : 'Dodaj'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
