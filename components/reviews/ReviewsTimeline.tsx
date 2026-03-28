'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useReviewsTimeline } from "@/hooks/supabase/useReviewsTimeline";
import { Loader2 } from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#a78bfa",
  "#fb923c",
  "#34d399",
];

type ViewMode = "table" | "chart";

export function ReviewsTimeline() {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const { data, isLoading } = useReviewsTimeline();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.brands.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Oś czasu opinii</CardTitle>
          <CardDescription>Brak danych do wyświetlenia</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { brands, dates, timelineMap } = data;
  const shownDates = dates.slice(0, 60);

  const chartData = shownDates.slice().reverse().map(date => {
    const row: Record<string, any> = { date };
    brands.forEach(brand => {
      row[brand] = timelineMap.get(brand)?.get(date) || 0;
    });
    return row;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Oś czasu opinii</CardTitle>
            <CardDescription>Dzienna aktywność opinii per marka</CardDescription>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              Tabela
            </button>
            <button
              onClick={() => setViewMode("chart")}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                viewMode === "chart"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              Wykres
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "table" ? (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[120px] sticky left-0 bg-background">Data</TableHead>
                  {brands.map(brand => (
                    <TableHead key={brand} className="text-center min-w-[120px]">
                      {brand}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownDates.map(date => (
                  <TableRow key={date}>
                    <TableCell className="font-medium sticky left-0 bg-background">
                      {date}
                    </TableCell>
                    {brands.map(brand => {
                      const count = timelineMap.get(brand)?.get(date) || 0;
                      return (
                        <TableCell key={brand} className="text-center">
                          {count > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={450}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
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
              {brands.map((brand, i) => (
                <Line
                  key={brand}
                  type="monotone"
                  dataKey={brand}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
