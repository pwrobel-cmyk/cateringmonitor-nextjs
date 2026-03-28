'use client';

import * as XLSX from 'xlsx';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Plus, Pencil, Trash2, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const SOURCE_OPTIONS = ['Total', 'WWW', 'FB Grupa', 'FB Profil', 'Instagram', 'CRM'];
const PAGE_SIZE = 10;

type Brand = {
  id: string;
  name: string;
};

type Discount = {
  id: string;
  created_at: string;
  discount_code: string;
  brand_id: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  conditions: string | null;
  min_days: number | null;
  max_days: number | null;
  min_order_value: number | null;
  source: string | null;
  exclusions: string | null;
  description: string | null;
  channels: string | null;
  notes: string | null;
  is_cashback: boolean;
  is_active: boolean;
  brands: { name: string } | null;
};

type FormData = {
  discount_code: string;
  brand_id: string;
  discount_percent: string;
  discount_amount: string;
  valid_from: string;
  valid_until: string;
  conditions: string;
  min_days: string;
  max_days: string;
  min_order_value: string;
  source: string[];
  exclusions: string;
  description: string;
  channels: string;
  notes: string;
  is_cashback: boolean;
  is_active: boolean;
};

type BulkRow = {
  discount_code: string;
  brand_id: string;
  discount_percent: string;
  valid_from: string;
  valid_until: string;
};

const emptyForm: FormData = {
  discount_code: '',
  brand_id: '',
  discount_percent: '',
  discount_amount: '',
  valid_from: '',
  valid_until: '',
  conditions: '',
  min_days: '',
  max_days: '',
  min_order_value: '',
  source: [],
  exclusions: '',
  description: '',
  channels: '',
  notes: '',
  is_cashback: false,
  is_active: true,
};

function emptyBulkRow(): BulkRow {
  return { discount_code: '', brand_id: '', discount_percent: '', valid_from: '', valid_until: '' };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pl-PL');
  } catch {
    return dateStr;
  }
}

function parsePaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  pages.push(1);
  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

