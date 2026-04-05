'use client';

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  FileText, Download, Calendar, TrendingUp, TrendingDown, AlertCircle,
  ExternalLink, Building2
} from "lucide-react";
import { useMonthlyTrends } from "@/hooks/supabase/useMonthlyTrends";
import { useAveragePrice } from "@/hooks/supabase/useAveragePrice";
import { useReviewsCount } from "@/hooks/supabase/useReviewsCount";
import { useBrandFinancialData } from "@/hooks/useBrandFinancialData";


const marketYearlyData = [
  { year: "2021", value: 2000000000 },
  { year: "2022", value: 2500000000 },
  { year: "2023", value: 3000000000 },
  { year: "2024", value: 3500000000 },
];

const priceAlerts = [
  { brand: "Body Chief", change: -8.7, price: 38.80, status: "critical", date: "2024-01-20" },
  { brand: "SuperMenu", change: +5.2, price: 42.15, status: "warning", date: "2024-01-19" },
  { brand: "Pomelo", change: -3.4, price: 44.85, status: "info", date: "2024-01-18" },
];

const brandDetailPaths: Record<string, string> = {
  "Dieta od Brokula": "/reports/dieta-od-brokula",
  "Gastro Magazyn": "/reports/gastro-magazyn",
  "MaczFit": "/reports/maczfit",
  "SuperMenu": "/reports/supermenu",
  "Body Chief": "/reports/body-chief",
  "Pomelo": "/reports/pomelo",
  "Kuchnia Vikinga": "/reports/kuchnia-vikinga",
};

