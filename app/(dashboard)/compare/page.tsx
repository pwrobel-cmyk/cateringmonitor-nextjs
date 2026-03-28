'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Filter, Calendar as CalendarIcon, ArrowUpDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn, getCurrencySymbol } from "@/lib/utils";
import { BrandAverageChart } from "@/components/dashboard/BrandAverageChart";
import { DiscountTrendsChart } from "@/components/dashboard/DiscountTrendsChart";
import { usePackagePriceComparison } from "@/hooks/supabase/usePriceHistory";
import { useBrandsWithPackages } from "@/hooks/supabase/useBrandsWithPackages";
import { useCountry } from "@/contexts/CountryContext";
import { toast } from "sonner";

export default function Compare() {
  const { selectedCountry } = useCountry();
  const currencySymbol = getCurrencySymbol(selectedCountry === "Czechy" ? "CZK" : "PLN");

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedBrandPackages, setSelectedBrandPackages] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState<"kcal" | "price" | "discount">("kcal");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [priceType, setPriceType] = useState<"catalog" | "promo">("promo");
  const [customerType, setCustomerType] = useState<"existing" | "new">("existing");
  const [activeDateFilter, setActiveDateFilter] = useState<"today" | "yesterday" | "custom">("today");

  const { data: brandsWithPackages, isLoading: brandsLoading } = useBrandsWithPackages();

  const allBrandPackages = brandsWithPackages?.flatMap(brand =>
    brand.packages.map(pkg => ({
      key: `${brand.name} - ${pkg.name}`,
      brandName: brand.name,
      packageName: pkg.name,
      packageId: pkg.id,
      category: pkg.category || 'Inne'
    }))
  ) || [];

  const selectedPackageIds = selectedBrandPackages
    .map(key => allBrandPackages.find(bp => bp.key === key)?.packageId)
    .filter((id): id is string => id !== undefined);

  const { data: kcalComparisonData, isLoading: priceLoading } = usePackagePriceComparison({
    dateFrom,
    dateTo,
    packageIds: selectedPackageIds.length > 0 ? selectedPackageIds : undefined,
    customerType
  });

  const availableBrandPackages = useMemo(() => {
    return (brandsWithPackages || []).flatMap(brand =>
      (selectedBrands.length === 0 || selectedBrands.includes(brand.name))
        ? brand.packages.map(pkg => ({
            key: `${brand.name} - ${pkg.name}`,
            brandName: brand.name,
            packageName: pkg.name,
            packageId: pkg.id,
            category: pkg.category || 'Inne'
          }))
        : []
    );
  }, [brandsWithPackages, selectedBrands]);

  useEffect(() => {
    if (brandsWithPackages && brandsWithPackages.length > 0 && selectedBrands.length === 0) {
      const defaultBrands = brandsWithPackages
        .filter(b => b.name === "Nice To Fit You" || b.name === "MaczFit")
        .map(b => b.name);
      setSelectedBrands(defaultBrands.length > 0 ? defaultBrands : brandsWithPackages.slice(0, 2).map(b => b.name));
    }
  }, [brandsWithPackages, selectedBrands.length]);

  useEffect(() => {
    if (availableBrandPackages.length > 0 && selectedBrandPackages.length === 0) {
      const defaultPackages = availableBrandPackages
        .filter(bp =>
          (bp.brandName === "MaczFit" && bp.packageName.toLowerCase().includes("everyday")) ||
          (bp.brandName === "Nice To Fit You" && bp.packageName.toLowerCase().includes("basic 25"))
        )
        .map(bp => bp.key);
      setSelectedBrandPackages(defaultPackages.length > 0 ? defaultPackages : availableBrandPackages.slice(0, 2).map(bp => bp.key));
    }
  }, [availableBrandPackages]);

  const comparisonData = useMemo(() => {
    if (!kcalComparisonData) return [];
    return kcalComparisonData.map(item => {
      const filteredBrandPackagePrices: typeof item.brandPackagePrices = {};
      selectedBrandPackages.forEach(key => {
        const bp = item.brandPackagePrices[key];
        if (bp) filteredBrandPackagePrices[key] = bp;
      });
      return { ...item, brandPackagePrices: filteredBrandPackagePrices };
    });
  }, [kcalComparisonData, selectedBrandPackages]);

  const sortedData = useMemo(() => {
    return [...comparisonData].sort((a, b) => {
      let aValue: number, bValue: number;
      switch (sortBy) {
        case "price": {
          const ap = Object.values(a.brandPackagePrices).map(p => priceType === "catalog" ? p.catalogPrice : p.promoPrice);
          const bp2 = Object.values(b.brandPackagePrices).map(p => priceType === "catalog" ? p.catalogPrice : p.promoPrice);
          aValue = ap.length > 0 ? Math.min(...ap) : 0;
          bValue = bp2.length > 0 ? Math.min(...bp2) : 0;
          break;
        }
        case "discount": {
          const ad = Object.values(a.brandPackagePrices).map(p => p.discountPercentage);
          const bd = Object.values(b.brandPackagePrices).map(p => p.discountPercentage);
          aValue = ad.length > 0 ? Math.max(...ad) : 0;
          bValue = bd.length > 0 ? Math.max(...bd) : 0;
          break;
        }
        default:
          aValue = a.kcal;
          bValue = b.kcal;
      }
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [comparisonData, sortBy, sortOrder, priceType]);

  const exportToCSV = useCallback(() => {
    const headers = ["Kalorie", ...selectedBrandPackages.map(bp => `${bp} (Katalogowa)`), ...selectedBrandPackages.map(bp => `${bp} (Promocyjna)`), ...selectedBrandPackages.map(bp => `${bp} (Rabat %)`)];
    const csvContent = [
      headers.join(","),
      ...sortedData.map(row => [
        row.kcalLabel,
        ...selectedBrandPackages.map(bp => row.brandPackagePrices[bp]?.catalogPrice?.toFixed(2) || ""),
        ...selectedBrandPackages.map(bp => row.brandPackagePrices[bp]?.promoPrice?.toFixed(2) || ""),
        ...selectedBrandPackages.map(bp => row.brandPackagePrices[bp]?.discountPercentage?.toFixed(1) || "")
      ].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `porownanie_cen_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [selectedBrandPackages, sortedData]);

  const isLoading = brandsLoading || priceLoading;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="compare" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="compare">Porównanie</TabsTrigger>
          <TabsTrigger value="charts">Wykresy</TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-6 mt-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Filtry Porównania</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Okres analizy</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant={activeDateFilter === "today" ? "default" : "outline"} size="sm" onClick={() => { const t = new Date(); setDateFrom(t); setDateTo(t); setActiveDateFilter("today"); }}>Dziś</Button>
                    <Button variant={activeDateFilter === "yesterday" ? "default" : "outline"} size="sm" onClick={() => { const y = subDays(new Date(), 1); setDateFrom(y); setDateTo(y); setActiveDateFilter("yesterday"); }}>Wczoraj</Button>
                    <Popover>
                      <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), activeDateFilter === "custom" && "border-primary")}>
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {format(dateFrom, "dd/MM")} - {format(dateTo, "dd/MM")}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dateFrom} onSelect={d => { if (d) { setDateFrom(d); setActiveDateFilter("custom"); } }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Brands */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Marki ({selectedBrands.length})</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {brandsWithPackages?.map(brand => (
                      <div key={brand.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`brand-${brand.id}`}
                          checked={selectedBrands.includes(brand.name)}
                          onCheckedChange={checked => {
                            if (checked) setSelectedBrands(prev => [...prev, brand.name]);
                            else setSelectedBrands(prev => prev.filter(b => b !== brand.name));
                          }}
                        />
                        <Label htmlFor={`brand-${brand.id}`} className="text-xs cursor-pointer">{brand.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Packages */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pakiety ({selectedBrandPackages.length})</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {availableBrandPackages.map(bp => (
                      <div key={bp.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`bp-${bp.key}`}
                          checked={selectedBrandPackages.includes(bp.key)}
                          onCheckedChange={checked => {
                            if (checked) setSelectedBrandPackages(prev => [...prev, bp.key]);
                            else setSelectedBrandPackages(prev => prev.filter(k => k !== bp.key));
                          }}
                        />
                        <Label htmlFor={`bp-${bp.key}`} className="text-xs cursor-pointer">{bp.packageName}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sortowanie</Label>
                  <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kcal">Kalorie</SelectItem>
                      <SelectItem value="price">Cena</SelectItem>
                      <SelectItem value="discount">Rabat</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")} className="w-full h-8 text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    {sortOrder === "asc" ? "Rosnąco" : "Malejąco"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToCSV} disabled={sortedData.length === 0} className="w-full h-8 text-xs">
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>Porównanie Cen — {sortedData.length} pakietów</CardTitle>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                    <Label className="text-sm whitespace-nowrap">Katalogowa</Label>
                    <Switch checked={priceType === "promo"} onCheckedChange={c => setPriceType(c ? "promo" : "catalog")} />
                    <Label className="text-sm whitespace-nowrap">Promocyjna</Label>
                  </div>
                  {priceType === "promo" && (
                    <Tabs value={customerType} onValueChange={v => setCustomerType(v as any)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Dla wszystkich</TabsTrigger>
                        <TabsTrigger value="new">Dla nowych</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : sortedData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Brak danych do porównania. Sprawdź filtry i spróbuj ponownie.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Kaloryczność</TableHead>
                        {selectedBrandPackages.map(bp => (
                          <TableHead key={bp} className="text-center min-w-[140px]">{bp}</TableHead>
                        ))}
                        {selectedBrandPackages.length > 1 && <TableHead className="text-center min-w-[100px]">Różnica %</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((row, index) => {
                        const prices = selectedBrandPackages
                          .map(bp => row.brandPackagePrices[bp])
                          .filter(Boolean)
                          .map(d => priceType === "catalog" ? d.catalogPrice : d.promoPrice);
                        const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                        const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                        const priceDiffPct = minPrice && maxPrice && minPrice > 0
                          ? ((maxPrice - minPrice) / minPrice * 100)
                          : null;

                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{row.kcalLabel}</TableCell>
                            {selectedBrandPackages.map(bp => {
                              const data = row.brandPackagePrices[bp];
                              if (!data) return <TableCell key={bp} className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>;

                              const selectedPrice = priceType === "catalog" ? data.catalogPrice : data.promoPrice;
                              const hasDiscount = priceType === "promo" && data.hasDiscount && data.discountPercentage > 0;
                              const isCheapest = selectedPrice === minPrice;

                              return (
                                <TableCell key={bp} className="text-center">
                                  <div className={cn("font-medium", hasDiscount ? "text-green-600" : "", isCheapest && prices.length > 1 ? "font-bold" : "")}>
                                    {selectedPrice.toFixed(2)} {currencySymbol}
                                  </div>
                                  {hasDiscount && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="line-through">{data.catalogPrice.toFixed(2)} {currencySymbol}</span>
                                      {" "}
                                      <Badge variant="secondary" className="text-green-600 text-xs px-1 py-0">-{data.discountPercentage.toFixed(0)}%</Badge>
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                            {selectedBrandPackages.length > 1 && (
                              <TableCell className="text-center">
                                {priceDiffPct !== null ? (
                                  <span className={priceDiffPct > 10 ? "text-destructive font-medium" : "text-muted-foreground"}>
                                    {priceDiffPct.toFixed(1)}%
                                  </span>
                                ) : <Minus className="h-4 w-4 mx-auto text-muted-foreground" />}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6 mt-6">
          <BrandAverageChart />
          <DiscountTrendsChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
