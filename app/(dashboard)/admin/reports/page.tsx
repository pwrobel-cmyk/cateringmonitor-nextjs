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
import { FileBarChart2, UserPlus, Copy, Check } from 'lucide-react'
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
