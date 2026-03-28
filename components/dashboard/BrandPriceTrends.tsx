'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, Loader2, Info } from "lucide-react";
import { format } from "date-fns";
import { cn, getCurrencySymbol } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useBrandPriceTrends } from "@/hooks/supabase/useBrandPriceTrends";
import { useCountry } from "@/contexts/CountryContext";

export function BrandPriceTrends() {
  const { selectedCountry } = useCountry();
  const currencySymbol = getCurrencySymbol(selectedCountry === "Czechy" ? "CZK" : "PLN");
  const [isPromotional, setIsPromotional] = useState(false);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(twoWeeksAgo);
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    setHasInitialized(false);
    setSelectedBrands([]);
  }, [selectedCountry]);

  const { data: trendsData, isLoading, error } = useBrandPriceTrends({ dateFrom, dateTo });

  const brandConfig = useMemo(() => {
    if (!trendsData?.brands || !trendsData?.chartData) return [];

    const brandsWithData = new Set<string>();
    trendsData.chartData.forEach((dataPoint: any) => {
      trendsData.brands.forEach((brand: string) => {
        if (dataPoint[brand] && dataPoint[brand] > 0) {
          brandsWithData.add(brand);
        }
      });
    });

    const filteredBrands = trendsData.brands.filter((brand: string) => brandsWithData.has(brand));

    const chartColors = [
      "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
      "hsl(var(--chart-4))", "hsl(var(--chart-5))",
    ];

    const strokeDashArrays = ["0", "5 5", "10 2", "15 5 5 5", "20 5", "3 3"];

    return filteredBrands.map((brand: string, index: number) => ({
      key: brand,
      name: brand,
      color: chartColors[index % chartColors.length],
      strokeDashArray: strokeDashArrays[index % strokeDashArrays.length]
    }));
  }, [trendsData?.brands, trendsData?.chartData]);

  useEffect(() => {
    if (brandConfig.length > 0 && selectedBrands.length === 0 && !hasInitialized) {
      setSelectedBrands(brandConfig.map(brand => brand.key));
      setHasInitialized(true);
    }
  }, [brandConfig, selectedBrands.length, hasInitialized, selectedCountry]);

  const handleBrandToggle = (brandKey: string, checked: boolean) => {
    if (checked) {
      setSelectedBrands(prev => [...prev, brandKey]);
    } else {
      setSelectedBrands(prev => prev.filter(key => key !== brandKey));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trendy Cen Marek</CardTitle>
          <CardDescription>Ładowanie trendów cenowych...</CardDescription>
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
          <CardTitle>Trendy Cen Marek</CardTitle>
          <CardDescription>Błąd podczas ładowania danych</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
          Nie można załadować trendów cenowych
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle>Trendy Cen Marek</CardTitle>
            <CardDescription>
              Średnie ceny wszystkich pakietów marki w czasie
            </CardDescription>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Wykres pokazuje średnie ceny katalogowe i promocyjne marek w czasie.
                  Ceny promocyjne uwzględniają wszystkie aktywne rabaty w danym okresie,
                  bez rozróżnienia na typ klienta (zawierają zarówno rabaty dla nowych jak
                  i dla wszystkich klientów).
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>

        {/* Filters row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Date From */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data od</label>
            <Popover>
              <PopoverTrigger
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full justify-start text-left font-normal",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd.MM.yyyy") : <span>Wybierz datę</span>}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data do</label>
            <Popover>
              <PopoverTrigger
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full justify-start text-left font-normal",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd.MM.yyyy") : <span>Wybierz datę</span>}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Price Type Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Typ ceny</label>
            <div className="flex items-center space-x-2 h-10 px-3 border rounded-md">
              <Label htmlFor="trends-price-type" className="text-sm">Katalogowa</Label>
              <Switch
                id="trends-price-type"
                checked={isPromotional}
                onCheckedChange={setIsPromotional}
              />
              <Label htmlFor="trends-price-type" className="text-sm">Promocyjna</Label>
            </div>
          </div>
        </div>

        {/* Brand selection checkboxes */}
        <div className="space-y-2 pt-4">
          <label className="text-sm font-medium">Wybierz marki do wyświetlenia:</label>
          <div className="flex flex-wrap gap-4">
            {brandConfig.map((brand) => (
              <div key={brand.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`trends-brand-${brand.key}`}
                  checked={selectedBrands.includes(brand.key)}
                  onCheckedChange={(checked) => handleBrandToggle(brand.key, !!checked)}
                />
                <label
                  htmlFor={`trends-brand-${brand.key}`}
                  className="text-sm font-medium cursor-pointer flex items-center space-x-2"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  <span>{brand.name}</span>
                </label>
              </div>
            ))}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trends-select-all"
                checked={selectedBrands.length === brandConfig.length && brandConfig.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedBrands(brandConfig.map(b => b.key));
                }}
              />
              <label htmlFor="trends-select-all" className="text-sm font-medium cursor-pointer">
                Zaznacz wszystkie
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trends-deselect-all"
                checked={selectedBrands.length === 0}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedBrands([]);
                }}
              />
              <label htmlFor="trends-deselect-all" className="text-sm font-medium cursor-pointer">
                Odznacz wszystkie
              </label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendsData?.chartData || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dateFormatted"
                className="text-xs fill-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={60}
                interval="preserveStartEnd"
              />
              <YAxis
                className="text-xs fill-muted-foreground"
                tickFormatter={(value) => `${value} ${currencySymbol}`}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                formatter={(value: any, name: any) => {
                  const nameStr = String(name || '');
                  const displayName = nameStr.endsWith('_promo') ? `${nameStr.replace('_promo', '')} (promo)` : nameStr;
                  return [`${value?.toFixed(2)} ${currencySymbol}`, displayName];
                }}
                labelFormatter={(date) => `Data: ${date}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              {selectedBrands.map((brandKey) => {
                const brand = brandConfig.find(b => b.key === brandKey);
                if (!brand) return null;

                const dataKey = isPromotional ? `${brandKey}_promo` : brandKey;

                return (
                  <Line
                    key={dataKey}
                    type="monotone"
                    dataKey={dataKey}
                    stroke={brand.color}
                    strokeWidth={2}
                    strokeDasharray={brand.strokeDashArray}
                    name={isPromotional ? `${brandKey} (promo)` : brandKey}
                    dot={false}
                    activeDot={{ r: 4, stroke: brand.color, strokeWidth: 2, fill: 'hsl(var(--card))' }}
                    connectNulls={true}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
