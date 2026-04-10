'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileBarChart2, UserPlus, Copy, Check, Mail, ExternalLink, Send, Sparkles, Loader2, Eye } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { DynamicReport } from '@/components/reports/DynamicReport'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, subWeeks, subMonths, subQuarters, startOfQuarter, endOfQuarter } from 'date-fns'

type DateRangeType = 'last_week' | 'last_month' | 'last_quarter' | 'specific_month' | 'year'

function computeDateRange(
  type: DateRangeType,
  specificMonth: string,
  specificYear: string
): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  switch (type) {
    case 'last_week': {
      const prevMonday = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const prevSunday = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      return { from: fmt(prevMonday), to: fmt(prevSunday) }
    }
    case 'last_month': {
      const prevMonth = subMonths(now, 1)
      return { from: fmt(startOfMonth(prevMonth)), to: fmt(endOfMonth(prevMonth)) }
    }
    case 'last_quarter': {
      const prevQuarter = subQuarters(now, 1)
      return { from: fmt(startOfQuarter(prevQuarter)), to: fmt(endOfQuarter(prevQuarter)) }
    }
    case 'specific_month': {
      const d = new Date(specificMonth + '-01')
      return { from: fmt(startOfMonth(d)), to: fmt(endOfMonth(d)) }
    }
    case 'year': {
      const d = new Date(parseInt(specificYear), 0, 1)
      return { from: fmt(startOfYear(d)), to: fmt(endOfYear(d)) }
    }
  }
}

interface ReportParams {
  brandId: string | null
  brandName: string
  brandLogoUrl: string | null
  dateFrom: string
  dateTo: string
}

const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
  { value: 'last_week', label: 'Ostatni tydzień' },
  { value: 'last_month', label: 'Ostatni miesiąc' },
  { value: 'last_quarter', label: 'Ostatni kwartał' },
  { value: 'specific_month', label: 'Konkretny miesiąc' },
  { value: 'year', label: 'Rok' },
]

