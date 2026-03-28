'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useBrandParametersTrends } from "@/hooks/supabase/useBrandParametersTrends";
import { Loader2 } from "lucide-react";

interface BrandParametersTrendsChartProps {
  brands: Array<{ id: string; name: string }>;
}

const PARAMETERS = ["smak", "jakość", "cena", "obsługa", "dostawa", "porcje"] as const;

const PARAM_COLORS: Record<string, string> = {
  smak: "hsl(var(--chart-1))",
  jakość: "hsl(var(--chart-2))",
  cena: "hsl(var(--chart-3))",
  obsługa: "hsl(var(--chart-4))",
  dostawa: "hsl(var(--chart-5))",
  porcje: "#a78bfa",
};

export function BrandParametersTrendsChart({ brands }: BrandParametersTrendsChartProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || "");
  const [periodType, setPeriodType] = useState<'week' | 'month'>('month');
  const [timeRange, setTimeRange] = useState<'6months' | '1year' | 'all'>('1year');

  const { data, isLoading } = useBrandParametersTrends(selectedBrandId, periodType, timeRange);

  const chartData = (data || []).map(row => ({
    period: row.period,
    smak: row.smak,
    jakość: row.jakość,
    cena: row.cena,
    obsługa: row.obsługa,
    dostawa: row.dostawa,
    porcje: row.porcje,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trendy parametrów marki</CardTitle>
        <CardDescription>Zmiany ocen parametrów w czasie dla wybranej marki</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-6">
          <Select
            value={selectedBrandId}
            onValueChange={(v) => v && setSelectedBrandId(v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Wybierz markę" />
            </SelectTrigger>
            <SelectContent>
              {brands.map(brand => (
                <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={periodType}
            onValueChange={(v) => v && setPeriodType(v as 'week' | 'month')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Tygodniowo</SelectItem>
              <SelectItem value="month">Miesięcznie</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v as '6months' | '1year' | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">Ostatnie 6 miesięcy</SelectItem>
              <SelectItem value="1year">Ostatni rok</SelectItem>
              <SelectItem value="all">Wszystko</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !chartData.length ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Brak danych dla wybranej marki
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="period"
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis
                domain={[0, 5]}
                className="text-xs"
                tickCount={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              {PARAMETERS.map(param => (
                <Line
                  key={param}
                  type="monotone"
                  dataKey={param}
                  stroke={PARAM_COLORS[param]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
