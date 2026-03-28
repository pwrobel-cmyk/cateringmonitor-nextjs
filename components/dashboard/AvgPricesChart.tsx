"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface BrandAvgPrice {
  name: string;
  avg_price: number;
  min_price: number;
  max_price: number;
}

interface AvgPricesChartProps {
  data: BrandAvgPrice[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BrandAvgPrice }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.name}</p>
      <p className="text-[#1e3a5f]">Średnia: <span className="font-bold">{d.avg_price.toFixed(2)} zł</span></p>
      <p className="text-gray-500">Min: {d.min_price} zł / Max: {d.max_price} zł</p>
    </div>
  );
}

export function AvgPricesChart({ data }: AvgPricesChartProps) {
  const sorted = [...data].sort((a, b) => b.avg_price - a.avg_price);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tickFormatter={(v) => `${v} zł`}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="avg_price" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {sorted.map((_, i) => (
            <Cell
              key={i}
              fill={i === 0 ? "#0ea5e9" : "#1e3a5f"}
              opacity={1 - i * 0.035}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
