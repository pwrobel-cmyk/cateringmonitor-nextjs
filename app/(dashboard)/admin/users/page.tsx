'use client'

import { useEffect, useState } from 'react'
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
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
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

type ActivityData = {
  daily: { date: string; count: number }[]
  pages: { page: string; visits: number; uniqueUsers: number }[]
  topUsers: { userId: string; name: string; email: string; visits: number; last: string }[]
  heatmap: Record<string, number>
}

const DAYS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'trial'>('all')
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', status: '', trial_ends_at: '' })
  const [saving, setSaving] = useState(false)

  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    if (user && user.email !== adminEmail) router.replace('/dashboard')
  }, [user, router])

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false) })
  }, [])

  const loadActivity = () => {
    setActivityLoading(true)
    fetch('/api/admin/activity')
      .then(r => r.json())
      .then(d => { setActivity(d); setActivityLoading(false) })
  }

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

  const maxHeat = activity ? Math.max(...Object.values(activity.heatmap), 1) : 1

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
          <TabsTrigger value="analytics" className="gap-2" onClick={loadActivity}><BarChart3 className="h-4 w-4" />Analityka</TabsTrigger>
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
          {activityLoading && (
            <div className="p-8 text-center text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Ładowanie...</div>
          )}

          {activity && (
            <>
              {/* Daily chart */}
              <Card>
                <CardHeader><CardTitle className="text-base">Aktywność dzienna (30 dni)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={activity.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip labelFormatter={v => String(v)} />
                      <Line type="monotone" dataKey="count" stroke="#1a3a5c" strokeWidth={2} dot={false} name="Wizyty" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Heatmap */}
              <Card>
                <CardHeader><CardTitle className="text-base">Aktywność wg godziny i dnia tygodnia</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-separate border-spacing-0.5">
                      <thead>
                        <tr>
                          <th className="w-8 text-muted-foreground font-normal" />
                          {HOURS.map(h => (
                            <th key={h} className="w-5 text-muted-foreground font-normal text-center">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map((day, di) => (
                          <tr key={di}>
                            <td className="pr-1 text-muted-foreground text-right">{day}</td>
                            {HOURS.map(h => {
                              const val = activity.heatmap[`${di}_${h}`] || 0
                              const opacity = val ? 0.15 + (val / maxHeat) * 0.85 : 0
                              return (
                                <td key={h} title={`${val} wizyt`}>
                                  <div
                                    className="w-5 h-5 rounded-sm"
                                    style={{ background: val ? `rgba(26,58,92,${opacity})` : '#f3f4f6' }}
                                  />
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top pages */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Najpopularniejsze strony</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Strona</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Wizyty</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Unikalni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.pages.map(p => (
                          <tr key={p.page} className="border-b hover:bg-muted/20">
                            <td className="px-4 py-2 font-mono text-xs">{p.page}</td>
                            <td className="px-4 py-2 text-right">{p.visits}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{p.uniqueUsers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Top users */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Najbardziej aktywni</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Użytkownik</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Wizyty</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ostatnia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.topUsers.map(u => (
                          <tr key={u.userId} className="border-b hover:bg-muted/20">
                            <td className="px-4 py-2">
                              <p className="font-medium">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </td>
                            <td className="px-4 py-2 text-right">{u.visits}</td>
                            <td className="px-4 py-2 text-right text-xs text-muted-foreground">{fmtDate(u.last)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
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
