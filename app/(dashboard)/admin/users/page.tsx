'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Shield, Users, BarChart3, Pencil, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

type User = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  full_name: string
  avatar_url: string
  status: string
  trial_ends_at: string | null
  company_name: string
  brand_name: string
  last_activity: string | null
}

type UserListItem = { id: string; email: string; name: string }

type UserDetail = {
  totalVisits: number
  byDay: Record<string, { time: string; page: string }[]>
  topPages: { page: string; count: number }[]
  hourly: { hour: number; count: number }[]
  firstVisit: string | null
  lastVisit: string | null
}

type ComparisonRow = {
  userId: string
  name: string
  email: string
  visits: number
  topPage: string
  last: string
  spark: number[]
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'trial'>('all')
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', status: '', trial_ends_at: '' })
  const [saving, setSaving] = useState(false)

  // Analytics state
  const [userList, setUserList] = useState<UserListItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [comparison, setComparison] = useState<ComparisonRow[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (user && user.email !== adminEmail) router.replace('/dashboard')
  }, [user, router])

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false) })
  }, [])

  const loadAnalytics = useCallback(() => {
    setAnalyticsLoading(true)
    fetch('/api/admin/activity')
      .then(r => r.json())
      .then(d => {
        setUserList(d.userList || [])
        setComparison(d.comparison || [])
        if (d.userList?.length && !selectedUserId) setSelectedUserId(d.userList[0].id)
        setAnalyticsLoading(false)
      })
  }, [selectedUserId])

  const loadUserDetail = useCallback((uid: string) => {
    if (!uid) return
    setDetailLoading(true)
    fetch(`/api/admin/activity?userId=${uid}`)
      .then(r => r.json())
      .then(d => { setUserDetail(d.userDetail || null); setDetailLoading(false) })
  }, [])

  useEffect(() => {
    if (selectedUserId) loadUserDetail(selectedUserId)
  }, [selectedUserId, loadUserDetail])

  const filteredUsers = users.filter(u => {
    if (filter === 'active') return u.status === 'active'
    if (filter === 'trial') return u.status === 'trial'
    return true
  })

  const openEdit = (u: User) => {
    setEditUser(u)
    setEditForm({
      full_name: u.full_name,
      status: u.status,
      trial_ends_at: u.trial_ends_at ? u.trial_ends_at.slice(0, 10) : '',
    })
  }

  const saveEdit = async () => {
    if (!editUser) return
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, ...editForm, trial_ends_at: editForm.trial_ends_at || null }),
    })
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editForm } : u))
    setSaving(false)
    setEditUser(null)
  }

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('pl-PL') : '—'
  const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  if (!user || user.email !== adminEmail) return null

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2">
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
              {loading ? (
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
                        <th className="px-4 py-3"></th>
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
                            <Badge variant={u.status === 'active' ? 'default' : u.status === 'trial' ? 'secondary' : 'outline'} className="text-xs">
                              {u.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmtDate(u.created_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDateTime(u.last_sign_in_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDateTime(u.last_activity)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.brand_name || '—'}</td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
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
        <TabsContent value="analytics" className="space-y-6 mt-4">
          {analyticsLoading && (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Ładowanie...
            </div>
          )}

          {!analyticsLoading && userList.length > 0 && (
            <>
              {/* S1: User selector */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <label className="text-sm font-medium block mb-2">Wybierz użytkownika</label>
                  <select
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background max-w-sm"
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                  >
                    {userList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {detailLoading && (
                <div className="p-6 text-center text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
                </div>
              )}

              {!detailLoading && userDetail && (
                <>
                  {/* S3: User stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Łącznie wizyt (7d)', value: userDetail.totalVisits },
                      { label: 'Pierwsza wizyta', value: fmtDate(userDetail.firstVisit) },
                      { label: 'Ostatnia wizyta', value: fmtDateTime(userDetail.lastVisit) },
                      { label: 'Ulubiona strona', value: userDetail.topPages[0]?.page || '—' },
                    ].map(({ label, value }) => (
                      <Card key={label}>
                        <CardContent className="pt-4 pb-4">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className="font-semibold text-sm truncate">{value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top pages bar chart */}
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Top 5 stron</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={userDetail.topPages} layout="vertical">
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="page" tick={{ fontSize: 10 }} width={120} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#1a3a5c" radius={[0, 4, 4, 0]} name="Wizyty" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Hourly activity */}
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Aktywność wg godziny</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={userDetail.hourly}>
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => `${h}h`} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip labelFormatter={h => `${h}:00`} />
                            <Bar dataKey="count" fill="#1a3a5c" radius={[2, 2, 0, 0]} name="Wizyty" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* S2: Activity timeline */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Oś czasu aktywności (ostatnie 7 dni)</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {Object.keys(userDetail.byDay).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Brak aktywności w ostatnich 7 dniach.</p>
                      ) : (
                        Object.entries(userDetail.byDay).map(([day, visits]) => (
                          <div key={day}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{day}</p>
                            <div className="space-y-0.5 pl-3 border-l-2 border-muted">
                              {visits.map((v, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                  <span className="text-xs text-muted-foreground w-10 flex-shrink-0">{v.time}</span>
                                  <span className="font-mono text-xs">{v.page}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* S4: Comparison table */}
              {comparison.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Porównanie wszystkich użytkowników (30 dni)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Użytkownik</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Wizyty</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Ulubiona strona</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Ostatnia wizyta</th>
                            <th className="text-center px-4 py-2 font-medium text-muted-foreground">7 dni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.map(u => {
                            const maxSpark = Math.max(...u.spark, 1)
                            return (
                              <tr
                                key={u.userId}
                                className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${u.userId === selectedUserId ? 'bg-primary/5' : ''}`}
                                onClick={() => setSelectedUserId(u.userId)}
                              >
                                <td className="px-4 py-2">
                                  <p className="font-medium">{u.name}</p>
                                  <p className="text-xs text-muted-foreground">{u.email}</p>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold">{u.visits}</td>
                                <td className="px-4 py-2 font-mono text-xs hidden md:table-cell text-muted-foreground">{u.topPage}</td>
                                <td className="px-4 py-2 text-right text-xs text-muted-foreground hidden lg:table-cell">{fmtDate(u.last)}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-end gap-px h-6 justify-center">
                                    {u.spark.map((v, i) => (
                                      <div
                                        key={i}
                                        className="w-2 bg-primary/60 rounded-sm"
                                        style={{ height: `${Math.max(2, (v / maxSpark) * 24)}px` }}
                                        title={`${v}`}
                                      />
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
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
