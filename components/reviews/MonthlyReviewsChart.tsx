'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMonthlyReviewsChart, useBrandsForFilter } from "@/hooks/supabase/useMonthlyReviewsChart";
import { Loader2 } from "lucide-react";

export function MonthlyReviewsChart() {
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");

  const { data: brands } = useBrandsForFilter();
  const brandIds = selectedBrandId === "all" ? undefined : [selectedBrandId];
  const { data: chartData, isLoading } = useMonthlyReviewsChart(brandIds);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liczba opinii w czasie</CardTitle>
        <CardDescription>Rozkład pozytywnych i negatywnych opinii miesiącami</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <Select value={selectedBrandId} onValueChange={(v) => v && setSelectedBrandId(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Wszystkie marki" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie marki</SelectItem>
              {(brands || []).map(brand => (
                <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !chartData?.length ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Brak danych do wyświetlenia
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Bar dataKey="positive" name="Pozytywne (4-5★)" stackId="a" fill="#10b981" />
              <Bar dataKey="negative" name="Negatywne (1-3★)" stackId="a" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
