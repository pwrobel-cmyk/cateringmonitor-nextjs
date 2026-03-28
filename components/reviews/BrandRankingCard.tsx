'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useBrandReviews } from "@/hooks/supabase/useBrandReviews";

interface BrandRankingCardProps {
  brand: {
    name: string;
    logo_url?: string;
    totalReviews: number;
    averageRating: number;
    positiveCount: number;
    negativeCount: number;
    positivePercentage: number;
    positionChange: number;
    brand_id?: string;
  };
  position: number;
  timeFilter?: string;
}

interface TopicAnalysis {
  topic: string;
  mentions: number;
  sentiment: "positive" | "negative" | "neutral";
  positiveCount: number;
  negativeCount: number;
  positivePercentage: number;
  negativePercentage: number;
}

const analyzeReviewContent = (reviews: Array<{ content: string; rating: number }>): TopicAnalysis[] => {
  const topics = {
    smak: { keywords: ["smak", "smacz", "pyszn", "delicious"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
    jakość: { keywords: ["jakość", "jakośc", "quality", "śwież", "swiez"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
    dostawa: { keywords: ["dostaw", "kurier", "delivery", "przesyłk", "przesylk"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
    opakowanie: { keywords: ["opakow", "pakow", "package", "packaging"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
    obsługa: { keywords: ["obsług", "obslug", "service", "kontakt", "pomoc"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
    cena: { keywords: ["cena", "cen", "price", "koszt", "drogi", "tani"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
    porcje: { keywords: ["porcj", "ilość", "ilosc", "dużo", "duzo", "mało", "malo"], mentions: 0, totalRating: 0, positiveCount: 0, negativeCount: 0 },
  };

  reviews.forEach((review) => {
    const content = review.content.toLowerCase();
    Object.keys(topics).forEach((topic) => {
      const topicData = topics[topic as keyof typeof topics];
      const hasMatch = topicData.keywords.some((keyword) => content.includes(keyword));
      if (hasMatch) {
        topicData.mentions++;
        topicData.totalRating += review.rating;
        if (review.rating >= 4) {
          topicData.positiveCount++;
        } else if (review.rating <= 2) {
          topicData.negativeCount++;
        }
      }
    });
  });

  return Object.entries(topics)
    .filter(([_, data]) => data.mentions > 0)
    .map(([topic, data]) => {
      const avgRating = data.totalRating / data.mentions;
      return {
        topic,
        mentions: data.mentions,
        positiveCount: data.positiveCount,
        negativeCount: data.negativeCount,
        positivePercentage: Math.round((data.positiveCount / data.mentions) * 100),
        negativePercentage: Math.round((data.negativeCount / data.mentions) * 100),
        sentiment: (avgRating >= 4 ? "positive" : avgRating <= 2 ? "negative" : "neutral") as "positive" | "negative" | "neutral",
      };
    })
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 6);
};

export function BrandRankingCard({ brand, position, timeFilter = "all" }: BrandRankingCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: reviews, isLoading } = useBrandReviews(isOpen ? (brand.brand_id || null) : null, timeFilter);

  const topicAnalysis = reviews && reviews.length > 0 ? analyzeReviewContent(reviews) : [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardContent className="p-4">
          <div
            className="flex items-start gap-4 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-muted rounded-lg font-bold text-lg">
              {position}
            </div>

            {brand.logo_url && (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="w-12 h-12 object-contain flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{brand.name}</h3>
                {brand.positionChange !== 0 && (
                  <Badge variant={brand.positionChange > 0 ? "default" : "secondary"} className="flex items-center gap-1">
                    {brand.positionChange > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(brand.positionChange)}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Ocena: {brand.averageRating.toFixed(1)}</span>
                <span>Opinie: {brand.totalReviews}</span>
                <span className="text-green-600">
                  Pozytywne: {brand.positivePercentage.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="ml-auto flex-shrink-0">
              <div className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span>{isOpen ? "Mniej" : "Więcej"}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
          </div>

          <CollapsibleContent className="mt-4">
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Najczęstsze aspekty w opiniach</h4>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Ładowanie...</p>
              ) : topicAnalysis.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {topicAnalysis.map((item) => {
                    const difference = item.positivePercentage - item.negativePercentage;
                    const bgColor = difference > 5
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : difference < -5
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-muted border-border";

                    return (
                      <div
                        key={item.topic}
                        className={`px-3 py-2 rounded-lg border ${bgColor}`}
                      >
                        <div className="text-sm font-medium capitalize">{item.topic}</div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {item.mentions} {item.mentions === 1 ? "wzmianka" : "wzmianek"}
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-600 dark:text-green-400">
                            P {item.positivePercentage}%
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            N {item.negativePercentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Brak wystarczających danych do analizy
                </p>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
