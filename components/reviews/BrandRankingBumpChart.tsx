'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useBrandRankingHistory } from "@/hooks/supabase/useBrandRankingHistory";
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

export function BrandRankingBumpChart() {
  const { data, isLoading } = useBrandRankingHistory(24, 3);

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
          <CardTitle>Historia rankingu marek</CardTitle>
          <CardDescription>Brak wystarczających danych</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = data.months.map(month => {
    const row: Record<string, any> = { month };
    data.brands.forEach(brand => {
      const entry = data.data.find(d => d.month === month && d.brandName === brand);
      row[brand] = entry?.rank || null;
    });
    return row;
  });

  const maxRank = Math.max(...data.data.map(d => d.rank), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historia rankingu marek</CardTitle>
        <CardDescription>
          Pozycja marki w rankingu na przestrzeni czasu (niższy = lepszy)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              reversed
              domain={[1, maxRank + 1]}
              tickCount={maxRank}
              className="text-xs"
              label={{
                value: "Pozycja",
                angle: -90,
                position: "insideLeft",
                className: "text-xs fill-muted-foreground"
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              formatter={(value: any, name: any) => [`Pozycja ${value}`, name]}
            />
            <Legend />
            {data.brands.map((brand, i) => (
              <Line
                key={brand}
                type="monotone"
                dataKey={brand}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
