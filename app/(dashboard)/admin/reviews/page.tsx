'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const ADMIN_LINKS = [
  { href: '/admin/discounts', label: 'Rabaty' },
  { href: '/admin/prices', label: 'Ceny' },
  { href: '/admin/reviews', label: 'Opinie' },
  { href: '/admin/scrapers', label: 'Scrapery' },
]

interface ParsedReview {
  brand_id: string
  brand_name: string
  author_name: string
  content: string
  rating: number
  review_date: string | null
  owner_response: string | null
}

function cleanResponse(raw: string): string {
  return raw
    .replace(/^Odpowied[zź]\s+w[łl]a[śs]ciciela[^a-zA-ZąęśćźżńółĄĘŚĆŹŻŃÓŁ]*/i, '')
    .replace(/\s*Więcej\s*$/i, '')
    .trim()
}

export default function AdminReviewsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedReview[]>([])
  const [pending, setPending] = useState<ParsedReview[]>([])
  const [importing, setImporting] = useState(false)
  const [stats, setStats] = useState<{ imported: number; duplicates: number } | null>(null)

  if (!user) return null
  if (user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    router.push('/dashboard')
    return null
  }

  async function fetchBrands() {
    const { data } = await supabase.from('brands').select('id, name')
    return data || []
  }

  function parseFile(f: File): Promise<ParsedReview[]> {
    return new Promise(async (resolve) => {
      const brands = await fetchBrands()
      const brandMap = new Map(brands.map((b: { id: string; name: string }) => [b.name.toLowerCase(), b.id]))

      const reader = new FileReader()
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const headers: string[] = (rows[0] as string[]) || []

        const col = (names: string[]) =>
          headers.findIndex((h) => names.includes(String(h).toLowerCase().trim()))

        const brandCol = col(['title', 'marka'])
        const contentCol = col(['text', 'treść', 'content'])
        const authorCol = col(['name', 'autor', 'author_name'])
        const ratingCol = col(['stars', 'ocena', 'rating'])
        const dateCol = col(['data dodania opini', 'date', 'data', 'review_date'])
        const responseCol = col(['owner_response', 'odpowiedź właściciela', 'odpowiedz wlasciciela', 'owner response'])

        const parsed: ParsedReview[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[]
          const brandRaw = String(row[brandCol] ?? '').trim()
          const content = String(row[contentCol] ?? '')
            .trim()
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
          const authorName = String(row[authorCol] ?? '').trim()
          const rating = Math.min(5, Math.max(1, Number(row[ratingCol]) || 3))
          const brand_id = brandMap.get(brandRaw.toLowerCase())

          if (!brand_id || !content || !authorName) continue

          let review_date: string | null = null
          const rawDate = row[dateCol]
          if (rawDate) {
            if (typeof rawDate === 'number') {
              const d = XLSX.SSF.parse_date_code(rawDate)
              review_date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
            } else {
              const s = String(rawDate).trim()
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                review_date = s
              } else if (/^\d{2}[.\-/]\d{2}[.\-/]\d{4}$/.test(s)) {
                const [d, m, y] = s.split(/[.\-/]/)
                review_date = `${y}-${m}-${d}`
              }
            }
          }

          const rawResponse = responseCol >= 0 ? String(row[responseCol] ?? '').trim() : ''
          const owner_response = rawResponse ? cleanResponse(rawResponse) : null

          parsed.push({
            brand_id: brand_id as string,
            brand_name: brandRaw,
            author_name: authorName,
            content,
            rating,
            review_date,
            owner_response,
          })
        }
        resolve(parsed)
      }
      reader.readAsBinaryString(f)
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setStats(null)
    setPending([])
    const parsed = await parseFile(f)
    setPreview(parsed.slice(0, 5))
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setStats(null)
    setPending([])

    const parsed = await parseFile(file)
    const newReviews: ParsedReview[] = []
    let duplicates = 0

    // Deduplicate within the file first
    const seenFingerprints = new Set<string>()
    const dedupedParsed: ParsedReview[] = []
    for (const review of parsed) {
      const fp = `${review.brand_id}|${review.author_name.trim().toLowerCase()}|${review.content.trim().slice(0, 80).toLowerCase()}`
      if (!seenFingerprints.has(fp)) {
        seenFingerprints.add(fp)
        dedupedParsed.push(review)
      } else {
        duplicates++
      }
    }

    for (const review of dedupedParsed) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('brand_id', review.brand_id)
        .eq('author_name', review.author_name)
        .ilike('content', review.content.slice(0, 80).replace(/[%_]/g, '') + '%')
        .limit(1)

      if (existing && existing.length > 0) {
        duplicates++
      } else {
        newReviews.push(review)
      }
    }

    setPending(newReviews)
    setStats({ imported: newReviews.length, duplicates })
    toast.success(`Znaleziono ${newReviews.length} nowych opinii. Duplikaty: ${duplicates}.`)
    setImporting(false)
  }

  async function approve(review: ParsedReview) {
    const { data: inserted, error } = await supabase.from('reviews').insert({
      brand_id: review.brand_id,
      author_name: review.author_name,
      content: review.content,
      rating: review.rating,
      review_date: review.review_date,
      source: 'manual',
      is_approved: true,
      original_brand_name: review.brand_name,
    }).select('id').single()

    if (error && error.code !== '23505') {
      toast.error(`Błąd zapisu: ${error.message}`)
      return
    }

    if (inserted?.id && review.owner_response) {
      await (supabase as any).from('review_responses').insert({
        review_id: inserted.id,
        brand_id: review.brand_id,
        body: review.owner_response,
        source: 'manual',
        status: 'published',
      })
    }

    setPending((prev) => prev.filter((r) => r !== review))
    toast.success('Opinia zatwierdzona i zapisana')
  }

  function reject(review: ParsedReview) {
    setPending((prev) => prev.filter((r) => r !== review))
    toast.success('Opinia odrzucona')
  }

  async function approveAll() {
    let saved = 0
    let failed = 0
    for (const review of pending) {
      const { data: inserted, error } = await supabase.from('reviews').insert({
        brand_id: review.brand_id,
        author_name: review.author_name,
        content: review.content,
        rating: review.rating,
        review_date: review.review_date,
        source: 'manual',
        is_approved: true,
        original_brand_name: review.brand_name,
      }).select('id').single()
      if (error && error.code !== '23505') {
        failed++
      } else {
        saved++
        if (inserted?.id && review.owner_response) {
          await (supabase as any).from('review_responses').insert({
            review_id: inserted.id,
            brand_id: review.brand_id,
            body: review.owner_response,
            source: 'manual',
            status: 'published',
          })
        }
      }
    }
    setPending([])
    toast.success(`Zatwierdzono ${saved} opinii${failed > 0 ? `. Błędy: ${failed}` : ''}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {ADMIN_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <Button variant={l.href === '/admin/reviews' ? 'default' : 'outline'} size="sm">
              {l.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle>Import opinii z pliku Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="file" accept=".xlsx" onChange={handleFileChange} className="block" />

          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Podgląd (pierwsze 5 wierszy):</p>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border px-2 py-1">Marka</th>
                      <th className="border px-2 py-1">Autor</th>
                      <th className="border px-2 py-1">Ocena</th>
                      <th className="border px-2 py-1">Data</th>
                      <th className="border px-2 py-1">Treść</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-1">{r.brand_name}</td>
                        <td className="border px-2 py-1">{r.author_name}</td>
                        <td className="border px-2 py-1">{r.rating}</td>
                        <td className="border px-2 py-1">{r.review_date}</td>
                        <td className="border px-2 py-1 max-w-xs truncate">{r.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {file && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Sprawdzanie duplikatów...' : 'Wczytaj i sprawdź duplikaty'}
            </Button>
          )}

          {stats && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✓ Nowe: {stats.imported}</span>
              <span className="text-yellow-600">⊘ Duplikaty: {stats.duplicates}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moderacja */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Moderacja opinii — {pending.length} oczekujących</CardTitle>
            {pending.length > 0 && (
              <Button size="sm" onClick={approveAll}>
                Zatwierdź wszystkie ({pending.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Wczytaj plik Excel i kliknij &quot;Wczytaj i sprawdź duplikaty&quot;, aby zobaczyć opinie do moderacji.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((r, i) => (
                <div key={i} className="border rounded-lg p-4 flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{r.brand_name}</span>
                      <Badge variant="outline">{r.rating}★</Badge>
                      <span className="text-xs text-muted-foreground">{r.author_name}</span>
                      <span className="text-xs text-muted-foreground">{r.review_date}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">{r.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => approve(r)}>
                      Zatwierdź
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reject(r)}>
                      Odrzuć
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
