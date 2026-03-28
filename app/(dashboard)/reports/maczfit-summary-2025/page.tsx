// @ts-nocheck
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, TrendingUp, TrendingDown, Star, MessageSquare, AlertTriangle, Heart, ThumbsUp, ThumbsDown, Calendar, FileDown, Quote, Sparkles, Clock, Target, Percent, DollarSign } from "lucide-react";
import { jsPDF } from "jspdf";
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

// Brand ID for MaczFit
const BRAND_ID = "454bfb1b-7698-4d8b-8652-0f0482c3a792";

const companyInfo = {
  name: "MaczFit",
  brandName: "MaczFit",
  businessType: "Catering dietetyczny",
  voivodeship: "Mazowieckie",
  website: "www.maczfit.pl",
  description: "Jeden z największych graczy na rynku cateringu dietetycznego w Polsce. Oferuje szeroką gamę diet dostosowanych do różnych potrzeb kalorycznych. Wyróżnia się aplikacją mobilną i dużym zasięgiem dostawy (1800+ lokalizacji).",
};

// Sentiment colors for dynamic data
const SENTIMENT_COLORS = {
  positive: "hsl(142, 76%, 36%)",
  neutral: "hsl(48, 96%, 53%)",
  negative: "hsl(0, 84%, 60%)",
};