export default function AdminDiscountsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyBulkRow()]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importTotal, setImportTotal] = useState(0);
  const [importTime, setImportTime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (user.email !== 'p.wrobel@nwd.pl') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.email === 'p.wrobel@nwd.pl') {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    setLoading(true);
    const [discountsRes, brandsRes] = await Promise.all([
      supabase.from('discounts').select('*, brands(name)').order('created_at', { ascending: false }),
      supabase.from('brands').select('id, name').order('name'),
    ]);
    if (discountsRes.error) {
      toast.error('Błąd pobierania rabatów: ' + discountsRes.error.message);
    } else {
      setDiscounts(discountsRes.data as Discount[]);
    }
    if (brandsRes.error) {
      toast.error('Błąd pobierania marek: ' + brandsRes.error.message);
    } else {
      setBrands(brandsRes.data as Brand[]);
    }
    setLoading(false);
  }

  const filteredDiscounts = discounts.filter((d) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      d.discount_code?.toLowerCase().includes(term) ||
      d.description?.toLowerCase().includes(term) ||
      d.brands?.name?.toLowerCase().includes(term);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && d.is_active) ||
      (statusFilter === 'inactive' && !d.is_active);
    const matchesBrand = brandFilter === 'all' || d.brand_id === brandFilter;
    return matchesSearch && matchesStatus && matchesBrand;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDiscounts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedDiscounts = filteredDiscounts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const noExpiryActiveCount = discounts.filter((d) => d.is_active && !d.valid_until).length;

  function openAdd() {
    setEditingDiscount(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(d: Discount) {
    setEditingDiscount(d);
    const sourceArr: string[] = d.source
      ? d.source.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    setForm({
      discount_code: d.discount_code ?? '',
      brand_id: d.brand_id ?? '',
      discount_percent: d.discount_percent !== null ? String(d.discount_percent) : '',
      discount_amount: d.discount_amount !== null ? String(d.discount_amount) : '',
      valid_from: d.valid_from ? d.valid_from.slice(0, 10) : '',
      valid_until: d.valid_until ? d.valid_until.slice(0, 10) : '',
      conditions: d.conditions ?? '',
      min_days: d.min_days !== null ? String(d.min_days) : '',
      max_days: d.max_days !== null ? String(d.max_days) : '',
      min_order_value: d.min_order_value !== null ? String(d.min_order_value) : '',
      source: sourceArr,
      exclusions: d.exclusions ?? '',
      description: d.description ?? '',
      channels: d.channels ?? '',
      notes: d.notes ?? '',
      is_cashback: d.is_cashback ?? false,
      is_active: d.is_active ?? true,
    });
    setDialogOpen(true);
  }

  function buildPayload(f: FormData) {
    return {
      discount_code: f.discount_code || null,
      brand_id: f.brand_id || null,
      discount_percent: f.discount_percent !== '' ? Number(f.discount_percent) : null,
      discount_amount: f.discount_amount !== '' ? Number(f.discount_amount) : null,
      valid_from: f.valid_from || null,
      valid_until: f.valid_until || null,
      conditions: f.conditions || null,
      min_days: f.min_days !== '' ? Number(f.min_days) : null,
      max_days: f.max_days !== '' ? Number(f.max_days) : null,
      min_order_value: f.min_order_value !== '' ? Number(f.min_order_value) : null,
      source: f.source.length > 0 ? f.source.join(', ') : null,
      exclusions: f.exclusions || null,
      description: f.description || null,
      channels: f.channels || null,
      notes: f.notes || null,
      is_cashback: f.is_cashback,
      is_active: f.is_active,
    };
  }

  async function handleSave() {
    setSaving(true);
    const payload = buildPayload(form);
    let error;
    if (editingDiscount) {
      const res = await supabase.from('discounts').update(payload).eq('id', editingDiscount.id);
      error = res.error;
    } else {
      const res = await supabase.from('discounts').insert(payload);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error('Błąd zapisu: ' + error.message);
    } else {
      toast.success(editingDiscount ? 'Zaktualizowano rabat.' : 'Dodano rabat.');
      setDialogOpen(false);
      fetchData();
    }
  }

  async function handleDelete(d: Discount) {
    if (!confirm(`Usunąć rabat "${d.discount_code}"?`)) return;
    const { error } = await supabase.from('discounts').delete().eq('id', d.id);
    if (error) {
      toast.error('Błąd usuwania: ' + error.message);
    } else {
      toast.success('Rabat usunięty.');
      fetchData();
    }
  }

  function toggleSource(s: string) {
    setForm((f) => ({
      ...f,
      source: f.source.includes(s) ? f.source.filter((x) => x !== s) : [...f.source, s],
    }));
  }

  function updateBulkRow(idx: number, field: keyof BulkRow, value: string) {
    setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function handleBulkAdd() {
    const valid = bulkRows.filter((r) => r.discount_code.trim());
    if (valid.length === 0) {
      toast.error('Brak wierszy do dodania.');
      return;
    }
    setBulkSaving(true);
    const payload = valid.map((r) => ({
      discount_code: r.discount_code.trim(),
      brand_id: r.brand_id || null,
      discount_percent: r.discount_percent !== '' ? Number(r.discount_percent) : null,
      valid_from: r.valid_from || null,
      valid_until: r.valid_until || null,
      is_active: true,
    }));
    const { error } = await supabase.from('discounts').insert(payload);
    setBulkSaving(false);
    if (error) {
      toast.error('Błąd zbiorczego dodawania: ' + error.message);
    } else {
      toast.success(`Dodano ${valid.length} rabatów.`);
      setBulkRows([emptyBulkRow()]);
      setBulkOpen(false);
      fetchData();
    }
  }

  function parseDateValue(val: unknown): string | null {
    if (!val) return null;
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    }
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    }
    return null;
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) {
      toast.error('Plik jest pusty.');
      return;
    }

    setImportTotal(rows.length);
    setImportProgress(0);

    const now = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const brandName = String(row['Marka'] ?? '').trim();
      const brand = brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());

      const payload = {
        discount_code: String(row['Kod'] ?? '').trim() || null,
        brand_id: brand?.id ?? null,
        discount_percent: row['Procent'] !== undefined && row['Procent'] !== '' ? Number(row['Procent']) : null,
        discount_amount: row['Kwota'] !== undefined && row['Kwota'] !== '' ? Number(row['Kwota']) : null,
        valid_from: parseDateValue(row['DataOd']),
        valid_until: parseDateValue(row['DataDo']),
        conditions: String(row['Warunki'] ?? '').trim() || null,
        min_days: row['MinDni'] !== undefined && row['MinDni'] !== '' ? Number(row['MinDni']) : null,
        max_days: row['MaxDni'] !== undefined && row['MaxDni'] !== '' ? Number(row['MaxDni']) : null,
        min_order_value: row['MinWartosc'] !== undefined && row['MinWartosc'] !== '' ? Number(row['MinWartosc']) : null,
        source: String(row['Zrodlo'] ?? '').trim() || null,
        exclusions: String(row['Wylaczenia'] ?? '').trim() || null,
        description: String(row['Opis'] ?? '').trim() || null,
        channels: String(row['Kanaly'] ?? '').trim() || null,
        notes: String(row['Uwagi'] ?? '').trim() || null,
        is_cashback: String(row['Cashback'] ?? '').toLowerCase() === 'tak' || row['Cashback'] === true,
        is_active: true,
        created_at: now,
      };

      const { error } = await supabase.from('discounts').insert(payload);
      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
      setImportProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setImportTime(now);
    setImportProgress(null);
    toast.success(`Zaimportowano ${successCount} rekordów. Błędy: ${errorCount}.`);
    fetchData();
  }

  async function handleUndoImport() {
    if (!importTime) return;
    if (!confirm('Cofnąć ostatni import? Usunie wszystkie rekordy dodane podczas ostatniego importu.')) return;
    const cutoff = new Date(new Date(importTime).getTime() - 60000).toISOString();
    const { error } = await supabase
      .from('discounts')
      .delete()
      .gte('created_at', cutoff);
    if (error) {
      toast.error('Błąd cofania importu: ' + error.message);
    } else {
      toast.success('Import cofnięty.');
      setImportTime(null);
      fetchData();
    }
  }

  function handleExcelExport() {
    const data = filteredDiscounts.map((d) => ({
      'Data dodania': formatDate(d.created_at),
      'Data od': formatDate(d.valid_from),
      'Data do': formatDate(d.valid_until),
      'Marka': d.brands?.name ?? '',
      'Procent': d.discount_percent ?? '',
      'Kwota': d.discount_amount ?? '',
      'Warunki': d.conditions ?? '',
      'Kod': d.discount_code ?? '',
      'Min. dni': d.min_days ?? '',
      'Max. dni': d.max_days ?? '',
      'Min. wartość': d.min_order_value ?? '',
      'Źródło': d.source ?? '',
      'Wykluczenia': d.exclusions ?? '',
      'Opis': d.description ?? '',
      'Kanały': d.channels ?? '',
      'Uwagi': d.notes ?? '',
      'Cashback': d.is_cashback ? 'Tak' : 'Nie',
      'Aktywny': d.is_active ? 'Tak' : 'Nie',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rabaty');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `rabaty-export-${dateStr}.xlsx`);
  }

  const paginationPages = parsePaginationPages(currentPage, totalPages);

  if (!user || user.email !== 'p.wrobel@nwd.pl') {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Admin nav */}
      <div className="flex gap-2 mb-6">
        <Link href="/admin/discounts">
          <Button variant={pathname === '/admin/discounts' ? 'default' : 'outline'} size="sm">
            Rabaty
          </Button>
        </Link>
        <Link href="/admin/prices">
          <Button variant={pathname === '/admin/prices' ? 'default' : 'outline'} size="sm">
            Ceny
          </Button>
        </Link>
        <Link href="/admin/reviews">
          <Button variant={pathname === '/admin/reviews' ? 'default' : 'outline'} size="sm">
            Opinie
          </Button>
        </Link>
        <Link href="/admin/scrapers">
          <Button variant={pathname === '/admin/scrapers' ? 'default' : 'outline'} size="sm">
            Scrapery
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Zarządzanie rabatami</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />
            Import Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelImport}
          />
          {importTime && (
            <Button variant="outline" size="sm" onClick={handleUndoImport}>
              Cofnij ostatni import
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExcelExport}>
            <Download className="w-4 h-4 mr-1" />
            Eksport Excel
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Dodaj rabat
          </Button>
        </div>
      </div>

      {/* Warning card */}
      {noExpiryActiveCount > 0 && (
        <Card className="mb-4 border-amber-400 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-amber-800 font-medium">
              {noExpiryActiveCount} {noExpiryActiveCount === 1 ? 'rabat' : 'rabatów'} bez daty wygaśnięcia
            </span>
          </CardContent>
        </Card>
      )}

      {/* Import progress */}
      {importProgress !== null && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <p className="text-sm mb-2">Importowanie... {importProgress}% ({Math.round(importProgress / 100 * importTotal)}/{importTotal})</p>
            <Progress value={importProgress} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Szukaj kodu, opisu, marki..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | 'active' | 'inactive'); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="active">Aktywne</SelectItem>
            <SelectItem value="inactive">Nieaktywne</SelectItem>
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v ?? 'all'); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Wszystkie marki" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie marki</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">
          {filteredDiscounts.length} wyników
        </span>
      </div>

      {/* Table */}
      <Card className="mb-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DATA DODANIA</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DATA OD</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DATA DO</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">MARKA</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">%</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">WARUNKI</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">KOD</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">MIN.DNI</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">AKCJE</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Ładowanie...</td>
                  </tr>
                ) : pagedDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Brak rabatów</td>
                  </tr>
                ) : (
                  pagedDiscounts.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(d.created_at)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(d.valid_from)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {d.valid_until ? formatDate(d.valid_until) : (
                          <span className="text-amber-600 font-medium">brak</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {d.brands?.name ? (
                          <Badge variant="secondary">{d.brands.name}</Badge>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {d.discount_percent !== null ? `${d.discount_percent}%` : '—'}
                      </td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={d.conditions ?? undefined}>
                        {d.conditions || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {d.discount_code || '—'}
                      </td>
                      <td className="px-3 py-2">{d.min_days ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(d)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {paginationPages.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
            ) : (
              <Button
                key={p}
                variant={currentPage === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPage(p as number)}
                className="w-9"
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Bulk Add */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkOpen((o) => !o)}
          className="mb-3"
        >
          {bulkOpen ? 'Ukryj' : 'Pokaż'} zbiorcze dodawanie
        </Button>
        {bulkOpen && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Zbiorcze dodawanie rabatów</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left font-medium">Kod</th>
                      <th className="px-2 py-1 text-left font-medium">Marka</th>
                      <th className="px-2 py-1 text-left font-medium">%</th>
                      <th className="px-2 py-1 text-left font-medium">Data od</th>
                      <th className="px-2 py-1 text-left font-medium">Data do</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-2 py-1">
                          <Input
                            value={row.discount_code}
                            onChange={(e) => updateBulkRow(idx, 'discount_code', e.target.value)}
                            className="h-7 text-sm"
                            placeholder="KOD"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={row.brand_id || '_none'}
                            onValueChange={(v) => updateBulkRow(idx, 'brand_id', (!v || v === '_none') ? '' : v)}
                          >
                            <SelectTrigger className="h-7 text-sm w-36">
                              <SelectValue placeholder="Marka" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— brak —</SelectItem>
                              {brands.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            value={row.discount_percent}
                            onChange={(e) => updateBulkRow(idx, 'discount_percent', e.target.value)}
                            className="h-7 text-sm w-20"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="date"
                            value={row.valid_from}
                            onChange={(e) => updateBulkRow(idx, 'valid_from', e.target.value)}
                            className="h-7 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="date"
                            value={row.valid_until}
                            onChange={(e) => updateBulkRow(idx, 'valid_until', e.target.value)}
                            className="h-7 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setBulkRows((rows) => rows.filter((_, i) => i !== idx))}
                            disabled={bulkRows.length === 1}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkRows((rows) => [...rows, emptyBulkRow()])}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Dodaj wiersz
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkAdd}
                  disabled={bulkSaving}
                >
                  {bulkSaving ? 'Zapisywanie...' : 'Dodaj wszystkie'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDiscount ? 'Edytuj rabat' : 'Dodaj rabat'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1">
              <Label>Kod rabatowy</Label>
              <Input
                value={form.discount_code}
                onChange={(e) => setForm((f) => ({ ...f, discount_code: e.target.value }))}
                placeholder="KOD123"
              />
            </div>
            <div className="space-y-1">
              <Label>Marka</Label>
              <Select
                value={form.brand_id || '_none'}
                onValueChange={(v) => setForm((f) => ({ ...f, brand_id: (!v || v === '_none') ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz markę" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— brak —</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Procent zniżki (%)</Label>
              <Input
                type="number"
                value={form.discount_percent}
                onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value }))}
                placeholder="10"
              />
            </div>
            <div className="space-y-1">
              <Label>Kwota zniżki (opcjonalnie)</Label>
              <Input
                type="number"
                value={form.discount_amount}
                onChange={(e) => setForm((f) => ({ ...f, discount_amount: e.target.value }))}
                placeholder="50"
              />
            </div>
            <div className="space-y-1">
              <Label>Data od</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Data do (opcjonalnie)</Label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Min. dni</Label>
              <Input
                type="number"
                value={form.min_days}
                onChange={(e) => setForm((f) => ({ ...f, min_days: e.target.value }))}
                placeholder="7"
              />
            </div>
            <div className="space-y-1">
              <Label>Max. dni (opcjonalnie)</Label>
              <Input
                type="number"
                value={form.max_days}
                onChange={(e) => setForm((f) => ({ ...f, max_days: e.target.value }))}
                placeholder="30"
              />
            </div>
            <div className="space-y-1">
              <Label>Min. wartość zamówienia (opcjonalnie)</Label>
              <Input
                type="number"
                value={form.min_order_value}
                onChange={(e) => setForm((f) => ({ ...f, min_order_value: e.target.value }))}
                placeholder="500"
              />
            </div>
            <div className="space-y-1">
              <Label>Kanały</Label>
              <Input
                value={form.channels}
                onChange={(e) => setForm((f) => ({ ...f, channels: e.target.value }))}
                placeholder="Kanały dystrybucji"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Źródło</Label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.source.includes(s)}
                      onChange={() => toggleSource(s)}
                      className="rounded"
                    />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Warunki</Label>
              <Textarea
                value={form.conditions}
                onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                placeholder="Warunki skorzystania z rabatu"
                rows={2}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Wykluczenia</Label>
              <Textarea
                value={form.exclusions}
                onChange={(e) => setForm((f) => ({ ...f, exclusions: e.target.value }))}
                placeholder="Wykluczenia"
                rows={2}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Opis</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opis rabatu"
                rows={2}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Uwagi</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Uwagi wewnętrzne"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_cashback"
                type="checkbox"
                checked={form.is_cashback}
                onChange={(e) => setForm((f) => ({ ...f, is_cashback: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_cashback">Cashback</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_active">Aktywny</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Zapisywanie...' : editingDiscount ? 'Zapisz zmiany' : 'Dodaj rabat'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
