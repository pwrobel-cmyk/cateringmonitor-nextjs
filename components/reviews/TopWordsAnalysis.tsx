'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTopWords } from "@/hooks/supabase/useTopWords";
import { Loader2 } from "lucide-react";

interface TopWordsAnalysisProps {
  selectedBrandName: string;
  comparedBrandName: string;
  brands: any[];
}

export function TopWordsAnalysis({ selectedBrandName, comparedBrandName, brands }: TopWordsAnalysisProps) {
  const selectedBrand = brands.find(b => b.name === selectedBrandName);
  const comparedBrand = brands.find(b => b.name === comparedBrandName);

  const selectedBrandId = selectedBrand?.id || null;
  const comparedBrandId = comparedBrand?.id || null;

  const { data: allPositive, isLoading: loadingAllPositive } = useTopWords(null, 'positive');
  const { data: allNegative, isLoading: loadingAllNegative } = useTopWords(null, 'negative');

  const { data: selectedPositive, isLoading: loadingSelectedPositive } = useTopWords(selectedBrandId, 'positive');
  const { data: selectedNegative, isLoading: loadingSelectedNegative } = useTopWords(selectedBrandId, 'negative');

  const { data: comparedPositive, isLoading: loadingComparedPositive } = useTopWords(comparedBrandId, 'positive');
  const { data: comparedNegative, isLoading: loadingComparedNegative } = useTopWords(comparedBrandId, 'negative');

  const renderChart = (
    data: any[] | undefined,
    isLoading: boolean,
    color: string
  ) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          Brak danych dla wybranej marki
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" className="text-xs" />
          <YAxis
            type="category"
            dataKey="word"
            className="text-xs"
            width={70}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderComparisonChart = (
    data1: any[] | undefined,
    data2: any[] | undefined,
    isLoading1: boolean,
    isLoading2: boolean,
    brand1Name: string,
    brand2Name: string
  ) => {
    if (isLoading1 || isLoading2) {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if ((!data1 || data1.length === 0) && (!data2 || data2.length === 0)) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          Brak danych dla wybranych marek
        </div>
      );
    }

    const allWords = new Set([
      ...(data1 || []).map(d => d.word),
      ...(data2 || []).map(d => d.word)
    ]);

    const combinedData = Array.from(allWords).map(word => {
      const brand1Item = data1?.find(d => d.word === word);
      const brand2Item = data2?.find(d => d.word === word);

      return {
        word,
        [brand1Name]: brand1Item?.count || 0,
        [brand2Name]: brand2Item?.count || 0
      };
    }).sort((a, b) => {
      const totalA = (a[brand1Name] as number) + (a[brand2Name] as number);
      const totalB = (b[brand1Name] as number) + (b[brand2Name] as number);
      return totalB - totalA;
    }).slice(0, 10);

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={combinedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" className="text-xs" />
          <YAxis
            type="category"
            dataKey="word"
            className="text-xs"
            width={70}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Bar dataKey={brand1Name} fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
          <Bar dataKey={brand2Name} fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">📊 Wszystkie marki</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🟢 Słowa Pozytywne (4-5⭐)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderChart(allPositive, loadingAllPositive, '#10b981')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🔴 Słowa Negatywne (1-2⭐)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderChart(allNegative, loadingAllNegative, '#f97316')}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">🔍 {selectedBrandName}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🟢 Słowa Pozytywne (4-5⭐)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderChart(selectedPositive, loadingSelectedPositive, '#10b981')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🔴 Słowa Negatywne (1-2⭐)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderChart(selectedNegative, loadingSelectedNegative, '#f97316')}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">⚖️ Porównanie: {selectedBrandName} vs {comparedBrandName}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🟢 Słowa Pozytywne (4-5⭐)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderComparisonChart(
                selectedPositive,
                comparedPositive,
                loadingSelectedPositive,
                loadingComparedPositive,
                selectedBrandName,
                comparedBrandName
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🔴 Słowa Negatywne (1-2⭐)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderComparisonChart(
                selectedNegative,
                comparedNegative,
                loadingSelectedNegative,
                loadingComparedNegative,
                selectedBrandName,
                comparedBrandName
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
