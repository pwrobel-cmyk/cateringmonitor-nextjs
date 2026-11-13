'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, BrainCircuit, CheckCircle2, ThumbsUp, TrendingUp } from 'lucide-react'
import { useRetentionModel } from '@/hooks/useRetentionModel'
import { useUserBrands } from '@/hooks/useUserBrands'
import {
  buildOwnerReport, buildPricePosition, computeValue, predictPriceEffect, type OwnerTopic,
} from '@/lib/retentionModel'

const zl = (n: number) =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' zł'
const n0 = (x: number) => Math.round(x).toString()
const zl2 = (n: number) => n.toFixed(2).replace('.', ',') + ' zł'
const pct1 = (x: number) => Math.abs(x).toFixed(1).replace('.', ',') + '%'
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

function Quotes({ topic }: { topic: OwnerTopic }) {
  if (topic.examples.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Ostatnie negatywne opinie klientów</div>
      {topic.examples.map((e, i) => (
        <blockquote key={i} className="border-l-2 border-border pl-3 text-sm">
          „{e.text}”
          <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">{e.date} · ocena {e.rating}/5</span>
        </blockquote>
      ))}
    </div>
  )
}

function Position({ topic }: { topic: OwnerTopic }) {
  if (topic.rank === null) return null
  return (
    <Badge variant="outline">{topic.rank}. miejsce na {topic.rankedBrands} marek</Badge>
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

  const report = useMemo(
    () => (data && brandId ? buildOwnerReport(brandId, data.reviews) : null),
    [data, brandId]
  )

  const brandNameForPrice = data?.brands.find((b) => b.id === brandId)?.name ?? ''
  const position = useMemo(
    () => (data && brandNameForPrice ? buildPricePosition(brandNameForPrice, data.offers, data.qualityByName) : null),
    [data, brandNameForPrice]
  )

  const value = computeValue({ activeCustomers, revenuePerCustomer, marginPct, churnPct })
  const priceModel = data?.priceModel
  const priceUsable = !!priceModel && (priceModel.reliability === 'średnia' || priceModel.reliability === 'wysoka')
  const prediction = priceModel && priceUsable ? predictPriceEffect(priceModel, plannedChange) : null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (error || !data || !report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Nie udało się przygotować raportu
          </CardTitle>
          <CardDescription>{error ? String((error as Error).message) : 'Brak danych.'}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const brandName = data.brands.find((b) => b.id === brandId)?.name ?? ''
  const better = report.brandPer100 <= report.marketPer100
  const nothingToFix = report.worsening.length === 0 && report.losing.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-6 w-6" />
            Retencja i ceny
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Na podstawie {data.reviews.length.toLocaleString('pl-PL')} opinii o {data.brands.length} markach od {data.since}
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

      {/* Pozycja cenowa */}
      <Card>
        <CardHeader>
          <CardTitle>Czy Twoje ceny są za niskie</CardTitle>
          <CardDescription>
            Każdy pakiet porównany z cenami innych marek w tym samym typie diety i kaloryczności
            {position?.qualityPremiumTrusted ? ', z poprawką na to, jak klienci oceniają markę.' : '.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.offersError && (
            <p className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Nie udało się pobrać aktualnych cen: {data.offersError}
            </p>
          )}
          {!position || position.compared === 0 || position.avgGapPct === null ? (
            <p className="text-sm text-muted-foreground">
              Brak pakietów tej marki, które mają co najmniej 3 konkurentów w tym samym typie diety i kaloryczności.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-lg font-semibold">
                    {Math.abs(position.avgGapPct) < 1.5
                      ? `Ceny ${brandName} są na poziomie rynku.`
                      : position.avgGapPct > 0
                        ? `${brandName} jest średnio ${pct1(position.avgGapPct)} tańszy niż rynek.`
                        : `${brandName} jest średnio ${pct1(position.avgGapPct)} droższy niż rynek.`}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Porównano {position.compared} pakietów.
                    {position.skipped > 0 && ` ${position.skipped} pominięto, bo mają mniej niż 3 konkurentów.`}
                  </div>
                </div>
                {position.avgGapPct >= 1.5 && (
                  <div className="rounded-lg border p-4">
                    <div className="text-sm text-muted-foreground">Wyrównanie cen do rynku, jeśli klienci zostaną</div>
                    <div className="text-2xl font-bold">{zl(value.valueOfOnePctPrice * position.avgGapPct)}</div>
                    <div className="text-xs text-muted-foreground">
                      więcej zysku co miesiąc przy {activeCustomers.toLocaleString('pl-PL')} klientach i {zl(revenuePerCustomer)} przychodu na klienta (zmienisz na dole strony)
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {position.qualityPremiumTrusted && position.qualityPremiumPct !== null
                  ? `Na tym rynku marka, która ma o 10 mniej negatywnych opinii na 100, bierze średnio ${pct1(position.qualityPremiumPct)} ${position.qualityPremiumPct >= 0 ? 'więcej' : 'mniej'} za ten sam pakiet. „Cena rynku” poniżej to uwzględnia.`
                  : 'Dziś rynek nie płaci wyraźnie więcej za lepsze opinie, więc „cena rynku” poniżej to średnia cen konkurentów.'}
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pakiet</TableHead>
                    <TableHead className="text-right">Twoja cena</TableHead>
                    <TableHead className="text-right">Cena rynku</TableHead>
                    <TableHead className="text-right">Różnica na dzień</TableHead>
                    <TableHead>Najtańszy i najdroższy konkurent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {position.offers.map((o) => (
                    <TableRow key={o.packageName + o.kcal}>
                      <TableCell>
                        <div className="font-medium">{o.packageName}</div>
                        <div className="text-xs text-muted-foreground">{o.segment} · {o.kcal} kcal · {o.competitors} konkurentów</div>
                      </TableCell>
                      <TableCell className="text-right">{zl2(o.price)}</TableCell>
                      <TableCell className="text-right">{zl2(o.expectedPrice)}</TableCell>
                      <TableCell className="text-right">
                        {Math.abs(o.gap) < 0.5 ? (
                          <span className="text-muted-foreground">na poziomie rynku</span>
                        ) : o.gap > 0 ? (
                          <Badge variant="default">możesz +{zl2(o.gap)}</Badge>
                        ) : (
                          <Badge variant="outline">drożej o {zl2(-o.gap)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {o.cheapest.brandName} {zl2(o.cheapest.price)} · {o.priciest.brandName} {zl2(o.priciest.price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                To porównanie cen katalogowych, a nie dowód, że podwyżka się uda. Nie uwzględnia rabatów, liczby posiłków ani zasięgu dostaw.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {report.reviewsUsed < 50 ? (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {brandName} ma tylko {report.reviewsUsed} opinii z treścią w tym okresie. To za mało na wiarygodne wnioski.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Werdykt */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-lg font-semibold">
                {n0(report.brandPer100)} na 100 opinii o {brandName} jest negatywnych. Średnia konkurencji: {n0(report.marketPer100)} na 100.
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {better ? 'Lepiej niż rynek.' : 'Gorzej niż rynek.'}
                {report.overallRank !== null && ` ${report.overallRank}. miejsce na ${report.overallRankedBrands} marek pod względem najmniejszego udziału negatywnych opinii.`}
              </div>
            </CardContent>
          </Card>

          {/* Do naprawy */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Do naprawy</h2>

            {nothingToFix && (
              <Card>
                <CardContent className="flex items-center gap-2 pt-6 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  W żadnym temacie nie jest gorzej niż u konkurencji i nic nie pogorszyło się w ostatnich 90 dniach.
                </CardContent>
              </Card>
            )}

            {report.worsening.map((t) => (
              <Card key={'w-' + t.aspect} className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 capitalize">
                    <TrendingUp className="h-5 w-5 text-destructive" />
                    {t.aspect}
                    <Badge variant="destructive">pogarsza się</Badge>
                    <Position topic={t} />
                  </CardTitle>
                  <CardDescription>
                    W ostatnich 90 dniach {n0(t.recentPer100!)} na 100 opinii o tym temacie było negatywnych. W poprzednich 90 dniach: {n0(t.previousPer100!)} na 100.
                    {' '}Konkurencja: {n0(t.marketPer100)} na 100.
                  </CardDescription>
                </CardHeader>
                <CardContent><Quotes topic={t} /></CardContent>
              </Card>
            ))}

            {report.losing.map((t) => (
              <Card key={'l-' + t.aspect}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 capitalize">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    {t.aspect}
                    <Badge variant="outline">gorzej niż konkurencja</Badge>
                    <Position topic={t} />
                  </CardTitle>
                  <CardDescription>
                    {n0(t.brandPer100)} na 100 opinii o tym temacie jest negatywnych. U konkurencji: {n0(t.marketPer100)} na 100.
                    {' '}To {t.negatives} negatywnych opinii w analizowanym okresie.
                  </CardDescription>
                </CardHeader>
                <CardContent><Quotes topic={t} /></CardContent>
              </Card>
            ))}
          </div>

          {/* Przewagi */}
          {report.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-green-600" />
                  Przewagi nad konkurencją
                </CardTitle>
                <CardDescription>Tematy, w których klienci narzekają wyraźnie rzadziej niż u konkurencji. Materiał do komunikacji marketingowej.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {report.strengths.map((t) => (
                    <li key={t.aspect} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium capitalize">{t.aspect}</span>
                      <span className="text-muted-foreground">
                        {n0(t.brandPer100)} na 100 negatywnych, konkurencja {n0(t.marketPer100)} na 100
                      </span>
                      <Position topic={t} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Cena */}
      <Card>
        <CardHeader>
          <CardTitle>Czy podwyżka ceny pogorszy opinie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {priceUsable && prediction ? (
            <div className="grid gap-4 md:grid-cols-3">
              <NumberField id="planned" label="Planowana zmiana ceny" value={plannedChange} onChange={setPlannedChange} step={0.5} suffix="%" />
              <div className="md:col-span-2 rounded-lg border p-3 text-sm">
                <div className="text-muted-foreground">Przewidywana zmiana udziału negatywnych opinii względem konkurencji</div>
                <div className="text-2xl font-bold">{pp(prediction.pointPp)}</div>
                {prediction.lowPp !== null && prediction.highPp !== null && (
                  <div className="text-muted-foreground">
                    najpewniej między {pp(prediction.lowPp)} a {pp(prediction.highPp)}, na podstawie {priceModel!.n} podwyżek i obniżek na rynku
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Jeszcze nie wiadomo. Do rzetelnej odpowiedzi potrzeba co najmniej 25 zmian cen na rynku, wokół których jest wystarczająco dużo opinii.
              Dziś jest ich {priceModel?.n ?? 0}. Prognoza pojawi się tu sama, gdy danych przybędzie.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Wartość */}
      <Card>
        <CardHeader>
          <CardTitle>Ile to jest warte w Twojej firmie</CardTitle>
          <CardDescription>Wpisz swoje liczby.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="customers" label="Aktywni klienci" value={activeCustomers} onChange={setActiveCustomers} />
            <NumberField id="revenue" label="Przychód na klienta" value={revenuePerCustomer} onChange={setRevenuePerCustomer} suffix="zł/mies." />
            <NumberField id="margin" label="Marża" value={marginPct} onChange={setMarginPct} step={0.5} suffix="%" />
            <NumberField id="churn" label="Odejścia klientów miesięcznie" value={churnPct} onChange={setChurnPct} step={0.5} suffix="%" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Podwyżka o 1% bez utraty klientów</div>
              <div className="text-2xl font-bold">{zl(value.valueOfOnePctPrice)}</div>
              <div className="text-xs text-muted-foreground">więcej zysku co miesiąc</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">
                {Math.round(activeCustomers * 0.01)} klientów mniej odchodzi co miesiąc
              </div>
              <div className="text-2xl font-bold">{zl(value.valueOfOnePpChurn)}</div>
              <div className="text-xs text-muted-foreground">więcej zysku co miesiąc</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground">Jeden zatrzymany klient</div>
              <div className="text-2xl font-bold">{zl(value.profitPerSavedCustomer)}</div>
              <div className="text-xs text-muted-foreground">
                zysku, bo zostaje średnio {value.lifetimeMonths.toFixed(1).replace('.', ',')} mies.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
