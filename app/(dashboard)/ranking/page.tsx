'use client'

import { useState, useMemo } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears } from 'date-fns'
import { RankingReport } from '@/components/reports/RankingReport'
import { Button } from '@/components/ui/button'
import { Trophy, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'

type RangePreset = 'week' | 'month' | 'quarter' | 'year' | 'custom'

export default function RankingPage() {
  const [preset, setPreset] = useState<RangePreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { dateFrom, dateTo } = useMemo(() => {
    const today = new Date()
    switch (preset) {
      case 'week': {
        const to = subDays(today, 1)
        const from = subDays(to, 6)
        return { dateFrom: format(from, 'yyyy-MM-dd'), dateTo: format(to, 'yyyy-MM-dd') }
      }
      case 'month': {
        const lastMonth = subMonths(today, 1)
        return { dateFrom: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), dateTo: format(endOfMonth(lastMonth), 'yyyy-MM-dd') }
      }
      case 'quarter': {
        const lastQ = subQuarters(today, 1)
        return { dateFrom: format(startOfQuarter(lastQ), 'yyyy-MM-dd'), dateTo: format(endOfQuarter(lastQ), 'yyyy-MM-dd') }
      }
      case 'year': {
        const lastYear = subYears(today, 1)
        return { dateFrom: format(startOfYear(lastYear), 'yyyy-MM-dd'), dateTo: format(endOfYear(lastYear), 'yyyy-MM-dd') }
      }
      case 'custom':
        return { dateFrom: customFrom, dateTo: customTo }
    }
  }, [preset, customFrom, customTo])

  const presets: { key: RangePreset; label: string }[] = [
    { key: 'week', label: 'Ostatni tydzień' },
    { key: 'month', label: 'Ostatni miesiąc' },
    { key: 'quarter', label: 'Ostatni kwartał' },
    { key: 'year', label: 'Rok' },
    { key: 'custom', label: 'Własny zakres' },
  ]

  const canGenerate = dateFrom && dateTo

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          Ranking marek
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pozycje marek na rynku cateringu dietetycznego
        </p>
      </div>

      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map(p => (
          <Button
            key={p.key}
            variant={preset === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-36 h-8 text-sm"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="w-36 h-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* Ranking report */}
      {canGenerate && (
        <RankingReport
          key={`${dateFrom}-${dateTo}`}
          dateFrom={dateFrom}
          dateTo={dateTo}
          autoGenerate={true}
          isPublic={true}
          hideEmail={true}
        />
      )}
    </div>
  )
}
