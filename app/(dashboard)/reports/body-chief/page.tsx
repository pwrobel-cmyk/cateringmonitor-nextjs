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

// Financial data from uploaded files (2018-2024, converted to thousands)
const financialData = [
  { year: "2018", revenue: 39972.6, netProfit: 4620.7, ebitda: 5813.9, assets: 6091.9 },
  { year: "2019", revenue: 50364.7, netProfit: 6991.8, ebitda: 8665.7, assets: 11789.5 },
  { year: "2020", revenue: 68337.2, netProfit: 11966.2, ebitda: 14853.0, assets: 21593.9 },
  { year: "2021", revenue: 76292.2, netProfit: 10877.9, ebitda: 13522.1, assets: 32934.4 },
  { year: "2022", revenue: 72987.8, netProfit: 4173.2, ebitda: 4989.4, assets: 36041.9 },
  { year: "2023", revenue: 82591.1, netProfit: 6824.6, ebitda: 8401.2, assets: 39647.6 },
  { year: "2024", revenue: 95072.7, netProfit: 5906.2, ebitda: 7174.0, assets: 39523.9 },
];

const balanceData2023 = {
  assets: [
    { name: "Aktywa trwałe", value: 25231.5, color: "hsl(var(--primary))" },
    { name: "Aktywa obrotowe", value: 14416.1, color: "hsl(var(--chart-2))" },
  ],
  liabilities: [
    { name: "Kapitał własny", value: 33764.3, color: "hsl(var(--success))" },
    { name: "Zobowiązania", value: 5883.3, color: "hsl(var(--chart-4))" },
  ],
};

const valuationData = [
  { year: "2018", valuation: 47334.2 },
  { year: "2019", valuation: 67576.4 },
  { year: "2020", valuation: 105756.2 },
  { year: "2021", valuation: 114007.4 },
  { year: "2022", valuation: 87276.4 },
  { year: "2023", valuation: 107682.4 },
  { year: "2024", valuation: 110479.0 },
];

const profitabilityMetrics = [
  { year: "2018", roa: 76, roe: 157, operatingMargin: 15, netMargin: 12 },
  { year: "2019", roa: 59, roe: 87, operatingMargin: 17, netMargin: 14 },
  { year: "2020", roa: 55, roe: 73, operatingMargin: 22, netMargin: 18 },
  { year: "2021", roa: 33, roe: 42, operatingMargin: 18, netMargin: 14 },
  { year: "2022", roa: 12, roe: 14, operatingMargin: 7, netMargin: 6 },
  { year: "2023", roa: 17, roe: 20, operatingMargin: 10, netMargin: 8 },
  { year: "2024", roa: 15, roe: 19, operatingMargin: 8, netMargin: 6 },
];

const companyInfo = {
  name: "BODY CHIEF SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  brandName: "Body Chief",
  krs: "0000713725",
  nip: "7792479825",
  regon: "369298976",
  address: "ul. Grzybowa 10, 62-081 Wysogotowo",
  voivodeship: "Wielkopolskie",
  website: "www.bodychief.pl",
  email: "sekretariat@bodychief.pl",
  foundedYear: "2017",
  businessType: "Catering dietetyczny",
  description: "Body Chief to firma cateringowa specjalizująca się w dostarczaniu diety pudełkowej. Oferuje 19 rodzajów diet pudełkowych i 2 linie diet sokowych. Stosuje świeże, naturalne składniki bez konserwantów. Wykorzystuje ekologiczne opakowania ograniczające plastik. Dostawa do ponad 1200 miejscowości w Polsce. Dbałość o różnorodność i smak potraw z różnych kuchni świata.",
  capitalStock: 100000,
};

