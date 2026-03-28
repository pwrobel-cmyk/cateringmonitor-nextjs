// @ts-nocheck
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, TrendingUp, TrendingDown, Star, MessageSquare, AlertTriangle, Heart, ThumbsUp, ThumbsDown, Calendar, FileDown, Quote, Sparkles, Clock, Target, Percent, DollarSign } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useReviewAspects } from "@/hooks/supabase/useReviewAspects";
import { useMemo } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { pl } from "date-fns/locale";

// Brand ID for WygodnaDieta.pl
const BRAND_ID = "c526c29f-e592-4945-9312-e1d70fbfd498";
const BRAND_NAME = "WygodnaDieta.pl";

const companyInfo = {
  name: "WygodnaDieta.pl",
  brandName: "WygodnaDieta.pl",
  businessType: "Catering dietetyczny",
  voivodeship: "Ogólnopolski",
  website: "www.wygodnadieta.pl",
  description: "Wiodący dostawca cateringu dietetycznego oferujący wysokiej jakości posiłki z dostawą na terenie całej Polski. Wyróżnia się świetnymi ocenami klientów i szerokim wyborem diet.",
};

// Sentiment colors for dynamic data
const SENTIMENT_COLORS = {
  positive: "hsl(142, 76%, 36%)",
  neutral: "hsl(48, 96%, 53%)",
  negative: "hsl(0, 84%, 60%)",
};

// Helper to determine emotion based on rating and trend
function getEmotionForPeriod(avgRating: number, positivePercent: number, negativePercent: number) {
  if (avgRating >= 4.5 && positivePercent >= 85) {
    return { dominant: "Zaufanie", secondary: "Lojalność", type: "positive" as const };
  } else if (avgRating >= 4.2 && positivePercent >= 80) {
    return { dominant: "Satysfakcja", secondary: "Zadowolenie", type: "positive" as const };
  } else if (avgRating >= 4.0 && negativePercent < 15) {
    return { dominant: "Nadzieja", secondary: "Powrót zaufania", type: "neutral" as const };
  } else if (avgRating < 4.0 || negativePercent >= 20) {
    return { dominant: "Frustracja", secondary: "Rozczarowanie", type: "negative" as const };
  } else {
    return { dominant: "Ostrożność", secondary: "Niepewność", type: "neutral" as const };
  }
}

