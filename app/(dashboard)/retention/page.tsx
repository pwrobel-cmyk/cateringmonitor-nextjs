'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, BrainCircuit, TrendingDown, TrendingUp } from 'lucide-react'
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useRetentionModel } from '@/hooks/useRetentionModel'
import { useUserBrands } from '@/hooks/useUserBrands'
import { computeValue, diagnoseBrand, predictPriceEffect } from '@/lib/retentionModel'

const zl = (n: number) =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' zł'
const pct = (x: number, digits = 1) => (x * 100).toFixed(digits).replace('.', ',') + '%'
const pp = (x: number) => (x > 0 ? '+' : '') + x.toFixed(1).replace('.', ',') + ' pp'

function NumberField(props: {
  id: string; label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={props.id}
          type="number"
          inputMode="decimal"
          step={props.step ?? 1}
          value={Number.isFinite(props.value) ? props.value : ''}
          onChange={(e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {props.suffix && <span className="text-sm text-muted-foreground whitespace-nowrap">{props.suffix}</span>}
      </div>
    </div>
  )
}

export default function RetentionPage() {
  const { data, isLoading, error } = useRetentionModel()
  const { assignedBrandIds } = useUserBrands()

  const [brandId, setBrandId] = useState<string>('')
  const [plannedChange, setPlannedChange] = useState(5)
  const [activeCustomers, setActiveCustomers] = useState(1000)
  const [revenuePerCustomer, setRevenuePerCustomer] = useState(1280)
  const [marginPct, setMarginPct] = useState(10)
  const [churnPct, setChurnPct] = useState(30)

  // Domyślnie marka przypisana do użytkownika, w przeciwnym razie pierwsza z listy.
  useEffect(() => {
    if (brandId || !data?.brands.length) return
    const assigned = data.brands.find((b) => assignedBrandIds.includes(b.id))
    setBrandId((assigned || data.brands[0]).id)
  }, [brandId, data, assignedBrandIds])

  const diagnosis = useMemo(
    () => (data && brandId ? diagnoseBrand(brandId, data.reviews, data.aspectModel) : null),
    [data, brandId]
  )

  const value = computeValue({ activeCustomers, revenuePerCustomer, marginPct, churnPct })
  const priceModel = data?.priceModel
  const prediction = priceModel ? predictPriceEffect(priceModel, plannedChange) : null
  const brandEvents = priceModel?.events.filter((e) => e.brandId === brandId) ?? []
  const scatter = (priceModel?.events ?? []).map((e) => ({
    x: e.changePercent, y: Number(e.did.toFixed(2)), own: e.brandId === brandId,
  }))

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Nie udało się przeliczyć modelu
          </CardTitle>
          <CardDescription>{error ? String((error as Error).message) : 'Brak danych.'}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const topDrivers = (diagnosis?.drivers ?? []).filter((d) => d.mentions >= 10)
  const excessTotal = diagnosis && diagnosis.expectedNegatives !== null
    ? diagnosis.negatives - diagnosis.expectedNegatives
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-6 w-6" />
            Retencja i ceny
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Model trenowany na {data.reviews.length.toLocaleString('pl-PL')} opiniach rynku od {data.since}
            {data.truncated && ' (osiągnięto limit pobierania — starsze opinie pominięte)'}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Marka</Label>
          <select
            id="brand"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!data.aspectModel && (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Za mało opinii z treścią i oceną (minimum 200), żeby wytrenować model rynkowy. Tabela pokazuje same zliczenia.
          </CardContent>
        </Card>
      )}

      {/* 1. Przyczyny negatywnych opinii */}
      <Card>
        <CardHeader>
          <CardTitle>Co generuje negatywne opinie</CardTitle>
          <CardDescription>
            {diagnosis && diagnosis.reviewsUsed > 0 ? (
              <>
                {diagnosis.reviewsUsed.toLocaleString('pl-PL')} opinii marki, w tym {diagnosis.negatives} negatywnych ({pct(diagnosis.negativeRate)}).
                {excessTotal !== null && (
                  <> Model rynkowy dla takiego miksu tematów przewiduje {Math.round(diagnosis.expectedNegatives!)}, czyli różnica {excessTotal > 0 ? '+' : ''}{Math.round(excessTotal)}.</>
                )}
              </>
            ) : 'Brak opinii tej marki w analizowanym okresie.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topDrivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Żaden temat nie ma co najmniej 10 wzmianek.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Temat</TableHead>
                  <TableHead className="text-right">Wzmianki</TableHead>
                  <TableHead className="text-right">Negatywne u marki</TableHead>
                  <TableHead className="text-right">Negatywne na rynku</TableHead>
                  <TableHead className="text-right">Ponad normę rynku</TableHead>
                  <TableHead className="text-right">Trend 90 dni</TableHead>
                  <TableHead className="text-right">Waga rynkowa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDrivers.map((d) => (
                  <TableRow key={d.aspect}>
                    <TableCell className="font-medium capitalize">{d.aspect}</TableCell>
                    <TableCell className="text-right">{d.mentions}</TableCell>
                    <TableCell className="text-right">{pct(d.brandNegRate)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{pct(d.marketNegRate)}</TableCell>
                    <TableCell className="text-right">
                      {d.excessNegatives >= 1 ? (
                        <Badge variant="destructive">+{Math.round(d.excessNegatives)} opinii</Badge>
                      ) : (
                        <span className="text-muted-foreground">{Math.round(d.excessNegatives)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.trendPp === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 ${d.trendPp > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {d.trendPp > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {pp(d.trendPp)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {data.aspectModel ? '×' + d.marketOddsRatio.toFixed(2).replace('.', ',') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            „Ponad normę rynku” = liczba negatywnych opinii z danym tematem powyżej tego, co wynikałoby z rynkowego odsetka.
            „Waga rynkowa” = ile razy wzmianka o temacie zwiększa szansę, że opinia jest negatywna (regresja logistyczna, ocena ≤ 2).
          </p>
        </CardContent>
      </Card>

      {/* 2. Cena */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Zmiana ceny a opinie
            <Badge variant={priceModel?.reliability === 'wysoka' ? 'default' : 'outline'}>
              wiarygodność: {priceModel?.reliability}
            </Badge>
          </CardTitle>
          <CardDescription>
            {priceModel?.n ?? 0} zmian cen na rynku z wystarczającą liczbą opinii w oknie ±{priceModel?.windowDays} dni
            (z {data.priceChangesCount.toLocaleString('pl-PL')} zarejestrowanych zmian), w tym {brandEvents.length} tej marki.
            {data.priceError && ` Błąd pobierania zmian cen: ${data.priceError}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {priceModel && priceModel.slope !== null ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <NumberField id="planned" label="Planowana zmiana ceny" value={plannedChange} onChange={setPlannedChange} step={0.5} suffix="%" />
                <div className="md:col-span-2 rounded-lg border p-3 text-sm">
                  {prediction && (
                    <>
                      <div className="text-muted-foreground">Przewidywana zmiana udziału negatywnych opinii względem rynku</div>
                      <div className="text-2xl font-bold">{pp(prediction.pointPp)}</div>
                      {prediction.lowPp !== null && prediction.highPp !== null && (
                        <div className="text-muted-foreground">
                          przedział 95%: od {pp(prediction.lowPp)} do {pp(prediction.highPp)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="Zmiana ceny" unit="%" label={{ value: 'zmiana ceny (%)', position: 'bottom', offset: 4 }} />
                    <YAxis type="number" dataKey="y" name="Zmiana negatywów" unit=" pp" />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Rynek" data={scatter.filter((s) => !s.own)} fill="hsl(var(--muted-foreground))" fillOpacity={0.45} />
                    <Scatter name="Wybrana marka" data={scatter.filter((s) => s.own)} fill="hsl(var(--primary))" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">
                Każdy punkt to jedna zmiana ceny. Oś pionowa: zmiana udziału negatywnych opinii marki minus zmiana na reszcie rynku w tym samym czasie.
                Nachylenie: {priceModel.slope.toFixed(2).replace('.', ',')} pp na 1% ceny
                {priceModel.slopeStdErr !== null && ` (błąd standardowy ${priceModel.slopeStdErr.toFixed(2).replace('.', ',')})`}
                {priceModel.r2 !== null && `, R² ${priceModel.r2.toFixed(2).replace('.', ',')}`}.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Za mało zmian cen z opiniami po obu stronach (minimum 5), żeby oszacować zależność. Model uzupełni się sam wraz z nowymi danymi.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Wartość */}
      <Card>
        <CardHeader>
          <CardTitle>Ile to jest warte</CardTitle>
          <CardDescription>Arytmetyka na Twoich liczbach. Wpisz dane swojego cateringu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="customers" label="Aktywni klienci" value={activeCustomers} onChange={setActiveCustomers} />
            <NumberField id="revenue" label="Przychód na klienta" value={revenuePerCustomer} onChange={setRevenuePerCustomer} suffix="zł/mies." />
            <NumberField id="margin" label="Marża" value={marginPct} onChange={setMarginPct} step={0.5} suffix="%" />
            <NumberField id="churn" label="Churn miesięczny" value={churnPct} onChange={setChurnPct} step={0.5} suffix="%" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">+1% ceny bez utraty klientów</div>
              <div className="text-2xl font-bold">{zl(value.valueOfOnePctPrice)}</div>
              <div className="text-xs text-muted-foreground">zysku miesięcznie</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">1 pp churnu mniej</div>
              <div className="text-2xl font-bold">{zl(value.valueOfOnePpChurn)}</div>
              <div className="text-xs text-muted-foreground">zysku miesięcznie</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Jeden zatrzymany klient</div>
              <div className="text-2xl font-bold">{zl(value.profitPerSavedCustomer)}</div>
              <div className="text-xs text-muted-foreground">
                zysku przez {value.lifetimeMonths.toFixed(1).replace('.', ',')} mies. życia klienta
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Model nie łączy jeszcze opinii z odejściami klientów. Do tego potrzebne są dane o zamówieniach cateringu.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
