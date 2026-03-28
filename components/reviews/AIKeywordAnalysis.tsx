'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Brain, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useStoredAIAnalysis, useAggregatedAIAnalysis } from "@/hooks/useStoredAIAnalyses";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIKeywordAnalysisProps {
  brands: Array<{ id: string; name: string; logo_url?: string }>;
  timeFrame?: string;
}

interface BrandAnalysisCardProps {
  brand: { id: string; name: string; logo_url?: string };
  timeFrame: string;
}

function BrandAnalysisCard({ brand, timeFrame }: BrandAnalysisCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: analysis } = useStoredAIAnalysis(brand.id, timeFrame);

  if (!analysis) {
    return (
      <Card className="opacity-60">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {brand.logo_url && (
              <img src={brand.logo_url} alt={brand.name} className="w-8 h-8 object-contain" />
            )}
            <span className="font-medium">{brand.name}</span>
            <Badge variant="outline" className="text-xs">Brak analizy AI</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const analysisData = analysis.analysis_data || {};
  const positiveKeywords: string[] = analysisData.positive_keywords || [];
  const negativeKeywords: string[] = analysisData.negative_keywords || [];
  const summary: string = analysisData.summary || "";
  const strengths: string[] = analysisData.strengths || [];
  const weaknesses: string[] = analysisData.weaknesses || [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {brand.logo_url && (
                <img src={brand.logo_url} alt={brand.name} className="w-8 h-8 object-contain" />
              )}
              <span className="font-medium">{brand.name}</span>
              <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <Brain className="w-3 h-3 mr-1" />
                AI
              </Badge>
            </div>

            <CollapsibleTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1 text-xs"
              )}
            >
              {isOpen ? (
                <>Mniej <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Więcej <ChevronDown className="w-4 h-4" /></>
              )}
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4 space-y-4">
            {summary && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Podsumowanie</h4>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {positiveKeywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Słowa pozytywne
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {positiveKeywords.map(keyword => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 text-xs"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {negativeKeywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    Słowa negatywne
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {negativeKeywords.map(keyword => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {strengths.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">Mocne strony</h4>
                <ul className="space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {weaknesses.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Słabe strony</h4>
                <ul className="space-y-1">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

export function AIKeywordAnalysis({ brands, timeFrame = "1year" }: AIKeywordAnalysisProps) {
  const { data: aggregated } = useAggregatedAIAnalysis(timeFrame);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Analiza AI słów kluczowych
          </CardTitle>
          <CardDescription>
            Zaawansowana analiza semantyczna opinii wykonana przez AI
          </CardDescription>
        </CardHeader>
      </Card>

      {aggregated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analiza zagregowana — cały rynek</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aggregated.positive_keywords?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Najczęstsze słowa pozytywne
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {aggregated.positive_keywords.map((keyword: string) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {aggregated.negative_keywords?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    Najczęstsze słowa negatywne
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {aggregated.negative_keywords.map((keyword: string) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Analiza per marka
        </h3>
        {brands.map(brand => (
          <BrandAnalysisCard key={brand.id} brand={brand} timeFrame={timeFrame} />
        ))}
      </div>
    </div>
  );
}
