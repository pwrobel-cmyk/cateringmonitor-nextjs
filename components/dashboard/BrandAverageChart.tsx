'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Info } from "lucide-react";
import { format } from "date-fns";
import { cn, getCurrencySymbol } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBrandAverageComparison } from "@/hooks/supabase/useBrandAverageComparison";
import { useBrands } from "@/hooks/supabase/useBrands";
import { useCountry } from "@/contexts/CountryContext";
import { supabase } from "@/lib/supabase/client";

interface BrandAverageChartProps {
  showAllPackages?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  showLogosOnXAxis?: boolean;
  selectedBrands?: string[];
  selectedPackages?: string[];
}

export function BrandAverageChart({
  showAllPackages = false,
  dateFrom: propDateFrom,
  dateTo: propDateTo,
  showLogosOnXAxis = false,
  selectedBrands: propSelectedBrands,
  selectedPackages: propSelectedPackages,
}: BrandAverageChartProps) {
  const { selectedCountry } = useCountry();
  const currencySymbol = getCurrencySymbol(selectedCountry === "Czechy" ? "CZK" : "PLN");
  const [isPromotional, setIsPromotional] = useState(false);
  const [showYesterday, setShowYesterday] = useState(true);
  const [customerType, setCustomerType] = useState<"existing" | "new">("existing");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [sortByHighest, setSortByHighest] = useState(true);
  const [includeCashback, setIncludeCashback] = useState(false);

  // Fetch cashback discounts
  const { data: cashbackDiscounts } = useQuery({
    queryKey: ["cashback-discounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("discounts")
        .select("brand_id, percentage, brands!inner(name)")
        .eq("is_cashback", true)
        .eq("is_active", true);
      if (error) throw error;
      return data as Array<{ brand_id: string; percentage: number; brands: { name: string } }>;
    },
  });

  // Build cashback map: brandName -> max cashback percentage
  const cashbackMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!cashbackDiscounts) return map;
    cashbackDiscounts.forEach((cb: any) => {
      const name = cb.brands?.name;
      if (name && cb.percentage) {
        map.set(name, Math.max(map.get(name) || 0, cb.percentage));
      }
    });
    return map;
  }, [cashbackDiscounts]);

  // Calculate dates based on selected range
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const polandDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));

    const year = polandDate.getFullYear();
    const month = polandDate.getMonth();
    const day = polandDate.getDate();

    const today = new Date(year, month, day);

    if (showYesterday) {
      const yesterday = new Date(year, month, day - 1);
      return { dateFrom: yesterday, dateTo: yesterday };
    } else {
      return { dateFrom: today, dateTo: today };
    }
  }, [showYesterday]);

  const isUsingExternalFilters = propSelectedBrands !== undefined;
  const effectiveDateFrom = propDateFrom || dateFrom;
  const effectiveDateTo = propDateTo || dateTo;
  const effectiveSelectedBrands = propSelectedBrands || selectedBrands;

  // Reset initialization when country changes
  useEffect(() => {
    if (!isUsingExternalFilters) {
      setHasInitialized(false);
      setSelectedBrands([]);
    }
  }, [selectedCountry, isUsingExternalFilters]);

  const { data: comparisonResult, isLoading, error, refetch } = useBrandAverageComparison({
    dateFrom: effectiveDateFrom,
    dateTo: effectiveDateTo,
    selectedPackages: propSelectedPackages,
    customerType: customerType,
  });

  // Force refetch when date range, customer type, or country changes
  useEffect(() => {
    refetch();
  }, [showYesterday, customerType, selectedCountry, refetch, effectiveDateFrom, effectiveDateTo]);

  const { data: brandsData } = useBrands();

  const availableBrandsWithData = useMemo(() => {
    if (!comparisonResult?.data || !comparisonResult?.brands) return [];
    const brandsWithData = new Set(comparisonResult.data.map((item) => item.brandName));
    return comparisonResult.brands.filter((brandName) => brandsWithData.has(brandName));
  }, [comparisonResult?.data, comparisonResult?.brands]);

  useEffect(() => {
    if (!isUsingExternalFilters && availableBrandsWithData.length > 0 && selectedBrands.length === 0 && !hasInitialized) {
      setSelectedBrands(availableBrandsWithData);
      setHasInitialized(true);
    }
  }, [availableBrandsWithData, selectedBrands.length, isUsingExternalFilters, hasInitialized, selectedCountry]);

  const handleBrandToggle = (brandName: string, checked: boolean) => {
    if (checked) {
      setSelectedBrands((prev) => [...prev, brandName]);
    } else {
      setSelectedBrands((prev) => prev.filter((name) => name !== brandName));
    }
  };

  const getBrandLogoUrl = (brandName: string): string | null => {
    if (!brandsData) return null;
    const brand = brandsData.find((b) => b.name === brandName);
    return brand?.logo_url || null;
  };

  const filteredData = useMemo(() => {
    if (!comparisonResult?.data) return [];

    return comparisonResult.data
      .filter((brand) => effectiveSelectedBrands.includes(brand.brandName))
      .map((brand) => {
        const cashbackPct = includeCashback ? cashbackMap.get(brand.brandName) || 0 : 0;
        const catalogPriceWithCashback = brand.catalogPrice * (1 - cashbackPct / 100);
        const totalDiscountPct = Math.min(brand.discountPercentage + cashbackPct, 100);
        const promoPriceWithCashback = brand.catalogPrice * (1 - totalDiscountPct / 100);

        return {
          brandName: brand.brandName,
          packageName: brand.packageName,
          displayName: brand.packageName ? `${brand.brandName}\n${brand.packageName}` : brand.brandName,
          catalogPrice: includeCashback ? catalogPriceWithCashback : brand.catalogPrice,
          promoPrice: includeCashback ? promoPriceWithCashback : brand.promoPrice,
          discountPercentage: includeCashback ? totalDiscountPct : brand.discountPercentage,
          discountDifference:
            (includeCashback ? catalogPriceWithCashback : brand.catalogPrice) -
            (includeCashback ? promoPriceWithCashback : brand.promoPrice),
          packageCount: brand.packageCount,
          hasCashback: cashbackPct > 0,
          cashbackPct,
        };
      })
      .sort((a, b) => {
        if (sortByHighest) {
          const priceA = isPromotional ? a.promoPrice : a.catalogPrice;
          const priceB = isPromotional ? b.promoPrice : b.catalogPrice;
          return priceB - priceA;
        } else {
          return a.brandName.localeCompare(b.brandName);
        }
      });
  }, [comparisonResult?.data, effectiveSelectedBrands, sortByHighest, isPromotional, showYesterday, customerType, effectiveDateFrom, effectiveDateTo, includeCashback, cashbackMap]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Średnie Ceny per Marka</CardTitle>
          <CardDescription>Ładowanie danych...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Średnie Ceny per Marka</CardTitle>
          <CardDescription>Błąd podczas ładowania danych</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
          Nie można załadować danych
        </CardContent>
      </Card>
    );
  }

  return (
    <Card key={`${showYesterday}-${customerType}-${format(effectiveDateFrom, "yyyy-MM-dd")}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle>Średnie Ceny per Marka</CardTitle>
            <CardDescription>
              Średnie ceny pakietów przed i po rabacie dla wybranych marek w danym okresie
            </CardDescription>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Wykres pokazuje średnią cenę katalogową i promocyjną dla wybranych marek.
                  Cena promocyjna jest obliczana jako cena katalogowa pomniejszona o średni
                  rabat z ostatniego dnia wybranego okresu dla danego typu klienta.
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>

        {!isUsingExternalFilters && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Okres danych</label>
                <Button
                  variant={showYesterday ? "default" : "outline"}
                  onClick={() => setShowYesterday(!showYesterday)}
                  className="w-full"
                >
                  {showYesterday ? "Wczoraj" : "Dziś"}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Typ ceny</label>
                <div className="flex items-center space-x-2 h-10 px-3 border rounded-md">
                  <Label htmlFor="average-price-type" className="text-sm">Katalogowa</Label>
                  <Switch
                    id="average-price-type"
                    checked={isPromotional}
                    onCheckedChange={setIsPromotional}
                  />
                  <Label htmlFor="average-price-type" className="text-sm">Promocyjna</Label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Typ klienta</label>
                <Tabs
                  value={customerType}
                  onValueChange={(value) => setCustomerType(value as "existing" | "new")}
                  className={!isPromotional ? "opacity-50 pointer-events-none" : ""}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing" disabled={!isPromotional}>Dla wszystkich</TabsTrigger>
                    <TabsTrigger value="new" disabled={!isPromotional}>Dla nowych</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {availableBrandsWithData.length > 0 && (
              <div className="space-y-2 pt-4">
                <label className="text-sm font-medium">Wybierz marki do wyświetlenia:</label>
                <div className="flex flex-wrap gap-4">
                  {availableBrandsWithData.map((brandName) => (
                    <div key={brandName} className="flex items-center space-x-2">
                      <Checkbox
                        id={`average-brand-${brandName}`}
                        checked={selectedBrands.includes(brandName)}
                        onCheckedChange={(checked) => handleBrandToggle(brandName, !!checked)}
                      />
                      <label htmlFor={`average-brand-${brandName}`} className="text-sm font-medium cursor-pointer">
                        {brandName}
                      </label>
                    </div>
                  ))}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="average-select-all"
                      checked={selectedBrands.length === availableBrandsWithData.length && availableBrandsWithData.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedBrands(availableBrandsWithData);
                      }}
                    />
                    <label htmlFor="average-select-all" className="text-sm font-medium cursor-pointer">
                      Zaznacz wszystkie
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="average-deselect-all"
                      checked={selectedBrands.length === 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedBrands([]);
                      }}
                    />
                    <label htmlFor="average-deselect-all" className="text-sm font-medium cursor-pointer">
                      Odznacz wszystkie
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="average-sort-highest"
                      checked={sortByHighest}
                      onCheckedChange={(checked) => setSortByHighest(!!checked)}
                    />
                    <label htmlFor="average-sort-highest" className="text-sm font-medium cursor-pointer">
                      Sortuj od najwyższej
                    </label>
                  </div>

                  {cashbackMap.size > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="average-cashback"
                        checked={includeCashback}
                        onCheckedChange={(checked) => setIncludeCashback(!!checked)}
                      />
                      <label htmlFor="average-cashback" className="text-sm font-medium cursor-pointer">
                        Cashback
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {isUsingExternalFilters && (
          <div className="space-y-2 pt-4">
            <div className="text-sm text-muted-foreground">
              Okres: {effectiveDateFrom ? format(effectiveDateFrom, "dd.MM.yyyy") : "Brak"} -{" "}
              {effectiveDateTo ? format(effectiveDateTo, "dd.MM.yyyy") : "Brak"}. Marki:{" "}
              {effectiveSelectedBrands.length > 0 ? effectiveSelectedBrands.join(", ") : "Brak wybranych marek"}.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Typ ceny</label>
              <div className="flex items-center space-x-2 h-10 px-3 border rounded-md">
                <Label htmlFor="external-price-type" className="text-sm">Katalogowa</Label>
                <Switch
                  id="external-price-type"
                  checked={isPromotional}
                  onCheckedChange={setIsPromotional}
                />
                <Label htmlFor="external-price-type" className="text-sm">Promocyjna</Label>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            {effectiveSelectedBrands.length === 0 ? "Wybierz marki do wyświetlenia" : "Brak danych dla wybranych marek"}
          </div>
        ) : (
          <div className={cn("h-[400px]", showLogosOnXAxis && "h-[420px]")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 20, right: 30, left: 20, bottom: showLogosOnXAxis ? 5 : 60 }}
              >
                <XAxis
                  dataKey="displayName"
                  height={showLogosOnXAxis ? 85 : 80}
                  interval={0}
                  {...(showLogosOnXAxis
                    ? {
                        tick: ({ x, y, payload }: any) => {
                          const brandData = filteredData.find((d) => d.displayName === payload.value);
                          const logoUrl = brandData ? getBrandLogoUrl(brandData.brandName) : null;
                          const packageName = brandData?.packageName;

                          return (
                            <g transform={`translate(${x},${y})`}>
                              {logoUrl ? (
                                <>
                                  <image x={-20} y={0} width={40} height={40} href={logoUrl} />
                                  {packageName && (
                                    <text x={0} y={60} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
                                      {packageName}
                                    </text>
                                  )}
                                </>
                              ) : (
                                <>
                                  <text x={0} y={10} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight={600}>
                                    {brandData?.brandName || payload.value}
                                  </text>
                                  {packageName && (
                                    <text x={0} y={24} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
                                      {packageName}
                                    </text>
                                  )}
                                </>
                              )}
                            </g>
                          );
                        },
                      }
                    : {
                        tick: ({ x, y, payload }: any) => {
                          const lines = payload.value.split("\n");
                          return (
                            <g transform={`translate(${x},${y})`}>
                              {lines.map((line: string, index: number) => (
                                <text
                                  key={index}
                                  x={0}
                                  y={index * 14 + 10}
                                  textAnchor="middle"
                                  fontSize={10}
                                  fill="hsl(var(--muted-foreground))"
                                  fontWeight={index === 0 ? 600 : 400}
                                >
                                  {line}
                                </text>
                              ))}
                            </g>
                          );
                        },
                      })}
                />
                <YAxis
                  fontSize={12}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `${value.toFixed(0)} ${currencySymbol}`}
                />

                {isPromotional ? (
                  <>
                    <Bar dataKey="promoPrice" fill="#16a34a" name="Cena promocyjna" stackId="promo" />
                    <Bar dataKey="discountDifference" fill="#eab308" name="Rabat" stackId="promo" radius={[4, 4, 0, 0]} />
                  </>
                ) : (
                  <Bar dataKey="catalogPrice" fill="#3b82f6" name="Cena katalogowa" radius={[4, 4, 4, 4]} />
                )}

                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  formatter={(value: any, name: any) => [`${(value as number).toFixed(2)} ${currencySymbol}`, String(name)]}
                  labelFormatter={(label) => {
                    const brandData = filteredData.find((d) => d.displayName === label);
                    if (!brandData) return label;

                    const displayLabel = brandData.packageName
                      ? `${brandData.brandName} - ${brandData.packageName}`
                      : brandData.brandName;

                    if (isPromotional && brandData) {
                      return `${displayLabel}\nCena katalogowa: ${brandData.catalogPrice.toFixed(2)} ${currencySymbol}\nMaksymalny rabat: ${brandData.discountPercentage.toFixed(1)}%\nCena promocyjna: ${brandData.promoPrice.toFixed(2)} ${currencySymbol}`;
                    }
                    return `Marka: ${displayLabel}`;
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    whiteSpace: "pre-line",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
