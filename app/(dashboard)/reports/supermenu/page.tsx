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

// Financial data from uploaded files (2020-2023, converted to thousands)
const financialData = [
  { year: "2020", revenue: 13756.4, netProfit: 2011.2, ebitda: 2011.3, assets: 6350.4 },
  { year: "2021", revenue: 37169.5, netProfit: 9445.9, ebitda: 9449.0, assets: 6723.9 },
  { year: "2022", revenue: 41234.2, netProfit: 4342.8, ebitda: 4588.6, assets: 7109.0 },
  { year: "2023", revenue: 32279.5, netProfit: 176.9, ebitda: 268.1, assets: 8563.3 },
];

const balanceData2023 = {
  assets: [
    { name: "Aktywa trwałe", value: 3979.7, color: "hsl(var(--primary))" },
    { name: "Aktywa obrotowe", value: 3673.0, color: "hsl(var(--chart-2))" },
    { name: "Należne wpłaty na kapitał", value: 910.6, color: "hsl(var(--chart-3))" },
  ],
  liabilities: [
    { name: "Kapitał własny", value: 3720.3, color: "hsl(var(--success))" },
    { name: "Zobowiązania", value: 4843.0, color: "hsl(var(--chart-4))" },
  ],
};

const valuationData = [
  { year: "2020", valuation: 20539.2 },
  { year: "2021", valuation: 65353.4 },
  { year: "2022", valuation: 47624.1 },
  { year: "2023", valuation: 25017.4 },
];

const profitabilityMetrics = [
  { year: "2020", roa: 32, roe: 45, operatingMargin: 15, netMargin: 15 },
  { year: "2021", roa: 140, roe: 254, operatingMargin: 25, netMargin: 25 },
  { year: "2022", roa: 61, roe: 118, operatingMargin: 11, netMargin: 11 },
  { year: "2023", roa: 2, roe: 5, operatingMargin: 1, netMargin: 1 },
];

const companyInfo = {
  name: "EAT BY ANN SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ SPÓŁKA KOMANDYTOWA",
  brandName: "SuperMenu",
  krs: "0000963053",
  nip: "1133012310",
  regon: "385763515",
  address: "ul. Omulewska 27, 04-128 Warszawa",
  voivodeship: "Mazowieckie",
  website: "www.supermenu.com.pl",
  email: "kontakt@supermenu.com.pl",
  foundedYear: "2020",
  businessType: "Catering dietetyczny",
  description: "Zdrowy catering dietetyczny dla odbiorców zewnętrznych. Diety autorskie, dla aktywnych, redukcyjne, zdrowotne. Brak białego cukru, pszenicy, surowego mleka krowiego. Ekologiczne składniki i opcja wyboru menu.",
};

export default function SuperMenu() {
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
                  src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759140646846-93a7f.png" 
                  alt="SuperMenu logo" 
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
              <CardTitle className="text-sm font-medium">Przychody 2023</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestYear.revenue.toLocaleString('pl-PL')} k zł</div>
              <p className="text-xs text-destructive flex items-center mt-1">
                <TrendingDown className="h-3 w-3 mr-1" />
                {revenueGrowth}% vs 2022
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zysk netto 2023</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestYear.netProfit.toLocaleString('pl-PL')} k zł</div>
              <p className="text-xs text-muted-foreground mt-1">
                Spadek rentowności
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
                Wycena na 2023
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Marża EBITDA</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{((latestYear.ebitda / latestYear.revenue) * 100).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Efektywność operacyjna
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
                <CardTitle>Przychody i Zyski (2020-2023)</CardTitle>
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
                      <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Przychody (k zł)" />
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
                  <p className="text-xs text-muted-foreground mt-2">Stan na koniec 2023</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>EBITDA 2023</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{latestYear.ebitda.toLocaleString('pl-PL')} k zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Zysk operacyjny przed amortyzacją</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wzrost 2021</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">+170.2%</div>
                  <p className="text-xs text-muted-foreground mt-2">Najlepszy rok przychodowy</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="profitability" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>ROA 2023</CardTitle>
                  <CardDescription>Zwrot z aktywów</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[3].roa}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROE 2023</CardTitle>
                  <CardDescription>Zwrot z kapitału</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[3].roe}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża operacyjna</CardTitle>
                  <CardDescription>2023</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[3].operatingMargin}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża netto</CardTitle>
                  <CardDescription>2023</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{profitabilityMetrics[3].netMargin}%</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trendy Rentowności (ROA i ROE)</CardTitle>
                <CardDescription>Wskaźniki zwrotu w latach 2020-2023</CardDescription>
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
                  <CardDescription>Podział aktywów (k zł)</CardDescription>
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
                          label={(entry) => `${entry.value.toFixed(0)}k`}
                        >
                          {balanceData2023.assets.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)} k zł`} />
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
                        <span className="text-sm font-semibold">{item.value.toFixed(1)} k zł</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Struktura Pasywów 2023</CardTitle>
                  <CardDescription>Kapitał i zobowiązania (k zł)</CardDescription>
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
                          label={(entry) => `${entry.value.toFixed(0)}k`}
                        >
                          {balanceData2023.liabilities.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)} k zł`} />
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
                        <span className="text-sm font-semibold">{item.value.toFixed(1)} k zł</span>
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
                  <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Wskaźnik zadłużenia 2023</span>
                      <span className="text-2xl font-bold">57%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Rosnące zadłużenie - wymaga uwagi
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
                <CardDescription>Średnia wartość organizacji (k zł)</CardDescription>
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
                        name="Wycena (k zł)"
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
                  <p className="text-xs text-muted-foreground mt-2">Średnia wartość 2023</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Szczyt wyceny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">65.4 mln zł</div>
                  <p className="text-xs text-muted-foreground mt-2">Rok 2021</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Zmiana wyceny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">-47.5%</div>
                  <p className="text-xs text-muted-foreground mt-2">vs rok 2022</p>
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
                        <span className="font-medium">Sp. komandytowa</span>
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
                  <h3 className="font-semibold mb-2">Kluczowe cechy</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🌱 Ekologiczne składniki</div>
                      <div className="text-xs text-muted-foreground mt-1">Naturalne produkty wysokiej jakości</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🚫 Bez białego cukru</div>
                      <div className="text-xs text-muted-foreground mt-1">Zdrowsze alternatywy słodzenia</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🌾 Bez pszenicy</div>
                      <div className="text-xs text-muted-foreground mt-1">Alternatywne źródła węglowodanów</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🥛 Bez mleka krowiego</div>
                      <div className="text-xs text-muted-foreground mt-1">Opcje roślinne i bezlaktozowe</div>
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
