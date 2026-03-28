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

// Brand ID for Nice To Fit You
const BRAND_ID = "212788b3-6ce1-4b4b-9f55-5e908c1a4d2a";

const companyInfo = {
  name: "Nice To Fit You",
  brandName: "Nice To Fit You",
  businessType: "Catering dietetyczny",
  voivodeship: "Mazowieckie",
  website: "www.nicetofityou.pl",
  description: "Jeden z liderów rynku cateringu dietetycznego w Polsce. Wyróżnia się możliwością samodzielnego wyboru dań z szerokiego menu (Select, Foodie). Oferuje diety dopasowane do indywidualnych potrzeb kalorycznych i smakowych.",
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

export default function NiceToFitYou() {
  // Calculate last full month dates
  const lastFullMonthEnd = useMemo(() => endOfMonth(subMonths(new Date(), 1)), []);
  const lastFullMonthStart = useMemo(() => startOfMonth(lastFullMonthEnd), []);

  const handleDownloadPDF = () => {
    // "Drukuj do PDF" – używa natywnego dialogu drukowania przeglądarki
    const previousTitle = document.title;
    document.title = `${companyInfo.brandName} - raport`;

    window.print();

    setTimeout(() => {
      document.title = previousTitle;
    }, 1500);
  };

  // Fetch time period statistics (with pagination for all time)
  const { data: periodStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['ntfy-period-stats', 'v3-last-full-month'],
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
    queryKey: ['ntfy-monthly-trends', 'v3-full-range'],
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
    queryKey: ['ntfy-date-range'],
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
    queryKey: ['ntfy-crisis-months'],
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
    queryKey: ['ntfy-real-quotes'],
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
    queryKey: ['ntfy-discount-comparison-q4'],
    queryFn: async () => {
      const { data: discounts } = await supabase
        .from('discounts')
        .select('brand_id, percentage, brands!inner(name)')
        .gte('valid_from', '2025-10-01')
        .lt('valid_from', '2026-01-01')
        .not('percentage', 'is', null);

      const brandAggregates: Record<string, { sum: number; count: number; name: string }> = {};
      brandAggregates['Nice To Fit You'] = { sum: 0, count: 0, name: 'Nice To Fit You' };

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
    queryKey: ['ntfy-discount-codes-q4'],
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
    queryKey: ['ntfy-price-comparison-q4'],
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

      const brandStats = brandAggregates['Nice To Fit You'] ? {
        avgPrice: parseFloat((brandAggregates['Nice To Fit You'].sum / brandAggregates['Nice To Fit You'].count).toFixed(2)),
        minPrice: parseFloat(brandAggregates['Nice To Fit You'].min.toFixed(2)),
        maxPrice: parseFloat(brandAggregates['Nice To Fit You'].max.toFixed(2)),
        count: brandAggregates['Nice To Fit You'].count
      } : null;

      const allCatalogPrices = Object.values(brandAggregates)
        .filter(b => b.count > 0)
        .map(b => ({
          brand: b.name,
          avgPrice: parseFloat((b.sum / b.count).toFixed(2))
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);

      const brandEntry = allCatalogPrices.find(p => p.brand === 'Nice To Fit You');
      let catalogPrices = allCatalogPrices.slice(0, 12);
      if (brandEntry && !catalogPrices.some(p => p.brand === 'Nice To Fit You')) {
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

  // NTFY discount stats
  const ntfyDiscountStats = useMemo(() => {
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
                  src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759140707213-cp0u18.png" 
                  alt="Nice To Fit You logo" 
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
          
          {/* Insight Card */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed">
                <strong>Nice To Fit You</strong> to marka o stabilnej, wysokiej reputacji ({allTimeStats?.avgRating || '4.50'}/5), 
                która w ostatnich miesiącach doświadcza punktowych problemów operacyjnych 
                (spadek do {monthStats?.avgRating || '4.10'} w ostatnim miesiącu). 
                <span className="text-primary font-semibold"> Kluczowe: klienci krytykują procesy, nie produkt.</span>
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

                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ostatni kwartał</CardTitle>
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-orange-600">{quarterStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      spadek vs 6 mies.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{lastFullMonthName}</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-red-600">{monthStats?.avgRating}</span>
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    </div>
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
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
                <CardDescription>Na podstawie {allTimeStats?.count || '2,291'} opinii</CardDescription>
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
                  <p className="text-sm"><strong>Smak to główny wyróżnik</strong> - powtarzający się motyw "lepsze niż w restauracji"</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                  <p className="text-sm"><strong>Możliwość wyboru menu</strong> (Select/Foodie) to unikalne USP na rynku</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                  <p className="text-sm"><strong>Realne efekty zdrowotne</strong> (cholesterol, utrata wagi) budują lojalność</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-xs font-bold text-orange-600">4</div>
                  <p className="text-sm"><strong>Insight czasowy:</strong> Trend zmienia się w zależności od sezonu - sprawdź wykres poniżej</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-600">5</div>
                  <p className="text-sm"><strong>Problemy logistyczne i obsługi</strong> dominują w negatywnych opiniach</p>
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
                  <h4 className="font-semibold mb-1">Audyt logistyki dostaw</h4>
                  <p className="text-sm text-muted-foreground">
                    Wdrożyć tracking w czasie rzeczywistym, system weryfikacji zdjęć dostawy, szkolenie kurierów
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Badge className="mb-2 bg-purple-500">KOMUNIKACYJNA</Badge>
                  <h4 className="font-semibold mb-1">Rewizja procesu reklamacji</h4>
                  <p className="text-sm text-muted-foreground">
                    SLA na odpowiedź 24h, automatyczne rekompensaty, proaktywna komunikacja
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Badge className="mb-2 bg-green-500">E-COMMERCE</Badge>
                  <h4 className="font-semibold mb-1">Udoskonalenie aplikacji</h4>
                  <p className="text-sm text-muted-foreground">
                    Możliwość zmiany adresu/daty, lepsza historia zamówień, waga porcji
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
                  "Smak posiłków - \"pyszne\", \"lepsze niż w restauracji\"",
                  "Różnorodność i możliwość wyboru dań",
                  "Widoczne efekty zdrowotne (cholesterol, waga)",
                  "Wygoda i oszczędność czasu",
                  "Estetyka podania posiłków",
                  "Aplikacja mobilna do zarządzania"
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
                  "Brak reakcji na reklamacje",
                  "Problemy z dostawami (spóźnienia, kradzieże)",
                  "Niespójna jakość w okresach szczytowych",
                  "\"Zapychacze\" w dietach (olej, śmietana)",
                  "Ukryty cukier w posiłkach (do 77g!)",
                  "Ograniczenia aplikacji (zmiana adresu/daty)"
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
                            <p className="text-xs text-muted-foreground">{item.stats.count} opinii</p>
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
                              parseFloat(item.stats.avgRating) < 4.2 ? 'text-orange-600' : ''
                            }`}>{item.stats.avgRating}</span>
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              
              <Card className="mt-6 border-l-4 border-l-orange-500 bg-orange-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Insight:</strong> W okresie spadku ocen rośnie frustracja i rozczarowanie, 
                    ale emocje nie uderzają w produkt, tylko w doświadczenie zakupowe (dostawa, obsługa, aplikacja).
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
                      <td className="py-3 px-4 text-center">{allTimeStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Stabilna, wysoka reputacja</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Ostatnie 6 mies.</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-green-600">{sixMonthStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{sixMonthStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Wzrost dzięki IX 2025 (4.85)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Ostatni kwartał</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-orange-600">{quarterStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{quarterStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Spadek - problemy logistyczne</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Ostatni miesiąc</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-red-600">{monthStats?.avgRating}</span> ★
                      </td>
                      <td className="py-3 px-4 text-center">{monthStats?.count}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">Świąteczny kryzys operacyjny</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <Card className="mt-6 border-l-4 border-l-primary bg-primary/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Insight strategiczny:</strong> Marka wykazuje sezonowe wahania związane z obciążeniem operacyjnym. 
                    Analiza trendów pokazuje potencjał wzrostu oraz wyzwania skalowania w okresach szczytowych.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Deep Dive: Ostatni kwartał */}
          <Card className="border-2 border-orange-500/30">
            <CardHeader className="bg-orange-500/5">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Deep Dive: Ostatni kwartał (X-XII 2025)
              </CardTitle>
              <CardDescription>Szczegółowa analiza okresu kryzysowego</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Monthly breakdown */}
              <div>
                <h4 className="font-semibold mb-4">Rozkład miesięczny</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="text-sm text-muted-foreground">Październik 2025</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {crisisMonthsData?.['2025-10']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-10']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <div className="text-sm text-muted-foreground">Listopad 2025</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {crisisMonthsData?.['2025-11']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-11']?.count || 0} opinii
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="text-sm text-muted-foreground">Grudzień 2025</div>
                    <div className="text-2xl font-bold text-red-600">
                      {crisisMonthsData?.['2025-12']?.avgRating?.toFixed(2) || '...'} ★
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {crisisMonthsData?.['2025-12']?.count || 0} opinii
                    </div>
                  </div>
                </div>
              </div>

              {/* Key issues breakdown */}
              <div>
                <h4 className="font-semibold mb-4">Główne problemy w kwartale</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">Logistyka</div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: '45%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-red-600">45%</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">Obsługa klienta</div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: '30%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-orange-600">30%</div>
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
                        <div className="h-full bg-gray-400" style={{ width: '10%' }} />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right font-medium text-muted-foreground">10%</div>
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
                      <li>• Opóźnienia w dostawach (szczególnie XII)</li>
                      <li>• Brak dostaw bez uprzedzenia</li>
                      <li>• Problemy z komunikacją kurierów</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-700">Obsługa</Badge>
                    </div>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Brak reakcji na zgłoszenia</li>
                      <li>• Długi czas oczekiwania na odpowiedź</li>
                      <li>• Brak przeprosin i rekompensaty</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Positive despite crisis */}
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  Co nadal działa dobrze
                </h4>
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Smak posiłków (88% pozytywnych)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Różnorodność menu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Funkcjonalność aplikacji Select</span>
                  </div>
                </div>
              </div>

              {/* Strategic insight */}
              <Card className="border-l-4 border-l-orange-500 bg-orange-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Wniosek:</strong> Kryzys Q4 2025 ma charakter wyłącznie operacyjny - produkt pozostaje wysoko oceniany. 
                    Spadek z 4.32 do 3.90 w ciągu 3 miesięcy (-0.42 pkt) wynika z przeciążenia logistycznego w sezonie świątecznym, 
                    nie z problemów z jakością oferty. To oznacza, że <strong>naprawa jest możliwa bez zmiany produktu</strong>.
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
                Cytaty pokazują jak zmienia się narracja klientów, nie tylko liczby. W okresie stabilnym dominuje 
                lojalność i długoterminowe relacje. W okresie spadku - frustracja procesowa, ale nadal uznanie 
                dla jakości produktu. To kluczowy insight: <strong>problem jest operacyjny, nie wizerunkowy</strong>.
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

          {/* NTFY Discounts Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">25</div>
                <div className="text-sm text-muted-foreground">Aktywnych promocji</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">22.6%</div>
                <div className="text-sm text-muted-foreground">Średni rabat</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">33%</div>
                <div className="text-sm text-muted-foreground">Maksymalny rabat</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">18%</div>
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
              <CardDescription>Średni rabat procentowy wśród głównych graczy rynku</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { brand: 'Gastropaczka', avgDiscount: 34.5, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'MaczFit', avgDiscount: 30.1, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Kuchnia Vikinga', avgDiscount: 26.3, fill: 'hsl(var(--muted-foreground))' },
                      { brand: '5 Posiłków', avgDiscount: 26.0, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'BodyChief', avgDiscount: 24.3, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Pomelo', avgDiscount: 23.3, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Nice To Fit You', avgDiscount: 22.6, fill: 'hsl(var(--primary))' },
                    ]}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 40]} tickFormatter={(v) => `${v}%`} />
                    <YAxis dataKey="brand" type="category" width={95} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Średni rabat']} />
                    <Bar dataKey="avgDiscount" radius={[0, 4, 4, 0]}>
                      {[
                        { brand: 'Gastropaczka', avgDiscount: 34.5 },
                        { brand: 'MaczFit', avgDiscount: 30.1 },
                        { brand: 'Kuchnia Vikinga', avgDiscount: 26.3 },
                        { brand: '5 Posiłków', avgDiscount: 26.0 },
                        { brand: 'BodyChief', avgDiscount: 24.3 },
                        { brand: 'Pomelo', avgDiscount: 23.3 },
                        { brand: 'Nice To Fit You', avgDiscount: 22.6 },
                      ].map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.brand === 'Nice To Fit You' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Key discount codes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                Główne kody rabatowe Q4 2025
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold text-primary">BW33</code>
                    <Badge variant="default">33%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Black Week | 25-30 XI</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">CM30</code>
                    <Badge variant="secondary">30%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Cyber Monday | 30 XI - 1 XII</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">BLACKWEEK25</code>
                    <Badge variant="secondary">25%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Black Week | 25-30 XI</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">NOWYROK25</code>
                    <Badge variant="secondary">25%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Sylwester/Nowy Rok | 26 XII - 11 I</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">TRADYCJA</code>
                    <Badge variant="secondary">23%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Listopad | 16-20 XI</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">PSIKUS22</code>
                    <Badge variant="secondary">22%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Halloween | 23 X - 2 XI</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> Nice To Fit You stosuje <strong>konserwatywną politykę rabatową</strong> - średni rabat 22.6% 
                to najniższa wartość wśród głównych konkurentów. Dla porównania: Gastropaczka oferuje średnio 34.5%, a MaczFit 30.1%. 
                Ta strategia pozwala utrzymać wyższą marżę, ale może ograniczać atrakcyjność cenową dla klientów poszukujących okazji.
                Marka stawia na wartość produktu zamiast konkurować ceną.
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

          {/* NTFY Price Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">92.91 zł</div>
                <div className="text-sm text-muted-foreground">Średnia cena katalogowa</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">71.93 zł</div>
                <div className="text-sm text-muted-foreground">Średnia po rabacie*</div>
                <div className="text-xs text-muted-foreground mt-1">*przy śr. rabacie 22.6%</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">59.99 zł</div>
                <div className="text-sm text-muted-foreground">Minimalna cena</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">124.29 zł</div>
                <div className="text-sm text-muted-foreground">Maksymalna cena</div>
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
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { brand: 'SuperMenu NEW 25', avgPrice: 95.58, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Nice To Fit You', avgPrice: 92.91, fill: 'hsl(var(--primary))' },
                      { brand: 'MaczFit', avgPrice: 92.73, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'FitApetit', avgPrice: 92.58, fill: 'hsl(var(--muted-foreground))' },
                      { brand: '5 Posiłków', avgPrice: 92.16, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Zdrowa Szama', avgPrice: 91.15, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'TIM Catering', avgPrice: 86.01, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Pomelo', avgPrice: 84.77, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'BodyChief', avgPrice: 80.37, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Gastropaczka', avgPrice: 80.11, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Kuchnia Vikinga', avgPrice: 79.21, fill: 'hsl(var(--muted-foreground))' },
                    ]}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[70, 100]} tickFormatter={(v) => `${v} zł`} />
                    <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Średnia cena']} />
                    <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                      {[
                        { brand: 'SuperMenu NEW 25' },
                        { brand: 'Nice To Fit You' },
                        { brand: 'MaczFit' },
                        { brand: 'FitApetit' },
                        { brand: '5 Posiłków' },
                        { brand: 'Zdrowa Szama' },
                        { brand: 'TIM Catering' },
                        { brand: 'Pomelo' },
                        { brand: 'BodyChief' },
                        { brand: 'Gastropaczka' },
                        { brand: 'Kuchnia Vikinga' },
                      ].map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.brand === 'Nice To Fit You' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Price after discount comparison vs competition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Porównanie cen po rabacie z konkurencją (Q4 2025)
              </CardTitle>
              <CardDescription>Średnia cena po uwzględnieniu rabatów za dzień diety</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { brand: 'SuperMenu NEW 25', avgPrice: 81.24, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'FitApetit', avgPrice: 74.06, fill: 'hsl(var(--muted-foreground))' },
                      { brand: '5 Posiłków', avgPrice: 73.73, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Zdrowa Szama', avgPrice: 72.92, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Nice To Fit You', avgPrice: 71.93, fill: 'hsl(var(--primary))' },
                      { brand: 'TIM Catering', avgPrice: 68.81, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'MaczFit', avgPrice: 64.81, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'BodyChief', avgPrice: 64.30, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Pomelo', avgPrice: 63.57, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Kuchnia Vikinga', avgPrice: 58.36, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Gastropaczka', avgPrice: 52.47, fill: 'hsl(var(--muted-foreground))' },
                    ]}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[45, 85]} tickFormatter={(v) => `${v} zł`} />
                    <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Cena po rabacie']} />
                    <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                      {[
                        { brand: 'SuperMenu NEW 25' },
                        { brand: 'FitApetit' },
                        { brand: '5 Posiłków' },
                        { brand: 'Zdrowa Szama' },
                        { brand: 'Nice To Fit You' },
                        { brand: 'TIM Catering' },
                        { brand: 'MaczFit' },
                        { brand: 'BodyChief' },
                        { brand: 'Pomelo' },
                        { brand: 'Kuchnia Vikinga' },
                        { brand: 'Gastropaczka' },
                      ].map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.brand === 'Nice To Fit You' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Price stability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Stabilność cen w Q4 2025
              </CardTitle>
              <CardDescription>Trend cen katalogowych po miesiącach</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">92.91 zł</div>
                  <div className="text-sm text-muted-foreground">Październik</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">92.92 zł</div>
                  <div className="text-sm text-muted-foreground">Listopad</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">92.92 zł</div>
                  <div className="text-sm text-muted-foreground">Grudzień</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-sm font-medium text-green-700">
                  ✓ Ceny katalogowe pozostały stabilne przez cały Q4 2025 (zmiana &lt;0.01%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> Nice To Fit You pozycjonuje się w <strong>górnym segmencie cenowym</strong> rynku 
                (92.91 zł - drugie miejsce po SuperMenu). Ta strategia premium jest spójna z niską polityką rabatową 
                i sugeruje fokus na wartość, nie wolumen. Ceny były <strong>absolutnie stabilne</strong> przez cały Q4 2025.
                W zestawieniu z konkurencją: MaczFit i 5 Posiłków mają zbliżone ceny (~92-93 zł), 
                ale oferują wyższe rabaty, co daje niższą cenę końcową dla klienta.
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
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">I-III 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium">Stabilny start roku</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.28 | Stali klienci dominują w opiniach | Pozytywny odbiór aplikacji Select</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">IV-VI 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium">Szczyt sezonu wiosennego</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.35 | Najwyższe oceny w roku | Wzrost bazy klientów | Bardzo dobra logistyka</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">VII-IX 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-blue-500/5 border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium">Sezon letni - lekkie spowolnienie</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.22 | Sezonowy spadek zamówień | Utrzymanie jakości obsługi</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-orange-600">X 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-orange-500/5 border-l-4 border-l-orange-500">
                    <p className="text-sm font-medium">Początek kryzysu logistycznego</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.12 | Pierwsze skargi na opóźnienia | Wzrost wolumenu zamówień</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-red-600">XI 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-red-500/5 border-l-4 border-l-red-500">
                    <p className="text-sm font-medium">Eskalacja problemów</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 3.95 | Masowe opóźnienia dostaw | Problemy z obsługą klienta | Brak pojemników</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-red-600">XII 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-red-500/5 border-l-4 border-l-red-500">
                    <p className="text-sm font-medium">Dno kryzysu i początek odbudowy</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 3.90 | Najniższy punkt roku | Pierwsze działania naprawcze widoczne pod koniec miesiąca</p>
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
                      <span><strong>Smak i jakość posiłków</strong> - konsekwentnie najlepiej oceniany aspekt (88% pozytywnych)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Lojalność klientów</strong> - wielu klientów korzysta z usług 2-3 lata</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Aplikacja Select</strong> - wysoko ceniona możliwość wyboru menu</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Różnorodność menu</strong> - szeroki wybór diet i kaloryczności</span>
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
                      <span><strong>Skalowalność logistyki</strong> - system nie wytrzymał sezonu świątecznego</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Komunikacja kryzysowa</strong> - brak proaktywnego informowania o problemach</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Obsługa klienta</strong> - długi czas reakcji na zgłoszenia (27% negatywnych)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Zarządzanie zapasami</strong> - braki pojemników w szczycie sezonu</span>
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
                Rok 2025 zakończył się trudnym Q4, ale fundamenty biznesu pozostają silne. Kluczowe rekomendacje na 2026:
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">🚚</div>
                  <h5 className="font-semibold text-sm mb-1">Logistyka</h5>
                  <p className="text-xs text-muted-foreground">Wzmocnienie floty i procesów przed sezonem jesiennym 2026</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">📞</div>
                  <h5 className="font-semibold text-sm mb-1">Obsługa klienta</h5>
                  <p className="text-xs text-muted-foreground">Skrócenie czasu reakcji i wdrożenie systemu powiadomień</p>
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
                <strong>Podsumowanie:</strong> Nice To Fit You zebrało {allTimeStats?.count?.toLocaleString('pl-PL') || '...'} opinii 
                ze średnią oceną {allTimeStats?.avgRating || '...'}/5. 
                <strong> Kluczowy insight: problemy mają charakter operacyjny, nie produktowy</strong> - smak i jakość posiłków 
                pozostają mocną stroną marki ({allTimeStats?.positivePercent || '...'}% pozytywnych opinii). 
                To oznacza, że odbudowa reputacji jest w pełni możliwa poprzez usprawnienie procesów, bez konieczności 
                zmiany core produktu.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}