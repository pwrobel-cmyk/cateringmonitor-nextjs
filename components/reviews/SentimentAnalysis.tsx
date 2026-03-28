'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useReviewsStats } from "@/hooks/supabase/useReviewsStats";
import { TopWordsAnalysis } from "./TopWordsAnalysis";
import { Loader2 } from "lucide-react";

interface SentimentAnalysisProps {
  brands: Array<{ id: string; name: string; logo_url?: string }>;
}

export function SentimentAnalysis({ brands }: SentimentAnalysisProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [comparedBrand, setComparedBrand] = useState<string>("");
  const { data: statsData, isLoading } = useReviewsStats();

  if (!brands.length) return null;

  const firstBrand = brands[0]?.name || "";
  const secondBrand = brands[1]?.name || firstBrand;

  const effectiveSelected = selectedBrand || firstBrand;
  const effectiveCompared = comparedBrand || secondBrand;

  const parameters = ["smak", "jakość", "dostawa", "cena", "porcje", "obsługa"];

  const buildRadarData = (brandName: string) => {
    const brandStats = statsData?.[brandName];
    if (!brandStats) return parameters.map(p => ({ subject: p, value: 0 }));

    return parameters.map(param => ({
      subject: param,
      value: brandStats.avg || 0,
    }));
  };

  const selectedData = buildRadarData(effectiveSelected);
  const comparedData = buildRadarData(effectiveCompared);

  const radarData = parameters.map((param, i) => ({
    subject: param,
    [effectiveSelected]: selectedData[i].value,
    [effectiveCompared]: comparedData[i].value,
  }));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Analiza sentymentu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Select onValueChange={(v) => v && setSelectedBrand(v)} value={effectiveSelected}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Wybierz markę" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(brand => (
                  <SelectItem key={brand.id} value={brand.name}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => v && setComparedBrand(v)} value={effectiveCompared}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Porównaj z marką" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(brand => (
                  <SelectItem key={brand.id} value={brand.name}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis dataKey="subject" className="text-xs" />
                <PolarRadiusAxis angle={90} domain={[0, 5]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Radar
                  name={effectiveSelected}
                  dataKey={effectiveSelected}
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.3}
                />
                {effectiveCompared !== effectiveSelected && (
                  <Radar
                    name={effectiveCompared}
                    dataKey={effectiveCompared}
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.3}
                  />
                )}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <TopWordsAnalysis
        selectedBrandName={effectiveSelected}
        comparedBrandName={effectiveCompared}
        brands={brands}
      />
    </div>
  );
}
