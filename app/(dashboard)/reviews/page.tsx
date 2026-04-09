'use client';

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Star, MessageSquare, TrendingUp, BarChart2, Loader2, Brain,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

import { useReviews } from "@/hooks/supabase/useReviews";
import { useBrands } from "@/hooks/supabase/useBrands";
import { useReviewsStatistics } from "@/hooks/supabase/useReviewsStatistics";
import { useReviewsStats } from "@/hooks/supabase/useReviewsStats";

import { StatCard } from "@/components/reviews/StatCard";
import { BrandRankingCard } from "@/components/reviews/BrandRankingCard";
import { BrandRatingsCard } from "@/components/reviews/BrandRatingsCard";
import { BrandParametersComparison } from "@/components/reviews/BrandParametersComparison";
import { SentimentAnalysis } from "@/components/reviews/SentimentAnalysis";
import { BrandParametersTrendsChart } from "@/components/reviews/BrandParametersTrendsChart";
import { BrandRankingBumpChart } from "@/components/reviews/BrandRankingBumpChart";
import { MonthlyReviewsChart } from "@/components/reviews/MonthlyReviewsChart";
import { ReviewsTimeline } from "@/components/reviews/ReviewsTimeline";
import { KeywordAnalysis } from "@/components/reviews/KeywordAnalysis";
import { AIKeywordAnalysis } from "@/components/reviews/AIKeywordAnalysis";

