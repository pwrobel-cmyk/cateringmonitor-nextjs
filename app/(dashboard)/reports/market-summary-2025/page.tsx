// @ts-nocheck
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, TrendingUp, TrendingDown, Star, MessageSquare, AlertTriangle, Heart, ThumbsUp, ThumbsDown, Calendar, FileDown, Sparkles, Target, Percent, DollarSign, Users, BarChart3, Building2 } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketReviewAspects } from "@/hooks/supabase/useMarketReviewAspects";
import { useMemo, useRef } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { PDFGenerator } from "@/components/reports/PDFGenerator";

// Chart colors
const COLORS = [
  "hsl(142, 76%, 36%)", // green
  "hsl(221, 83%, 53%)", // blue
  "hsl(280, 68%, 50%)", // purple
  "hsl(38, 92%, 50%)",  // orange
  "hsl(0, 84%, 60%)",   // red
];

// =====================
// DATA FETCHING HELPERS
// =====================

// Fetch all reviews for all Polish brands with recursive pagination
async function fetchAllPolishReviewsWithDetails() {
  const allReviews: Array<{ 
    rating: number | null; 
    review_date: string | null; 
    brand_id: string;
    content: string | null;
  }> = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  // First get all Polish brand IDs with names
  const { data: polishBrands } = await supabase
    .from('brands')
    .select('id, name')
    .neq('country', 'Czechy')
    .eq('is_active', true);

  const polishBrandIds = (polishBrands || []).map(b => b.id);
  const brandNameMap = new Map((polishBrands || []).map(b => [b.id, b.name]));

  if (polishBrandIds.length === 0) return { reviews: allReviews, brandNameMap };

  while (hasMore) {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating, review_date, brand_id, content')
      .in('brand_id', polishBrandIds)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allReviews.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return { reviews: allReviews, brandNameMap };
}

// Fetch brand daily stats for Q4 2025
async function fetchBrandDailyStatsQ4() {
  const allRows: Array<{ avgPrice: number; weight: number; brandId: string; brandName: string }> = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('brand_daily_stats')
      .select('average_price, total_prices_count, brand_id, brands!inner(id, name, country)')
      .gte('date', '2025-10-01')
      .lte('date', '2025-12-31')
      .not('average_price', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const transformed = (data as any[])
      .map((row) => {
        const brandObj = row.brands;
        const brandId = String(row.brand_id ?? brandObj?.id ?? '').trim();
        return {
          avgPrice: Number(row.average_price ?? 0),
          weight: Number(row.total_prices_count ?? 1) || 1,
          brandId,
          brandName: String(brandObj?.name ?? 'Unknown').trim(),
          country: String(brandObj?.country ?? '').trim(),
        };
      })
      .filter((r) => r.brandId !== '' && (!r.country || r.country !== 'Czechy'))
      .map(({ country: _country, ...rest }) => rest);

    allRows.push(...transformed);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

// Fetch discounts for Q4 2025
async function fetchDiscountsQ4() {
  const { data: discounts } = await supabase
    .from('discounts')
    .select('brand_id, percentage, brands!inner(id, name, country)')
    .gte('valid_from', '2025-10-01')
    .lt('valid_from', '2026-01-01')
    .not('percentage', 'is', null);

  return (discounts || []).filter((d: any) => {
    const country = String(d.brands?.country ?? '').trim();
    return !country || country !== 'Czechy';
  });
}

// =====================
// COMPONENT: Market Aspects
// =====================
function MarketAspectsSection() {
  const { data: aspectsData, isLoading } = useMarketReviewAspects();

  if (isLoading) {
    return (
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          Aspekty w opiniach – cały rynek
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-4 w-16 mb-4" />
                <Skeleton className="h-3 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  const aspects = aspectsData || [];
  const topAspect = aspects[0];
  const controversialAspects = aspects.filter(a => a.negative >= 20);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        Aspekty w opiniach – cały rynek
      </h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {aspects.map((item, idx) => (
          <Card key={idx} className="relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold capitalize">{item.aspect}</h3>
                  <p className="text-sm text-muted-foreground">{item.mentions.toLocaleString('pl-PL')} wzmianek</p>
                </div>
                {item.positive >= 80 ? (
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                ) : item.negative >= 20 ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                ) : (
                  <Heart className="h-5 w-5 text-primary" />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className="bg-green-500 transition-all" 
                    style={{ width: `${item.positive}%` }}
                  />
                  <div 
                    className="bg-red-500 transition-all" 
                    style={{ width: `${item.negative}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600 font-medium">Pozytywne {item.positive}%</span>
                  <span className="text-red-600 font-medium">Negatywne {item.negative}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm">
            <strong>Insight rynkowy:</strong> {topAspect ? (
              <>
                {topAspect.aspect.charAt(0).toUpperCase() + topAspect.aspect.slice(1)} jest najczęściej dyskutowanym aspektem ({topAspect.mentions.toLocaleString('pl-PL')} wzmianek) z {topAspect.positive}% pozytywnych opinii.
                {controversialAspects.length > 0 && (
                  <> Aspekty wymagające uwagi: {controversialAspects.map(a => a.aspect.charAt(0).toUpperCase() + a.aspect.slice(1)).join(', ')} ({controversialAspects.map(a => a.negative + '% negatywnych').join(', ')}).</>
                )}
              </>
            ) : (
              "Brak danych do analizy."
            )}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

// =====================
// MAIN COMPONENT
// =====================
export default function MarketSummary2025() {
  const contentRef = useRef<HTMLDivElement>(null);

  // Main market statistics query
  const { data: marketStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['market-summary-2025-stats'],
    queryFn: async () => {
      const { reviews, brandNameMap } = await fetchAllPolishReviewsWithDetails();
      
      // Overall statistics
      const totalReviews = reviews.length;
      const validRatings = reviews.filter(r => r.rating !== null);
      const avgRating = validRatings.length > 0 
        ? validRatings.reduce((acc, r) => acc + (r.rating || 0), 0) / validRatings.length 
        : 0;
      
      const positiveReviews = reviews.filter(r => (r.rating || 0) >= 4).length;
      const negativeReviews = reviews.filter(r => (r.rating || 0) <= 2).length;
      const neutralReviews = reviews.filter(r => r.rating === 3).length;
      
      const positivePercent = totalReviews > 0 ? (positiveReviews / totalReviews) * 100 : 0;
      const negativePercent = totalReviews > 0 ? (negativeReviews / totalReviews) * 100 : 0;
      
      // Brand ranking
      const brandAggregates: Record<string, { sum: number; count: number; name: string }> = {};
      
      reviews.forEach(r => {
        if (r.rating === null) return;
        if (!brandAggregates[r.brand_id]) {
          brandAggregates[r.brand_id] = { sum: 0, count: 0, name: brandNameMap.get(r.brand_id) || 'Unknown' };
        }
        brandAggregates[r.brand_id].sum += r.rating;
        brandAggregates[r.brand_id].count++;
      });
      
      const brandRanking = Object.entries(brandAggregates)
        .map(([id, data]) => ({
          brandId: id,
          brandName: data.name,
          avgRating: data.sum / data.count,
          reviewCount: data.count,
        }))
        .sort((a, b) => b.avgRating - a.avgRating);
      
      // Monthly trends for 2025
      const monthlyData: Record<string, { ratings: number[]; count: number }> = {};
      
      reviews.forEach(r => {
        if (!r.review_date || r.rating === null) return;
        const date = new Date(r.review_date);
        if (date.getFullYear() !== 2025) return;
        
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { ratings: [], count: 0 };
        }
        monthlyData[monthKey].ratings.push(r.rating);
        monthlyData[monthKey].count++;
      });
      
      const monthlyTrends = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
          count: data.count,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      // H1 vs H2 comparison
      const h1Reviews = reviews.filter(r => {
        if (!r.review_date || r.rating === null) return false;
        const date = new Date(r.review_date);
        return date.getFullYear() === 2025 && date.getMonth() < 6;
      });
      
      const h2Reviews = reviews.filter(r => {
        if (!r.review_date || r.rating === null) return false;
        const date = new Date(r.review_date);
        return date.getFullYear() === 2025 && date.getMonth() >= 6;
      });
      
      const h1Avg = h1Reviews.length > 0 
        ? h1Reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / h1Reviews.length 
        : 0;
      const h2Avg = h2Reviews.length > 0 
        ? h2Reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / h2Reviews.length 
        : 0;
      
      return {
        totalReviews,
        avgRating,
        positivePercent,
        negativePercent,
        positiveReviews,
        negativeReviews,
        neutralReviews,
        brandCount: brandNameMap.size,
        brandRanking,
        monthlyTrends,
        h1Avg,
        h2Avg,
        h1Count: h1Reviews.length,
        h2Count: h2Reviews.length,
      };
    },
    staleTime: 1000 * 60 * 15,
  });

  // Price comparison Q4 2025
  const { data: priceData, isLoading: isLoadingPrices } = useQuery({
    queryKey: ['market-summary-2025-prices'],
    queryFn: async () => {
      const stats = await fetchBrandDailyStatsQ4();
      
      // Aggregate by brand
      const brandPrices: Record<string, { sumWeighted: number; totalWeight: number; brandName: string }> = {};
      
      stats.forEach(row => {
        if (!brandPrices[row.brandId]) {
          brandPrices[row.brandId] = { sumWeighted: 0, totalWeight: 0, brandName: row.brandName };
        }
        brandPrices[row.brandId].sumWeighted += row.avgPrice * row.weight;
        brandPrices[row.brandId].totalWeight += row.weight;
      });
      
      return Object.entries(brandPrices)
        .map(([id, data]) => ({
          brandId: id,
          brandName: data.brandName,
          avgPrice: data.sumWeighted / data.totalWeight,
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);
    },
    staleTime: 1000 * 60 * 15,
  });

  // Discount comparison Q4 2025
  const { data: discountData, isLoading: isLoadingDiscounts } = useQuery({
    queryKey: ['market-summary-2025-discounts'],
    queryFn: async () => {
      const discounts = await fetchDiscountsQ4();
      
      // Aggregate by brand
      const brandDiscounts: Record<string, { sum: number; count: number; brandName: string }> = {};
      
      discounts.forEach((d: any) => {
        const brandId = d.brand_id;
        const brandName = d.brands?.name || 'Unknown';
        
        if (!brandDiscounts[brandId]) {
          brandDiscounts[brandId] = { sum: 0, count: 0, brandName };
        }
        brandDiscounts[brandId].sum += d.percentage || 0;
        brandDiscounts[brandId].count++;
      });
      
      return Object.entries(brandDiscounts)
        .map(([id, data]) => ({
          brandId: id,
          brandName: data.brandName,
          avgDiscount: data.sum / data.count,
          discountCount: data.count,
        }))
        .sort((a, b) => b.avgDiscount - a.avgDiscount);
    },
    staleTime: 1000 * 60 * 15,
  });

  // Derived data
  const topBrands = useMemo(() => 
    (marketStats?.brandRanking || []).filter(b => b.avgRating >= 4.5).slice(0, 5),
    [marketStats]
  );
  
  const bottomBrands = useMemo(() => 
    (marketStats?.brandRanking || []).filter(b => b.avgRating < 4.0).slice(-5).reverse(),
    [marketStats]
  );

  const volumeRanking = useMemo(() =>
    [...(marketStats?.brandRanking || [])].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 10),
    [marketStats]
  );

  const isLoading = isLoadingStats || isLoadingPrices || isLoadingDiscounts;

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-6 py-6 space-y-8 print:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden" data-pdf-hide="true">
          <Link href="/reports" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Powrót do raportów
          </Link>
          <PDFGenerator 
            reportTitle="Rynek Cateringu Dietetycznego 2025"
            reportSubtitle="Kompleksowa analiza opinii i cen wszystkich polskich marek cateringowych"
            contentRef={contentRef}
          />
        </div>
        
        {/* PDF Content Container */}
        <div ref={contentRef} className="space-y-8">

        {/* Report Header */}
        <div className="text-center space-y-4 py-8 border-b">
          <div className="flex items-center justify-center gap-3">
            <Building2 className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold">Rynek Cateringu Dietetycznego 2025</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Kompleksowa analiza opinii i cen wszystkich polskich marek cateringowych
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-sm">
              <Calendar className="h-3 w-3 mr-1" />
              Dane: 2015-2025
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Star className="h-3 w-3 mr-1" />
              {isLoading ? '...' : marketStats?.totalReviews.toLocaleString('pl-PL')} opinii
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Building2 className="h-3 w-3 mr-1" />
              {isLoading ? '...' : marketStats?.brandCount} marek
            </Badge>
          </div>
        </div>

        {/* Executive Summary KPIs */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Executive Summary – KPI rynkowe
          </h2>
          
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className="text-3xl font-bold">{marketStats?.avgRating.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Średnia ocena rynku</p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    <span className="text-3xl font-bold">{(marketStats?.totalReviews || 0).toLocaleString('pl-PL')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Łączna liczba opinii</p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="h-5 w-5 text-green-500" />
                    <span className="text-3xl font-bold">{marketStats?.positivePercent.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Opinie pozytywne (4-5★)</p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsDown className="h-5 w-5 text-red-500" />
                    <span className="text-3xl font-bold">{marketStats?.negativePercent.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Opinie negatywne (1-2★)</p>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-purple-500" />
                    <span className="text-3xl font-bold">{marketStats?.brandCount}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Aktywnych marek</p>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        <Separator />

        {/* Brand Rating Ranking */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            Ranking marek wg oceny klientów
          </h2>
          
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={Math.max(400, (marketStats?.brandRanking.length || 0) * 35)}>
                  <BarChart 
                    data={marketStats?.brandRanking} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 5]} />
                    <YAxis type="category" dataKey="brandName" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [value.toFixed(2), 'Średnia ocena']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar 
                      dataKey="avgRating" 
                      radius={[0, 4, 4, 0]}
                    >
                      {(marketStats?.brandRanking || []).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.avgRating >= 4.4 
                              ? "hsl(142, 76%, 36%)" // green
                              : entry.avgRating >= 4.0 
                                ? "hsl(38, 92%, 50%)" // orange
                                : "hsl(0, 84%, 60%)" // red
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Volume Ranking */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Top 10 marek wg liczby opinii
          </h2>
          
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[350px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart 
                    data={volumeRanking} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="brandName" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString('pl-PL'), 'Liczba opinii']}
                    />
                    <Bar 
                      dataKey="reviewCount" 
                      fill="hsl(221, 83%, 53%)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Monthly Trend 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Trend miesięczny – średnia ocena rynku 2025
          </h2>
          
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={marketStats?.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM', { locale: pl });
                      }}
                    />
                    <YAxis domain={[3.5, 5]} />
                    <Tooltip 
                      labelFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return format(new Date(parseInt(year), parseInt(month) - 1), 'LLLL yyyy', { locale: pl });
                      }}
                      formatter={(value: number) => [value.toFixed(2), 'Średnia ocena']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgRating" 
                      stroke="hsl(142, 76%, 36%)" 
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Średnia ocena"
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                {/* H1 vs H2 comparison */}
                {marketStats && (
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">H1 2025</p>
                      <p className="text-2xl font-bold">{marketStats.h1Avg.toFixed(2)} ★</p>
                      <p className="text-xs text-muted-foreground">{marketStats.h1Count.toLocaleString('pl-PL')} opinii</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">H2 2025</p>
                      <p className="text-2xl font-bold">{marketStats.h2Avg.toFixed(2)} ★</p>
                      <p className="text-xs text-muted-foreground">{marketStats.h2Count.toLocaleString('pl-PL')} opinii</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Market Aspects */}
        <MarketAspectsSection />

        <Separator />

        {/* Price Comparison Q4 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Porównanie cen katalogowych Q4 2025
          </h2>
          
          {isLoadingPrices ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          ) : priceData && priceData.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={Math.max(400, priceData.length * 35)}>
                  <BarChart 
                    data={priceData} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `${value.toFixed(0)} zł`} />
                    <YAxis type="category" dataKey="brandName" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Średnia cena/dzień']}
                    />
                    <Bar 
                      dataKey="avgPrice" 
                      fill="hsl(38, 92%, 50%)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak danych cenowych dla Q4 2025
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Discount Comparison Q4 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            Analiza rabatów Q4 2025
          </h2>
          
          {isLoadingDiscounts ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          ) : discountData && discountData.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={Math.max(400, discountData.length * 35)}>
                  <BarChart 
                    data={discountData} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `${value.toFixed(0)}%`} />
                    <YAxis type="category" dataKey="brandName" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name, props) => [
                        `${value.toFixed(1)}% (${props.payload.discountCount} kodów)`, 
                        'Średni rabat'
                      ]}
                    />
                    <Bar 
                      dataKey="avgDiscount" 
                      fill="hsl(280, 68%, 50%)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak danych o rabatach dla Q4 2025
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Leaders and Outsiders */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Liderzy i Outsiderzy 2025
          </h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top 5 */}
            <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <ThumbsUp className="h-5 w-5" />
                  Top 5 – Liderzy ({">"}4.5★)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : topBrands.length > 0 ? (
                  <div className="space-y-3">
                    {topBrands.map((brand, idx) => (
                      <div key={brand.brandId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                            {idx + 1}
                          </Badge>
                          <span className="font-medium">{brand.brandName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold">{brand.avgRating.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Brak marek z oceną powyżej 4.5</p>
                )}
              </CardContent>
            </Card>
            
            {/* Bottom 5 */}
            <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Marki do poprawy ({"<"}4.0★)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : bottomBrands.length > 0 ? (
                  <div className="space-y-3">
                    {bottomBrands.map((brand, idx) => (
                      <div key={brand.brandId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 border-red-300">
                            {idx + 1}
                          </Badge>
                          <span className="font-medium">{brand.brandName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold">{brand.avgRating.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Wszystkie marki mają ocenę powyżej 4.0</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Summary and Insights */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Podsumowanie i wnioski
          </h2>
          
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6 space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : (
                <>
                  <p>
                    <strong>Ogólna kondycja rynku:</strong> Rynek cateringu dietetycznego w Polsce charakteryzuje się 
                    wysoką średnią oceną <strong>{marketStats?.avgRating.toFixed(2)}★</strong> przy 
                    <strong> {marketStats?.totalReviews.toLocaleString('pl-PL')}</strong> analizowanych opinii 
                    z <strong>{marketStats?.brandCount}</strong> aktywnych marek.
                  </p>
                  
                  <p>
                    <strong>Sentyment klientów:</strong> {marketStats?.positivePercent.toFixed(1)}% opinii jest pozytywnych (4-5★), 
                    podczas gdy tylko {marketStats?.negativePercent.toFixed(1)}% jest negatywnych (1-2★). 
                    To wskazuje na ogólnie wysoką satysfakcję klientów w branży.
                  </p>
                  
                  {marketStats && marketStats.h1Avg && marketStats.h2Avg && (
                    <p>
                      <strong>Trend 2025:</strong> {marketStats.h2Avg > marketStats.h1Avg ? (
                        <>Obserwujemy poprawę jakości – średnia ocena wzrosła z {marketStats.h1Avg.toFixed(2)}★ (H1) do {marketStats.h2Avg.toFixed(2)}★ (H2).</>
                      ) : marketStats.h2Avg < marketStats.h1Avg ? (
                        <>Widoczny spadek satysfakcji – średnia ocena spadła z {marketStats.h1Avg.toFixed(2)}★ (H1) do {marketStats.h2Avg.toFixed(2)}★ (H2).</>
                      ) : (
                        <>Stabilna jakość usług – średnia ocena utrzymuje się na poziomie {marketStats.h1Avg.toFixed(2)}★.</>
                      )}
                    </p>
                  )}
                  
                  {topBrands.length > 0 && (
                    <p>
                      <strong>Liderzy rynku:</strong> {topBrands.slice(0, 3).map(b => b.brandName).join(', ')} wyróżniają się 
                      najwyższymi ocenami klientów, przekraczając próg 4.5★.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>Raport wygenerowany dynamicznie przez cateringmonitor.pl</p>
          <p>© {new Date().getFullYear()} cateringmonitor.pl – Wszystkie dane pochodzą z rzeczywistych opinii klientów</p>
        </div>
        </div>{/* End PDF Content Container */}
      </main>
    </div>
  );
}
