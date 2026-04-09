'use client'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileBarChart2, ExternalLink, Copy } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function MojeRaportyPage() {
  const { user } = useAuth()

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['my-custom-reports', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('custom_reports')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      return (data || []) as {
        id: string
        title: string
        brand_name: string
        date_from: string
        date_to: string
        created_at: string
      }[]
    },
  })

  const copyLink = async (id: string) => {
    const link = `${window.location.origin}/reports/custom/${id}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link skopiowany do schowka')
    } catch {
      toast.error('Nie udało się skopiować linku')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart2 className="h-6 w-6" />
          Moje raporty
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Raporty przypisane do Twojego konta przez administratora
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Ładowanie…</p>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <FileBarChart2 className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium">Brak przypisanych raportów</p>
            <p className="text-sm mt-1 opacity-70">Administrator może przypisać Ci raport z Generatora Raportów.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map(r => {
            const createdAt = (() => {
              try { return new Date(r.created_at).toLocaleDateString('pl-PL') } catch { return '' }
            })()
            return (
              <Card key={r.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">{r.brand_name}</span></p>
                    <p>{r.date_from} – {r.date_to}</p>
                    {createdAt && <p>Utworzony {createdAt}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/reports/custom/${r.id}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Otwórz raport
                      </Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => copyLink(r.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