export default function Reports() {
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedBrandForTrend, setSelectedBrandForTrend] = useState("Dieta od Brokula");
  const [selectedBrandForAnalysis, setSelectedBrandForAnalysis] = useState("Dieta od Brokula");

  const { data: monthlyTrends, isLoading: trendsLoading } = useMonthlyTrends();
  const { data: avgPriceData } = useAveragePrice();
  const { data: reviewsCount } = useReviewsCount();
  const { data: brandFinancialData } = useBrandFinancialData();

  const brandPerformanceByYear = brandFinancialData || {};
  const brandPerformance = brandPerformanceByYear[selectedYear] || [];

  const brandYearlyTrends: Record<string, Array<{ year: string; marketShare: number }>> = {
    "Dieta od Brokula": [
      { year: "2020", marketShare: 3.8 },
      { year: "2021", marketShare: 7.8 },
      { year: "2022", marketShare: 9.6 },
      { year: "2023", marketShare: 9.0 },
      { year: "2024", marketShare: 9.3 },
    ],
    "MaczFit": [
      { year: "2019", marketShare: 4.0 },
      { year: "2020", marketShare: 5.0 },
      { year: "2021", marketShare: 8.7 },
      { year: "2022", marketShare: 9.2 },
      { year: "2023", marketShare: 11.1 },
      { year: "2024", marketShare: 11.7 },
    ],
    "Body Chief": [
      { year: "2018", marketShare: 2.0 },
      { year: "2019", marketShare: 2.5 },
      { year: "2020", marketShare: 3.4 },
      { year: "2021", marketShare: 3.8 },
      { year: "2022", marketShare: 2.9 },
      { year: "2023", marketShare: 2.8 },
      { year: "2024", marketShare: 2.7 },
    ],
    "Pomelo": [
      { year: "2020", marketShare: 0.3 },
      { year: "2021", marketShare: 0.6 },
      { year: "2022", marketShare: 0.5 },
      { year: "2023", marketShare: 0.6 },
      { year: "2024", marketShare: 0.8 },
    ],
    "Kuchnia Vikinga": [
      { year: "2021", marketShare: 2.3 },
      { year: "2022", marketShare: 3.1 },
      { year: "2023", marketShare: 8.9 },
    ],
    "SuperMenu": [
      { year: "2020", marketShare: 0.7 },
      { year: "2021", marketShare: 1.9 },
      { year: "2022", marketShare: 1.6 },
      { year: "2023", marketShare: 1.1 },
    ],
    "Gastro Magazyn": [
      { year: "2018", marketShare: 0.2 },
      { year: "2020", marketShare: 0.3 },
      { year: "2021", marketShare: 0.6 },
      { year: "2022", marketShare: 2.5 },
      { year: "2023", marketShare: 3.5 },
    ],
  };

  const selectedBrandTrendData = brandYearlyTrends[selectedBrandForTrend] || [];

  const sortedBrandPerformance = [...brandPerformance].sort((a, b) => b.revenue - a.revenue);
  const selectedBrandAnalysis = brandPerformance.find(b => b.brand === selectedBrandForAnalysis);
  const brandRank = sortedBrandPerformance.findIndex(b => b.brand === selectedBrandForAnalysis) + 1;

  const totalRevenue = brandPerformance.reduce((acc, brand) => acc + brand.revenue, 0);
  const avgGrowth = brandPerformance.length > 0
    ? brandPerformance.reduce((acc, brand) => acc + brand.growth, 0) / brandPerformance.length
    : 0;

  const totalMarketValue = marketYearlyData.find(d => d.year === selectedYear)?.value || 3500000000;

  const marketShare = brandPerformance
    .map((brand, index) => ({
      name: brand.brand,
      value: Number((((brand.revenue * 1000) / totalMarketValue) * 100).toFixed(1)),
      color: `hsl(var(--chart-${(index % 5) + 1}))`,
      revenue: brand.revenue,
      logo: brand.logo,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const othersShare = Number((100 - marketShare.reduce((acc, item) => acc + item.value, 0)).toFixed(1));
  if (othersShare > 0) {
    marketShare.push({
      name: "Inne",
      value: othersShare,
      color: "hsl(var(--muted))",
      revenue: (totalMarketValue - (totalRevenue * 1000)) / 1000,
      logo: "",
    });
  }

  const MarketShareTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-3">
            {data.logo && (
              <img src={data.logo} alt={data.name} className="h-8 w-8 object-contain rounded" />
            )}
            <div>
              <p className="font-semibold">{data.name}</p>
              <p className="text-sm text-muted-foreground">Udział: {data.value}%</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Raporty</h1>
          <p className="text-muted-foreground mt-2">
            Kompleksowe analizy rynku cateringowego i trendów cenowych
          </p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Eksportuj PDF
        </Button>
      </div>

      {/* Summary 2025 Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Raporty podsumowujące 2025 (opinie + statystyki)
          </CardTitle>
          <CardDescription>
            Kliknij logo marki, aby zobaczyć pełny raport z analizą opinii, ocen i trendów
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              { brand: "Rynek 2025", path: "/reports/market-summary-2025", logo: null, icon: true },
              { brand: "MaczFit", path: "/reports/maczfit-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139797514-fnz11.webp" },
              { brand: "Pomelo", path: "/reports/pomelo-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139868878-xe7bdj.webp" },
              { brand: "Kuchnia Vikinga", path: "/reports/kuchnia-vikinga-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139828363-253v6o.png" },
              { brand: "SuperMenu", path: "/reports/supermenu-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759140646846-93a7f.png" },
              { brand: "Wygodna Dieta", path: "/reports/wygodnadieta-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1760442472314-oti5ub.png" },
              { brand: "Diety od Brokuła", path: "/reports/dietyodbrokula-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759140593877-r0snpen.jpeg" },
              { brand: "Nice To Fit You", path: "/reports/nice-to-fit-you-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759140707213-cp0u18.png" },
              { brand: "5 Posiłków Dziennie", path: "/reports/5-posilkow-dziennie-summary-2025", logo: "https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1767105792818-6vlnar.jpeg" },
            ].map((report) => (
              <Link
                key={report.path}
                href={report.path}
                className={`group flex flex-col items-center p-4 rounded-lg border bg-card hover:shadow-lg hover:border-primary transition-all ${report.icon ? 'border-primary/50 bg-primary/5' : ''}`}
              >
                {report.icon ? (
                  <Building2 className="h-16 w-16 text-primary mb-2 group-hover:scale-105 transition-transform" />
                ) : (
                  <img
                    src={report.logo!}
                    alt={report.brand}
                    className="h-16 w-16 object-contain rounded mb-2 group-hover:scale-105 transition-transform"
                  />
                )}
                <span className="text-sm font-medium text-center group-hover:text-primary flex items-center gap-1">
                  {report.brand}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączne Przychody</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalRevenue / 1000).toFixed(1)}M zł</div>
            <p className="text-xs text-muted-foreground">+{avgGrowth.toFixed(1)}% vs poprzedni rok</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opinie</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewsCount || 0}</div>
            <p className="text-xs text-muted-foreground">wszystkich opinii</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średnia Cena</CardTitle>
            {avgPriceData && avgPriceData.changePercent >= 0 ? (
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgPriceData ? avgPriceData.currentAvgPrice.toFixed(2) : "0.00"} zł
            </div>
            <p className="text-xs text-muted-foreground">
              {avgPriceData
                ? avgPriceData.changePercent >= 0
                  ? `+${avgPriceData.changePercent.toFixed(1)}%`
                  : `${avgPriceData.changePercent.toFixed(1)}%`
                : "0.0%"} vs poprzedni miesiąc
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerty Cenowe</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{priceAlerts.length}</div>
            <p className="text-xs text-muted-foreground">aktywnych alertów</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="brands">Analiza Marek</TabsTrigger>
          <TabsTrigger value="market">Udział w Rynku</TabsTrigger>
          <TabsTrigger value="alerts">Alerty</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Trendy Miesięczne</CardTitle>
                <CardDescription>Średnie ceny i liczba promocji</CardDescription>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">Ładowanie danych...</p>
                  </div>
                ) : !monthlyTrends || monthlyTrends.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">Brak danych do wyświetlenia</p>
                  </div>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                        <YAxis className="text-xs fill-muted-foreground" />
                        <Tooltip formatter={(value, name) => [
                          name === 'avgPrice' ? `${value} zł` : value,
                          name === 'avgPrice' ? 'Średnia cena' : 'Promocje'
                        ]} />
                        <Line type="monotone" dataKey="avgPrice" stroke="hsl(var(--primary))" strokeWidth={2} />
                        <Line type="monotone" dataKey="promotions" stroke="hsl(var(--secondary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Udział w Rynku</CardTitle>
                    <CardDescription>Dystrybucja według marek (%)</CardDescription>
                  </div>
                  <Select value={selectedYear} onValueChange={v => { if (v) setSelectedYear(v); }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {marketYearlyData.map(({ year }) => (
                        <SelectItem key={year} value={year}>Rok {year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={marketShare}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {marketShare.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<MarketShareTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {marketShare.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-sm">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wyniki Marek</CardTitle>
                  <CardDescription>Przychody, wzrost i satysfakcja klientów</CardDescription>
                </div>
                <Select value={selectedYear} onValueChange={v => { if (v) setSelectedYear(v); }}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="2024">Rok 2024</SelectItem>
                    <SelectItem value="2023">Rok 2023</SelectItem>
                    <SelectItem value="2022">Rok 2022</SelectItem>
                    <SelectItem value="2021">Rok 2021</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {brandPerformance.map((brand, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {brand.logo && (
                        <img
                          src={brand.logo}
                          alt={`${brand.brand} logo`}
                          className="h-10 w-10 object-contain rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{brand.brand}</h3>
                      </div>
                      <Badge variant={brand.growth > 0 ? "default" : "destructive"}>
                        {brand.growth > 0 ? "+" : ""}{brand.growth}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold">przychody: {(brand.revenue / 1000).toFixed(1)}M zł</div>
                        <div className="text-sm text-muted-foreground">
                          {(brand as any).satisfaction != null && <>średnia ocena: {(brand as any).satisfaction}/5 ★</>}
                        </div>
                      </div>
                      {brandDetailPaths[brand.brand] && (
                        <Link href={brandDetailPaths[brand.brand]}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Zobacz szczegóły
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Porównanie Przychodów</CardTitle>
              <CardDescription>Miesięczne przychody według marek</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brandPerformance}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="brand"
                      className="text-xs fill-muted-foreground"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      className="text-xs fill-muted-foreground"
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}M`}
                    />
                    <Tooltip formatter={(value) => [`${(Number(value) / 1000).toFixed(1)}M zł`, "Przychód"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Trendy Udziału w Rynku</CardTitle>
                    <CardDescription>Zmiany w latach</CardDescription>
                  </div>
                  <Select value={selectedBrandForTrend} onValueChange={v => { if (v) setSelectedBrandForTrend(v); }}>
                    <SelectTrigger className="w-[180px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {Object.keys(brandYearlyTrends).map((brandName) => (
                        <SelectItem key={brandName} value={brandName}>{brandName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedBrandTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" className="text-xs fill-muted-foreground" />
                      <YAxis className="text-xs fill-muted-foreground" tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Udział w rynku']} />
                      <Line type="monotone" dataKey="marketShare" stroke="hsl(var(--chart-3))" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analiza Konkurencji</CardTitle>
                    <CardDescription>Pozycja na rynku względem konkurentów</CardDescription>
                  </div>
                  <Select value={selectedBrandForAnalysis} onValueChange={v => { if (v) setSelectedBrandForAnalysis(v); }}>
                    <SelectTrigger className="w-[180px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {brandPerformance.map((brand) => (
                        <SelectItem key={brand.brand} value={brand.brand}>{brand.brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedBrandAnalysis ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto text-green-600 mb-4" />
                    <h3 className="text-lg font-medium mb-2">{selectedBrandAnalysis.brand}</h3>
                    <p className="text-muted-foreground mb-4">
                      Udział w rynku: {((selectedBrandAnalysis.revenue * 1000 / totalMarketValue) * 100).toFixed(1)}%
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className={`font-bold ${selectedBrandAnalysis.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedBrandAnalysis.growth > 0 ? '+' : ''}{selectedBrandAnalysis.growth.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">Wzrost r/r</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">#{brandRank}</div>
                        <div className="text-muted-foreground">Pozycja</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Brak danych dla wybranej marki
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Udział w Rynku</CardTitle>
                  <CardDescription>Dystrybucja według marek (%)</CardDescription>
                </div>
                <Select value={selectedYear} onValueChange={v => { if (v) setSelectedYear(v); }}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {marketYearlyData.map(({ year }) => (
                      <SelectItem key={year} value={year}>Rok {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={marketShare}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {marketShare.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<MarketShareTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {marketShare.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Alerty Cenowe
              </CardTitle>
              <CardDescription>Ostatnie zmiany cen wymagające uwagi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {priceAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        alert.status === 'critical' ? 'bg-red-100 text-red-600' :
                        alert.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{alert.brand}</div>
                        <div className="text-sm text-muted-foreground">{alert.date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${alert.change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {alert.change > 0 ? '+' : ''}{alert.change}%
                      </div>
                      <div className="text-sm text-muted-foreground">{alert.price.toFixed(2)} zł/dzień</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