export default function BodyChief() {
  const latestYear = financialData[financialData.length - 1];
  const previousYear = financialData[financialData.length - 2];
  const revenueGrowth = ((latestYear.revenue - previousYear.revenue) / previousYear.revenue * 100).toFixed(1);

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
                  src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139894630-5hauxe.png" 
                  alt="Body Chief logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{companyInfo.brandName}</h1>
                <p className="text-lg text-muted-foreground mb-2">{companyInfo.name}</p>
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
              <div className="text-2xl font-bold">{(latestYear.revenue / 1000).toFixed(1)} mln zł</div>
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
              <div className="text-2xl font-bold">{(latestYear.netProfit / 1000).toFixed(1)} mln zł</div>
              <p className="text-xs text-muted-foreground mt-1">
                Stabilny wynik finansowy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wycena firmy</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(valuationData[valuationData.length - 1].valuation / 1000).toFixed(1)} mln zł</div>
              <p className="text-xs text-muted-foreground mt-1">
                Wycena na 2024
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lokalizacje</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1200+</div>
              <p className="text-xs text-muted-foreground mt-1">
                miejscowości w Polsce
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
                <CardTitle>Przychody i Zyski (2018-2024)</CardTitle>
                <CardDescription>Dynamika wzrostu przychodów i wyników finansowych</CardDescription>
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
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Przychody (tys. zł)" />
                      <Line type="monotone" dataKey="netProfit" stroke="hsl(var(--success))" strokeWidth={2} name="Zysk netto (tys. zł)" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Porównanie Rok do Roku</CardTitle>
                <CardDescription>Wzrost przychodów w poszczególnych latach</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    revenue: {
                      label: "Przychody",
                      color: "hsl(var(--chart-1))",
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
                      <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Przychody (tys. zł)" />
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
                  <div className="text-3xl font-bold">{(latestYear.assets / 1000).toFixed(1)} mln zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Stan na koniec 2024</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>EBITDA 2024</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{(latestYear.ebitda / 1000).toFixed(1)} mln zł</div>
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
                  <div className="text-3xl font-bold">{profitabilityMetrics[6].roa}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROE 2024</CardTitle>
                  <CardDescription>Zwrot z kapitału</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[6].roe}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża operacyjna</CardTitle>
                  <CardDescription>2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[6].operatingMargin}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża netto</CardTitle>
                  <CardDescription>2024</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[6].netMargin}%</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trendy Rentowności (ROA i ROE)</CardTitle>
                <CardDescription>Wskaźniki zwrotu w latach 2018-2024</CardDescription>
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
                  <CardTitle>Struktura Aktywów 2023</CardTitle>
                  <CardDescription>Podział aktywów (tys. zł)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={balanceData2023.assets}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={(entry) => `${(entry.value / 1000).toFixed(1)}M`}
                        >
                          {balanceData2023.assets.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(1)} mln zł`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {balanceData2023.assets.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{(item.value / 1000).toFixed(1)} mln zł</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Struktura Pasywów 2023</CardTitle>
                  <CardDescription>Kapitał i zobowiązania (tys. zł)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={balanceData2023.liabilities}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={(entry) => `${(entry.value / 1000).toFixed(1)}M`}
                        >
                          {balanceData2023.liabilities.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(1)} mln zł`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {balanceData2023.liabilities.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{(item.value / 1000).toFixed(1)} mln zł</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Wskaźnik Zadłużenia</CardTitle>
                <CardDescription>Relacja zobowiązań do aktywów w czasie</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Wskaźnik zadłużenia 2024</span>
                      <span className="text-2xl font-bold">21%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Niskie zadłużenie - zdrowa struktura finansowa
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Valuation Tab */}
          <TabsContent value="valuation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Wycena Firmy w Czasie</CardTitle>
                <CardDescription>Średnia wartość organizacji (tys. zł)</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    valuation: {
                      label: "Wycena",
                      color: "hsl(var(--chart-5))",
                    },
                  }}
                  className="h-[350px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={valuationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="valuation" 
                        stroke="hsl(var(--chart-5))" 
                        fill="hsl(var(--chart-5))" 
                        fillOpacity={0.6}
                        name="Wycena (tys. zł)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Obecna Wycena</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{(valuationData[valuationData.length - 1].valuation / 1000).toFixed(1)} mln zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Średnia wartość 2024</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Szczyt wyceny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">114.0 mln zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Rok 2021</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wzrost wyceny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">+2.6%</div>
                  <p className="text-xs text-muted-foreground mt-2">vs rok 2023</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil Firmy</CardTitle>
                <CardDescription>Szczegółowe informacje o organizacji</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-2">Dane podstawowe</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nazwa handlowa:</span>
                        <span className="font-medium">{companyInfo.brandName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Forma prawna:</span>
                        <span className="font-medium">Sp. z o.o.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rok założenia:</span>
                        <span className="font-medium">{companyInfo.foundedYear}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Województwo:</span>
                        <span className="font-medium">{companyInfo.voivodeship}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Kontakt</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Adres:</span>
                        <span className="font-medium">{companyInfo.address}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Strona www:</span>
                        <a href={`https://${companyInfo.website}`} className="font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                          {companyInfo.website}
                        </a>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Email:</span>
                        <span className="font-medium">{companyInfo.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Opis działalności</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {companyInfo.description}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Kluczowe informacje</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">19</div>
                      <div className="text-sm text-muted-foreground">Rodzajów diet pudełkowych</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">2</div>
                      <div className="text-sm text-muted-foreground">Linie diet sokowych</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">1200+</div>
                      <div className="text-sm text-muted-foreground">Miejscowości w Polsce</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">{(latestYear.revenue / 1000).toFixed(0)}M</div>
                      <div className="text-sm text-muted-foreground">Przychody 2024 (zł)</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Wartości firmy</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🌱 Naturalne składniki</div>
                      <div className="text-xs text-muted-foreground mt-1">Bez konserwantów i sztucznych dodatków</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">♻️ Ekologiczne opakowania</div>
                      <div className="text-xs text-muted-foreground mt-1">Ograniczenie plastiku w opakowaniach</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
