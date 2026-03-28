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
import { format, subMonths } from "date-fns";
import { pl } from "date-fns/locale";
import { supabase } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useReviewAspects } from "@/hooks/supabase/useReviewAspects";

// Brand ID for Kuchnia Vikinga
const BRAND_ID = "011da56b-f3df-41f2-8ebf-6fe46b110ea5";

const companyInfo = {
  name: "Kuchnia Vikinga",
  brandName: "Kuchnia Vikinga",
  businessType: "Catering dietetyczny",
  voivodeship: "Podlaskie",
  website: "www.kuchniavikinga.pl",
  description: "Jeden z największych graczy na rynku cateringu dietetycznego w Polsce. Oferuje 13 gotowych diet i 5 wariantów z wyborem posiłków, obsługując ponad 5400 miejscowości. Specjalizuje się w dietach wegańskich, ketogenicznych, low-carb oraz dla osób z problemami trawiennymi.",
};

// Sentiment colors for dynamic data
const SENTIMENT_COLORS = {
  positive: "hsl(142, 76%, 36%)",
  neutral: "hsl(45, 93%, 47%)",
  negative: "hsl(0, 84%, 60%)",
};

// Helper function to fetch all reviews with pagination
async function fetchAllReviews(brandId: string) {
  const allReviews: Array<{ rating: number | null; review_date: string | null; content: string | null }> = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating, review_date, content')
      .eq('brand_id', brandId)
      .order('review_date', { ascending: false })
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

  return allReviews;
}

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

