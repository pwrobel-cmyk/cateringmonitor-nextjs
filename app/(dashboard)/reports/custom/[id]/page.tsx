'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { DynamicReport } from '@/components/reports/DynamicReport'
import { Skeleton } from '@/components/ui/skeleton'
import { FileBarChart2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

interface CustomReport {
  id: string
  title: string
  brand_id: string | null
  brand_name: string
  date_from: string
  date_to: string
  created_at: string
}

export default function CustomReportPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<CustomReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(supabase as any)
      .from('custom_reports')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }: any) => {
        if (err || !data) {
          setError('Raport nie został znaleziony.')
        } else {
          setReport(data)
        }
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6 py-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-48" />
        <div className="space-y-4 mt-8">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground">
        <FileBarChart2 className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">{error || 'Raport nie został znaleziony.'}</p>
      </div>
    )
  }

  const createdAt = (() => {
    try { return format(new Date(report.created_at), 'd MMMM yyyy', { locale: pl }) } catch { return '' }
  })()

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart2 className="h-6 w-6 text-primary" />
          {report.title}
        </h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {report.date_from} – {report.date_to}
          </span>
          {createdAt && <span>Wygenerowany {createdAt}</span>}
        </div>
      </div>

      <DynamicReport
        brandId={report.brand_id}
        brandName={report.brand_name}
        dateFrom={report.date_from}
        dateTo={report.date_to}
      />
    </div>
  )
}
