'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Filter, Calendar as CalendarIcon, ArrowUpDown, TrendingUp, TrendingDown, Minus, Settings } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { cn, getCurrencySymbol } from '@/lib/utils'
import { BrandAverageChart } from '@/components/dashboard/BrandAverageChart'
import { DiscountTrendsChart } from '@/components/dashboard/DiscountTrendsChart'
import { usePackagePriceComparison } from '@/hooks/supabase/usePriceHistory'
import { useBrandsWithPackages } from '@/hooks/supabase/useBrandsWithPackages'
import { useDiscountTrends } from '@/hooks/supabase/useDiscountTrends'
import { PackagePairConfigurator } from '@/components/compare/PackagePairConfigurator'
import { useUserPackagePairs } from '@/hooks/useUserPackagePairs'
import { toast } from 'sonner'
import { useCountry } from '@/contexts/CountryContext'

interface BrandPackagePrice {
  brandName: string
  packageName: string
  category: string
  catalogPrice: number
  promoPrice: number
  discountPercentage: number
  hasDiscount: boolean
}

interface KcalComparisonRow {
  kcalLabel: string
  kcal: number
  brandPackagePrices: Record<string, BrandPackagePrice>
}

export default function Compare() {
  const { selectedCountry } = useCountry()
  const currencySymbol = getCurrencySymbol(selectedCountry === 'Czechy' ? 'CZK' : 'PLN')
  const [activeTab, setActiveTab] = useState<'compare' | 'config'>('compare')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedBrandPackages, setSelectedBrandPackages] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<Date>(new Date())
  const [dateTo, setDateTo] = useState<Date>(new Date())
  const [sortBy, setSortBy] = useState<'kcal' | 'price' | 'discount'>('kcal')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [priceType, setPriceType] = useState<'catalog' | 'promo'>('promo')
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing')
  const [activeDateFilter, setActiveDateFilter] = useState<'today' | 'yesterday' | 'custom'>('today')

  const { data: brandsWithPackages, isLoading: brandsLoading } = useBrandsWithPackages()
  const { data: savedPairs } = useUserPackagePairs()

  const allBrandPackages = brandsWithPackages?.flatMap(brand =>
    brand.packages.map(pkg => ({
      key: `${brand.name} - ${pkg.name}`,
      brandName: brand.name,
      packageName: pkg.name,
      packageId: pkg.id,
      category: pkg.category || 'Inne',
    }))
  ) || []

  const selectedPackageIds = selectedBrandPackages
    .map(key => allBrandPackages.find(bp => bp.key === key)?.packageId)
    .filter((id): id is string => id !== undefined)

  const { data: kcalComparisonData, isLoading: priceLoading } = usePackagePriceComparison({
    dateFrom,
    dateTo,
    packageIds: selectedPackageIds.length > 0 ? selectedPackageIds : undefined,
    customerType,
  }, activeTab === 'compare')

  const { data: discountTrendsData, isLoading: discountLoading } = useDiscountTrends({
    dateFrom,
    dateTo,
    brandNames: selectedBrands.length > 0 ? selectedBrands : undefined,
    customerType,
  }, activeTab === 'compare')

  const filteredBrandsWithData = useMemo(() => brandsWithPackages || [], [brandsWithPackages])

  const availableBrandPackages = useMemo(() => {
    return filteredBrandsWithData?.flatMap(brand =>
      (selectedBrands.length === 0 || selectedBrands.includes(brand.name))
        ? brand.packages.map(pkg => ({
            key: `${brand.name} - ${pkg.name}`,
            brandName: brand.name,
            packageName: pkg.name,
            packageId: pkg.id,
            category: pkg.category || 'Inne',
          }))
        : []
    ) || []
  }, [filteredBrandsWithData, selectedBrands])

  useEffect(() => {
    if (filteredBrandsWithData && filteredBrandsWithData.length > 0 && selectedBrands.length === 0) {
      const defaultBrands = filteredBrandsWithData
        .filter(b => b.name === 'Nice To Fit You' || b.name === 'MaczFit')
        .map(b => b.name)
      if (defaultBrands.length > 0) setSelectedBrands(defaultBrands)
      else setSelectedBrands(filteredBrandsWithData.slice(0, 2).map(b => b.name))
    }
  }, [filteredBrandsWithData, selectedBrands.length])

  useEffect(() => {
    if (availableBrandPackages.length > 0 && selectedBrandPackages.length === 0) {
      const defaultPackages = availableBrandPackages
        .filter(bp =>
          (bp.brandName === 'MaczFit' && bp.packageName.toLowerCase().includes('everyday')) ||
          (bp.brandName === 'Nice To Fit You' && bp.packageName.toLowerCase().includes('basic 25'))
        )
        .map(bp => bp.key)
      if (defaultPackages.length > 0) setSelectedBrandPackages(defaultPackages)
      else setSelectedBrandPackages(availableBrandPackages.slice(0, 2).map(bp => bp.key))
    }
  }, [availableBrandPackages])

  const comparisonData = useMemo<KcalComparisonRow[]>(() => {
    const data: KcalComparisonRow[] = []
    if (kcalComparisonData) {
      kcalComparisonData.forEach(item => {
        const filteredBrandPackagePrices: Record<string, BrandPackagePrice> = {}
        selectedBrandPackages.forEach(brandPackageKey => {
          const brandPackagePrice = (item.brandPackagePrices as any)[brandPackageKey]
          if (brandPackagePrice) filteredBrandPackagePrices[brandPackageKey] = brandPackagePrice
        })
        data.push({ kcalLabel: item.kcalLabel, kcal: item.kcal, brandPackagePrices: filteredBrandPackagePrices })
      })
    }
    return data
  }, [kcalComparisonData, selectedBrandPackages])

  const sortedData = useMemo(() => {
    return [...comparisonData].sort((a, b) => {
      let aValue: number
      let bValue: number
      switch (sortBy) {
        case 'price': {
          const aPrices = Object.values(a.brandPackagePrices).map(p => priceType === 'catalog' ? p.catalogPrice : p.promoPrice)
          const bPrices = Object.values(b.brandPackagePrices).map(p => priceType === 'catalog' ? p.catalogPrice : p.promoPrice)
          aValue = aPrices.length > 0 ? Math.min(...aPrices) : 0
          bValue = bPrices.length > 0 ? Math.min(...bPrices) : 0
          break
        }
        case 'discount': {
          const aDiscounts = Object.values(a.brandPackagePrices).map(p => p.discountPercentage)
          const bDiscounts = Object.values(b.brandPackagePrices).map(p => p.discountPercentage)
          aValue = aDiscounts.length > 0 ? Math.max(...aDiscounts) : 0
          bValue = bDiscounts.length > 0 ? Math.max(...bDiscounts) : 0
          break
        }
        default:
          aValue = a.kcal
          bValue = b.kcal
      }
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })
  }, [comparisonData, sortBy, sortOrder, priceType])

  const exportToCSV = useCallback(() => {
    const headers = ['Kalorie', ...selectedBrandPackages.map(bp => `${bp} (Katalogowa)`), ...selectedBrandPackages.map(bp => `${bp} (Promocyjna)`), ...selectedBrandPackages.map(bp => `${bp} (Rabat %)`)]
    const csvContent = [
      headers.join(','),
      ...sortedData.map(row => [
        row.kcalLabel,
        ...selectedBrandPackages.map(bp => row.brandPackagePrices[bp]?.catalogPrice?.toFixed(2) || ''),
        ...selectedBrandPackages.map(bp => row.brandPackagePrices[bp]?.promoPrice?.toFixed(2) || ''),
        ...selectedBrandPackages.map(bp => row.brandPackagePrices[bp]?.discountPercentage?.toFixed(1) || ''),
      ].join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `porownanie_cen_${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }, [selectedBrandPackages, sortedData])

  const isLoading = brandsLoading || (activeTab === 'compare' && (priceLoading || discountLoading))

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="compare">Porównanie</TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />Konfiguracja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-6 mt-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Ładowanie danych...</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" /><span>Filtry Porównania</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr_auto] gap-4 items-start">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Okres analizy</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className={cn('h-10 text-xs', activeDateFilter === 'today' && 'bg-blue-100 dark:bg-blue-950 border-blue-300')}
                      onClick={() => { const today = new Date(); setDateFrom(today); setDateTo(today); setActiveDateFilter('today') }}>
                      Dziś
                    </Button>
                    <Button variant="outline" size="sm" className={cn('h-10 text-xs', activeDateFilter === 'yesterday' && 'bg-blue-100 dark:bg-blue-950 border-blue-300')}
                      onClick={() => { const y = subDays(new Date(), 1); setDateFrom(y); setDateTo(y); setActiveDateFilter('yesterday') }}>
                      Wczoraj
                    </Button>
                    <Popover>
                      <PopoverTrigger>
                        <Button variant="outline" className={cn('h-10 justify-start text-left font-normal text-xs', !dateFrom && 'text-muted-foreground', activeDateFilter === 'custom' && 'bg-blue-100 dark:bg-blue-950 border-blue-300')}>
                          <CalendarIcon className="mr-1 h-3 w-3" />{dateFrom ? format(dateFrom, 'dd/MM') : 'Od'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={(date) => { if (date) { setDateFrom(date); setActiveDateFilter('custom') } }} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger>
                        <Button variant="outline" className={cn('h-10 justify-start text-left font-normal text-xs', !dateTo && 'text-muted-foreground', activeDateFilter === 'custom' && 'bg-blue-100 dark:bg-blue-950 border-blue-300')}>
                          <CalendarIcon className="mr-1 h-3 w-3" />{dateTo ? format(dateTo, 'dd/MM') : 'Do'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={(date) => { if (date) { setDateTo(date); setActiveDateFilter('custom') } }} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Marki ({selectedBrands.length})</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {isLoading ? (
                      <div className="space-y-1">{[1,2,3].map(i => <Skeleton key={i} className="h-4 w-full" />)}</div>
                    ) : (
                      filteredBrandsWithData?.map((brand) => (
                        <div key={brand.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand.id}`}
                            checked={selectedBrands.includes(brand.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedBrands([...selectedBrands, brand.name])
                              } else {
                                setSelectedBrands(selectedBrands.filter(b => b !== brand.name))
                                setSelectedBrandPackages(selectedBrandPackages.filter(bp => !bp.startsWith(brand.name + ' - ')))
                              }
                            }}
                          />
                          <Label htmlFor={`brand-${brand.id}`} className="text-xs">{brand.name}</Label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pakiety ({selectedBrandPackages.length})</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {isLoading ? (
                      <div className="space-y-1">{[1,2,3].map(i => <Skeleton key={i} className="h-4 w-full" />)}</div>
                    ) : (
                      availableBrandPackages?.map((brandPackage) => (
                        <div key={brandPackage.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`bp-${brandPackage.key}`}
                            checked={selectedBrandPackages.includes(brandPackage.key)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedBrandPackages([...selectedBrandPackages, brandPackage.key])
                              else setSelectedBrandPackages(selectedBrandPackages.filter(bp => bp !== brandPackage.key))
                            }}
                          />
                          <Label htmlFor={`bp-${brandPackage.key}`} className="text-xs">{brandPackage.packageName}</Label>
                        </div>
                      ))
                    )}
                  </div>
                  {savedPairs && savedPairs.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span>Predefiniowane pakiety</span>
                        <span className="text-muted-foreground font-normal">(konfiguracja -</span>
                        <button onClick={() => setActiveTab('config')} className="text-primary hover:underline text-muted-foreground font-normal">przejdź do konfiguracji</button>
                        <span className="text-muted-foreground font-normal">)</span>
                      </div>
                      <Select onValueChange={(pairId) => {
                        const pair = savedPairs.find(p => p.id === pairId)
                        if (pair) {
                          const packageKeys = pair.package_ids
                            .map(pkgId => { const bp = allBrandPackages.find(bp => bp.packageId === pkgId); return bp?.key })
                            .filter((key): key is string => key !== undefined)
                          setSelectedBrandPackages(packageKeys)
                          const brandNames = new Set(packageKeys.map(key => key.split(' - ')[0]))
                          setSelectedBrands(Array.from(brandNames))
                          toast.success(`Zastosowano parę: ${pair.name}`)
                        }
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wybierz predefiniowaną parę" /></SelectTrigger>
                        <SelectContent>
                          {savedPairs.map(pair => <SelectItem key={pair.id} value={pair.id}>{pair.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sortowanie</Label>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kcal">Kalorie</SelectItem>
                      <SelectItem value="price">Cena</SelectItem>
                      <SelectItem value="discount">Rabat</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="w-full h-8 text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1" />{sortOrder === 'asc' ? 'Rosnąco' : 'Malejąco'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="space-y-2 max-w-xs">
                  <Label className="text-sm font-medium">Eksport</Label>
                  <Button variant="outline" size="sm" onClick={exportToCSV} disabled={sortedData.length === 0} className="w-full h-8 text-xs">
                    <Download className="h-3 w-3 mr-1" />CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Porównanie Cen - {sortedData.length} pakietów</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                    <Label htmlFor="compare-price-type" className="text-sm whitespace-nowrap">Katalogowa</Label>
                    <Switch id="compare-price-type" checked={priceType === 'promo'} onCheckedChange={(checked) => setPriceType(checked ? 'promo' : 'catalog')} />
                    <Label htmlFor="compare-price-type" className="text-sm whitespace-nowrap">Promocyjna</Label>
                  </div>
                  {priceType === 'promo' && (
                    <Tabs value={customerType} onValueChange={(value) => setCustomerType(value as 'existing' | 'new')}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Dla wszystkich</TabsTrigger>
                        <TabsTrigger value="new">Dla nowych</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {format(dateFrom, 'dd/MM/yyyy')} - {format(dateTo, 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
                </div>
              ) : sortedData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Brak danych do porównania. Sprawdź filtry i spróbuj ponownie.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Kaloryczność</TableHead>
                      {selectedBrandPackages.map((bp) => <TableHead key={bp} className="text-center min-w-[140px]">{bp}</TableHead>)}
                      {selectedBrandPackages.length > 1 && <TableHead className="text-center min-w-[100px]">Różnica %</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((row, index) => {
                      const firstKey = selectedBrandPackages[0]
                      const firstData = row.brandPackagePrices[firstKey]
                      const refPricePerKcal = firstData ? (priceType === 'catalog' ? firstData.catalogPrice : firstData.promoPrice) / row.kcal : null
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{row.kcalLabel}</TableCell>
                          {selectedBrandPackages.map((bp) => {
                            const data = row.brandPackagePrices[bp]
                            if (!data) return <TableCell key={bp} className="text-center"><div className="flex items-center justify-center text-muted-foreground"><Minus className="h-4 w-4" /></div></TableCell>
                            const selectedPrice = priceType === 'catalog' ? data.catalogPrice : data.promoPrice
                            const hasDiscount = priceType === 'promo' && data.hasDiscount && data.discountPercentage > 0
                            return (
                              <TableCell key={bp} className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className={hasDiscount ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium'}>
                                    {selectedPrice.toFixed(2)} {currencySymbol}
                                  </div>
                                  {hasDiscount && <Badge variant="destructive" className="text-xs">-{data.discountPercentage.toFixed(0)}%</Badge>}
                                </div>
                              </TableCell>
                            )
                          })}
                          {selectedBrandPackages.length > 1 && (
                            <TableCell className="text-center">
                              <div className="space-y-1">
                                {selectedBrandPackages.slice(1).map((bp) => {
                                  const data = row.brandPackagePrices[bp]
                                  if (!data || !refPricePerKcal) return <div key={bp} className="text-xs text-muted-foreground flex items-center justify-center"><Minus className="h-3 w-3" /></div>
                                  const currentPrice = priceType === 'catalog' ? data.catalogPrice : data.promoPrice
                                  const diff = ((currentPrice / row.kcal - refPricePerKcal) / refPricePerKcal) * 100
                                  const isPos = diff > 0
                                  return (
                                    <div key={bp} className={`text-xs font-medium ${isPos ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} flex items-center justify-center`}>
                                      {isPos ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                      {isPos ? '+' : ''}{diff.toFixed(1)}%
                                    </div>
                                  )
                                })}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="w-full">
              <BrandAverageChart showAllPackages={false} dateFrom={dateFrom} dateTo={dateTo} selectedBrands={selectedBrands} selectedPackages={selectedBrandPackages} showLogosOnXAxis={true} />
            </div>
            <div className="w-full">
              <DiscountTrendsChart filterBrands={selectedBrands} filterDateFrom={dateFrom} filterDateTo={dateTo} filterCustomerType={customerType} />
            </div>
          </div>

          {comparisonData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2"><TrendingUp className="h-5 w-5" /><span>Analiza Konkurencyjności</span></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {(() => {
                        if (comparisonData.length === 0) return 'N/A'
                        const allPrices = comparisonData.flatMap(row => Object.entries(row.brandPackagePrices).map(([, price]) => ({ price: price.catalogPrice })))
                        const minPrice = Math.min(...allPrices.map(p => p.price))
                        return `${minPrice.toFixed(2)} zł`
                      })()}
                    </div>
                    <div className="text-sm text-muted-foreground">Najniższa cena katalogowa</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(() => {
                        if (!discountTrendsData?.chartData || discountTrendsData.chartData.length === 0) return '0.0%'
                        const allDiscounts = discountTrendsData.chartData.flatMap(dp =>
                          Object.entries(dp).filter(([k]) => k !== 'date' && k !== 'day').map(([, v]) => Number(v) || 0).filter(d => d > 0)
                        )
                        if (allDiscounts.length === 0) return '0.0%'
                        return `${Math.max(...allDiscounts).toFixed(1)}%`
                      })()}
                    </div>
                    <div className="text-sm text-muted-foreground">Najwyższy rabat</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {(() => {
                        if (comparisonData.length === 0) return 'N/A'
                        const brandAvgs = new Map<string, number>()
                        const brandCounts = new Map<string, number>()
                        comparisonData.forEach(row => {
                          Object.entries(row.brandPackagePrices).forEach(([key, price]) => {
                            if (price.catalogPrice > 0) {
                              const brand = key.split(' - ')[0]
                              brandAvgs.set(brand, (brandAvgs.get(brand) || 0) + price.catalogPrice)
                              brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1)
                            }
                          })
                        })
                        const finals: number[] = []
                        brandAvgs.forEach((total, brand) => finals.push(total / (brandCounts.get(brand) || 1)))
                        if (finals.length < 2) return 'N/A'
                        const minA = Math.min(...finals), maxA = Math.max(...finals)
                        if (maxA === 0) return 'N/A'
                        return `${(((maxA - minA) / maxA) * 100).toFixed(1)}%`
                      })()}
                    </div>
                    <div className="text-sm text-muted-foreground">Niższa od najdroższej marki</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-6 mt-6">
          {brandsWithPackages && <PackagePairConfigurator brandsWithPackages={brandsWithPackages} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
