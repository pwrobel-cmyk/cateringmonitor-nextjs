'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Shield, Users, BarChart3, Pencil, RefreshCw, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase/client'

const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

type User = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null
  full_name: string; avatar_url: string; status: string; trial_ends_at: string | null
  company_name: string; brand_name: string; brand_id: string; role: string; last_activity: string | null
}

type BrandOption = { id: string; name: string }

type SummaryRow = {
  userId: string; name: string; email: string; avatar: string
  visits: number; topPage: string; last: string | null; spark: number[]
}

type UserDetail = {
  totalVisits: number
  byDay: Record<string, { time: string; page: string }[]>
  topPages: { page: string; count: number }[]
  hourly: { hour: number; count: number }[]
  firstVisit: string | null; lastVisit: string | null
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Users tab
  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'trial'>('all')
  const [usersLoading, setUsersLoading] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', status: '', trial_ends_at: '', brand_id: '', role: 'user' })
  const [changePassword, setChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [brands, setBrands] = useState<BrandOption[]>([])

  // Analytics tab
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SummaryRow | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (user && user.email !== adminEmail) router.replace('/dashboard')
  }, [user, router])

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      setUsers(d.users || [])
      setUsersLoading(false)
    })
  }, [])

  useEffect(() => {
    ;(supabase as any).from('brands').select('id, name').eq('is_active', true).order('name')
      .then(({ data }: any) => setBrands(data || []))
  }, [])

  const loadAnalytics = useCallback(() => {
    if (summary.length) return
    setAnalyticsLoading(true)
    fetch('/api/admin/activity').then(r => r.json()).then(d => {
      setSummary(d.summary || [])
      setAnalyticsLoading(false)
    })
  }, [summary.length])

  const selectUser = (row: SummaryRow) => {
    setSelectedUser(row)
    setDetail(null)
    setDetailLoading(true)
    fetch(`/api/admin/activity?userId=${row.userId}`).then(r => r.json()).then(d => {
      setDetail(d)
      setDetailLoading(false)
    })
  }

  const filteredUsers = users.filter(u =>
    filter === 'all' ? true : u.status === filter
  )

  const openEdit = (u: User) => {
    setEditUser(u)
    setEditForm({ full_name: u.full_name, status: u.status, trial_ends_at: u.trial_ends_at?.slice(0, 10) || '', brand_id: u.brand_id || '', role: u.role || 'user' })
    setChangePassword(false)
    setNewPassword('')
  }

  const saveEdit = async () => {
    if (!editUser) return
    setSaving(true)

    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, full_name: editForm.full_name, status: editForm.status, trial_ends_at: editForm.trial_ends_at || null }),
    })

    const extra: Record<string, any> = { userId: editUser.id }
    if (editForm.brand_id !== editUser.brand_id) extra.brandId = editForm.brand_id
    if (editForm.role !== editUser.role) extra.role = editForm.role
    if (changePassword && newPassword) extra.password = newPassword

    if (Object.keys(extra).length > 1) {
      await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extra),
      })
    }

    const brandName = brands.find(b => b.id === editForm.brand_id)?.name || ''
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, full_name: editForm.full_name, status: editForm.status, trial_ends_at: editForm.trial_ends_at || null, brand_id: editForm.brand_id, brand_name: brandName, role: editForm.role } : u))
    setSaving(false)
    setEditUser(null)
  }

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('pl-PL') : '—'
  const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  if (!user || user.email !== adminEmail) return null

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Użytkownicy</h1>
          <p className="text-sm text-muted-foreground">Panel administracyjny</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Lista użytkowników</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" onClick={loadAnalytics}><BarChart3 className="h-4 w-4" />Analityka</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Users ── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(['all', 'active', 'trial'] as const).map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'Wszyscy' : f === 'active' ? 'Aktywni' : 'Trial'}
                </Button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground ml-auto">{filteredUsers.length} użytkowników</span>
          </div>

          <Card>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="p-8 text-center text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Ładowanie...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Użytkownik</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Dołączył</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Ostatnie logowanie</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Aktywność</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Marka</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={u.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">{(u.full_name || u.email || '?')[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{u.full_name || '—'}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={u.status === 'active' ? 'default' : u.status === 'trial' ? 'secondary' : 'outline'} className="text-xs">{u.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmtDate(u.created_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDateTime(u.last_sign_in_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDateTime(u.last_activity)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.brand_name || '—'}</td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Analytics ── */}
        <TabsContent value="analytics" className="mt-4">
          {analyticsLoading ? (
            <div className="p-8 text-center text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Ładowanie...</div>
          ) : (
            <div className={`flex gap-4 ${selectedUser ? 'items-start' : ''}`}>
              {/* Summary table */}
              <div className={selectedUser ? 'flex-1 min-w-0' : 'w-full'}>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Użytkownik</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Wizyty (7d)</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Ostatnia wizyta</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Ulubiona strona</th>
                            <th className="text-center px-4 py-3 font-medium text-muted-foreground">7 dni</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {summary.map(row => {
                            const isSelected = selectedUser?.userId === row.userId
                            const maxSpark = Math.max(...row.spark, 1)
                            const hasActivity = row.visits > 0
                            return (
                              <tr
                                key={row.userId}
                                className={`border-b transition-colors cursor-pointer ${isSelected ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-muted/20'} ${!hasActivity ? 'opacity-50' : ''}`}
                                onClick={() => selectUser(row)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7 flex-shrink-0">
                                      <AvatarImage src={row.avatar || undefined} />
                                      <AvatarFallback className="text-xs">{(row.name || row.email || '?')[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="font-medium text-xs truncate">{row.name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {hasActivity ? (
                                    <span className="font-semibold">{row.visits}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Brak aktywności</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{fmtDateTime(row.last)}</td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[140px]">{row.topPage}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-end gap-px h-5 justify-center">
                                    {row.spark.map((v, i) => (
                                      <div
                                        key={i}
                                        className="w-2.5 rounded-sm"
                                        style={{
                                          height: `${Math.max(2, (v / maxSpark) * 20)}px`,
                                          background: v === 0 ? '#e5e7eb' : v === maxSpark ? '#1a3a5c' : `rgba(26,58,92,${0.3 + (v / maxSpark) * 0.7})`,
                                        }}
                                        title={`${v}`}
                                      />
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2">Zobacz</Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detail panel */}
              {selectedUser && (
                <div className="w-[400px] flex-shrink-0 border rounded-lg bg-background shadow-sm">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={selectedUser.avatar || undefined} />
                      <AvatarFallback>{(selectedUser.name || selectedUser.email || '?')[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{selectedUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => setSelectedUser(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {detailLoading ? (
                    <div className="p-8 text-center text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin mx-auto" /></div>
                  ) : detail ? (
                    <div className="overflow-y-auto max-h-[80vh]">
                      {/* KPI */}
                      <div className="grid grid-cols-3 gap-0 border-b">
                        {[
                          { label: 'Wizyty (7d)', value: detail.totalVisits },
                          { label: 'Ulubiona', value: detail.topPages[0]?.page?.replace('/', '') || '—' },
                          { label: 'Aktywny od', value: fmtDate(detail.firstVisit) },
                        ].map(({ label, value }) => (
                          <div key={label} className="px-3 py-3 text-center border-r last:border-r-0">
                            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                            <p className="text-sm font-semibold truncate" title={String(value)}>{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Hourly chart */}
                      <div className="px-4 py-3 border-b">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Aktywność wg godziny</p>
                        <ResponsiveContainer width="100%" height={80}>
                          <BarChart data={detail.hourly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickFormatter={h => h % 4 === 0 ? `${h}h` : ''} />
                            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                            <Tooltip labelFormatter={h => `${h}:00`} contentStyle={{ fontSize: 11 }} />
                            <Bar dataKey="count" fill="#1a3a5c" radius={[2, 2, 0, 0]} name="Wizyty" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Timeline */}
                      <div className="px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground mb-3">Oś czasu (7 dni)</p>
                        {Object.keys(detail.byDay).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Brak aktywności.</p>
                        ) : (
                          <div className="space-y-4">
                            {Object.entries(detail.byDay).map(([day, visits]) => (
                              <div key={day}>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{day}</p>
                                <div className="space-y-0.5 pl-3 border-l-2 border-muted">
                                  {visits.slice(0, 20).map((v, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground w-9 flex-shrink-0">{v.time}</span>
                                      <span className="font-mono text-[11px] truncate">{v.page}</span>
                                    </div>
                                  ))}
                                  {visits.length > 20 && (
                                    <p className="text-xs text-muted-foreground pl-11">+{visits.length - 20} więcej</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={!!editUser} onOpenChange={v => { if (!v) setEditUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj użytkownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Imię i nazwisko</label>
              <Input className="mt-1" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="trial">trial</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Trial do</label>
              <Input className="mt-1" type="date" value={editForm.trial_ends_at} onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Domyślna marka</label>
              <select
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={editForm.brand_id}
                onChange={e => setEditForm(f => ({ ...f, brand_id: e.target.value }))}
              >
                <option value="">— brak —</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Rola</label>
              <select
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={changePassword} onChange={e => { setChangePassword(e.target.checked); if (!e.target.checked) setNewPassword('') }} />
                <span className="text-sm font-medium">Zmień hasło</span>
              </label>
              {changePassword && (
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nowe hasło" className="mt-2 w-full border rounded-lg px-3 py-2 text-sm bg-background" />
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditUser(null)}>Anuluj</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? 'Zapisuję...' : 'Zapisz'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