const TIME_FILTER_OPTIONS = [
  { value: "all", label: "Wszystkie" },
  { value: "1month", label: "Ostatni miesiąc" },
  { value: "3months", label: "Ostatnie 3 miesiące" },
  { value: "6months", label: "Ostatnie 6 miesięcy" },
  { value: "1year", label: "Ostatni rok" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState("statistics");
  const [timeFilter, setTimeFilter] = useState("all");
  const [excludeDietly, setExcludeDietly] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Recent tab state
  const [page, setPage] = useState(0);
  const [recentRating, setRecentRating] = useState<number | undefined>();

  const { data: brands } = useBrands();
  const { data: reviewsStatistics, isLoading: isLoadingStats } = useReviewsStatistics(
    selectedBrandId,
    timeFilter,
    excludeDietly
  );
  const { data: statsData } = useReviewsStats();

  const { data: reviewsData, isLoading: isLoadingReviews } = useReviews(
    page,
    20,
    selectedBrandId || undefined,
    recentRating
  );

  const reviews = reviewsData?.reviews || [];
  const total = reviewsData?.total || 0;
  const hasMore = reviewsData?.hasMore || false;

  const handleBrandChange = (value: string) => {
    setSelectedBrandId(value === "all" ? null : value);
    setPage(0);
  };

  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
    setPage(0);
  };

  const overview = reviewsStatistics?.overview;
  const ratingDistribution = reviewsStatistics?.ratingDistribution || [];
  const brandRanking = reviewsStatistics?.brandRanking || [];
  const sourceBreakdown = reviewsStatistics?.sourceBreakdown || [];

  const aiTimeFrame = timeFilter === "all" ? "1year" : timeFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Opinie
          </h1>
          <p className="text-muted-foreground mt-1">
            Analiza i monitorowanie opinii klientów
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={selectedBrandId || "all"} onValueChange={(v) => v && handleBrandChange(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Wszystkie marki">
                {selectedBrandId
                  ? ((brands || []).find(b => b.id === selectedBrandId)?.name || "Wszystkie marki")
                  : "Wszystkie marki"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie marki</SelectItem>
              {(brands || []).map(brand => (
                <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={(v) => v && handleTimeFilterChange(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FILTER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="exclude-dietly"
              checked={excludeDietly}
              onCheckedChange={setExcludeDietly}
            />
            <Label htmlFor="exclude-dietly" className="text-sm cursor-pointer">
              Wyklucz Dietly
            </Label>
          </div>
        </div>
      </div>

      {/* Overview stats row */}
      {isLoadingStats ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Wszystkie opinie"
            value={overview.totalReviews.toLocaleString()}
            icon={MessageSquare}
          />
          <StatCard
            title="Średnia ocena"
            value={overview.averageRating ? overview.averageRating.toFixed(2) : "—"}
            icon={Star}
          />
          <StatCard
            title="Pozytywne"
            value={`${overview.positivePercentage ? overview.positivePercentage.toFixed(1) : "0"}%`}
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Źródła"
            value={sourceBreakdown.length}
            icon={BarChart2}
          />
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="statistics">Statystyki</TabsTrigger>
          <TabsTrigger value="recent">Ostatnie opinie</TabsTrigger>
          <TabsTrigger value="ratings">Rozkład ocen</TabsTrigger>
          <TabsTrigger value="sentiment">Sentyment</TabsTrigger>
          <TabsTrigger value="timeline">Oś czasu</TabsTrigger>
          <TabsTrigger value="keywords">Słowa kluczowe</TabsTrigger>
          <TabsTrigger value="ai-keywords">
            <Brain className="w-4 h-4 mr-1" />
            Słowa AI
          </TabsTrigger>
        </TabsList>

        {/* Tab: Statystyki */}
        <TabsContent value="statistics" className="space-y-6">
          {/* Brand ranking */}
          {brandRanking.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Ranking marek</h2>
              {brandRanking.map((brand: any, i: number) => (
                <BrandRankingCard
                  key={brand.brandId || brand.name}
                  brand={brand}
                  position={i + 1}
                  timeFilter={timeFilter}
                />
              ))}
            </div>
          )}

          {/* Monthly chart */}
          <MonthlyReviewsChart />

          {/* Bump chart (ranking over time) */}
          <BrandRankingBumpChart />

          {/* Parameters trends */}
          {brands && brands.length > 0 && (
            <BrandParametersTrendsChart brands={brands} />
          )}

          {/* Source breakdown */}
          {sourceBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rozkład według źródeł</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sourceBreakdown.map((source: any) => (
                    <div key={source.source} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{source.source || "Brak"}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{source.count} opinii</span>
                        <span>śr. {(source.avgRating || source.avg_rating || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Ostatnie opinie */}
        <TabsContent value="recent" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select
              value={recentRating !== undefined ? String(recentRating) : "all"}
              onValueChange={v => {
                if (!v) return;
                setRecentRating(v === "all" ? undefined : parseInt(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Wszystkie oceny" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie oceny</SelectItem>
                {[5, 4, 3, 2, 1].map(r => (
                  <SelectItem key={r} value={String(r)}>{r} ★</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground flex items-center">
              Łącznie: {total.toLocaleString()} opinii
            </div>
          </div>

          {isLoadingReviews ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Brak opinii dla wybranych filtrów</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reviews.map(review => (
                <Card key={review.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {review.brands?.logo_url && (
                          <AvatarImage src={review.brands.logo_url} alt={review.brands.name} />
                        )}
                        <AvatarFallback>
                          {(review.brands?.name || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{review.brands?.name}</span>
                          <StarRating rating={review.rating} />
                          {review.source && (
                            <Badge variant="outline" className="text-xs">{review.source}</Badge>
                          )}
                          {review.review_date && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(review.review_date), "d MMM yyyy", { locale: pl })}
                            </span>
                          )}
                        </div>
                        {review.author_name && (
                          <p className="text-sm text-muted-foreground mt-1">{review.author_name}</p>
                        )}
                        {review.content && (
                          <p className="text-sm mt-2 leading-relaxed">{review.content}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {(page > 0 || hasMore) && (
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Poprzednia
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">Strona {page + 1}</span>
              <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={!hasMore}>
                Następna
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Tab: Rozkład ocen */}
        <TabsContent value="ratings" className="space-y-4">
          <BrandParametersComparison />

          {statsData && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Rozkład ocen per marka</h2>
              {Object.entries(statsData).map(([brandName, stats]: [string, any]) => {
                const brand = (brands || []).find(b => b.name === brandName);
                return (
                  <BrandRatingsCard
                    key={brandName}
                    brandName={brandName}
                    brandId={brand?.id}
                    logoUrl={brand?.logo_url ?? undefined}
                    stats={stats}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Sentyment */}
        <TabsContent value="sentiment">
          {brands && brands.length > 0 ? (
            <SentimentAnalysis brands={brands.map(b => ({ ...b, logo_url: b.logo_url ?? undefined }))} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>

        {/* Tab: Oś czasu */}
        <TabsContent value="timeline" className="space-y-6">
          <ReviewsTimeline />
        </TabsContent>

        {/* Tab: Słowa kluczowe */}
        <TabsContent value="keywords">
          {brands && brands.length > 0 ? (
            <KeywordAnalysis brands={brands.map(b => ({ ...b, logo_url: b.logo_url ?? undefined }))} timeFilter={timeFilter} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>

        {/* Tab: Słowa AI */}
        <TabsContent value="ai-keywords">
          {brands && brands.length > 0 ? (
            <AIKeywordAnalysis brands={brands.map(b => ({ ...b, logo_url: b.logo_url ?? undefined }))} timeFrame={aiTimeFrame} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