// Dynamic Review Aspects Section Component  
function ReviewAspectsSection() {
  const { data: aspectsData, isLoading } = useReviewAspects(BRAND_ID);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Najczęstsze aspekty w opiniach
        </h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (!aspectsData || aspectsData.length === 0) {
    return null;
  }

  const topAspect = aspectsData[0];
  const controversialAspects = aspectsData.filter(a => a.negative >= 20);

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        Najczęstsze aspekty w opiniach
      </h3>
      <p className="text-sm text-muted-foreground">
        Analiza {aspectsData.reduce((sum, a) => sum + a.mentions, 0)} wzmianek w opiniach klientów
      </p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {aspectsData.map((aspect, idx) => (
          <Card key={idx} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium capitalize">{aspect.aspect}</span>
                <Badge variant="outline" className="text-xs">
                  {aspect.mentions} wzmianek
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${aspect.positive}%`,
                        backgroundColor: SENTIMENT_COLORS.positive
                      }}
                    />
                  </div>
                  <span className="text-xs text-green-600 w-10">{aspect.positive}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${aspect.negative}%`,
                        backgroundColor: SENTIMENT_COLORS.negative
                      }}
                    />
                  </div>
                  <span className="text-xs text-red-600 w-10">{aspect.negative}%</span>
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

export default function KuchniaVikingaOpinie() {
  // Ostatni miesiąc = ostatni pełny miesiąc kalendarzowy (np. w styczniu -> grudzień)
  const lastFullMonthKey = format(subMonths(new Date(), 1), "yyyy-MM");
  const [lfYear, lfMonth] = lastFullMonthKey.split("-");
  const lastFullMonthLabel = `${lfMonth}.${lfYear}`;

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
    queryKey: ["kv-period-stats", "v3-full-month", lastFullMonthKey],
    queryFn: async () => {
      const allReviews = await fetchAllReviews(BRAND_ID);

      const now = Date.now();
      const min6MonthsMs = now - 180 * 24 * 60 * 60 * 1000;
      const minQuarterMs = now - 90 * 24 * 60 * 60 * 1000;

      const filters: Array<{
        key: "all_time" | "last_6_months" | "last_quarter" | "last_month";
        match: (r: { review_date: string | null }) => boolean;
      }> = [
        { key: "all_time", match: () => true },
        {
          key: "last_6_months",
          match: (r) => !!r.review_date && new Date(r.review_date).getTime() >= min6MonthsMs,
        },
        {
          key: "last_quarter",
          match: (r) => !!r.review_date && new Date(r.review_date).getTime() >= minQuarterMs,
        },
        {
          key: "last_month",
          match: (r) => !!r.review_date && r.review_date.startsWith(lastFullMonthKey),
        },
      ];

      return filters.map(({ key, match }) => {
        const reviews = allReviews.filter((r) => match({ review_date: r.review_date }));

        const total = reviews.length;
        const avgRating =
          total > 0 ? reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / total : 0;
        const positive = reviews.filter((r) => (r.rating || 0) >= 4).length;
        const neutral = reviews.filter((r) => r.rating === 3).length;
        const negative = reviews.filter((r) => (r.rating || 0) <= 2).length;

        return {
          period: key,
          count: total,
          avgRating: avgRating.toFixed(2),
          positive,
          neutral,
          negative,
          positivePercent: total > 0 ? ((positive / total) * 100).toFixed(1) : "0",
          negativePercent: total > 0 ? ((negative / total) * 100).toFixed(1) : "0",
        };
      });
    },
  });

  // Fetch monthly trends
  const { data: monthlyTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ['kv-monthly-trends', 'v3-full-range'],
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

      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
          count: data.count,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }
  });

  // Fetch date range for header
  const { data: dateRange } = useQuery({
    queryKey: ['kv-date-range'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('review_date')
        .eq('brand_id', BRAND_ID)
        .not('review_date', 'is', null)
        .order('review_date', { ascending: true })
        .limit(1);
      
      const { data: latestData } = await supabase
        .from('reviews')
        .select('review_date')
        .eq('brand_id', BRAND_ID)
        .not('review_date', 'is', null)
        .order('review_date', { ascending: false })
        .limit(1);
      
      const earliest = data?.[0]?.review_date ? new Date(data[0].review_date) : null;
      const latest = latestData?.[0]?.review_date ? new Date(latestData[0].review_date) : null;
      
      return { earliest, latest };
    }
  });

  // =====================
  // DYNAMIC DATA: QUOTES
  // =====================
  const { data: realQuotes, isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['kv-real-quotes'],
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

  const allTimeStats = periodStats?.find(p => p.period === 'all_time');
  const last6MonthsStats = periodStats?.find(p => p.period === 'last_6_months');
  const lastQuarterStats = periodStats?.find(p => p.period === 'last_quarter');
  const lastMonthStats = periodStats?.find(p => p.period === 'last_month');

  // Get crisis months data from monthly trends (dynamic)
  const crisisMonths = ['2025-03', '2025-06', '2025-08'];
  const getCrisisMonthData = (monthKey: string) => {
    return monthlyTrends?.find(m => m.month === monthKey);
  };

  // Calculate recovery bounce (difference between min crisis and max recovery)
  const recoveryBounce = (() => {
    if (!monthlyTrends) return null;
    const sepOct2025 = monthlyTrends.filter(m => m.month === '2025-09' || m.month === '2025-10');
    const junAug2025 = monthlyTrends.filter(m => ['2025-06', '2025-07', '2025-08'].includes(m.month));
    if (sepOct2025.length === 0 || junAug2025.length === 0) return null;
    const maxRecovery = Math.max(...sepOct2025.map(m => m.avgRating));
    const minCrisis = Math.min(...junAug2025.map(m => m.avgRating));
    return (maxRecovery - minCrisis).toFixed(1);
  })();

  // Format date range for header
  const dateRangeFormatted = (() => {
    if (!dateRange?.earliest || !dateRange?.latest) return '...';
    const months = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const earliestMonth = months[dateRange.earliest.getMonth()];
    const earliestYear = dateRange.earliest.getFullYear();
    const latestMonth = months[dateRange.latest.getMonth()];
    const latestYear = dateRange.latest.getFullYear();
    return `${earliestMonth} ${earliestYear} - ${latestMonth} ${latestYear}`;
  })();

  // Prepare chart data for the trend visualization
  const chartData = monthlyTrends?.slice(-24) || [];

  // Calculate sentiment distribution for pie chart
  const sentimentData = allTimeStats ? [
    { name: 'Pozytywne (4-5★)', value: allTimeStats.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutralne (3★)', value: allTimeStats.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negatywne (1-2★)', value: allTimeStats.negative, color: SENTIMENT_COLORS.negative },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      
      <div className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Powrót do Raportów
            </Button>
          </Link>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-xl bg-background border flex items-center justify-center overflow-hidden">
              <img 
                src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139828363-253v6o.png" 
                alt="Kuchnia Vikinga logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{companyInfo.name}</h1>
              <p className="text-muted-foreground">Raport analizy opinii klientów</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {allTimeStats?.count || '...'} opinii
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {dateRangeFormatted}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge className="bg-primary text-primary-foreground">{companyInfo.businessType}</Badge>
                <Badge variant="outline">{companyInfo.voivodeship}</Badge>
                <Badge variant="outline">Google Maps</Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" className="gap-2 no-print" onClick={handleDownloadPDF}>
            <FileDown className="h-4 w-4" />
            Pobierz PDF
          </Button>
        </div>

        <Separator />

        {/* Executive Summary */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Executive Summary
          </h2>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed">
                <strong>Kuchnia Vikinga</strong> to marka z długą historią i ponad 6900 opiniami (średnia 4.35/5). 
                Rok 2025 przyniósł wyraźne turbulencje: po kryzysie wiosna-lato 2025 (oceny 2-3) nastąpiło 
                spektakularne odbicie we wrześniu-październiku (oceny 4.7+). <span className="text-primary font-semibold">Kluczowe: 
                marka potrafi się odradzać po kryzysach.</span>
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Quick Stats Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Cały okres
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    {allTimeStats?.avgRating}
                  </div>
                  <p className="text-xs text-muted-foreground">{allTimeStats?.count} opinii</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Ostatnie 6 mies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    {last6MonthsStats?.avgRating}
                  </div>
                  <p className="text-xs text-muted-foreground">{last6MonthsStats?.count} opinii</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Ostatni kwartał
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    {lastQuarterStats?.avgRating}
                  </div>
                  <p className="text-xs text-muted-foreground">{lastQuarterStats?.count} opinii</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Ostatni miesiąc ({lastFullMonthLabel})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    {lastMonthStats?.avgRating}
                  </div>
                  <p className="text-xs text-muted-foreground">{lastMonthStats?.count} opinii</p>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Section 2: Trend Analysis */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Dynamika emocji klientów
          </h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Średnia ocena w czasie (ostatnie 24 miesiące)</CardTitle>
              <CardDescription>Trend pokazuje wyraźny kryzys wiosna-lato 2025 i spektakularne odbicie we wrześniu</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTrends ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [value.toFixed(2), 'Średnia ocena']}
                      labelFormatter={(label) => {
                        const [year, month] = label.split('-');
                        const months = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
                        return `${months[parseInt(month) - 1]} ${year}`;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgRating" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rozkład sentymentu (cały okres)</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} opinii`, '']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kluczowe obserwacje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10">
                  <ThumbsUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700">Silna pozycja historyczna</p>
                    <p className="text-sm text-muted-foreground">{allTimeStats?.count || '...'} opinii ze średnią {allTimeStats?.avgRating || '...'} - jeden z najwyższych wyników w branży</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-700">Kryzys wiosna-lato 2025</p>
                    <p className="text-sm text-muted-foreground">Marzec-sierpień: oceny spadły do 2-3, skargi na jakość i błędy w zamówieniach</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700">Spektakularne odbicie</p>
                    <p className="text-sm text-muted-foreground">Wrzesień-październik 2025: powrót do 4.7+ - marka potrafi się odradzać</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Section 3: Detailed Period Analysis */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Szczegółowa analiza okresów
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* All Time Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Cały okres (2019-2026)
                </CardTitle>
                <CardDescription>Kompletna historia marki</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingStats ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{allTimeStats?.avgRating}</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {allTimeStats?.count} opinii
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Pozytywne</span>
                        <Progress value={parseFloat(allTimeStats?.positivePercent || '0')} className="h-2" />
                        <span className="text-sm text-green-600">{allTimeStats?.positivePercent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Negatywne</span>
                        <Progress value={parseFloat(allTimeStats?.negativePercent || '0')} className="h-2 [&>div]:bg-red-500" />
                        <span className="text-sm text-red-600">{allTimeStats?.negativePercent}%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Last 6 Months Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ostatnie 6 miesięcy
                </CardTitle>
                <CardDescription>Okres turbulencji i odbicia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingStats ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{last6MonthsStats?.avgRating}</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {last6MonthsStats?.count} opinii
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Pozytywne</span>
                        <Progress value={parseFloat(last6MonthsStats?.positivePercent || '0')} className="h-2" />
                        <span className="text-sm text-green-600">{last6MonthsStats?.positivePercent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Negatywne</span>
                        <Progress value={parseFloat(last6MonthsStats?.negativePercent || '0')} className="h-2 [&>div]:bg-red-500" />
                        <span className="text-sm text-red-600">{last6MonthsStats?.negativePercent}%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Last Quarter Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Ostatni kwartał (X-XII 2025)
                </CardTitle>
                <CardDescription>Okres stabilizacji po kryzysie</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingStats ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{lastQuarterStats?.avgRating}</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {lastQuarterStats?.count} opinii
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Pozytywne</span>
                        <Progress value={parseFloat(lastQuarterStats?.positivePercent || '0')} className="h-2" />
                        <span className="text-sm text-green-600">{lastQuarterStats?.positivePercent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Negatywne</span>
                        <Progress value={parseFloat(lastQuarterStats?.negativePercent || '0')} className="h-2 [&>div]:bg-red-500" />
                        <span className="text-sm text-red-600">{lastQuarterStats?.negativePercent}%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Last Month Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Ostatni miesiąc
                </CardTitle>
                <CardDescription>Najświeższe dane</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingStats ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{lastMonthStats?.avgRating}</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {lastMonthStats?.count} opinii
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Pozytywne</span>
                        <Progress value={parseFloat(lastMonthStats?.positivePercent || '0')} className="h-2" />
                        <span className="text-sm text-green-600">{lastMonthStats?.positivePercent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-24">Negatywne</span>
                        <Progress value={parseFloat(lastMonthStats?.negativePercent || '0')} className="h-2 [&>div]:bg-red-500" />
                        <span className="text-sm text-red-600">{lastMonthStats?.negativePercent}%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Section 4: Review Aspects - Dynamic */}
        <ReviewAspectsSection />

        <Separator />

        {/* Section 5: Deep Dive Q2-Q3 2025 Crisis */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Deep Dive: Kryzys wiosna-lato 2025
          </h2>

          <Card className="border-red-200 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                Analiza spadku (III-VIII 2025)
              </CardTitle>
              <CardDescription>Okres najniższych ocen w historii marki</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Monthly breakdown */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-3 rounded-lg bg-background border">
                  <div className="text-sm text-muted-foreground">Marzec 2025</div>
                  <div className="text-xl font-bold text-red-600">
                    {getCrisisMonthData('2025-03')?.avgRating.toFixed(2) || '...'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getCrisisMonthData('2025-03')?.count || '...'} opinii
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-background border">
                  <div className="text-sm text-muted-foreground">Czerwiec 2025</div>
                  <div className="text-xl font-bold text-red-600">
                    {getCrisisMonthData('2025-06')?.avgRating.toFixed(2) || '...'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getCrisisMonthData('2025-06')?.count || '...'} opinii - dno
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-background border">
                  <div className="text-sm text-muted-foreground">Sierpień 2025</div>
                  <div className="text-xl font-bold text-orange-600">
                    {getCrisisMonthData('2025-08')?.avgRating.toFixed(2) || '...'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getCrisisMonthData('2025-08')?.count || '...'} opinii - poprawa
                  </div>
                </div>
              </div>

              {/* Issues breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold">Główne problemy zgłaszane przez klientów:</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-red-700">Jakość posiłków</span>
                      <span className="text-sm text-red-600">~45%</span>
                    </div>
                    <Progress value={45} className="h-2 [&>div]:bg-red-500" />
                    <p className="text-xs text-muted-foreground mt-2">Skargi na smak, składniki, powtarzalność menu</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-red-700">Błędy w zamówieniach</span>
                      <span className="text-sm text-red-600">~30%</span>
                    </div>
                    <Progress value={30} className="h-2 [&>div]:bg-red-500" />
                    <p className="text-xs text-muted-foreground mt-2">Złe dania, brakujące elementy, pomylone zamówienia</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-orange-700">Menu bez wyboru</span>
                      <span className="text-sm text-orange-600">~15%</span>
                    </div>
                    <Progress value={15} className="h-2 [&>div]:bg-orange-500" />
                    <p className="text-xs text-muted-foreground mt-2">Niezadowolenie z diety standard, "sok zamiast posiłku"</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-orange-700">Logistyka</span>
                      <span className="text-sm text-orange-600">~10%</span>
                    </div>
                    <Progress value={10} className="h-2 [&>div]:bg-orange-500" />
                    <p className="text-xs text-muted-foreground mt-2">Późne dostawy, problemy z kierowcami</p>
                  </div>
                </div>
              </div>

              {/* Strategic insight */}
              <Card className="border-l-4 border-l-orange-500 bg-orange-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <strong>Wniosek:</strong> Kryzys 2025 miał charakter produktowo-operacyjny - w przeciwieństwie do Nice To Fit You 
                    (gdzie problem był czysto logistyczny), Kuchnia Vikinga musiała zmierzyć się ze skargami na jakość samych posiłków. 
                    Spektakularne odbicie we wrześniu (z 2.7 do 4.7) sugeruje, że <strong>marka przeprowadziła głęboką restrukturyzację 
                    procesów produkcyjnych</strong>.
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Section 6: Quotes */}
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
                Cytaty pokazują różnicę między klientami w okresie stabilnym (lojalność, entuzjazm) a kryzysowym 
                (frustracja produktowa i operacyjna). W przeciwieństwie do innych marek, kryzys Kuchni Vikinga 
                dotyczył <strong>core produktu, nie tylko logistyki</strong> - co czyni odbicie jeszcze bardziej imponującym.
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Section 7: Analiza rabatów Q4 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            Analiza rabatów Q4 2025
          </h2>

          {/* Discount stats cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">12</div>
                <div className="text-sm text-muted-foreground">Aktywnych promocji</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">26.3%</div>
                <div className="text-sm text-muted-foreground">Średni rabat</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">31%</div>
                <div className="text-sm text-muted-foreground">Maksymalny rabat</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">20%</div>
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
                      { brand: 'Kuchnia Vikinga', avgDiscount: 26.3, fill: 'hsl(var(--primary))' },
                      { brand: '5 Posiłków', avgDiscount: 26.0, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'BodyChief', avgDiscount: 24.3, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Pomelo', avgDiscount: 23.3, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Nice To Fit You', avgDiscount: 22.6, fill: 'hsl(var(--muted-foreground))' },
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
                          fill={entry.brand === 'Kuchnia Vikinga' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
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
                    <code className="font-mono font-bold text-primary">VIKING30</code>
                    <Badge variant="default">30%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Black Week | 23-30 XI</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">NAWYKI28</code>
                    <Badge variant="secondary">28%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Noworoczna | 26 XII - 11 I</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">HEJVIKING</code>
                    <Badge variant="secondary">28%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Flash sale | 11-14 X (8000 kodów)</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">VIKINGTOUR28</code>
                    <Badge variant="secondary">28%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Regionalna | 03-30 X</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">NIEDZIELAVIKINGA</code>
                    <Badge variant="secondary">25%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Weekendowa | X-XI</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex justify-between items-start mb-2">
                    <code className="font-mono font-bold">STRASZNAOFERTA</code>
                    <Badge variant="secondary">20%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Halloween | 25-31 X</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> Kuchnia Vikinga prowadzi <strong>agresywną politykę rabatową</strong> - średni rabat 26.3% 
                plasuje markę wysoko w rankingu. Dla porównania: Gastropaczka oferuje średnio 34.5%, a NTFY tylko 22.6%. 
                Strategia flash sales (ograniczona pula kodów) buduje poczucie pilności. W Q4 2025 marka stosowała 
                różnorodne promocje: od regionalnych (VIKINGTOUR) przez weekendowe (NIEDZIELAVIKINGA) po świąteczne (NAWYKI).
                <strong> Wysoka częstotliwość promocji może wskazywać na próbę odbudowy bazy klientów po kryzysie 2025.</strong>
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Section 8: Analiza cen Q4 2025 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Analiza cen Q4 2025
          </h2>

          {/* Price stats cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-primary mb-1">79,21 zł</div>
                <div className="text-sm text-muted-foreground">Średnia cena katalogowa</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">~58,36 zł</div>
                <div className="text-sm text-muted-foreground">Śr. cena po rabacie 26%</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">48,90 zł</div>
                <div className="text-sm text-muted-foreground">Cena minimalna</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">101,99 zł</div>
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
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { brand: 'SuperMenu NEW 25', avgPrice: 95.58, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Nice To Fit You', avgPrice: 92.91, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'MaczFit', avgPrice: 92.73, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'FitApetit', avgPrice: 92.58, fill: 'hsl(var(--muted-foreground))' },
                      { brand: '5 Posiłków', avgPrice: 92.16, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Zdrowa Szama', avgPrice: 91.15, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'TIM Catering', avgPrice: 86.01, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Pomelo', avgPrice: 84.77, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'BodyChief', avgPrice: 80.37, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Gastropaczka', avgPrice: 80.11, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Kuchnia Vikinga', avgPrice: 79.21, fill: 'hsl(var(--primary))' },
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
                          fill={entry.brand === 'Kuchnia Vikinga' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
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
                      { brand: 'Nice To Fit You', avgPrice: 78.97, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'MaczFit', avgPrice: 74.18, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'FitApetit', avgPrice: 74.06, fill: 'hsl(var(--muted-foreground))' },
                      { brand: '5 Posiłków', avgPrice: 73.73, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Zdrowa Szama', avgPrice: 72.92, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'TIM Catering', avgPrice: 68.81, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Pomelo', avgPrice: 63.57, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'BodyChief', avgPrice: 64.30, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Gastropaczka', avgPrice: 64.09, fill: 'hsl(var(--muted-foreground))' },
                      { brand: 'Kuchnia Vikinga', avgPrice: 58.36, fill: 'hsl(var(--primary))' },
                    ]}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[50, 85]} tickFormatter={(v) => `${v} zł`} />
                    <YAxis dataKey="brand" type="category" width={105} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)} zł`, 'Cena po rabacie']} />
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
                          fill={entry.brand === 'Kuchnia Vikinga' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
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
                  <div className="text-xl font-bold">78.99 zł</div>
                  <div className="text-sm text-muted-foreground">Październik</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">79.32 zł</div>
                  <div className="text-sm text-muted-foreground">Listopad</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-xl font-bold">79.32 zł</div>
                  <div className="text-sm text-muted-foreground">Grudzień</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-sm font-medium text-green-700">
                  ✓ Ceny katalogowe pozostały stabilne przez cały Q4 2025 (zmiana &lt;0.5%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Insight:</strong> Kuchnia Vikinga pozycjonuje się z ceną katalogową 79.21 zł - <strong>najniższa wśród premium brandów</strong>. 
                Dla porównania: NTFY 92.91 zł, MaczFit 92.73 zł. Jednak dzięki agresywnej polityce rabatowej (śr. 26.3%), 
                efektywna cena spada do ~58 zł, co plasuje markę w segmencie mid-premium. 
                <strong> Strategia "niższa cena katalogowa + wysoki rabat" buduje percepcję najlepszej wartości na rynku.</strong> 
                Ceny były bardzo stabilne w Q4 2025 - brak podwyżek pomimo kryzysu wcześniej w roku.
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Section 9: Year Summary */}
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
                  {allTimeStats?.count ? allTimeStats.count.toLocaleString('pl-PL') : '...'}
                </div>
                <div className="text-sm text-muted-foreground">Opinii ogółem</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {allTimeStats?.avgRating || '...'}
                </div>
                <div className="text-sm text-muted-foreground">Średnia historyczna</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {allTimeStats?.positivePercent ? `${Math.round(parseFloat(allTimeStats.positivePercent))}%` : '...'}
                </div>
                <div className="text-sm text-muted-foreground">Opinii pozytywnych</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {recoveryBounce ? `+${recoveryBounce} pkt` : '...'}
                </div>
                <div className="text-sm text-muted-foreground">Odbicie IX-X 2025</div>
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
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-orange-600">I-II 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-orange-500/5 border-l-4 border-l-orange-500">
                    <p className="text-sm font-medium">Pierwsze sygnały problemów</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 2.9-3.1 | Początek skarg na jakość | Narastające niezadowolenie</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-red-600">III-VI 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-red-500/5 border-l-4 border-l-red-500">
                    <p className="text-sm font-medium">Pełny kryzys</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 1.9-2.4 | Dno w czerwcu (1.90) | Masowe skargi na jakość i błędy</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-orange-600">VII-VIII 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-orange-500/5 border-l-4 border-l-orange-500">
                    <p className="text-sm font-medium">Stabilizacja</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 2.7 | Pierwsze działania naprawcze | Zatrzymanie spadku</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-green-600">IX-X 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-green-500/5 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium">Spektakularne odbicie</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.7+ | Powrót do najlepszych wyników | 992 opinie w 2 miesiące</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-24 flex-shrink-0 font-semibold text-sm text-blue-600">XI-XII 2025</div>
                  <div className="flex-1 p-3 rounded-lg bg-blue-500/5 border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium">Stabilizacja na wysokim poziomie</p>
                    <p className="text-xs text-muted-foreground mt-1">Średnia ocena 4.0-4.3 | Lekka korekta po szczycie | Utrzymanie jakości</p>
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
                Kluczowe wnioski
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
                      <span><strong>Zdolność do restrukturyzacji</strong> - udowodniona umiejętność wyjścia z kryzysu</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Silna baza historyczna</strong> - {allTimeStats?.count || '...'} opinii, średnia {allTimeStats?.avgRating || '...'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Szeroka oferta</strong> - 13 diet, 5 wariantów z wyborem</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                      <span><strong>Zasięg geograficzny</strong> - 5400+ miejscowości</span>
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
                      <span><strong>Kontrola jakości</strong> - kryzys 2025 dotyczył core produktu</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Dieta standard</strong> - wiele skarg na brak wyboru</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Dokładność zamówień</strong> - błędy w dostawach</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <span><strong>Wczesne wykrywanie</strong> - reagowanie zanim kryzys się rozwinie</span>
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
                Rok 2025 był dla Kuchni Vikinga prawdziwym testem - i marka go zdała. Kluczowe rekomendacje na 2026:
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">🔍</div>
                  <h5 className="font-semibold text-sm mb-1">Monitoring jakości</h5>
                  <p className="text-xs text-muted-foreground">Utrzymanie standardów z Q4 2025, wczesne wykrywanie problemów</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">📊</div>
                  <h5 className="font-semibold text-sm mb-1">Analiza sentymentu</h5>
                  <p className="text-xs text-muted-foreground">Ciągły monitoring opinii dla szybkiej reakcji na negatywne trendy</p>
                </div>
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-2xl mb-2">🍽️</div>
                  <h5 className="font-semibold text-sm mb-1">Menu standard</h5>
                  <p className="text-xs text-muted-foreground">Rozważenie ulepszenia diety bez wyboru - główne źródło skarg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final insight */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Podsumowanie:</strong> Kuchnia Vikinga to marka o silnej pozycji historycznej ({allTimeStats?.count || '...'} opinii, średnia {allTimeStats?.avgRating || '...'}), 
                która w 2025 roku przeszła przez najpoważniejszy kryzys w swojej historii. Spadek z 4.7 do 1.9 w ciągu 6 miesięcy
                (III-VI 2025) dotyczył core produktu, nie tylko logistyki. <strong>Kluczowy insight: spektakularne odbicie do 4.7+ 
                we wrześniu-październiku 2025 udowadnia, że marka potrafi się odradzać</strong> - to rzadka i cenna umiejętność w branży.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
