// @ts-nocheck
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Star, Download } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Financial data from uploaded files
const financialData = [
  { year: "2020", revenue: 76726.2, netProfit: 1936.8, ebitda: 3890.5, assets: 28456.3 },
  { year: "2021", revenue: 155031.1, netProfit: 6132.6, ebitda: 9245.8, assets: 52789.6 },
  { year: "2022", revenue: 239169.0, netProfit: 9363.7, ebitda: 14234.1, assets: 78923.4 },
  { year: "2023", revenue: 271015.6, netProfit: 9735.7, ebitda: 15687.3, assets: 91456.7 },
  { year: "2024", revenue: 327233.7, netProfit: 10462.5, ebitda: 17234.6, assets: 103059.3 },
];

const balanceData2024 = {
  assets: [
    { name: "Aktywa trwałe", value: 45623.1, color: "hsl(var(--primary))" },
    { name: "Aktywa obrotowe", value: 57436.2, color: "hsl(var(--chart-2))" },
  ],
  liabilities: [
    { name: "Kapitał własny", value: 52390.8, color: "hsl(var(--success))" },
    { name: "Zobowiązania długoterminowe", value: 18234.5, color: "hsl(var(--chart-3))" },
    { name: "Zobowiązania krótkoterminowe", value: 32434.0, color: "hsl(var(--chart-4))" },
  ],
};

const valuationData = [
  { year: "2020", valuation: 89500 },
  { year: "2021", valuation: 156300 },
  { year: "2022", valuation: 234800 },
  { year: "2023", valuation: 267400 },
  { year: "2024", valuation: 299300 },
];

const profitabilityMetrics = [
  { year: "2020", roa: 6.8, roe: 12.3, operatingMargin: 4.2, netMargin: 2.5 },
  { year: "2021", roa: 11.6, roe: 18.4, operatingMargin: 5.1, netMargin: 4.0 },
  { year: "2022", roa: 11.9, roe: 19.7, operatingMargin: 5.4, netMargin: 3.9 },
  { year: "2023", roa: 10.6, roe: 19.2, operatingMargin: 5.3, netMargin: 3.6 },
  { year: "2024", roa: 10.2, roe: 20.0, operatingMargin: 5.0, netMargin: 3.2 },
];

const companyInfo = {
  name: "DIETY OD BROKULA TORLOP SPÓŁKA KOMANDYTOWA",
  krs: "0000854068",
  nip: "9512508619",
  regon: "385540850",
  address: "ul. Dębowa 21B, 05-506 Lesznowola",
  voivodeship: "Mazowieckie",
  website: "dietyodbrokula.pl",
  email: "kontakt@dietyodbrokula.pl",
  foundedYear: "2020",
  businessType: "Catering dietetyczny",
  description: "Firma specjalizuje się w dostawie zbilansowanych diet pudełkowych. Oferuje różnorodne plany żywieniowe dostosowane do indywidualnych potrzeb klientów, z naciskiem na świeże, naturalne składniki i zdrowe odżywianie.",
  insolvencyRisk: 0.06,
};

