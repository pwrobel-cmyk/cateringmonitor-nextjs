'use client';

import { useState } from "react";
import { useGoogleTrendsAnalyses } from "@/hooks/useGoogleTrendsAnalyses";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, Calendar, Globe, Search, FileText, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";
import type { GoogleTrendsAnalysis } from "@/hooks/useGoogleTrendsAnalyses";

interface TrendDataPoint {
  date: string;
  [key: string]: string | number;
}

export default function Trends() {
  const { data: analyses, isLoading, error } = useGoogleTrendsAnalyses();
  const [selectedAnalysis, setSelectedAnalysis] = useState<GoogleTrendsAnalysis | null>(null);

  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case "interest_over_time":
        return "Zainteresowanie w czasie";
      case "interest_by_region":
      case "multi_region":
        return "Zainteresowanie wg regionu";
      case "related_queries":
        return "Powiązane zapytania";
      default:
        return type;
    }
  };

  const getAnalysisTypeColor = (type: string) => {
    switch (type) {
      case "interest_over_time":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "interest_by_region":
      case "multi_region":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "related_queries":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const chartColors = [
    "hsl(var(--primary))",
    "hsl(142, 76%, 36%)",
    "hsl(38, 92%, 50%)",
    "hsl(280, 65%, 60%)",
    "hsl(0, 84%, 60%)",
  ];

  const prepareChartData = (data: unknown, analysisType: string): TrendDataPoint[] => {
    if (!data || typeof data !== 'object') return [];

    const dataObj = data as {
      timeline_data?: Array<{ date: string; values: Array<{ query: string; value: number }> }>;
      timeline?: Array<{ date: string; [key: string]: string | number }>;
      regions?: string[];
    };

    if (analysisType === 'multi_region' && dataObj.timeline && Array.isArray(dataObj.timeline)) {
      return dataObj.timeline.map((item) => {
        const point: TrendDataPoint = { date: item.date as string };
        Object.keys(item).forEach((key) => {
          if (key !== 'date') {
            point[key] = item[key];
          }
        });
        return point;
      }).sort((a, b) => {
        const dateA = new Date(a.date.replace(/([A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s(\d+).*(\d{4})/, '$1 $2, $3'));
        const dateB = new Date(b.date.replace(/([A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s(\d+).*(\d{4})/, '$1 $2, $3'));
        return dateA.getTime() - dateB.getTime();
      });
    }

    if (!dataObj.timeline_data || !Array.isArray(dataObj.timeline_data)) return [];

    return dataObj.timeline_data.map((item) => {
      const point: TrendDataPoint = { date: item.date };
      item.values.forEach((v) => {
        point[v.query] = v.value;
      });
      return point;
    });
  };

  const getChartKeys = (data: unknown, analysisType: string, queries: string[]): string[] => {
    if (analysisType === 'multi_region' && data && typeof data === 'object') {
      const dataObj = data as { regions?: string[] };
      if (dataObj.regions && Array.isArray(dataObj.regions)) {
        return dataObj.regions;
      }
    }
    return queries;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Google Trends
        </h1>
        <p className="text-muted-foreground mt-1">
          Analizy trendów wyszukiwań dla branży catering dietetyczny
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-destructive">Błąd podczas ładowania danych: {(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {analyses && analyses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Brak zapisanych analiz trendów</p>
          </CardContent>
        </Card>
      )}

      {analyses && analyses.length > 0 && (
        <div className="space-y-4">
          {analyses.map((analysis) => (
            <Card key={analysis.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle
                    className="text-lg cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setSelectedAnalysis(analysis)}
                  >
                    {analysis.name}
                  </CardTitle>
                  <Badge variant="secondary" className={getAnalysisTypeColor(analysis.analysis_type)}>
                    {getAnalysisTypeLabel(analysis.analysis_type)}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-4 text-xs">
                  {analysis.geo && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {analysis.geo}
                    </span>
                  )}
                  {analysis.date_range && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {analysis.date_range}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Search className="h-3 w-3" />
                    Słowa kluczowe:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.queries.map((query, idx) => (
                      <Badge key={idx} variant="outline" className="text-sm">
                        {query}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  {analysis.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Utworzono: {format(new Date(analysis.created_at), "d MMM yyyy, HH:mm", { locale: pl })}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAnalysis(analysis)}
                    className="flex items-center gap-1"
                  >
                    Szczegóły
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedAnalysis && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {selectedAnalysis.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {selectedAnalysis.data && (
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Wykres zainteresowania
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={prepareChartData(selectedAnalysis.data, selectedAnalysis.analysis_type)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          {getChartKeys(selectedAnalysis.data, selectedAnalysis.analysis_type, selectedAnalysis.queries).map((key, idx) => (
                            <Line
                              key={key}
                              type="monotone"
                              dataKey={key}
                              stroke={chartColors[idx % chartColors.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {selectedAnalysis.ai_analysis && (
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Analiza AI
                    </h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{selectedAnalysis.ai_analysis}</ReactMarkdown>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
                  {selectedAnalysis.geo && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      Region: {selectedAnalysis.geo}
                    </span>
                  )}
                  {selectedAnalysis.date_range && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Zakres: {selectedAnalysis.date_range}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
