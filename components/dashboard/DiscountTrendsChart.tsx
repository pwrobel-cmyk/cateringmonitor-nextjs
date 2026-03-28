'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Dot } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useDiscountsFiltered } from "@/hooks/supabase/useDiscountsFiltered";
import { useDiscountSeries } from "@/hooks/useDiscountSeries";
import { useCountry } from "@/contexts/CountryContext";

interface DiscountTrendsChartProps {
  filterBrands?: string[];
  filterDateFrom?: Date;
  filterDateTo?: Date;
  filterCustomerType?: "existing" | "new";
}

const CHART_COLORS = ["#3b82f6", "#16a34a", "#eab308", "#9333ea", "#ec4899"];

const brandColors: Record<string, string> = {
  MaczFit: CHART_COLORS[0],
  "Nice To Fit You": CHART_COLORS[1],
  "Healthy Brothers": CHART_COLORS[2],
  AfterFit: CHART_COLORS[3],
  "Maczfit Strong": CHART_COLORS[4],
};

function getBrandColor(brandName: string, index: number): string {
  if (brandColors[brandName]) return brandColors[brandName];
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function DiscountTrendsChart({
  filterBrands,
  filterDateFrom,
  filterDateTo,
  filterCustomerType,
}: DiscountTrendsChartProps) {
  const { selectedCountry } = useCountry();
  const [aggregation, setAggregation] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [customerType, setCustomerType] = useState<"existing" | "new">("existing");

  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }, []);

  const today = useMemo(() => new Date(), []);

  const dateFrom = filterDateFrom || thirtyDaysAgo;
  const dateTo = filterDateTo || today;

  const { data, isLoading } = useDiscountsFiltered({
    dateFrom,
    dateTo,
    brandNames: filterBrands,
    customerType: filterCustomerType || customerType,
  });

  const discounts = data?.discounts || [];
  const availableBrands = (data?.brands as string[]) || [];

  // Reset initialization when country changes
  useEffect(() => {
    if (!filterBrands) {
      setHasInitialized(false);
      setSelectedBrands([]);
    }
  }, [selectedCountry, filterBrands]);

  // Initialize selected brands
  useEffect(() => {
    if (filterBrands && filterBrands.length > 0) {
      setSelectedBrands(filterBrands);
      setHasInitialized(true);
    } else if (availableBrands.length > 0 && selectedBrands.length === 0 && !hasInitialized) {
      setSelectedBrands(availableBrands as string[]);
      setHasInitialized(true);
    }
  }, [filterBrands, availableBrands, selectedBrands.length, hasInitialized, selectedCountry]);

  // Build chart data — adapt discounts to the format useDiscountSeries expects
  const discountsForSeries = useMemo(
    () =>
      discounts.map((d: any) => ({
        percentage: d.percentage,
        valid_from: d.valid_from,
        valid_until: d.valid_until,
        brands: { name: (d.brands as any)?.name || "" },
      })),
    [discounts]
  );

  const { chartData } = useDiscountSeries({
    discounts: discountsForSeries,
    dateFrom,
    dateTo,
    aggregation,
  });

  const filteredChartData = useMemo(() => {
    return chartData.map((point) => {
      const filtered: any = { day: point.day };
      selectedBrands.forEach((brand) => {
        filtered[brand] = point[brand] || 0;
      });
      return filtered;
    });
  }, [chartData, selectedBrands]);

  const maxValue = useMemo(() => {
    let max = 0;
    filteredChartData.forEach((point) => {
      selectedBrands.forEach((brand) => {
        if (point[brand] > max) max = point[brand];
      });
    });
    return Math.ceil(max * 1.1);
  }, [filteredChartData, selectedBrands]);

  const handleBrandToggle = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((b) => b !== brandName) : [...prev, brandName]
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      return (
        <div className="bg-background border rounded-lg p-2 shadow-lg">
          <p className="font-medium mb-1 text-xs">{label}</p>
          {sortedPayload.map((entry: any) => (
            <p key={entry.name} style={{ color: entry.color }} className="text-xs">
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, value } = props;
    if (value === 0) return null;
    return <Dot cx={cx} cy={cy} r={3} fill={props.stroke} />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trendy Rabatów</CardTitle>
          <CardDescription>Ładowanie...</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Ładowanie danych...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle>Trendy Rabatów</CardTitle>
            <CardDescription>Procentowe rabaty dla wybranych marek w czasie</CardDescription>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Wykres przedstawia procentowe rabaty aktywne w danym okresie.
                  Rabaty są liczone jako średnia z wszystkich aktywnych promocji
                  dla danej marki w wybranym przedziale czasowym.
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>

        <div className="flex flex-col gap-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Agregacja</Label>
              <Select value={aggregation} onValueChange={(v: any) => setAggregation(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {{ daily: "Dziennie", weekly: "Tygodniowo", monthly: "Miesięcznie" }[aggregation]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Dziennie</SelectItem>
                  <SelectItem value="weekly">Tygodniowo</SelectItem>
                  <SelectItem value="monthly">Miesięcznie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!filterCustomerType && (
              <div className="space-y-2">
                <Label>Typ klienta</Label>
                <Tabs value={customerType} onValueChange={(value) => setCustomerType(value as "existing" | "new")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Dla wszystkich</TabsTrigger>
                    <TabsTrigger value="new">Dla nowych</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
          </div>

          {!filterBrands && availableBrands.length > 0 && (
            <div className="space-y-2">
              <Label>Wybierz marki:</Label>
              <div className="flex flex-wrap gap-4">
                {availableBrands.map((brandName: string, index: number) => (
                  <div key={brandName} className="flex items-center gap-2">
                    <Checkbox
                      id={`discount-brand-${brandName}`}
                      checked={selectedBrands.includes(brandName)}
                      onCheckedChange={() => handleBrandToggle(brandName)}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getBrandColor(brandName, index) }}
                    />
                    <Label htmlFor={`discount-brand-${brandName}`} className="cursor-pointer">
                      {brandName}
                    </Label>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="discount-select-all"
                    checked={selectedBrands.length === availableBrands.length && availableBrands.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedBrands(availableBrands as string[]);
                    }}
                  />
                  <Label htmlFor="discount-select-all" className="cursor-pointer">
                    Zaznacz wszystkie
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="discount-deselect-all"
                    checked={selectedBrands.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedBrands([]);
                    }}
                  />
                  <Label htmlFor="discount-deselect-all" className="cursor-pointer">
                    Odznacz wszystkie
                  </Label>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredChartData.length === 0 || selectedBrands.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            {selectedBrands.length === 0 ? "Wybierz marki do wyświetlenia" : "Brak danych"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredChartData}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, maxValue]} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              {selectedBrands.map((brandName, index) => (
                <Line
                  key={brandName}
                  type="monotone"
                  dataKey={brandName}
                  stroke={getBrandColor(brandName, index)}
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