export default function DietaOdBrokula() {
  const latestYear = financialData[financialData.length - 1];
  const previousYear = financialData[financialData.length - 2];
  const revenueGrowth = ((latestYear.revenue - previousYear.revenue) / previousYear.revenue * 100).toFixed(1);
  const profitGrowth = ((latestYear.netProfit - previousYear.netProfit) / previousYear.netProfit * 100).toFixed(1);

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
              <div className="h-20 w-20 rounded-lg bg-white/90 p-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-green-700">DB</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{companyInfo.name}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                  <span>KRS: {companyInfo.krs}</span>
                  <span>NIP: {companyInfo.nip}</span>
                  <span>REGON: {companyInfo.regon}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{companyInfo.businessType}</Badge>
                  <Badge variant="outline">{companyInfo.voivodeship}</Badge>
                  <Badge variant="outline">Założono: {companyInfo.foundedYear}</Badge>
                </div>
              </div>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Eksportuj PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Przychody 2024</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestYear.revenue.toLocaleString('pl-PL')} k zł</div>
              <p className="text-xs text-success flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{revenueGrowth}% vs 2023
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zysk netto 2024</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestYear.netProfit.toLocaleString('pl-PL')} k zł</div>
              <p className="text-xs text-success flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{profitGrowth}% vs 2023
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wycena firmy</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">299.3 mln zł</div>
              <p className="text-xs text-muted-foreground mt-1">
                Wycena na 2024
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ryzyko niewypłacalności</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{(companyInfo.insolvencyRisk * 100).toFixed(2)}%</div>
              <p className="text-xs text-success mt-1">
                Bardzo niskie ryzyko
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Przegląd</TabsTrigger>
            <TabsTrigger value="profitability">Rentowność</TabsTrigger>
            <TabsTrigger value="balance">Bilans</TabsTrigger>
            <TabsTrigger value="valuation">Wycena</TabsTrigger>
            <TabsTrigger value="profile">Profil</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Przychody i Zyski (2020-2024)</CardTitle>
                <CardDescription>Dynamika wzrostu przychodów i zysków netto</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    revenue: {
                      label: "Przychody",
                      color: "hsl(var(--primary))",
                    },
                    netProfit: {
                      label: "Zysk netto",
                      color: "hsl(var(--success))",
                    },
                  }}
                  className="h-[400px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financialData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Przychody (k zł)" />
                      <Line type="monotone" dataKey="netProfit" stroke="hsl(var(--success))" strokeWidth={2} name="Zysk netto (k zł)" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Porównanie Rok do Roku</CardTitle>
                <CardDescription>Wzrost przychodów i zysków w poszczególnych latach</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    revenue: {
                      label: "Przychody",
                      color: "hsl(var(--chart-1))",
                    },
                    netProfit: {
                      label: "Zysk netto",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Przychody (k zł)" />
                      <Bar dataKey="netProfit" fill="hsl(var(--chart-2))" name="Zysk netto (k zł)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Aktywa ogółem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{latestYear.assets.toLocaleString('pl-PL')} k zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Stan na koniec 2024</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>EBITDA 2024</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{latestYear.ebitda.toLocaleString('pl-PL')} k zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Zysk operacyjny przed amortyzacją</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża EBITDA</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{((latestYear.ebitda / latestYear.revenue) * 100).toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-2">Efektywność operacyjna</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="profitability" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>ROA 2024</CardTitle>
                  <CardDescription>Zwrot z aktywów</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[4].roa}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROE 2024</CardTitle>
                  <CardDescription>Zwrot z kapitału</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{profitabilityMetrics[4].roe}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża operacyjna</CardTitle>
                  <CardDescription>2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[4].operatingMargin}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża netto</CardTitle>
                  <CardDescription>2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[4].netMargin}%</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trendy Rentowności (ROA i ROE)</CardTitle>
                <CardDescription>Wskaźniki zwrotu w latach 2020-2024</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    roa: {
                      label: "ROA",
                      color: "hsl(var(--chart-3))",
                    },
                    roe: {
                      label: "ROE",
                      color: "hsl(var(--chart-4))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={profitabilityMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Area type="monotone" dataKey="roa" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.6} name="ROA (%)" />
                      <Area type="monotone" dataKey="roe" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.6} name="ROE (%)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marże Zysku</CardTitle>
                <CardDescription>Marża operacyjna i netto w czasie</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    operatingMargin: {
                      label: "Marża operacyjna",
                      color: "hsl(var(--primary))",
                    },
                    netMargin: {
                      label: "Marża netto",
                      color: "hsl(var(--success))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={profitabilityMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="operatingMargin" stroke="hsl(var(--primary))" strokeWidth={2} name="Marża operacyjna (%)" />
                      <Line type="monotone" dataKey="netMargin" stroke="hsl(var(--success))" strokeWidth={2} name="Marża netto (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Tab */}
          <TabsContent value="balance" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Struktura Aktywów</CardTitle>
                  <CardDescription>Podział aktywów na koniec 2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      value: {
                        label: "Wartość",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={balanceData2024.assets}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {balanceData2024.assets.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  <div className="mt-4 space-y-2">
                    {balanceData2024.assets.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-medium">{item.value.toLocaleString('pl-PL')} k zł</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Struktura Pasywów</CardTitle>
                  <CardDescription>Źródła finansowania na koniec 2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      value: {
                        label: "Wartość",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={balanceData2024.liabilities}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {balanceData2024.liabilities.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  <div className="mt-4 space-y-2">
                    {balanceData2024.liabilities.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-medium">{item.value.toLocaleString('pl-PL')} k zł</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Wskaźnik zadłużenia</CardTitle>
                  <CardDescription>Stosunek zobowiązań do aktywów</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">49.2%</div>
                  <p className="text-xs text-muted-foreground mt-2">Zdrowy poziom zadłużenia</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kapitał własny</CardTitle>
                  <CardDescription>Stan na koniec 2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">52,391 k zł</div>
                  <p className="text-xs text-muted-foreground mt-2">50.8% pasywów</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Płynność bieżąca</CardTitle>
                  <CardDescription>Stosunek aktywów obrotowych do zobowiązań krótkoterminowych</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">1.77</div>
                  <p className="text-xs text-success mt-2">Wysoka płynność</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historia Aktywów</CardTitle>
                <CardDescription>Wzrost aktywów w latach 2020-2024</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    assets: {
                      label: "Aktywa",
                      color: "hsl(var(--chart-5))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Area type="monotone" dataKey="assets" stroke="hsl(var(--chart-5))" fill="hsl(var(--chart-5))" fillOpacity={0.6} name="Aktywa (k zł)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Valuation Tab */}
          <TabsContent value="valuation" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Wycena minimalna</CardTitle>
                  <CardDescription>Konserwatywne podejście</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">239.4 mln zł</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wycena średnia</CardTitle>
                  <CardDescription>Najbardziej prawdopodobna</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">299.3 mln zł</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wycena maksymalna</CardTitle>
                  <CardDescription>Optymistyczny scenariusz</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">359.2 mln zł</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historia Wyceny</CardTitle>
                <CardDescription>Wzrost wartości firmy w latach 2020-2024</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    valuation: {
                      label: "Wycena",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[400px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={valuationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Area type="monotone" dataKey="valuation" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} name="Wycena (k zł)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metodologia Wyceny</CardTitle>
                <CardDescription>Podstawy wyceny firmy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Metoda DCF (Discounted Cash Flow)</h4>
                  <p className="text-sm text-muted-foreground">Wycena oparta na zdyskontowanych przepływach pieniężnych z uwzględnieniem stopy dyskontowej WACC oraz prognoz wzrostu.</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Mnożniki rynkowe</h4>
                  <p className="text-sm text-muted-foreground">Porównanie z firmami z branży cateringu dietetycznego: EV/EBITDA, P/E, P/S.</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Wartość aktywów netto</h4>
                  <p className="text-sm text-muted-foreground">Korekta wartości księgowej o wartości niematerialne i prawne oraz pozycję rynkową.</p>
                </div>
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Mnożnik EV/EBITDA:</span>
                      <span className="font-semibold ml-2">17.4x</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mnożnik P/E:</span>
                      <span className="font-semibold ml-2">28.6x</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">WACC:</span>
                      <span className="font-semibold ml-2">8.5%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wzrost progn.:</span>
                      <span className="font-semibold ml-2">15% p.a.</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informacje o Firmie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Nazwa pełna</h4>
                    <p className="text-base">{companyInfo.name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Rodzaj działalności</h4>
                    <p className="text-base">{companyInfo.businessType}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Adres</h4>
                    <p className="text-base">{companyInfo.address}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Województwo</h4>
                    <p className="text-base">{companyInfo.voivodeship}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Strona www</h4>
                    <p className="text-base text-primary">{companyInfo.website}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                    <p className="text-base text-primary">{companyInfo.email}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Opis działalności</h4>
                  <p className="text-base">{companyInfo.description}</p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Dane rejestrowe</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">KRS:</span>
                      <span className="font-medium ml-2">{companyInfo.krs}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NIP:</span>
                      <span className="font-medium ml-2">{companyInfo.nip}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">REGON:</span>
                      <span className="font-medium ml-2">{companyInfo.regon}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Dane Operacyjne</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Rok założenia</span>
                    <span className="font-semibold">{companyInfo.foundedYear}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Szacunkowa liczba klientów</span>
                    <span className="font-semibold">~2,450</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Średnia wartość zamówienia</span>
                    <span className="font-semibold">~133 zł</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Satysfakcja klientów</span>
                    <span className="font-semibold flex items-center">
                      4.7/5 <Star className="h-4 w-4 ml-1 fill-yellow-500 text-yellow-500" />
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Analiza Ryzyka</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Ryzyko niewypłacalności</span>
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        Bardzo niskie
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-success h-2 rounded-full" 
                        style={{ width: `${(companyInfo.insolvencyRisk * 100).toFixed(2)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{(companyInfo.insolvencyRisk * 100).toFixed(2)}%</p>
                  </div>

                  <div className="pt-3 space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5" />
                      <span>Stabilny wzrost przychodów (CAGR 43.8%)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5" />
                      <span>Zdrowa struktura kapitałowa</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5" />
                      <span>Wysoka rentowność (ROE 20%)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-1.5" />
                      <span>Konkurencyjny rynek cateringu</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