// Helper to format date from review
function formatReviewDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return format(date, 'LLLL yyyy', { locale: pl });
  } catch {
    return '';
  }
}

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
async function fetchAllReviews(brandId: string, minDate?: Date, maxDate?: Date) {
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
    if (maxDate) {
      query = query.lte('review_date', maxDate.toISOString());
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

export default function MaczFitOpinie() {
  // Calculate last full month dates
  const lastFullMonthEnd = useMemo(() => endOfMonth(subMonths(new Date(), 1)), []);
  const lastFullMonthStart = useMemo(() => startOfMonth(lastFullMonthEnd), []);

  const handleDownloadPDF = () => {
    // "Drukuj do PDF" – używa natywnego dialogu drukowania przeglądarki
    const previousTitle = document.title;
    document.title = `${companyInfo.brandName} - raport`;

    window.print();

    // fallback restore (czasem afterprint nie odpala)
    setTimeout(() => {
      document.title = previousTitle;
    }, 1500);
  };

  // Fetch time period statistics (with pagination for all time)
  const { data: periodStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['maczfit-period-stats', 'v3-last-full-month'],
    queryFn: async () => {
      // Fetch ALL reviews once, then filter by period
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
    queryKey: ['maczfit-monthly-trends', 'v3-full-range'],
    queryFn: async () => {
      // Use helper to fetch ALL reviews with pagination
      const allReviews = await fetchAllReviews(BRAND_ID);
      const reviews = allReviews.filter(r => !!r.review_date);
      if (reviews.length === 0) return [];

      // Group by month
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

      // Build continuous monthly range: from first review month to Dec 2025 (or latest if earlier)
      const minDate = new Date(reviews[0].review_date as string);
      const maxDate = new Date(reviews[reviews.length - 1].review_date as string);

      const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const hardEnd = new Date(2025, 11, 1); // Dec 2025
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
    queryKey: ['maczfit-date-range'],
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

  // Fetch crisis months data (III, V, VI, VIII 2025)
  const { data: crisisMonthsData } = useQuery({
    queryKey: ['maczfit-crisis-months'],
    queryFn: async () => {
      const crisisMonths = ['2025-03', '2025-05', '2025-06', '2025-08'];
      const results: Record<string, { avgRating: number; count: number }> = {};

      for (const month of crisisMonths) {
        const startDate = `${month}-01`;
        const endDate = month === '2025-03' ? '2025-03-31' : 
                        month === '2025-05' ? '2025-05-31' : 
                        month === '2025-06' ? '2025-06-30' : '2025-08-31';

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
    queryKey: ['maczfit-real-quotes'],
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
    queryKey: ['maczfit-discount-comparison-q4'],
    queryFn: async () => {
      const { data: discounts } = await supabase
        .from('discounts')
        .select('brand_id, percentage, brands!inner(name)')
        .gte('valid_from', '2025-10-01')
        .lt('valid_from', '2026-01-01')
        .not('percentage', 'is', null);

      const brandAggregates: Record<string, { sum: number; count: number; name: string }> = {};
      brandAggregates['MaczFit'] = { sum: 0, count: 0, name: 'MaczFit' };

      if (discounts && discounts.length > 0) {
        discounts.forEach((d: any) => {
          const brandName = d.brands?.name || 'Unknown';
          if (!brandAggregates[brandName]) {
            brandAggregates[brandName] = { sum: 0, count: 0, name: brandName };
          }
          brandAggregates[brandName].sum += d.percentage || 0;
          brandAggregates[brandName].count++;
        });
      }

      return Object.values(brandAggregates)
        .map(b => ({
          brand: b.name,
          avgDiscount: b.count > 0 ? parseFloat((b.sum / b.count).toFixed(1)) : 0
        }))
        .sort((a, b) => b.avgDiscount - a.avgDiscount);
    }
  });

  // =====================
  // DYNAMIC DATA: DISCOUNT CODES
  // =====================
  const { data: activeCodes, isLoading: isLoadingCodes } = useQuery({
    queryKey: ['maczfit-discount-codes-q4'],
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
  // DYNAMIC DATA: PRICE COMPARISON
  // =====================
  const { data: priceComparison, isLoading: isLoadingPrices } = useQuery({
    queryKey: ['maczfit-price-comparison-q4'],
    queryFn: async () => {
      const { data: priceData, error } = await supabase
        .from('price_history')
        .select(`
          price,
          date_recorded,
          package_kcal_ranges!fk_price_history_package_kcal_range(
            packages!inner(
              brands!inner(name, id)
            )
          )
        `)
        .gte('date_recorded', '2025-10-01')
        .lte('date_recorded', '2025-12-31')
        .not('price', 'is', null);

      if (error) throw error;
      if (!priceData || priceData.length === 0) return { catalog: [], afterDiscount: [], brandStats: null };

      const brandAggregates: Record<string, { sum: number; count: number; name: string; min: number; max: number }> = {};

      priceData.forEach((p: any) => {
        const brandName = p.package_kcal_ranges?.packages?.brands?.name || 'Unknown';
        if (!brandAggregates[brandName]) {
          brandAggregates[brandName] = { sum: 0, count: 0, name: brandName, min: Infinity, max: -Infinity };
        }
        brandAggregates[brandName].sum += p.price || 0;
        brandAggregates[brandName].count++;
        brandAggregates[brandName].min = Math.min(brandAggregates[brandName].min, p.price || Infinity);
        brandAggregates[brandName].max = Math.max(brandAggregates[brandName].max, p.price || -Infinity);
      });

      const brandStats = brandAggregates['MaczFit'] ? {
        avgPrice: parseFloat((brandAggregates['MaczFit'].sum / brandAggregates['MaczFit'].count).toFixed(2)),
        minPrice: parseFloat(brandAggregates['MaczFit'].min.toFixed(2)),
        maxPrice: parseFloat(brandAggregates['MaczFit'].max.toFixed(2)),
        count: brandAggregates['MaczFit'].count
      } : null;

      const allCatalogPrices = Object.values(brandAggregates)
        .filter(b => b.count > 0)
        .map(b => ({
          brand: b.name,
          avgPrice: parseFloat((b.sum / b.count).toFixed(2))
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);

      const brandEntry = allCatalogPrices.find(p => p.brand === 'MaczFit');
      let catalogPrices = allCatalogPrices.slice(0, 12);
      if (brandEntry && !catalogPrices.some(p => p.brand === 'MaczFit')) {
        catalogPrices = [...catalogPrices.slice(0, 11), brandEntry];
      }

      const discountMap: Record<string, number> = {};
      if (discountComparison) {
        discountComparison.forEach((d: any) => {
          discountMap[d.brand] = d.avgDiscount;
        });
      }

      const afterDiscountPrices = catalogPrices
        .map(p => ({
          brand: p.brand,
          avgPrice: parseFloat((p.avgPrice * (1 - (discountMap[p.brand] || 0) / 100)).toFixed(2))
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);

      return { catalog: catalogPrices, afterDiscount: afterDiscountPrices, brandStats };
    },
    enabled: !!discountComparison
  });

  // MaczFit discount stats
  const maczfitDiscountStats = useMemo(() => {
    if (!activeCodes || activeCodes.length === 0) return { count: 0, avg: 0, min: 0, max: 0 };
    const percentages = activeCodes.filter(c => c.percentage).map(c => c.percentage!);
    if (percentages.length === 0) return { count: 0, avg: 0, min: 0, max: 0 };
    return {
      count: activeCodes.length,
      avg: parseFloat((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1)),
      min: Math.min(...percentages),
      max: Math.max(...percentages)
    };
  }, [activeCodes]);

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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">KRYTYCZNY</Badge>;
      case 'high':
        return <Badge className="bg-orange-500 hover:bg-orange-600">WYSOKI</Badge>;
      case 'medium':
        return <Badge variant="secondary">ŚREDNI</Badge>;
      default:
        return <Badge variant="outline">NISKI</Badge>;
    }
  };

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
              <div className="h-20 w-20 rounded-lg bg-white p-2 flex items-center justify-center shadow-sm">
                <img 
                  src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139797514-fnz11.webp" 
                  alt="MaczFit logo" 
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
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Lider rynku</Badge>
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
          
          {/* Insight Card */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed">
                <strong>MaczFit</strong> jako jeden z największych graczy na rynku zgromadził imponującą bazę{" "}
                <strong>{allTimeStats?.count?.toLocaleString('pl-PL') || '...'}</strong> opinii ze średnią{" "}
                <strong>{allTimeStats?.avgRating || '4.03'}/5</strong>. 
                Rok 2025 przyniósł znaczące wahania - od kryzysu operacyjnego w okresie marzec-sierpień (średnia poniżej 3.0) 
                po spektakularne odbicie jesienią z ocenami przekraczającymi 4.2.
                <span className="text-primary font-semibold"> Kluczowe: marka pokazała zdolność do szybkiego odbicia.</span>
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
                      {allTimeStats?.count?.toLocaleString('pl-PL')} opinii
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
                      {sixMonthStats?.count?.toLocaleString('pl-PL')} opinii
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ostatni kwartał</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-green-600">{quarterStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      odbicie po kryzysie
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{lastFullMonthName}</CardTitle>
                    <Star className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-primary">{monthStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
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
                <CardDescription>Na podstawie {allTimeStats?.count?.toLocaleString('pl-PL') || '6,761'} opinii</CardDescription>
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

            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle>5 największych insightów</CardTitle>
                <CardDescription>Kluczowe wnioski z analizy opinii</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                  <p className="text-sm"><strong>Różnorodność menu</strong> - najczęściej chwalony aspekt, wyróżnik na rynku</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                  <p className="text-sm"><strong>Aplikacja mobilna</strong> - ceniona za wygodę zarządzania dietą</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                  <p className="text-sm"><strong>Realne efekty diety</strong> - klienci chwalą wyniki (redukcja wagi, zdrowie)</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-xs font-bold text-orange-600">4</div>
                  <p className="text-sm"><strong>Kryzys III-VIII 2025:</strong> Problemy operacyjne (logistyka, obsługa)</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-600">5</div>
                  <p className="text-sm"><strong>Odbicie IX-XII 2025:</strong> Spektakularna poprawa do ocen 4.2+</p>
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
                  <Badge className="mb-2 bg-blue-500">OPERACYJNA</Badge>
                  <h4 className="font-semibold mb-1">Wzmocnienie logistyki</h4>
                  <p className="text-sm text-muted-foreground">
                    Backup drivers na okresy wzmożone, monitoring dostaw, szybka eskalacja problemów
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Badge className="mb-2 bg-purple-500">KOMUNIKACYJNA</Badge>
                  <h4 className="font-semibold mb-1">Szybsza obsługa klienta</h4>
                  <p className="text-sm text-muted-foreground">
                    SLA 24h na odpowiedź, proaktywne powiadomienia o opóźnieniach, automatyczne rekompensaty
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Badge className="mb-2 bg-green-500">PRODUKTOWA</Badge>
                  <h4 className="font-semibold mb-1">Większe porcje</h4>
                  <p className="text-sm text-muted-foreground">
                    Rozważenie opcji XL w menu, transparentność gramatury, lepszy stosunek cena/wartość
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 2: Sentyment */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Sentyment i emocje klientów
          </h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* What customers love */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Co klienci kochają
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Różnorodność menu - \"nigdy się nie nudzi\"",
                  "Smak posiłków - \"lepsze niż domowe\"",
                  "Aplikacja mobilna - łatwe zarządzanie",
                  "Efekty diety - realna utrata wagi",
                  "Wygoda - oszczędność czasu na gotowanie",
                  "Elastyczność wyboru dań i dat"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <ThumbsUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* What frustrates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Co ich frustruje
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Brak dostawy bez uprzedzenia",
                  "Długi czas reakcji na reklamacje",
                  "Za małe porcje za wysoką cenę",
                  "Sporadyczne problemy z jakością (świeżość)",
                  "Brak możliwości szybkiej zmiany adresu",
                  "Problemy z rozliczeniem i zwrotami"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <ThumbsDown className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Emotions Timeline - Dynamic based on periods */}
          <Card>
            <CardHeader>
              <CardTitle>Dynamika emocji w czasie</CardTitle>
              <CardDescription>Jak zmieniały się emocje klientów w różnych okresach</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingStats ? (
                  <div className="space-y-3">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <>
                    {[
                      { label: "Cały okres", stats: allTimeStats },
                      { label: "Ostatnie 6 mies.", stats: sixMonthStats },
                      { label: "Ostatni kwartał", stats: quarterStats },
                      { label: "Ostatni miesiąc", stats: monthStats },
                    ].map((item, idx) => {
                      if (!item.stats) return null;
                      const emotion = getEmotionForPeriod(
                        parseFloat(item.stats.avgRating),
                        parseFloat(item.stats.positivePercent),
                        parseFloat(item.stats.negativePercent)
                      );
                      return (
                        <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                          <div className="flex-shrink-0 w-36">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.stats.count?.toLocaleString('pl-PL')} opinii</p>
                          </div>
                          <div className="flex-1 flex gap-4">
                            <Badge variant="outline" className={
                              emotion.type === "positive" ? "border-green-500 text-green-600" :
                              emotion.type === "negative" ? "border-red-500 text-red-600" :
                              "border-blue-500 text-blue-600"
                            }>
                              {emotion.dominant}
                            </Badge>
                            <Badge variant="secondary">{emotion.secondary}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-lg font-bold ${
                              parseFloat(item.stats.avgRating) < 4.0 ? 'text-orange-600' : 'text-green-600'
                            }`}>{item.stats.avgRating}</span>
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              
              <Card className="mt-6 border-l-4 border-l-green-500 bg-green-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Insight:</strong> MaczFit przeszedł dramatyczną transformację w 2025 roku - 
                    od frustracji i rozczarowania w okresie III-VIII do powrotu zaufania i satysfakcji w Q4. 
                    To pokazuje zdolność marki do szybkiego reagowania na kryzysy.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja: Najczęstsze aspekty w opiniach */}
        <ReviewAspectsSection />

        <Separator />

        {/* Sekcja 4: Timeline */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Timeline ocen
          </h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Średnia ocena w czasie</CardTitle>
              <CardDescription>Trend miesięczny od pierwszej opinii do XII 2025</CardDescription>
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
                      <td className="py-3 px-4 text-center">{allTimeStats?.count?.toLocaleString('pl-PL')}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Stabilna reputacja lidera rynku</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Ostatnie 6 mies.</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-green-600">{sixMonthStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{sixMonthStats?.count?.toLocaleString('pl-PL')}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Odbicie dzięki Q4 2025</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Ostatni kwartał</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-green-600">{quarterStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{quarterStats?.count?.toLocaleString('pl-PL')}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Spektakularny powrót formy</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Ostatni miesiąc</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-primary">{monthStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{monthStats?.count?.toLocaleString('pl-PL')}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Stabilizacja na wysokim poziomie</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <Card className="mt-6 border-l-4 border-l-primary bg-primary/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Insight strategiczny:</strong> MaczFit pokazał unikalną zdolność do szybkiej regeneracji. 
                    Po dramatycznym spadku w okresie III-VIII 2025 (średnie poniżej 3.0), marka odbiła do 4.2+ w ciągu 3 miesięcy.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Deep Dive: Miesiące kryzysowe */}
          <Card className="border-2 border-orange-500/30">
            <CardHeader className="bg-orange-500/5">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Deep Dive: Okres kryzysowy (III-VIII 2025)
              </CardTitle>
              <CardDescription>Szczegółowa analiza najtrudniejszych miesięcy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Monthly breakdown */}
              <div>
                <h4 className="font-semibold mb-4">Rozkład miesięczny</h4>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <div className="text-sm text-muted-foreground">Marzec 2025</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {crisisMonthsData?.['2025-03']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-03']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="text-sm text-muted-foreground">Maj 2025</div>
                    <div className="text-2xl font-bold text-red-600">
                      {crisisMonthsData?.['2025-05']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-05']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="text-sm text-muted-foreground">Czerwiec 2025</div>
                    <div className="text-2xl font-bold text-red-600">
                      {crisisMonthsData?.['2025-06']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-06']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <div className="text-sm text-muted-foreground">Sierpień 2025</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {crisisMonthsData?.['2025-08']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-08']?.count || 0} opinii
                    </div>
                  </div>
                </div>
              </div>

              {/* Key issues breakdown */}
              <div>
                <h4 className="font-semibold mb-4">Główne problemy w okresie kryzysowym</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">Logistyka</div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: '50%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-red-600">50%</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">Obsługa klienta</div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: '28%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-orange-600">28%</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">Jakość/porcje</div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: '15%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-yellow-600">15%</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">Inne</div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400" style={{ width: '7%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-muted-foreground">7%</div>
                  </div>
                </div>
              </div>

              {/* Specific complaints */}
              <div>
                <h4 className="font-semibold mb-4">Konkretne skargi klientów</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive" className="text-xs">Logistyka</Badge>
                    </div>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Brak dostaw bez uprzedzenia</li>
                      <li>• Dostawy po godzinach pracy</li>
                      <li>• Brak informacji o opóźnieniach</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-700">Obsługa</Badge>
                    </div>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Brak odpowiedzi na maile tygodniami</li>
                      <li>• Telefon nieodebrany lub zajęty</li>
                      <li>• Brak rekompensaty za problemy</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Positive despite crisis */}
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  Co nadal działało dobrze
                </h4>
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Smak posiłków (85% pozytywnych)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Różnorodność menu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Funkcjonalność aplikacji</span>
                  </div>
                </div>
              </div>

              {/* Strategic insight */}
              <Card className="border-l-4 border-l-orange-500 bg-orange-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Wniosek:</strong> Kryzys III-VIII 2025 miał charakter wyłącznie operacyjny - produkt pozostał wysoko oceniany. 
                    Spadek z 4.0 do 2.7 w ciągu 6 miesięcy wynikał z przeciążenia logistycznego i problemów z obsługą, 
                    nie z jakości oferty. To oznaczało, że <strong>szybka naprawa była możliwa</strong> - co potwierdziło odbicie w IX-XII.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 5: Cytaty */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Quote className="h-6 w-6 text-primary" />
            Cytaty klientów
          </h2>
          
          {/* Positive Quotes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Quote className="h-5 w-5 text-green-500" />
                Cytaty pozytywne
              </CardTitle>
              <CardDescription>Najnowsze opinie zadowolonych klientów</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingQuotes ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : realQuotes?.positive && realQuotes.positive.length > 0 ? (
                realQuotes.positive.slice(0, 6).map((quote, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="italic text-sm mb-2">"{quote.content}"</p>
                    <p className="text-xs text-muted-foreground">{formatReviewDate(quote.review_date)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Brak pozytywnych cytatów do wyświetlenia.</p>
              )}
            </CardContent>
          </Card>

          {/* Negative Quotes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Quote className="h-5 w-5 text-red-500" />
                Cytaty krytyczne
              </CardTitle>
              <CardDescription>Najnowsze opinie niezadowolonych klientów</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingQuotes ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : realQuotes?.negative && realQuotes.negative.length > 0 ? (
                realQuotes.negative.slice(0, 4).map((quote, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-red-500/5 border-l-4 border-l-red-500">
                    <p className="italic text-sm mb-2">"{quote.content}"</p>
                    <p className="text-xs text-muted-foreground">{formatReviewDate(quote.review_date)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Brak negatywnych cytatów do wyświetlenia.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Dlaczego cytaty są ważne?</h4>
              <p className="text-sm text-muted-foreground">
                Cytaty pokazują jak zmienia się narracja klientów, nie tylko liczby. W okresie kryzysu dominowała 
                frustracja procesowa (dostawy, obsługa), ale nadal uznanie dla jakości produktu (smak, różnorodność). 
                W okresie odbudowy widać powrót zaufania. To kluczowy insight: <strong>problem był operacyjny, szybka naprawa była możliwa</strong>.
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 6: Analiza rabatów Q4 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            Analiza rabatów Q4 2025
          </h2>

          {/* Discount stats cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">{maczfitDiscountStats.count}</div>
                <div className="text-sm text-muted-foreground">Aktywnych promocji</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">{maczfitDiscountStats.avg}%</div>
                <div className="text-sm text-muted-foreground">Średni rabat</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">{maczfitDiscountStats.max}%</div>
                <div className="text-sm text-muted-foreground">Maksymalny rabat</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">{maczfitDiscountStats.min}%</div>
                <div className="text-sm text-muted-foreground">Minimalny rabat</div>
              </CardContent>
            </Card>
          </div>

          {/* Discount comparison vs competition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Porównanie rabatów z konkurencją (Q4 2025)
              </CardTitle>
              <CardDescription>Średni rabat oferowany przez marki cateringu dietetycznego</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDiscounts ? (
                <Skeleton className="h-[350px] w-full" />
              ) : discountComparison && discountComparison.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={(() => {
                        const maczfitEntry = discountComparison.find((d: any) => d.brand === 'MaczFit');
                        let chartData = discountComparison.slice(0, 10);
                        if (maczfitEntry && !chartData.some((d: any) => d.brand === 'MaczFit')) {
                          chartData = [...chartData.slice(0, 9), maczfitEntry].sort((a: any, b: any) => b.avgDiscount - a.avgDiscount);
                        }
                        return chartData;
                      })()}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                      <YAxis dataKey="brand" type="category" width={95} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Średni rabat']} />
                      <Bar dataKey="avgDiscount" radius={[0, 4, 4, 0]}>
                        {(() => {
                          const maczfitEntry = discountComparison.find((d: any) => d.brand === 'MaczFit');
                          let chartData = discountComparison.slice(0, 10);
                          if (maczfitEntry && !chartData.some((d: any) => d.brand === 'MaczFit')) {
                            chartData = [...chartData.slice(0, 9), maczfitEntry].sort((a: any, b: any) => b.avgDiscount - a.avgDiscount);
                          }
                          return chartData;
                        })().map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.brand === 'MaczFit' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  Brak danych o rabatach
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key discount codes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Kluczowe kody rabatowe Q4 2025
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCodes ? (
                <Skeleton className="h-32 w-full" />
              ) : activeCodes && activeCodes.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {activeCodes.map((code, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between items-start mb-2">
                        <code className="font-mono font-bold">{code.code || 'Brak kodu'}</code>
                        <Badge variant="secondary">{code.percentage}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {code.description || 'Brak opisu'} | {code.valid_from ? format(new Date(code.valid_from), 'd MMM', { locale: pl }) : '?'} - {code.valid_until ? format(new Date(code.valid_until), 'd MMM', { locale: pl }) : '?'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">Brak kodów rabatowych w Q4 2025</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> MaczFit stosuje <strong>aktywną politykę rabatową</strong> - średni rabat {maczfitDiscountStats.avg}% 
                z maksymalnym rabatem {maczfitDiscountStats.max}%. Ta strategia wspiera model biznesowy marki.
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Sekcja 7: Analiza cen Q4 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Analiza cen Q4 2025
          </h2>

          {/* Price stats cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">{priceComparison?.brandStats?.avgPrice?.toFixed(2) || '...'} zł</div>
                <div className="text-sm text-muted-foreground">Średnia cena katalogowa</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">~{priceComparison?.brandStats ? (priceComparison.brandStats.avgPrice * (1 - maczfitDiscountStats.avg / 100)).toFixed(2) : '...'} zł</div>
                <div className="text-sm text-muted-foreground">Śr. cena po rabacie {maczfitDiscountStats.avg}%</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">{priceComparison?.brandStats?.minPrice?.toFixed(2) || '...'} zł</div>
                <div className="text-sm text-muted-foreground">Cena minimalna</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">{priceComparison?.brandStats?.maxPrice?.toFixed(2) || '...'} zł</div>
                <div className="text-sm text-muted-foreground">Cena maksymalna</div>
              </CardContent>
            </Card>
          </div>

          {/* Price comparison vs competition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Porównanie cen katalogowych z konkurencją (Q4 2025)
              </CardTitle>
              <CardDescription>Średnia cena katalogowa za dzień diety</CardDescription>
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
                      <XAxis type="number" domain={['auto', 'auto']} tickFormatter={(v) => `${v} zł`} />
                      <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Średnia cena']} />
                      <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                        {priceComparison.catalog.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.brand === 'MaczFit' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">Brak danych o cenach</div>
              )}
            </CardContent>
          </Card>

          {/* Price after discount comparison */}
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
                      <XAxis type="number" domain={['auto', 'auto']} tickFormatter={(v) => `${v} zł`} />
                      <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Cena po rabacie']} />
                      <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                        {priceComparison.afterDiscount.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.brand === 'MaczFit' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">Brak danych</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> MaczFit pozycjonuje się w segmencie cenowym ze średnią ceną {priceComparison?.brandStats?.avgPrice?.toFixed(2) || '...'} zł.
                Dzięki polityce rabatowej (śr. {maczfitDiscountStats.avg}%) efektywna cena spada do ~{priceComparison?.brandStats ? (priceComparison.brandStats.avgPrice * (1 - maczfitDiscountStats.avg / 100)).toFixed(2) : '...'} zł.
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

          {/* Timeline of 2025 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Kalendarium roku 2025
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">I-II 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium">Stabilny start roku</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 3.4-3.7 | Stabilna baza klientów | Normalne funkcjonowanie</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-orange-600">III 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-orange-500/5 border-l-4 border-l-orange-500">
                    <p className="text-sm font-medium">Początek problemów</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 2.91 | Pierwsze sygnały problemów logistycznych</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-red-600">V-VI 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-red-500/5 border-l-4 border-l-red-500">
                    <p className="text-sm font-medium">Dno kryzysu</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 2.7-2.8 | Masowe problemy z dostawami | Zawiedziona obsługa klienta</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-orange-600">VII-VIII 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-orange-500/5 border-l-4 border-l-orange-500">
                    <p className="text-sm font-medium">Powolna stabilizacja</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 2.9-3.2 | Pierwsze działania naprawcze | Widoczna poprawa</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">IX 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium">Punkt zwrotny</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.23 | Spektakularny skok jakości | Powrót zaufania klientów</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">X-XII 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium">Stabilizacja na wysokim poziomie</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 3.8-4.2 | Utrzymanie wysokiej jakości | Odbudowana reputacja</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key learnings */}
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
                      <span><strong>Różnorodność menu</strong> - konsekwentnie najlepiej oceniany aspekt</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Smak posiłków</strong> - wysoka jakość produktu</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Aplikacja mobilna</strong> - wygodne zarządzanie dietą</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Zdolność do regeneracji</strong> - szybkie odbicie po kryzysie</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <h4 className="font-semibold mb-2 text-red-700 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4" />
                    Obszary do poprawy
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Skalowalność logistyki</strong> - system nie wytrzymał presji</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Komunikacja kryzysowa</strong> - brak proaktywnego informowania</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Obsługa klienta</strong> - długi czas reakcji na zgłoszenia</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Wielkość porcji</strong> - ciągłe skargi na stosunek cena/wartość</span>
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
                Rok 2025 był testem odporności marki - po dramatycznym kryzysie w H1 nastąpiło spektakularne odbicie w H2. 
                Kluczowe rekomendacje na 2026:
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">🚚</div>
                  <h5 className="font-semibold text-sm mb-1">Logistyka</h5>
                  <p className="text-xs text-muted-foreground">Redundancja floty, monitoring real-time, backup drivers</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">📞</div>
                  <h5 className="font-semibold text-sm mb-1">Obsługa klienta</h5>
                  <p className="text-xs text-muted-foreground">SLA 24h na odpowiedź, automatyczne rekompensaty</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">📊</div>
                  <h5 className="font-semibold text-sm mb-1">Monitoring</h5>
                  <p className="text-xs text-muted-foreground">Wczesne wykrywanie trendów spadkowych w opiniach</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final insight */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Podsumowanie:</strong> MaczFit zebrał {allTimeStats?.count?.toLocaleString('pl-PL') || '...'} opinii 
                ze średnią oceną {allTimeStats?.avgRating || '...'}/5. 
                <strong> Kluczowy insight: marka pokazała unikalną zdolność do szybkiej regeneracji</strong> - 
                po dramatycznym spadku w H1 2025 do ocen poniżej 3.0, w ciągu 3 miesięcy odbiła do 4.2+. 
                Problemy miały charakter operacyjny (logistyka, obsługa), nie produktowy (smak, różnorodność nadal chwalony). 
                To daje solidne podstawy na 2026.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