export default function AdminReportsPage() {
  const { user } = useAuth()
  const [brandId, setBrandId] = useState<string>('all')
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('last_month')
  const [specificMonth, setSpecificMonth] = useState(
    format(subMonths(new Date(), 1), 'yyyy-MM')
  )
  const [specificYear, setSpecificYear] = useState('2025')
  const [reportParams, setReportParams] = useState<ReportParams | null>(null)

  // Assign modal state
  const [showAssign, setShowAssign] = useState(false)
  const [assignUserId, setAssignUserId] = useState<string>('')
  const [assignTitle, setAssignTitle] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-for-report'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name, logo_url')
        .order('name')
      return data || []
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-for-assign'],
    enabled: showAssign,
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      return (json.users || []) as { id: string; email: string; full_name?: string }[]
    },
  })

  const handleGenerate = () => {
    const { from, to } = computeDateRange(dateRangeType, specificMonth, specificYear)
    const brand = (brands as any[]).find(b => b.id === brandId)
    setReportParams({
      brandId: brandId === 'all' ? null : brandId,
      brandName: brand?.name || 'Wszystkie marki',
      brandLogoUrl: brand?.logo_url || null,
      dateFrom: from,
      dateTo: to,
    })
  }

  const openAssignModal = () => {
    if (!reportParams) return
    setAssignTitle(`${reportParams.brandName} · ${reportParams.dateFrom} – ${reportParams.dateTo}`)
    setAssignUserId('')
    setCopied(false)
    setShowAssign(true)
  }

  const handleAssign = async () => {
    if (!reportParams || !assignUserId || !user) return
    setAssigning(true)
    try {
      const { data, error } = await (supabase as any)
        .from('custom_reports')
        .insert({
          user_id: assignUserId,
          brand_id: reportParams.brandId,
          brand_name: reportParams.brandName,
          date_from: reportParams.dateFrom,
          date_to: reportParams.dateTo,
          title: assignTitle,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (error) throw error

      const link = `https://cateringmonitor.pl/reports/custom/${data.id}`

      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
      } catch {}

      toast.success(
        `Raport przypisany! Link skopiowany do schowka: ${link}`,
        { duration: 8000 }
      )
      setShowAssign(false)
    } catch (e: any) {
      toast.error(e.message || 'Błąd przypisywania raportu')
    } finally {
      setAssigning(false)
    }
  }

  const { data: emailHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['admin-email-history'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-history')
      const json = await res.json()
      return (json.rows || []) as {
        id: string; brandName: string; brandId: string | null
        dateFrom: string; dateTo: string; recipientEmail: string; sentAt: string
      }[]
    },
  })

  const fmtDt = (s: string) => new Date(s).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ── Compose state ───────────────────────────────────────────────────────────
  const [composeSubject, setComposeSubject] = useState('')
  const [composeParagraphs, setComposeParagraphs] = useState('')  // newline-separated
  const [composePrompt, setComposePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [composeRecipients, setComposeRecipients] = useState<Set<string>>(new Set())
  const [composeExtraEmails, setComposeExtraEmails] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      return (json.users || []) as { id: string; email: string; full_name?: string; status?: string }[]
    },
  })

  const handleGenerateText = async () => {
    if (!composePrompt.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/generate-email-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: composePrompt }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.subject) setComposeSubject(data.subject)
      if (data.paragraphs) setComposeParagraphs(data.paragraphs.join('\n\n'))
    } catch (e: any) {
      toast.error(e.message || 'Błąd generowania')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendCustom = async () => {
    const extraList = composeExtraEmails.split('\n').map(e => e.trim()).filter(Boolean)
    const selectedEmails = allUsers.filter(u => composeRecipients.has(u.id)).map(u => u.email)
    const recipients = [...new Set([...selectedEmails, ...extraList])]
    if (!recipients.length) { toast.error('Brak odbiorców'); return }
    if (!composeSubject.trim()) { toast.error('Brak tematu'); return }
    if (!composeParagraphs.trim()) { toast.error('Brak treści'); return }
    setSending(true)
    try {
      const paragraphs = composeParagraphs.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      const res = await fetch('/api/admin/send-custom-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject: composeSubject, paragraphs }),
      })
      const data = await res.json()
      if (data.sent > 0) toast.success(`Wysłano do ${data.sent} odbiorców`)
      if (data.errors?.length) toast.error(`Błędy: ${data.errors.join(', ')}`)
    } catch (e: any) {
      toast.error(e.message || 'Błąd wysyłki')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileBarChart2 className="h-8 w-8" />
          Generator raportów
        </h1>
        <p className="text-muted-foreground mt-1">
          Wygeneruj raport dla wybranej marki i okresu
        </p>
      </div>

      <Tabs defaultValue="generator">
        <TabsList>
          <TabsTrigger value="generator" className="gap-2">
            <FileBarChart2 className="h-4 w-4" />Generator
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Mail className="h-4 w-4" />Historia wysyłek
            {emailHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{emailHistory.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-2">
            <Send className="h-4 w-4" />Wyślij wiadomość
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Ładowanie...</div>
              ) : emailHistory.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Brak wysłanych raportów.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marka</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Okres</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Odbiorca</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Wysłano</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {emailHistory.map(row => (
                        <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.brandName}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {row.dateFrom} – {row.dateTo}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.recipientEmail}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{fmtDt(row.sentAt)}</td>
                          <td className="px-4 py-3">
                            <a
                              href={`/reports/custom/${row.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Otwórz
                            </a>
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

        {/* ── Compose tab ── */}
        <TabsContent value="compose" className="mt-4">
          <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

            {/* Left: editor */}
            <div className="space-y-5">
              {/* AI prompt */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Generator treści (AI)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Opisz o czym ma być email, np. &quot;Napisz email o nowej funkcji Review Manager — pozwala zarządzać opiniami Google i moderować je z poziomu platformy&quot;"
                    value={composePrompt}
                    onChange={e => setComposePrompt(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleGenerateText} disabled={generating || !composePrompt.trim()} size="sm">
                    {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generuję...</> : <><Sparkles className="h-4 w-4 mr-2" />Generuj treść</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Subject + content */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Treść emaila</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Temat</Label>
                    <Input
                      placeholder="Temat wiadomości"
                      value={composeSubject}
                      onChange={e => setComposeSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Treść <span className="text-muted-foreground font-normal text-xs">(oddziel akapity pustą linią)</span></Label>
                    <Textarea
                      placeholder="Treść wiadomości..."
                      value={composeParagraphs}
                      onChange={e => setComposeParagraphs(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(v => !v)}
                      disabled={!composeSubject || !composeParagraphs}
                    >
                      <Eye className="h-4 w-4 mr-2" />{showPreview ? 'Ukryj podgląd' : 'Podgląd'}
                    </Button>
                  </div>

                  {/* Preview */}
                  {showPreview && composeParagraphs && (
                    <div className="border rounded-lg p-5 bg-muted/30 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Podgląd</p>
                      <div className="bg-[#1a3557] rounded-t-lg px-6 py-4 text-center">
                        <p className="text-white font-bold">Catering Monitor</p>
                        <p className="text-blue-300 text-xs mt-1">{composeSubject}</p>
                      </div>
                      <div className="border border-t-0 rounded-b-lg px-6 py-4 bg-white space-y-3">
                        <p className="text-sm text-gray-700">Cześć,</p>
                        {composeParagraphs.split(/\n{2,}/).filter(Boolean).map((p, i) => (
                          <p key={i} className="text-sm text-gray-700 leading-relaxed">{p}</p>
                        ))}
                        <p className="text-sm text-gray-700">Pozdrawiamy,<br/><strong>Zespół Catering Monitor</strong></p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: recipients + send */}
            <div className="space-y-4 lg:sticky lg:top-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Odbiorcy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* User checkboxes */}
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {allUsers.filter(u => u.status === 'active' || u.status === 'trial').map(u => (
                      <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1.5 rounded-md">
                        <input
                          type="checkbox"
                          checked={composeRecipients.has(u.id)}
                          onChange={e => setComposeRecipients(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(u.id) : next.delete(u.id)
                            return next
                          })}
                          className="rounded"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium truncate block">{u.full_name || u.email}</span>
                          {u.full_name && <span className="text-xs text-muted-foreground">{u.email}</span>}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{u.status}</Badge>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setComposeRecipients(new Set(allUsers.filter(u => u.status === 'active').map(u => u.id)))}
                    >
                      Zaznacz aktywnych
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setComposeRecipients(new Set())}
                    >
                      Wyczyść
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Dodatkowe emaile <span className="text-muted-foreground">(jeden na linię)</span></Label>
                    <Textarea
                      placeholder="email@example.com"
                      value={composeExtraEmails}
                      onChange={e => setComposeExtraEmails(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-3">
                      {composeRecipients.size + composeExtraEmails.split('\n').filter(e => e.trim()).length} odbiorców
                    </p>
                    <Button
                      className="w-full"
                      onClick={handleSendCustom}
                      disabled={sending || !composeSubject.trim() || !composeParagraphs.trim()}
                    >
                      {sending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wysyłam...</>
                        : <><Send className="h-4 w-4 mr-2" />Wyślij wiadomość</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="generator" className="mt-4">
      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left: Config form */}
        <Card className="no-print lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Konfiguracja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Brand */}
            <div className="space-y-2">
              <Label>Marka</Label>
              <Select value={brandId} onValueChange={v => v && setBrandId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz markę" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie marki</SelectItem>
                  {(brands as any[]).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="space-y-3">
              <Label>Zakres dat</Label>
              <RadioGroup
                value={dateRangeType}
                onValueChange={v => setDateRangeType(v as DateRangeType)}
                className="space-y-2"
              >
                {DATE_RANGE_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`range-${opt.value}`} />
                    <Label
                      htmlFor={`range-${opt.value}`}
                      className="cursor-pointer font-normal"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {dateRangeType === 'specific_month' && (
                <input
                  type="month"
                  value={specificMonth}
                  onChange={e => setSpecificMonth(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}

              {dateRangeType === 'year' && (
                <Select value={specificYear} onValueChange={v => v && setSpecificYear(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button className="w-full" onClick={handleGenerate}>
              Generuj raport
            </Button>

            {reportParams && (
              <>
                <p className="text-xs text-muted-foreground text-center">
                  {reportParams.brandName} · {reportParams.dateFrom} – {reportParams.dateTo}
                </p>
                <Button variant="outline" className="w-full" onClick={openAssignModal}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Przypisz do użytkownika
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Generated report */}
        <div>
          {reportParams ? (
            <DynamicReport {...reportParams} />
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground border-2 border-dashed rounded-xl">
              <FileBarChart2 className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Wybierz parametry i kliknij „Generuj raport"</p>
              <p className="text-sm mt-1 opacity-70">Raport zostanie wyświetlony tutaj</p>
            </div>
          )}
        </div>
      </div>

        </TabsContent>
      </Tabs>

      {/* Assign modal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Przypisz raport do użytkownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Użytkownik</Label>
              <Select value={assignUserId} onValueChange={v => v && setAssignUserId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz użytkownika" />
                </SelectTrigger>
                <SelectContent>
                  {(users as any[]).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tytuł raportu</Label>
              <Input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAssign(false)}>Anuluj</Button>
              <Button onClick={handleAssign} disabled={assigning || !assignUserId || !assignTitle}>
                {assigning ? 'Przypisuję...' : (
                  <>{copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}Przypisz</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
