'use client'

import * as XLSX from 'xlsx';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, RefreshCw, FileSpreadsheet, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string;
  name: string;
}

interface Package {
  id: string;
  name: string;
  brand_id: string;
}

interface KcalRange {
  id: string;
  kcal_from: number;
  kcal_to: number;
  kcal_label: string;
}

interface PackageKcalRange {
  id: string;
  package_id: string;
  kcal_range_id: string;
}

interface ImportBatch {
  id: string;
  source_file_name: string;
  created_at: string;
  status: string;
  total_records: number;
  successful_records: number;
  failed_records: number;
  rejection_reasons?: string | null;
}

interface ImportError {
  row: number;
  marka: string;
  pakiet?: string;
  kcal?: string;
  powod: string;
}

// ─── Admin Nav ────────────────────────────────────────────────────────────────

const adminLinks = [
  { href: '/admin/discounts', label: 'Rabaty' },
  { href: '/admin/prices', label: 'Ceny' },
  { href: '/admin/reviews', label: 'Opinie' },
  { href: '/admin/scrapers', label: 'Scrapery' },
];

function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 mb-6">
      {adminLinks.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link key={link.href} href={link.href}><Button variant={isActive ? 'default' : 'outline'} size="sm">{link.label}</Button></Link>
        );
      })}
    </nav>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    const ms = Math.round((val - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().split('T')[0];
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

function normalize(s: string): string {
  return s.replace(/[\s\-]/g, '').toLowerCase();
}

function matchBrand(cell: string, brands: Brand[]): { brand: Brand | null; score: number } {
  const cellLower = cell.toLowerCase().trim();
  let best: Brand | null = null;
  let bestScore = 0;

  for (const brand of brands) {
    const nameLower = brand.name.toLowerCase();
    let score = 0;
    if (nameLower === cellLower) {
      score = 3;
    } else if (cellLower.includes(nameLower)) {
      score = 2;
    } else if (nameLower.includes(cellLower)) {
      score = 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = brand;
    } else if (score > 0 && score === bestScore && best !== null) {
      // tie — ambiguous
      best = null;
      bestScore = -1;
    }
  }

  return { brand: bestScore > 0 ? best : null, score: bestScore };
}

const PACKAGE_ALIASES: Record<string, string> = {
  // Zdrowa Szama
  'active - 5 posiłków': 'Zdrowa Szama - ACTIVE',
  'fit&slim - 5 posiłków': 'Zdrowa Szama - FIT & SLIM',
  'fit slim - 5 posiłków': 'Zdrowa Szama - FIT & SLIM',
  'fodmap - 5 posiłków': 'Zdrowa Szama - FODMAP',
  'hashi - 5 posiłków': 'Zdrowa Szama - HASHI',
  'intermittent fasting - 3 posiłki': 'Zdrowa Szama - INTERMITTENT FASTING',
  'keto - 4 posiłki': 'Zdrowa Szama - KETO',
  'klasyczna - 3 posiłki': 'Zdrowa Szama - KLASYCZNA',
  'klasyczna - 5 posiłków': 'Zdrowa Szama - KLASYCZNA',
  'low carb - 5 posiłków': 'Zdrowa Szama - LOW CARB',
  'sokowa - 6 soków': 'Zdrowa Szama - SOKOWA',
  'vege - 5 posiłków': 'Zdrowa Szama - VEGE',
  // SuperMenu WM
  'supermenu - wm fit 30': 'SM NEW Wybór menu 30',
  'supermenu - wm fit 40': 'SM NEW Wybór menu 40',
  'supermenu - wm keto 40': 'SM NEW Wybór menu 40',
  'supermenu - wm niski ig 30': 'SM NEW Wybór menu 30',
  'supermenu - wm niski ig 40': 'SM NEW Wybór menu 40',
  'supermenu - wm no gluten & no lactose 30': 'SM NEW Wybór menu 30',
  'supermenu - wm no gluten & no lactose 40': 'SM NEW Wybór menu 40',
  'supermenu - wm super smart 10': 'SM NEW Wybór menu 10',
  'supermenu - wm vege 30': 'SM NEW Wybór menu 30',
  'supermenu - wm vege 40': 'SM NEW Wybór menu 40',
  'supermenu - wm wegańska 30': 'SM NEW Wybór menu 30',
  'supermenu - wm wegańska 40': 'SM NEW Wybór menu 40',
  'supermenu - wm wrażliwe jelita 40': 'SM NEW Wybór menu 40',
  'supermenu - wm wzmocnienie odporności 10': 'SM NEW Wybór menu 10',
  'supermenu - wm wzmocnienie odporności 30': 'SM NEW Wybór menu 30',
  'supermenu - wm wzmocnienie odporności 40': 'SM NEW Wybór menu 40',
  // FitApetit
  'fitapetit - signature': 'FitApetit - Standard - wybór menu 10',
  // Pomelo
  'pomelo - wegeteriańska': 'Pomelo - Wegetariańska',
};

function matchPackage(cell: string, packages: Package[]): { pkg: Package | null; score: number } {
  const cellLower = cell.toLowerCase().trim();

  // Alias lookup
  const aliasTarget = PACKAGE_ALIASES[cellLower];
  if (aliasTarget) {
    const found = packages.find((p) => p.name.toLowerCase() === aliasTarget.toLowerCase());
    if (found) return { pkg: found, score: 4 };
  }
  const cellNorm = normalize(cell);
  let best: Package | null = null;
  let bestScore = 0;

  for (const pkg of packages) {
    const nameLower = pkg.name.toLowerCase();
    const nameNorm = normalize(pkg.name);
    let score = 0;
    if (nameLower === cellLower) {
      score = 3;
    } else if (nameNorm === cellNorm) {
      score = 2;
    } else if (nameLower.includes(cellLower) || cellLower.includes(nameLower)) {
      score = 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = pkg;
    }
  }

  return { pkg: bestScore > 0 ? best : null, score: bestScore };
}

function matchKcal(cell: unknown, kcalRanges: KcalRange[]): KcalRange | null {
  if (cell === null || cell === undefined || cell === '') return null;
  const raw = String(cell).replace(/kcal/gi, '').trim();
  const num = parseFloat(raw);

  for (const kr of kcalRanges) {
    if (kr.kcal_label.replace(/kcal/gi, '').trim() === raw) return kr;
    if (!isNaN(num)) {
      if (kr.kcal_from === num) return kr;
      if (num >= kr.kcal_from && num <= kr.kcal_to) return kr;
      if (Math.abs(kr.kcal_from - num) <= 100) return kr;
    }
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPricesPage() {
  const { user } = useAuth();
  const router = useRouter();

  // reference data
  const [brands, setBrands] = useState<Brand[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [kcalRanges, setKcalRanges] = useState<KcalRange[]>([]);
  const [packageKcalRanges, setPackageKcalRanges] = useState<PackageKcalRange[]>([]);

  // file state
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // import state
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // history
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user && user.email !== 'p.wrobel@nwd.pl') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // ── Reference data load ───────────────────────────────────────────────────

  useEffect(() => {
    async function loadRefData() {
      const [{ data: b }, { data: p }, { data: k }, { data: pkr }] = await Promise.all([
        supabase.from('brands').select('id, name'),
        supabase.from('packages').select('id, name, brand_id'),
        supabase.from('kcal_ranges').select('id, kcal_from, kcal_to, kcal_label'),
        supabase.from('package_kcal_ranges').select('id, package_id, kcal_range_id'),
      ]);
      if (b) setBrands(b);
      if (p) setPackages(p);
      if (k) setKcalRanges(k);
      if (pkr) setPackageKcalRanges(pkr);
    }
    loadRefData();
  }, []);

  // ── Import history ────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('import_batches')
      .select('id, source_file_name, created_at, status, total_records, successful_records, failed_records, rejection_reasons')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setBatches(data);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── File parsing ──────────────────────────────────────────────────────────

  const parseFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
      if (rows.length === 0) return;
      const headers = rows[0].map(String);
      const body = rows.slice(1, 6).map((r) => r.map(String));
      setPreviewHeaders(headers);
      setPreviewRows(body);
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleFileChange = useCallback(
    (f: File | null) => {
      if (!f) return;
      setFile(f);
      parseFile(f);
    },
    [parseFile],
  );

  const clearFile = () => {
    setFile(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & drop
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      if (!data) {
        setImporting(false);
        return;
      }
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
      }) as unknown[][];

      if (allRows.length < 2) {
        toast.error('Plik jest pusty lub nie zawiera danych.');
        setImporting(false);
        return;
      }

      const headers = (allRows[0] as string[]).map((h) => String(h).trim());
      const dataRows = allRows.slice(1).filter((r) => r.some((c) => c !== ''));
      const totalRows = dataRows.length;
      setProgressTotal(totalRows);

      // Create import batch
      const { data: batchData, error: batchError } = await supabase
        .from('import_batches')
        .insert({
          source_file_name: file.name,
          status: 'processing',
          total_records: totalRows,
          successful_records: 0,
          failed_records: 0,
          import_type: 'price_import',
          user_id: user?.id,
          notes: null,
        })
        .select('id')
        .single();

      if (batchError || !batchData) {
        toast.error('Nie udało się utworzyć rekordu importu.');
        setImporting(false);
        return;
      }
      const batchId = batchData.id;

      const colIndex = (...names: string[]) =>
        headers.findIndex((h) => names.some((n) => h.toLowerCase() === n.toLowerCase()));
      const iDate = colIndex('Data', 'Date', 'data');
      const iMarka = colIndex('Marka', 'Brand', 'Firma');
      const iPakiet = colIndex('Pakiet', 'Package', 'Dieta');
      const iKcal = colIndex('Kcal', 'Kalorie', 'Kalorii', 'kcal', 'kalorie', 'Kaloryczność');
      const iCena = colIndex('Cena', 'Cena PLN', 'Price', 'cena');
      const iWaluta = colIndex('Waluta', 'Currency', 'waluta');

      let successCount = 0;
      const errors: ImportError[] = [];

      // Keep a local mutable copy of package_kcal_ranges for auto-created entries
      const localPkr = [...packageKcalRanges];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const rowNum = i + 2;

        if (i === 0) {
        }

        // 1. Date
        const dateVal = iDate >= 0 ? row[iDate] : null;
        const parsedDate = parseDate(dateVal);
        const markaRaw = iMarka >= 0 ? String(row[iMarka] ?? '').trim() : '?';
        if (!parsedDate) {
          errors.push({ row: rowNum, marka: markaRaw || '?', powod: `nieprawidłowa data "${dateVal}"` });
          setProgress(i + 1);
          continue;
        }

        // 2. Brand
        const markaCell = markaRaw;
        if (!markaCell) {
          errors.push({ row: rowNum, marka: '?', powod: 'brak marki' });
          setProgress(i + 1);
          continue;
        }
        const { brand, score: brandScore } = matchBrand(markaCell, brands);
        if (!brand) {
          errors.push({ row: rowNum, marka: markaCell, powod: `nie znaleziono marki dla "${markaCell}"` });
          setProgress(i + 1);
          continue;
        }

        // 3. Package
        const pakietCell = iPakiet >= 0 ? String(row[iPakiet] ?? '').trim() : '';
        if (!pakietCell) {
          errors.push({ row: rowNum, marka: brand.name, powod: 'brak pakietu' });
          setProgress(i + 1);
          continue;
        }
        const brandPackages = packages.filter((p) => p.brand_id === brand.id);
        const { pkg, score: pkgScore } = matchPackage(pakietCell, brandPackages);
        if (!pkg) {
          errors.push({ row: rowNum, marka: brand.name, pakiet: pakietCell, powod: `nie znaleziono pakietu "${pakietCell}"` });
          setProgress(i + 1);
          continue;
        }

        // 4. Kcal
        const kcalCell = iKcal >= 0 ? row[iKcal] : null;
        if (i === 0) {
        }
        const matchedKcal = matchKcal(kcalCell, kcalRanges);

        // 5. Price
        const priceRaw = iCena >= 0 ? row[iCena] : null;
        const price = priceRaw !== null && priceRaw !== '' ? parseFloat(String(priceRaw)) : NaN;
        if (isNaN(price)) {
          errors.push({ row: rowNum, marka: brand.name, pakiet: pkg.name, kcal: String(kcalCell ?? '').trim() || '?', powod: `nieprawidłowa cena "${priceRaw}"` });
          setProgress(i + 1);
          continue;
        }

        const currency = iWaluta >= 0 && row[iWaluta] ? String(row[iWaluta]).trim() : 'PLN';

        // 6. Resolve or create package_kcal_range
        let pkrId: string | null = null;
        if (matchedKcal) {
          const existing = localPkr.find(
            (r) => r.package_id === pkg.id && r.kcal_range_id === matchedKcal.id,
          );
          if (existing) {
            pkrId = existing.id;
          } else {
            const { data: newPkr, error: pkrError } = await supabase
              .from('package_kcal_ranges')
              .insert({ package_id: pkg.id, kcal_range_id: matchedKcal.id })
              .select('id')
              .single();
            if (pkrError || !newPkr) {
              errors.push({ row: rowNum, marka: brand.name, pakiet: pkg.name, kcal: String(kcalCell ?? '').trim() || '?', powod: `błąd tworzenia package_kcal_range: ${pkrError?.message}` });
              setProgress(i + 1);
              continue;
            }
            localPkr.push({ id: newPkr.id, package_id: pkg.id, kcal_range_id: matchedKcal.id });
            pkrId = newPkr.id;
          }
        }

        // 7. Upsert price — only via package_kcal_range_id (price_history has no package_id column)
        let upsertError: { message: string } | null = null;

        if (pkrId) {
          const { data: existing } = await supabase
            .from('price_history')
            .select('id')
            .eq('package_kcal_range_id', pkrId)
            .eq('date_recorded', parsedDate)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('price_history')
              .update({ price, currency })
              .eq('id', existing.id);
            upsertError = error;
          } else {
            const { error } = await supabase
              .from('price_history')
              .insert({ package_kcal_range_id: pkrId, date_recorded: parsedDate, price, currency });
            upsertError = error;
          }
        } else {
          errors.push({ row: rowNum, marka: brand.name, pakiet: pkg.name, kcal: String(kcalCell ?? '').trim() || '?', powod: 'brak zakresu kcal' });
          setProgress(i + 1);
          continue;
        }

        if (upsertError) {
          errors.push({ row: rowNum, marka: brand.name, pakiet: pkg.name, kcal: String(kcalCell ?? '').trim() || '?', powod: upsertError.message });
        } else {
          successCount++;
        }

        setProgress(i + 1);
      }

      // Update batch
      const finalStatus = errors.length === totalRows ? 'failed' : 'completed';
      await supabase
        .from('import_batches')
        .update({
          status: finalStatus,
          successful_records: successCount,
          failed_records: errors.length,
          rejection_reasons: errors.length > 0 ? JSON.stringify(errors.slice(0, 200)) : null,
        })
        .eq('id', batchId);

      toast.success(
        `Przetworzono ${totalRows} wierszy. Sukces: ${successCount}, Błędy: ${errors.length}.`,
      );

      setImporting(false);
      setProgress(0);
      setProgressTotal(0);
      fetchHistory();
    };

    reader.readAsArrayBuffer(file);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user || user.email !== 'p.wrobel@nwd.pl') {
    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <AdminNav />

      <h1 className="text-2xl font-bold mb-6">Import cen</h1>

      {/* Upload Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Importuj plik z cenami</CardTitle>
          <CardDescription>
            Obsługiwane formaty: .xlsx, .csv. Wymagane kolumny: Data, Marka, Pakiet, Kcal, Cena.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}
              ${file ? 'cursor-default' : 'cursor-pointer'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                <span className="font-medium">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="ml-2"
                >
                  <X className="h-4 w-4" />
                  Wyczyść
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-10 w-10" />
                <p className="text-sm">Przeciągnij plik tutaj lub kliknij, aby wybrać</p>
                <p className="text-xs">.xlsx, .csv</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {previewHeaders.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Podgląd (pierwsze 5 wierszy):</p>
              <div className="overflow-x-auto rounded border">
                <table className="text-xs w-full">
                  <thead className="bg-muted">
                    <tr>
                      {previewHeaders.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="border-t">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && progressTotal > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Przetwarzanie…</span>
                <span>
                  {progress} / {progressTotal}
                </span>
              </div>
              <Progress value={Math.round((progress / progressTotal) * 100)} />
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full sm:w-auto"
          >
            {importing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Importowanie…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importuj
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* History Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historia importów</CardTitle>
            <CardDescription>Ostatnie 20 operacji importu</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={loadingHistory}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak historii importów.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Plik</th>
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Wiersze</th>
                    <th className="pb-2 pr-4 font-medium text-right">Sukces</th>
                    <th className="pb-2 font-medium text-right">Błędy</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const batchErrors: ImportError[] = (() => {
                      try { return JSON.parse(batch.rejection_reasons ?? '[]'); } catch { return []; }
                    })();
                    const isExpanded = expandedBatchId === batch.id;
                    return (
                      <Fragment key={batch.id}>
                        <tr className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs max-w-[200px] truncate">
                            {batch.source_file_name}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                            {new Date(batch.created_at).toLocaleString('pl-PL', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              variant={
                                batch.status === 'completed'
                                  ? 'default'
                                  : batch.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {batch.status === 'completed'
                                ? 'Zakończony'
                                : batch.status === 'failed'
                                ? 'Błąd'
                                : 'W trakcie'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-right">{batch.total_records ?? '—'}</td>
                          <td className="py-2 pr-4 text-right">{batch.successful_records ?? '—'}</td>
                          <td className="py-2 text-right">
                            {batch.failed_records > 0 ? (
                              <button
                                onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                                className="inline-flex items-center gap-1 text-destructive font-medium underline decoration-dotted"
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {batch.failed_records}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && batchErrors.length > 0 && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="py-3 px-4">
                              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded border border-border/50">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1.5 text-left font-medium">Wiersz</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Marka</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Pakiet</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Kcal</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Powód</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {batchErrors.map((err, idx) => (
                                      <tr key={idx} className="border-t border-border/30">
                                        <td className="px-2 py-1 text-muted-foreground">{err.row}</td>
                                        <td className="px-2 py-1">{err.marka}</td>
                                        <td className="px-2 py-1 text-muted-foreground">{err.pakiet ?? '—'}</td>
                                        <td className="px-2 py-1 text-muted-foreground">{err.kcal ?? '—'}</td>
                                        <td className="px-2 py-1 text-destructive">{err.powod}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
