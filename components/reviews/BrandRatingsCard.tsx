'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, Star } from "lucide-react";
import { useState } from "react";
import { useBrandReviews } from "@/hooks/supabase/useBrandReviews";

interface BrandRatingsCardProps {
  brandName: string;
  brandId?: string;
  logoUrl?: string;
  stats: {
    total: number;
    avg: number;
    distribution: number[];
  };
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

export function BrandRatingsCard({ brandName, brandId, logoUrl, stats }: BrandRatingsCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: reviews, isLoading } = useBrandReviews(isOpen ? (brandId || null) : null);

  const topicAnalysis = reviews && reviews.length > 0 ? analyzeReviewContent(reviews) : [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardContent className="p-6">
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={logoUrl} alt={brandName} />
                  <AvatarFallback>{brandName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{brandName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.total} opinii • Średnia: {stats.avg}/5
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">{stats.avg}</div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= Math.round(stats.avg)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span>{isOpen ? "Mniej" : "Więcej"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm">{rating}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <Progress
                    value={(stats.distribution[rating - 1] / stats.total) * 100}
                    className="flex-1 h-2"
                  />
                  <span className="text-sm text-muted-foreground w-8">
                    {stats.distribution[rating - 1]}
                  </span>
                </div>
              ))}
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
