'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileBarChart2 } from 'lucide-react'
import { DynamicReport } from '@/components/reports/DynamicReport'
import { format, subWeeks, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

type DateRangeType = 'last_week' | 'last_month' | 'last_quarter' | 'specific_month' | 'year'

function computeDateRange(
  type: DateRangeType,
  specificMonth: string,
  specificYear: string
): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  switch (type) {
    case 'last_week':
      return { from: fmt(subWeeks(now, 1)), to: fmt(now) }
    case 'last_month':
      return { from: fmt(subMonths(now, 1)), to: fmt(now) }
    case 'last_quarter':
      return { from: fmt(subMonths(now, 3)), to: fmt(now) }
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
  const [brandId, setBrandId] = useState<string>('all')
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('last_month')
  const [specificMonth, setSpecificMonth] = useState(
    format(subMonths(new Date(), 1), 'yyyy-MM')
  )
  const [specificYear, setSpecificYear] = useState('2025')
  const [reportParams, setReportParams] = useState<ReportParams | null>(null)

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
              <p className="text-xs text-muted-foreground text-center">
                {reportParams.brandName} · {reportParams.dateFrom} – {reportParams.dateTo}
              </p>
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
    </div>
  )
}