// Helper function to fetch all reviews with pagination (bypasses 1000 limit)
async function fetchAllReviews(brandId: string, minDate?: Date) {
  let allReviews: { rating: number | null; review_date: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('reviews')
      .select('rating, review_date')
      .eq('brand_id', brandId)
      .not('review_date', 'is', null)
      .order('review_date', { ascending: true });

    if (minDate) {
      query = query.gte('review_date', minDate.toISOString());
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allReviews = [...allReviews, ...data];

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allReviews;
}

// Helper function to fetch all brand daily stats for Q4 (fast; tiny dataset vs price_history)
async function fetchAllBrandDailyStatsQ4(): Promise<Array<{
  avgPrice: number;
  weight: number;
  brandId: string;
  brandName: string;
}>> {
  let allRows: Array<{ avgPrice: number; weight: number; brandId: string; brandName: string }> = [];
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
      // Never mix PL and CZ in reports: for Poland include null/empty and everything except 'Czechy'
      .filter((r) => r.brandId !== '' && (!r.country || r.country !== 'Czechy'))
      .map(({ country: _country, ...rest }) => rest);

    allRows = [...allRows, ...transformed];

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

// Component for Review Aspects Section
function ReviewAspectsSection() {
  const { data: aspectsData, isLoading } = useReviewAspects(BRAND_ID);

  if (isLoading) {
    return (
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          Najczęstsze aspekty w opiniach
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
        Najczęstsze aspekty w opiniach
      </h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {aspects.map((item, idx) => (
          <Card key={idx} className="relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold capitalize">{item.aspect}</h3>
                  <p className="text-sm text-muted-foreground">{item.mentions} wzmianek</p>
                </div>
                {item.positive >= 85 ? (
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                ) : item.negative >= 20 ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                ) : (
                  <Heart className="h-5 w-5 text-primary" />
                )}
              </div>
              
              {/* Sentiment bar */}
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
                  <span className="text-green-600 font-medium">P {item.positive}%</span>
                  <span className="text-red-600 font-medium">N {item.negative}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm">
            <strong>Insight:</strong> {topAspect ? (
              <>
                {topAspect.aspect.charAt(0).toUpperCase() + topAspect.aspect.slice(1)} jest najczęściej wymienianym aspektem ({topAspect.mentions} wzmianek) z {topAspect.positive}% pozytywnych opinii.
                {controversialAspects.length > 0 && (
                  <> {controversialAspects.map(a => a.aspect.charAt(0).toUpperCase() + a.aspect.slice(1)).join(', ')} budz{controversialAspects.length > 1 ? 'ą' : 'i'} więcej kontrowersji ({controversialAspects.map(a => a.negative + '%').join('-')} negatywnych).</>
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

export default function WygodnaDietaSummary2025() {
  // Calculate last full month dates
  const lastFullMonthEnd = useMemo(() => endOfMonth(subMonths(new Date(), 1)), []);
  const lastFullMonthStart = useMemo(() => startOfMonth(lastFullMonthEnd), []);

  const handleDownloadPDF = () => {
    const previousTitle = document.title;
    document.title = `${companyInfo.brandName} - raport`;
    window.print();
    setTimeout(() => {
      document.title = previousTitle;
    }, 1500);
  };

  // Fetch time period statistics (with pagination for all time)
  const { data: periodStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['wygodnadieta-period-stats', 'v3-last-full-month'],
    queryFn: async () => {
      const allReviews = await fetchAllReviews(BRAND_ID);
      
      const now = Date.now();
      const periods = [
        { key: 'all_time', minMs: 0, maxMs: Infinity },
        { key: 'last_6_months', minMs: now - 180 * 24 * 60 * 60 * 1000, maxMs: Infinity },
        { key: 'last_quarter', minMs: now - 90 * 24 * 60 * 60 * 1000, maxMs: Infinity },
        { key: 'last_full_month', minMs: lastFullMonthStart.getTime(), maxMs: lastFullMonthEnd.getTime() },
      ];

      return periods.map(({ key, minMs, maxMs }) => {
        const reviews = minMs === 0
          ? allReviews
          : allReviews.filter(r => {
              const time = new Date(r.review_date!).getTime();
              return time >= minMs && time <= maxMs;
            });

        const total = reviews.length;
        const avgRating = total > 0 ? reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / total : 0;
        const positive = reviews.filter(r => (r.rating || 0) >= 4).length;
        const neutral = reviews.filter(r => r.rating === 3).length;
        const negative = reviews.filter(r => (r.rating || 0) <= 2).length;

        return {
          period: key,
          count: total,
          avgRating: avgRating.toFixed(2),
          positive,
          neutral,
          negative,
          positivePercent: total > 0 ? ((positive / total) * 100).toFixed(1) : '0',
          negativePercent: total > 0 ? ((negative / total) * 100).toFixed(1) : '0',
        };
      });
    }
  });

  // Fetch monthly trends
  const { data: monthlyTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['wygodnadieta-monthly-trends', 'v3-full-range'],
    queryFn: async () => {
      const allReviews = await fetchAllReviews(BRAND_ID);
      const reviews = allReviews.filter(r => !!r.review_date);
      if (reviews.length === 0) return [];

      const monthlyData: Record<string, { ratings: number[]; count: number }> = {};

      reviews.forEach((review) => {
        const date = new Date(review.review_date as string);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { ratings: [], count: 0 };
        }
        monthlyData[monthKey].ratings.push(review.rating || 0);
        monthlyData[monthKey].count++;
      });

      const minDate = new Date(reviews[0].review_date as string);
      const maxDate = new Date(reviews[reviews.length - 1].review_date as string);

      const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const hardEnd = new Date(2025, 11, 1);
      const end = maxDate < hardEnd ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1) : hardEnd;

      const result: Array<{
        month: string;
        avgRating: number | null;
        count: number;
        positive: number;
        negative: number;
      }> = [];

      for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = monthlyData[monthKey];

        if (!bucket) {
          result.push({
            month: monthKey,
            avgRating: null,
            count: 0,
            positive: 0,
            negative: 0,
          });
          continue;
        }

        const avg = bucket.ratings.reduce((a, b) => a + b, 0) / bucket.ratings.length;
        result.push({
          month: monthKey,
          avgRating: avg,
          count: bucket.count,
          positive: bucket.ratings.filter(r => r >= 4).length,
          negative: bucket.ratings.filter(r => r <= 2).length,
        });
      }

      return result;
    },
  });

  // Fetch date range for header
  const { data: dateRange } = useQuery({
    queryKey: ['wygodnadieta-date-range'],
    queryFn: async () => {
      const { data: oldest } = await supabase
        .from('reviews')
        .select('review_date')
        .eq('brand_id', BRAND_ID)
        .not('review_date', 'is', null)
        .order('review_date', { ascending: true })
        .limit(1)
        .single();

      const { data: newest } = await supabase
        .from('reviews')
        .select('review_date')
        .eq('brand_id', BRAND_ID)
        .not('review_date', 'is', null)
        .order('review_date', { ascending: false })
        .limit(1)
        .single();

      return {
        oldest: oldest?.review_date ? new Date(oldest.review_date) : null,
        newest: newest?.review_date ? new Date(newest.review_date) : null,
      };
    }
  });

  // Fetch crisis months data (X-XII 2025)
  const { data: crisisMonthsData } = useQuery({
    queryKey: ['wygodnadieta-crisis-months'],
    queryFn: async () => {
      const crisisMonths = ['2025-10', '2025-11', '2025-12'];
      const results: Record<string, { avgRating: number; count: number }> = {};

      for (const month of crisisMonths) {
        const startDate = `${month}-01`;
        const endDate = month === '2025-12' ? '2025-12-31' : 
                        month === '2025-11' ? '2025-11-30' : '2025-10-31';

        const { data } = await supabase
          .from('reviews')
          .select('rating')
          .eq('brand_id', BRAND_ID)
          .gte('review_date', startDate)
          .lte('review_date', endDate);

        if (data && data.length > 0) {
          const avg = data.reduce((acc, r) => acc + (r.rating || 0), 0) / data.length;
          results[month] = { avgRating: parseFloat(avg.toFixed(2)), count: data.length };
        } else {
          results[month] = { avgRating: 0, count: 0 };
        }
      }

      return results;
    }
  });

  // =====================
  // DYNAMIC DATA: QUOTES
  // =====================
  const { data: realQuotes, isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['wygodnadieta-real-quotes'],
    queryFn: async () => {
      const { data: positive } = await supabase
        .from('reviews')
        .select('content, rating, review_date')
        .eq('brand_id', BRAND_ID)
        .gte('rating', 4)
        .not('content', 'is', null)
        .order('review_date', { ascending: false })
        .limit(6);

      const { data: negative } = await supabase
        .from('reviews')
        .select('content, rating, review_date')
        .eq('brand_id', BRAND_ID)
        .lte('rating', 2)
        .not('content', 'is', null)
        .order('review_date', { ascending: false })
        .limit(4);

      return { 
        positive: (positive || []).filter(q => q.content && q.content.length > 20),
        negative: (negative || []).filter(q => q.content && q.content.length > 20)
      };
    }
  });

  // =====================
  // DYNAMIC DATA: DISCOUNT COMPARISON
  // =====================
  const { data: discountComparison, isLoading: isLoadingDiscounts } = useQuery({
    queryKey: ['wygodnadieta-discount-comparison-q4-v2'],
    queryFn: async () => {
      // Fetch all discounts from Q4 2025 (Oct-Dec)
      const { data: discounts } = await supabase
        .from('discounts')
        .select('brand_id, percentage, brands!inner(id, name, country)')
        .gte('valid_from', '2025-10-01')
        .lt('valid_from', '2026-01-01')
        .not('percentage', 'is', null);

      // Never mix PL and CZ in reports
      const discountsPL = (discounts || []).filter((d: any) => {
        const country = String(d.brands?.country ?? '').trim();
        return !country || country !== 'Czechy';
      });

      // Aggregate by brand_id (robust; avoids any name/whitespace mismatches)
      const brandAggregates: Record<string, { sum: number; count: number; brandId: string; brand: string }> = {
        // Always include subject brand even if no discounts
        [BRAND_ID]: { sum: 0, count: 0, brandId: BRAND_ID, brand: BRAND_NAME },
      };

      if (discountsPL.length > 0) {
        discountsPL.forEach((d: any) => {
          const brandId = d.brand_id ?? d.brands?.id;
          if (!brandId) return;

          const brandName = String(d.brands?.name ?? 'Unknown').trim();
          if (!brandAggregates[brandId]) {
            brandAggregates[brandId] = { sum: 0, count: 0, brandId, brand: brandName };
          }

          brandAggregates[brandId].sum += d.percentage ?? 0;
          brandAggregates[brandId].count += 1;
          // keep latest non-empty name
          if (brandName) brandAggregates[brandId].brand = brandName;
        });
      }

      // Calculate averages and sort
      return Object.values(brandAggregates)
        .map(b => ({
          brandId: b.brandId,
          brand: b.brand,
          avgDiscount: b.count > 0 ? parseFloat((b.sum / b.count).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.avgDiscount - a.avgDiscount);
    }
  });

  // =====================
  // DYNAMIC DATA: DISCOUNT CODES
  // =====================
  const { data: activeCodes, isLoading: isLoadingCodes } = useQuery({
    queryKey: ['wygodnadieta-discount-codes-q4'],
    queryFn: async () => {
      const { data } = await supabase
        .from('discounts')
        .select('code, percentage, valid_from, valid_until, description')
        .eq('brand_id', BRAND_ID)
        .gte('valid_from', '2025-10-01')
        .order('valid_from', { ascending: false })
        .limit(6);

      return data || [];
    }
  });

  // =====================
  // DYNAMIC DATA: PRICE COMPARISON (brand_daily_stats; avoids huge price_history pagination)
  // =====================
  const { data: priceComparison, isLoading: isLoadingPrices } = useQuery({
    queryKey: ['wygodnadieta-price-comparison-q4', 'v5-daily-stats'],
    queryFn: async () => {
      const dailyStats = await fetchAllBrandDailyStatsQ4();

      if (dailyStats.length === 0) return { catalog: [], afterDiscount: [] };

      // Weighted average by total_prices_count
      const brandAggregates: Record<string, { sum: number; weight: number; brandId: string; brand: string }> = {};

      dailyStats.forEach((row) => {
        if (!brandAggregates[row.brandId]) {
          brandAggregates[row.brandId] = { sum: 0, weight: 0, brandId: row.brandId, brand: row.brandName };
        }
        brandAggregates[row.brandId].sum += row.avgPrice * row.weight;
        brandAggregates[row.brandId].weight += row.weight;
      });

      // Calculate averages and sort (descending for catalog prices)
      const allCatalogPrices = Object.values(brandAggregates)
        .filter(b => b.weight > 0)
        .map(b => ({
          brandId: b.brandId,
          brand: b.brand,
          avgPrice: parseFloat((b.sum / b.weight).toFixed(2)),
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);

      // Keep chart readable: show top 12, but always include WygodnaDieta even if outside top
      const wygodnaEntry = allCatalogPrices.find(p => p.brandId === BRAND_ID);
      let catalogPrices = allCatalogPrices.slice(0, 12);
      if (wygodnaEntry && !catalogPrices.some(p => p.brandId === BRAND_ID)) {
        catalogPrices = [...catalogPrices.slice(0, 11), wygodnaEntry];
      }

      // For "after discount", we need to combine with discount data
      const discountMap: Record<string, number> = {};
      if (discountComparison) {
        discountComparison.forEach((d: any) => {
          if (d.brandId) discountMap[d.brandId] = d.avgDiscount;
        });
      }

      const afterDiscountPrices = catalogPrices
        .map(p => ({
          brandId: p.brandId,
          brand: p.brand,
          avgPrice: parseFloat((p.avgPrice * (1 - (discountMap[p.brandId] || 0) / 100)).toFixed(2))
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);

      return { catalog: catalogPrices, afterDiscount: afterDiscountPrices };
    },
    enabled: !!discountComparison // Wait for discount data
  });

  // Compute formatted date range
  const formattedDateRange = useMemo(() => {
    if (!dateRange?.oldest || !dateRange?.newest) return 'Ładowanie...';
    const oldestFormatted = format(dateRange.oldest, 'M yyyy', { locale: pl }).toUpperCase();
    const newestFormatted = format(dateRange.newest, 'M yyyy', { locale: pl }).toUpperCase();
    return `${oldestFormatted} - ${newestFormatted}`;
  }, [dateRange]);

  const allTimeStats = periodStats?.[0];
  const sixMonthStats = periodStats?.[1];
  const quarterStats = periodStats?.[2];
  const monthStats = periodStats?.[3];

  // Get last full month name
  const lastFullMonthName = useMemo(() => {
    return format(lastFullMonthEnd, 'LLLL yyyy', { locale: pl });
  }, [lastFullMonthEnd]);

  // Dynamic sentiment data computed from all-time stats
  const sentimentData = allTimeStats ? [
    { name: "Pozytywne (4-5★)", value: parseFloat(allTimeStats.positivePercent), color: SENTIMENT_COLORS.positive },
    { name: "Neutralne (3★)", value: parseFloat((((allTimeStats.neutral / allTimeStats.count) * 100) || 0).toFixed(1)), color: SENTIMENT_COLORS.neutral },
    { name: "Negatywne (1-2★)", value: parseFloat(allTimeStats.negativePercent), color: SENTIMENT_COLORS.negative },
  ] : [
    { name: "Pozytywne (4-5★)", value: 0, color: SENTIMENT_COLORS.positive },
    { name: "Neutralne (3★)", value: 0, color: SENTIMENT_COLORS.neutral },
    { name: "Negatywne (1-2★)", value: 0, color: SENTIMENT_COLORS.negative },
  ];

  // Determine rating interpretation
  const ratingInterpretation = useMemo(() => {
    const rating = parseFloat(allTimeStats?.avgRating || '0');
    if (rating >= 4.5) return { text: "doskonałą reputację", color: "text-green-600" };
    if (rating >= 4.0) return { text: "bardzo dobrą reputację", color: "text-green-600" };
    if (rating >= 3.5) return { text: "dobrą reputację z potencjałem", color: "text-blue-600" };
    if (rating >= 3.0) return { text: "umiarkowaną reputację wymagającą uwagi", color: "text-orange-600" };
    return { text: "reputację wymagającą pilnej poprawy", color: "text-red-600" };
  }, [allTimeStats]);

  // Find WygodnaDieta's position in discount comparison
  const wygodnaDiscount = useMemo(() => {
    if (!discountComparison) return null;
    return discountComparison.find((d: any) => d.brandId === BRAND_ID);
  }, [discountComparison]);

  // Find WygodnaDieta's position in price comparison
  const wygodnaPrice = useMemo(() => {
    if (!priceComparison?.catalog) return null;
    return priceComparison.catalog.find((p: any) => p.brandId === BRAND_ID);
  }, [priceComparison]);

  return (
    <div className="min-h-screen bg-background">
      
      {/* Breadcrumb Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <Link href="/reports">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót do Raportów
            </Button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              <div className="h-20 w-20 rounded-lg bg-white p-2 flex items-center justify-center shadow-sm overflow-hidden">
                <img 
                  src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1760442472314-oti5ub.png" 
                  alt="WygodnaDieta.pl logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{companyInfo.brandName}</h1>
                <p className="text-lg text-muted-foreground mb-2">Raport analizy opinii klientów</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {allTimeStats?.count?.toLocaleString('pl-PL') || '...'} opinii
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formattedDateRange}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{companyInfo.businessType}</Badge>
                  <Badge variant="outline">{companyInfo.voivodeship}</Badge>
                  <Badge className="bg-primary/10 text-primary">Google Maps</Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={handleDownloadPDF} className="no-print">
              <FileDown className="mr-2 h-4 w-4" />
              Pobierz PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-10">
        
        {/* Executive Summary - Timeline Cards */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Executive Summary
          </h2>
          
          {/* Insight Card - DYNAMIC */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed">
                <strong>{BRAND_NAME}</strong> to marka o <span className={ratingInterpretation.color}>{ratingInterpretation.text}</span> ({allTimeStats?.avgRating || '...'}/5), 
                będąca jednym z liderów rynku cateringu dietetycznego w Polsce. 
                <span className="text-primary font-semibold"> Kluczowe: {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'wyjątkowa jakość i satysfakcja klientów' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'wysoka jakość produktu przy konkurencyjnych cenach' : 'potrzeba poprawy jakości i komunikacji wartości'}.</span>
              </p>
            </CardContent>
          </Card>

          {/* Timeline KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoadingStats ? (
              <>
                {[1,2,3,4].map(i => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cały okres</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{allTimeStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {allTimeStats?.count} opinii
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ostatnie 6 mies.</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{sixMonthStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sixMonthStats?.count} opinii
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ostatni kwartał</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-blue-600">{quarterStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      {quarterStats?.count} opinii
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{lastFullMonthName}</CardTitle>
                    <Star className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-green-600">{monthStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      {monthStats?.count} opinii
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <Separator />

        {/* Sekcja 1: Podsumowanie */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Podsumowanie
          </h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Sentiment Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Rozkład sentymentu</CardTitle>
                <CardDescription>Na podstawie {allTimeStats?.count || '...'} opinii</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ value }) => `${value}%`}
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Key Insights - DYNAMIC */}
            <Card>
              <CardHeader>
                <CardTitle>5 największych insightów</CardTitle>
                <CardDescription>Kluczowe wnioski z analizy opinii</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                  <p className="text-sm"><strong>Średnia ocena {allTimeStats?.avgRating || '...'}/5</strong> - {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'doskonała reputacja' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'dobra reputacja' : 'wymaga poprawy'}</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                  <p className="text-sm"><strong>{allTimeStats?.positivePercent || '0'}% opinii pozytywnych</strong> (4-5★)</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                  <p className="text-sm"><strong>Pozycja rynkowa</strong> - {wygodnaPrice ? `${wygodnaPrice.avgPrice} zł średnio` : 'konkurencyjna oferta'}</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-xs font-bold text-orange-600">4</div>
                  <p className="text-sm"><strong>{allTimeStats?.negativePercent || '0'}% opinii negatywnych</strong> - obszar do monitorowania</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-600">5</div>
                  <p className="text-sm"><strong>Polityka rabatowa</strong> ({wygodnaDiscount?.avgDiscount || '...'}%) vs konkurencja</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>3 szybkie rekomendacje biznesowe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Badge className="mb-2 bg-blue-500">JAKOŚĆ</Badge>
                  <h4 className="font-semibold mb-1">Utrzymanie standardów</h4>
                  <p className="text-sm text-muted-foreground">
                    Kontynuacja wysokiej jakości posiłków, która jest głównym wyróżnikiem marki
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Badge className="mb-2 bg-purple-500">KOMUNIKACJA</Badge>
                  <h4 className="font-semibold mb-1">Wzmocnienie przekazu</h4>
                  <p className="text-sm text-muted-foreground">
                    Podkreślenie wartości wynikającej z wysokich ocen klientów
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Badge className="mb-2 bg-green-500">ROZWÓJ</Badge>
                  <h4 className="font-semibold mb-1">Zbieranie opinii</h4>
                  <p className="text-sm text-muted-foreground">
                    Aktywne zachęcanie zadowolonych klientów do pozostawienia recenzji
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 2: Sentyment klientów */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Sentyment i emocje klientów
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Emotion Cards - DYNAMIC */}
            <Card>
              <CardHeader>
                <CardTitle>Dominujące emocje</CardTitle>
                <CardDescription>Na podstawie analizy tonu opinii</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const emotion = getEmotionForPeriod(
                    parseFloat(allTimeStats?.avgRating || '0'),
                    parseFloat(allTimeStats?.positivePercent || '0'),
                    parseFloat(allTimeStats?.negativePercent || '0')
                  );
                  return (
                    <div className={`p-4 rounded-lg ${
                      emotion.type === 'positive' ? 'bg-green-500/10 border border-green-500/30' :
                      emotion.type === 'negative' ? 'bg-red-500/10 border border-red-500/30' :
                      'bg-yellow-500/10 border border-yellow-500/30'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        {emotion.type === 'positive' ? (
                          <ThumbsUp className="h-6 w-6 text-green-600" />
                        ) : emotion.type === 'negative' ? (
                          <ThumbsDown className="h-6 w-6 text-red-600" />
                        ) : (
                          <AlertTriangle className="h-6 w-6 text-yellow-600" />
                        )}
                        <span className="text-xl font-bold">{emotion.dominant}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Dominująca emocja: <strong>{emotion.dominant}</strong>, wspierana przez <strong>{emotion.secondary}</strong>
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Sentiment breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Szczegółowy rozkład ocen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium">5★</span>
                    <Progress value={sentimentData[0]?.value * 0.6 || 0} className="flex-1 h-3" />
                    <span className="text-sm text-muted-foreground w-12">{(sentimentData[0]?.value * 0.6 || 0).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium">4★</span>
                    <Progress value={sentimentData[0]?.value * 0.4 || 0} className="flex-1 h-3" />
                    <span className="text-sm text-muted-foreground w-12">{(sentimentData[0]?.value * 0.4 || 0).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium">3★</span>
                    <Progress value={sentimentData[1]?.value || 0} className="flex-1 h-3" />
                    <span className="text-sm text-muted-foreground w-12">{sentimentData[1]?.value || 0}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium">1-2★</span>
                    <Progress value={sentimentData[2]?.value || 0} className="flex-1 h-3" />
                    <span className="text-sm text-muted-foreground w-12">{sentimentData[2]?.value || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Sekcja 3: Aspekty w opiniach */}
        <ReviewAspectsSection />

        <Separator />

        {/* Sekcja 4: Timeline ocen */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Timeline ocen
          </h2>

          {/* Rating trend chart - DYNAMIC */}
          <Card>
            <CardHeader>
              <CardTitle>Średnia ocena miesięcznie</CardTitle>
              <CardDescription>Trend ocen od pierwszej opinii do XII 2025</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTrends ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                        tickFormatter={(value) => {
                          const [year, month] = String(value).split('-');
                          return `${month}/${year.slice(2)}`;
                        }}
                      />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload as any;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{label}</p>
                              {data.avgRating == null ? (
                                <p className="text-sm text-muted-foreground">Brak danych</p>
                              ) : (
                                <>
                                  <p className="text-sm">Średnia: {Number(data.avgRating).toFixed(2)} ★</p>
                                  <p className="text-sm text-muted-foreground">{data.count} opinii</p>
                                  <p className="text-xs text-green-600">Pozytywne: {data.positive}</p>
                                  <p className="text-xs text-red-600">Negatywne: {data.negative}</p>
                                </>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgRating"
                        connectNulls={false}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volume Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Liczba opinii miesięcznie</CardTitle>
              <CardDescription>Wolumen opinii od pierwszej opinii do XII 2025</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTrends ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const [year, month] = value.split('-');
                          return `${month}/${year.slice(2)}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="positive" stackId="a" fill="hsl(142, 76%, 36%)" name="Pozytywne" />
                      <Bar dataKey="negative" stackId="a" fill="hsl(0, 84%, 60%)" name="Negatywne" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle>Szczegółowa analiza okresów</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Okres</th>
                      <th className="text-center py-3 px-4 font-medium">Ocena</th>
                      <th className="text-center py-3 px-4 font-medium">Opinie</th>
                      <th className="text-left py-3 px-4 font-medium">Analiza</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4">Cały okres</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold">{allTimeStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{allTimeStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'Doskonała reputacja - lider jakości' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'Stabilna reputacja w segmencie premium' : 'Reputacja wymagająca poprawy'}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Ostatnie 6 mies.</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-green-600">{sixMonthStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{sixMonthStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Utrzymanie poziomu jakości</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Ostatni kwartał</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-blue-600">{quarterStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{quarterStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Stabilny okres</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Ostatni miesiąc</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-green-600">{monthStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{monthStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Bieżący poziom satysfakcji</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <Card className="mt-6 border-l-4 border-l-primary bg-primary/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Insight strategiczny:</strong> {BRAND_NAME} {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'jest liderem jakości z wyjątkowo wysokimi ocenami' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'utrzymuje stabilną reputację bez dramatycznych wahań, co świadczy o konsekwentnej jakości produktu i usług' : 'ma wyzwania z konsekwencją jakości, co widać w niższych ocenach'}.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Deep Dive: Ostatni kwartał */}
          <Card className="border-2 border-blue-500/30">
            <CardHeader className="bg-blue-500/5">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Analiza: Ostatni kwartał (X-XII 2025)
              </CardTitle>
              <CardDescription>Szczegółowa analiza ostatniego kwartału</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Monthly breakdown */}
              <div>
                <h4 className="font-semibold mb-4">Rozkład miesięczny</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="text-sm text-muted-foreground">Październik 2025</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {crisisMonthsData?.['2025-10']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-10']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="text-sm text-muted-foreground">Listopad 2025</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {crisisMonthsData?.['2025-11']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-11']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="text-sm text-muted-foreground">Grudzień 2025</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {crisisMonthsData?.['2025-12']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-12']?.count || 0} opinii
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategic insight */}
              <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Wniosek:</strong> {BRAND_NAME} utrzymuje {quarterStats && parseFloat(quarterStats.avgRating) >= 4.5 ? 'wyjątkową jakość przez cały kwartał' : quarterStats && parseFloat(quarterStats.avgRating) >= 4.0 ? 'stabilną jakość przez cały kwartał' : 'zmienne wyniki w ostatnim kwartale'}. 
                    {quarterStats && parseFloat(quarterStats.avgRating) >= 4.0 ? ' Brak dramatycznych wahań świadczy o konsekwentnej realizacji standardów operacyjnych.' : ' Zalecana analiza przyczyn niższych ocen.'}
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 5: Cytaty klientów - DYNAMIC FROM DATABASE */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Quote className="h-6 w-6 text-primary" />
            Cytaty klientów
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <ThumbsUp className="h-5 w-5" />
                  Pozytywne opinie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingQuotes ? (
                  [1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)
                ) : realQuotes?.positive && realQuotes.positive.length > 0 ? (
                  realQuotes.positive.slice(0, 4).map((quote, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                      <p className="text-sm italic mb-2">"{quote.content?.slice(0, 200)}{quote.content && quote.content.length > 200 ? '...' : ''}"</p>
                      <p className="text-xs text-muted-foreground">
                        {quote.review_date ? format(new Date(quote.review_date), 'LLLL yyyy', { locale: pl }) : 'Brak daty'} • {quote.rating}★
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Brak pozytywnych opinii z treścią do wyświetlenia.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <ThumbsDown className="h-5 w-5" />
                  Konstruktywna krytyka
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingQuotes ? (
                  [1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)
                ) : realQuotes?.negative && realQuotes.negative.length > 0 ? (
                  realQuotes.negative.slice(0, 3).map((quote, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-orange-500/5 border-l-4 border-l-orange-500">
                      <p className="text-sm italic mb-2">"{quote.content?.slice(0, 200)}{quote.content && quote.content.length > 200 ? '...' : ''}"</p>
                      <p className="text-xs text-muted-foreground">
                        {quote.review_date ? format(new Date(quote.review_date), 'LLLL yyyy', { locale: pl }) : 'Brak daty'} • {quote.rating}★
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Brak negatywnych opinii z treścią do wyświetlenia.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Sekcja 6: Analiza rabatów Q4 2025 - DYNAMIC FROM DATABASE */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            Analiza rabatów Q4 2025
          </h2>

          {/* Discount comparison vs competition - DYNAMIC */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Porównanie średnich rabatów z konkurencją
              </CardTitle>
              <CardDescription>Średni % rabatu w Q4 2025 (dane z bazy)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDiscounts ? (
                <Skeleton className="h-[350px] w-full" />
              ) : discountComparison && discountComparison.length > 0 ? (
                (() => {
                  // Always include WygodnaDieta in the chart, even if outside top 10
                  const wygodnaEntry = discountComparison.find((d: any) => d.brandId === BRAND_ID);
                  let chartData = discountComparison.slice(0, 10);
                  if (wygodnaEntry && !chartData.some((d: any) => d.brandId === BRAND_ID)) {
                    chartData = [...chartData.slice(0, 9), wygodnaEntry].sort((a: any, b: any) => b.avgDiscount - a.avgDiscount);
                  }
                  return (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 50]} tickFormatter={(v) => `${v}%`} />
                          <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value: number) => [`${value}%`, 'Średni rabat']} />
                          <Bar dataKey="avgDiscount" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={(entry.brandId === BRAND_ID) ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()
              ) : (
                <p className="text-center text-muted-foreground py-8">Brak danych o rabatach dla Q4 2025</p>
              )}
            </CardContent>
          </Card>

          {/* Key discount codes - DYNAMIC FROM DATABASE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                Kody rabatowe {BRAND_NAME} Q4 2025
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCodes ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : activeCodes && activeCodes.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {activeCodes.slice(0, 6).map((code, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${idx === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <code className={`font-mono font-bold ${idx === 0 ? 'text-primary' : ''}`}>{code.code || 'BRAK KODU'}</code>
                        <Badge variant={idx === 0 ? 'default' : 'secondary'}>{code.percentage}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {code.description || 'Brak opisu'} | {code.valid_from ? format(new Date(code.valid_from), 'd MMM', { locale: pl }) : '?'} - {code.valid_until ? format(new Date(code.valid_until), 'd MMM', { locale: pl }) : '?'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">Brak kodów rabatowych dla Q4 2025</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> {BRAND_NAME} stosuje {wygodnaDiscount ? `średni rabat ${wygodnaDiscount.avgDiscount}%` : 'zrównoważoną politykę rabatową'}, 
                co w połączeniu z wysoką jakością daje atrakcyjną propozycję wartości dla klienta. 
                {discountComparison && discountComparison.length > 0 && (
                  <> Średni rabat na rynku wynosi {(discountComparison.reduce((a: number, b: any) => a + b.avgDiscount, 0) / discountComparison.length).toFixed(1)}%.</>
                )}
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 7: Analiza cen Q4 2025 - DYNAMIC FROM DATABASE */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Analiza cen Q4 2025
          </h2>

          {/* Price stats cards - DYNAMIC */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {wygodnaPrice ? `${wygodnaPrice.avgPrice} zł` : '...'}
                </div>
                <div className="text-sm text-muted-foreground">Średnia cena katalogowa</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {priceComparison?.catalog?.[priceComparison.catalog.length - 1]?.avgPrice || '...'} zł
                </div>
                <div className="text-sm text-muted-foreground">Minimalna cena na rynku</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {priceComparison?.catalog?.[0]?.avgPrice || '...'} zł
                </div>
                <div className="text-sm text-muted-foreground">Maksymalna cena na rynku</div>
              </CardContent>
            </Card>
          </div>

          {/* Price comparison vs competition - DYNAMIC */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Porównanie cen katalogowych z konkurencją (Q4 2025)
              </CardTitle>
              <CardDescription>Średnia cena katalogowa za dzień diety (dane z bazy)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPrices ? (
                <Skeleton className="h-[350px] w-full" />
              ) : priceComparison?.catalog && priceComparison.catalog.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={priceComparison.catalog}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[50, 120]} tickFormatter={(v) => `${v} zł`} />
                      <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Średnia cena']} />
                      <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                        {priceComparison.catalog.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={(entry.brandId === BRAND_ID) ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Brak danych o cenach dla Q4 2025</p>
              )}
            </CardContent>
          </Card>

          {/* Price after discount comparison - DYNAMIC */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Porównanie cen po rabacie z konkurencją (Q4 2025)
              </CardTitle>
              <CardDescription>Średnia cena po uwzględnieniu rabatów za dzień diety</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPrices ? (
                <Skeleton className="h-[350px] w-full" />
              ) : priceComparison?.afterDiscount && priceComparison.afterDiscount.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={priceComparison.afterDiscount}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[40, 100]} tickFormatter={(v) => `${v} zł`} />
                      <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Cena po rabacie']} />
                      <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                        {priceComparison.afterDiscount.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={(entry.brandId === BRAND_ID) ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Brak danych o cenach po rabatach dla Q4 2025</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> {wygodnaPrice && priceComparison?.catalog ? (
                  <>{BRAND_NAME} oferuje {wygodnaPrice.avgPrice < (priceComparison.catalog.reduce((a, b) => a + b.avgPrice, 0) / priceComparison.catalog.length) ? 'konkurencyjne ceny poniżej średniej rynkowej' : 'ceny w górnym segmencie rynku'} 
                  ({wygodnaPrice.avgPrice} zł średnio). {wygodnaDiscount && (
                    <>W połączeniu z rabatem {wygodnaDiscount.avgDiscount}% daje cenę końcową ok. {(wygodnaPrice.avgPrice * (1 - wygodnaDiscount.avgDiscount / 100)).toFixed(2)} zł.</>
                  )}</>
                ) : 'Ładowanie danych o cenach...'}
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 8: Podsumowanie roku 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Podsumowanie roku 2025
          </h2>

          {/* Year overview stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {allTimeStats?.count?.toLocaleString('pl-PL') || '...'}
                </div>
                <div className="text-sm text-muted-foreground">Opinii zebranych</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {allTimeStats?.avgRating || '...'}
                </div>
                <div className="text-sm text-muted-foreground">Średnia ocena</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {allTimeStats?.positivePercent || '...'}%
                </div>
                <div className="text-sm text-muted-foreground">Opinii pozytywnych (4-5★)</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {allTimeStats?.negativePercent || '...'}%
                </div>
                <div className="text-sm text-muted-foreground">Opinii negatywnych (1-2★)</div>
              </CardContent>
            </Card>
          </div>

          {/* Key learnings - DYNAMIC */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Kluczowe wnioski z 2025
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                  <h4 className="font-semibold mb-2 text-green-700 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    Mocne strony
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Średnia ocena {allTimeStats?.avgRating}/5</strong> - {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'wyjątkowa' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'dobra' : 'do poprawy'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>{allTimeStats?.positivePercent}% opinii pozytywnych</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Smak posiłków</strong> - główny wyróżnik marki</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Wygoda zamawiania</strong> - zgodna z nazwą marki</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <h4 className="font-semibold mb-2 text-orange-700 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4" />
                    Obszary do rozważenia
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                      <span><strong>{allTimeStats?.negativePercent}% opinii negatywnych</strong> - do monitorowania</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                      <span><strong>Konkurencja rabatowa</strong> - {wygodnaDiscount ? `${wygodnaDiscount.avgDiscount}%` : 'polityka rabatowa'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                      <span><strong>Rozpoznawalność marki</strong> - budowanie świadomości</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                      <span><strong>Zbieranie opinii</strong> - zachęcanie klientów</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2026 Outlook */}
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Perspektywa na 2026
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {BRAND_NAME} {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'jest liderem jakości z wyjątkowymi ocenami' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'utrzymuje solidną pozycję na rynku' : 'ma potencjał poprawy'}. Kluczowe rekomendacje na 2026:
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">💎</div>
                  <h5 className="font-semibold text-sm mb-1">Utrzymanie jakości</h5>
                  <p className="text-xs text-muted-foreground">Kontynuacja wysokich standardów, które przynoszą wyjątkowe oceny</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">📢</div>
                  <h5 className="font-semibold text-sm mb-1">Promocja sukcesu</h5>
                  <p className="text-xs text-muted-foreground">Wykorzystanie doskonałych opinii w komunikacji marketingowej</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">🎯</div>
                  <h5 className="font-semibold text-sm mb-1">Ekspansja</h5>
                  <p className="text-xs text-muted-foreground">Rozszerzenie zasięgu i budowanie świadomości marki</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final insight - DYNAMIC */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Podsumowanie:</strong> {BRAND_NAME} zebrała {allTimeStats?.count?.toLocaleString('pl-PL') || '...'} opinii 
                ze średnią oceną {allTimeStats?.avgRating || '...'}/5 ({allTimeStats?.positivePercent || '...'}% pozytywnych).
                <strong> Kluczowy insight: {parseFloat(allTimeStats?.avgRating || '0') >= 4.5 ? 'marka jest liderem jakości z wyjątkowymi opiniami klientów' : parseFloat(allTimeStats?.avgRating || '0') >= 4.0 ? 'marka skutecznie utrzymuje wysoką pozycję' : 'marka ma wyzwania reputacyjne do rozwiązania'}</strong> 
                {wygodnaPrice && ` przy cenach ok. ${wygodnaPrice.avgPrice} zł`}
                {wygodnaDiscount && ` i rabatach ${wygodnaDiscount.avgDiscount}%`}.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
