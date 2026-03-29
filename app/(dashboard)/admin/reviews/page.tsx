'use client';

import * as XLSX from 'xlsx';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

const ADMIN_EMAIL = 'p.wrobel@nwd.pl';

const NAV_LINKS = [
  { href: '/admin/discounts', label: 'Rabaty' },
  { href: '/admin/prices', label: 'Ceny' },
  { href: '/admin/reviews', label: 'Opinie' },
  { href: '/admin/scrapers', label: 'Scrapery' },
];

interface Brand {
  id: string;
  name: string;
}

interface ParsedRow {
  brand_id: string;
  brand_name: string;
  author_name: string;
  content: string;
  rating: number;
  review_date: string | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  unmappedBrands: string[];
}

function parseDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0];
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const dmyMatch = trimmed.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
  }

  return null;
}

function getColIndex(headers: string[], candidates: string[]): number {
  const lowerHeaders = headers.map((h) => (h ?? '').toString().toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lowerHeaders.indexOf(candidate.toLowerCase().trim());
    if (idx !== -1) return idx;
  }
  return -1;
}

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [fileName, setFileName] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [allParsedRows, setAllParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [unmappedBrandsFromFile, setUnmappedBrandsFromFile] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    async function loadBrands() {
      const { data } = await supabase.from('brands').select('id, name');
      if (data) {
        setBrands(data as Brand[]);
      }
      setBrandsLoaded(true);
    }
    loadBrands();
  }, []);

  if (!user || user.email !== ADMIN_EMAIL) {
    return null;
  }

  function matchBrand(name: string, brandList: Brand[]): Brand | undefined {
    const lower = name.toLowerCase().trim();
    return brandList.find((b) => b.name.toLowerCase().trim() === lower);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);
    setPreviewRows([]);
    setAllParsedRows([]);
    setUnmappedBrandsFromFile([]);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (raw.length < 2) {
      toast.error('Plik nie zawiera danych.');
      return;
    }

    const headers = (raw[0] as string[]).map((h) => (h ?? '').toString());

    const brandCol = getColIndex(headers, ['title', 'Marka', 'marka', 'brand']);
    const contentCol = getColIndex(headers, ['text', 'Text', 'treść', 'content', 'Treść', 'Content']);
    const authorCol = getColIndex(headers, ['name', 'Name', 'autor', 'author_name', 'Autor']);
    const ratingCol = getColIndex(headers, ['stars', 'Stars', 'ocena', 'rating', 'Rating', 'Ocena']);
    const dateCol = getColIndex(headers, [
      'data dodania opini',
      'date',
      'Date',
      'data',
      'review_date',
      'Data',
    ]);

    const unmappedBrandSet = new Set<string>();
    const parsed: ParsedRow[] = [];
    const fingerprintSet = new Set<string>();

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as unknown[];

      const brandRaw = brandCol >= 0 ? (row[brandCol] ?? '').toString().trim() : '';
      const contentRaw = contentCol >= 0 ? (row[contentCol] ?? '').toString().trim() : '';
      const authorRaw = authorCol >= 0 ? (row[authorCol] ?? '').toString().trim() : '';
      const ratingRaw = ratingCol >= 0 ? row[ratingCol] : undefined;
      const dateRaw = dateCol >= 0 ? row[dateCol] : undefined;

      if (!contentRaw) continue;

      const brand = matchBrand(brandRaw, brands);
      if (!brand) {
        if (brandRaw) unmappedBrandSet.add(brandRaw);
        continue;
      }

      let rating = parseInt(String(ratingRaw ?? ''), 10);
      if (isNaN(rating)) rating = 5;
      if (rating < 1) rating = 1;
      if (rating > 5) rating = 5;

      const review_date = parseDate(dateRaw);

      const fingerprint = `${brand.id}|${authorRaw}|${contentRaw.slice(0, 100)}`;
      if (fingerprintSet.has(fingerprint)) continue;
      fingerprintSet.add(fingerprint);

      parsed.push({
        brand_id: brand.id,
        brand_name: brand.name,
        author_name: authorRaw,
        content: contentRaw,
        rating,
        review_date,
      });
    }

    setAllParsedRows(parsed);
    setPreviewRows(parsed.slice(0, 5));
    setUnmappedBrandsFromFile([...unmappedBrandSet]);
  }

  async function handleImport() {
    if (allParsedRows.length === 0) return;

    setImporting(true);
    setProgress(0);
    setImportResult(null);

    const brandIds = [...new Set(allParsedRows.map((r) => r.brand_id))];

    const existingFingerprints = new Set<string>();
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data } = await supabase
        .from('reviews')
        .select('brand_id, author_name, content')
        .eq('source', 'excel_import')
        .in('brand_id', brandIds)
        .range(from, from + pageSize - 1);

      if (!data || data.length === 0) break;

      for (const row of data) {
        const fp = `${row.brand_id}|${row.author_name || ''}|${(row.content ?? '').slice(0, 100)}`;
        existingFingerprints.add(fp);
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }

    const toInsert: ParsedRow[] = [];
    let skipped = 0;

    for (const row of allParsedRows) {
      const fp = `${row.brand_id}|${row.author_name}|${row.content.slice(0, 100)}`;
      if (existingFingerprints.has(fp)) {
        skipped++;
      } else {
        toInsert.push(row);
      }
    }

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize).map((r) => ({
        brand_id: r.brand_id,
        author_name: r.author_name || null,
        content: r.content,
        rating: r.rating,
        review_date: r.review_date || null,
        source: 'excel_import',
        is_approved: false,
      }));

      await supabase.from('reviews').insert(batch);
      inserted += batch.length;
      setProgress(Math.round((inserted / toInsert.length) * 100));
    }

    const result: ImportResult = {
      imported: inserted,
      skipped,
      unmappedBrands: unmappedBrandsFromFile,
    };

    setImportResult(result);
    setImporting(false);

    toast.success(
      `Zaimportowano ${inserted} opinii. Pominięto ${result.skipped} duplikatów. Niezmapowane marki: ${unmappedBrandsFromFile.join(', ') || 'brak'}.`
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <nav className="flex gap-2">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link key={link.href} href={link.href}>
              <Button variant={isActive ? 'default' : 'outline'} size="sm">{link.label}</Button>
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import opinii z pliku Excel
          </CardTitle>
          <CardDescription>
            Wgraj plik .xlsx z opiniami. System automatycznie wykryje kolumny i dopasuje marki.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <label
              htmlFor="xlsx-upload"
              className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-dashed rounded-md hover:bg-muted transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span className="text-sm">Wybierz plik .xlsx</span>
              <Input
                id="xlsx-upload"
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
                disabled={!brandsLoaded || importing}
              />
            </label>
            {fileName && (
              <span className="text-sm text-muted-foreground truncate max-w-xs">{fileName}</span>
            )}
          </div>

          {!brandsLoaded && (
            <p className="text-sm text-muted-foreground">Ładowanie listy marek...</p>
          )}

          {previewRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Podgląd (pierwsze 5 z {allParsedRows.length} wierszy):
              </p>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Marka</th>
                      <th className="text-left px-3 py-2 font-medium">Autor</th>
                      <th className="text-left px-3 py-2 font-medium">Ocena</th>
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                      <th className="text-left px-3 py-2 font-medium">Treść</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{row.brand_name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.author_name || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{row.rating}</Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.review_date || '—'}</td>
                        <td className="px-3 py-2 max-w-xs truncate">{row.content.slice(0, 80)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {allParsedRows.length > 0 && !importing && !importResult && (
            <Button onClick={handleImport} disabled={importing}>
              Importuj {allParsedRows.length} opinii
            </Button>
          )}

          {importing && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Importowanie... {progress}%</p>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Wynik importu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Zaimportowano: <strong>{importResult.imported}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">
                  Pominięto duplikatów: <strong>{importResult.skipped}</strong>
                </span>
              </div>
            </div>

            {importResult.unmappedBrands.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Niezmapowane marki:
                </p>
                <div className="flex flex-wrap gap-1">
                  {importResult.unmappedBrands.map((b) => (
                    <Badge key={b} variant="destructive">
                      {b}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Wszystkie marki zostały zmapowane.</p>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportResult(null);
                setAllParsedRows([]);
                setPreviewRows([]);
                setFileName('');
                setProgress(0);
                setUnmappedBrandsFromFile([]);
              }}
            >
              Importuj kolejny plik
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
