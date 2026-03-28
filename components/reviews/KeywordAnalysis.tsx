'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useReviewsStats } from "@/hooks/supabase/useReviewsStats";
import { Loader2 } from "lucide-react";

interface KeywordAnalysisProps {
  brands: Array<{ id: string; name: string; logo_url?: string }>;
  timeFilter?: string;
}

interface KeywordData {
  keyword: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: "positive" | "negative" | "neutral";
}

const POSITIVE_KEYWORDS = [
  "pyszny", "smaczny", "dobry", "świeży", "wspaniały", "polecam",
  "szybki", "terminowy", "profesjonalny", "miły", "pomocny",
  "różnorodny", "smaczne", "świetny", "doskonały", "rewelacyjny"
];

const NEGATIVE_KEYWORDS = [
  "zimny", "zimne", "niesmaczny", "zły", "słaby", "nie polecam",
  "opóźnienie", "nieprofesjonalny", "drogi", "mało", "za mało",
  "rozczarowanie", "problem", "błąd", "zepsuty"
];

function analyzeKeywords(content: string, rating: number): KeywordData[] {
  const lower = content.toLowerCase();
  const results: Map<string, KeywordData> = new Map();

  [...POSITIVE_KEYWORDS, ...NEGATIVE_KEYWORDS].forEach(keyword => {
    if (lower.includes(keyword)) {
      const existing = results.get(keyword) || {
        keyword,
        count: 0,
        positiveCount: 0,
        negativeCount: 0,
        sentiment: "neutral" as const,
      };

      existing.count++;
      if (rating >= 4) existing.positiveCount++;
      else if (rating <= 2) existing.negativeCount++;

      existing.sentiment = existing.positiveCount > existing.negativeCount
        ? "positive"
        : existing.negativeCount > existing.positiveCount
        ? "negative"
        : "neutral";

      results.set(keyword, existing);
    }
  });

  return Array.from(results.values()).sort((a, b) => b.count - a.count);
}

function useAllBrandKeywords(brandName: string, statsData: any) {
  const stats = statsData?.[brandName];
  return stats || null;
}

export function KeywordAnalysis({ brands }: KeywordAnalysisProps) {
  const { data: statsData, isLoading } = useReviewsStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Analiza słów kluczowych</CardTitle>
          <CardDescription>
            Najczęstsze słowa kluczowe w opiniach klientów per marka
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {brands.map(brand => {
              const stats = statsData?.[brand.name];
              if (!stats) return null;

              return (
                <AccordionItem key={brand.id} value={brand.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      {brand.logo_url && (
                        <img src={brand.logo_url} alt={brand.name} className="w-8 h-8 object-contain" />
                      )}
                      <span className="font-medium">{brand.name}</span>
                      <Badge variant="secondary">{stats.total} opinii</Badge>
                      <Badge variant="outline">Średnia: {stats.avg}/5</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3">
                            🟢 Pozytywne słowa kluczowe
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {POSITIVE_KEYWORDS.slice(0, 8).map(keyword => (
                              <Badge key={keyword} variant="secondary" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
                            🔴 Negatywne słowa kluczowe
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {NEGATIVE_KEYWORDS.slice(0, 8).map(keyword => (
                              <Badge key={keyword} variant="secondary" className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        * Analiza słów kluczowych oparta na statystykach dostępnych w bazie danych.
                        Skorzystaj z zakładki &quot;Słowa AI&quot; dla zaawansowanej analizy semantycznej.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
