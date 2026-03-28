// @ts-nocheck
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Star, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Financial data from uploaded files (2020-2024, converted to thousands)
const financialData = [
  { year: "2020", revenue: 6721.3, netProfit: 285.4, ebitda: 360.2, assets: 464.9 },
  { year: "2021", revenue: 11850.1, netProfit: 445.2, ebitda: 584.0, assets: 565.9 },
  { year: "2022", revenue: 11838.9, netProfit: 445.3, ebitda: 572.7, assets: 565.9 },
  { year: "2023", revenue: 17509.5, netProfit: 156.9, ebitda: 167.8, assets: 930.4 },
  { year: "2024", revenue: 26704.7, netProfit: 283.7, ebitda: 204.2, assets: 1988.2 },
];

const balanceData2023 = {
  assets: [
    { name: "Aktywa trwałe", value: 45.6, color: "hsl(var(--primary))" },
    { name: "Aktywa obrotowe", value: 884.8, color: "hsl(var(--chart-2))" },
  ],
  liabilities: [
    { name: "Kapitał własny", value: 285.7, color: "hsl(var(--success))" },
    { name: "Zobowiązania", value: 644.7, color: "hsl(var(--chart-4))" },
  ],
};

const valuationData = [
  { year: "2020", valuation: 5840.1 },
  { year: "2021", valuation: 10001.2 },
  { year: "2022", valuation: 9993.8 },
  { year: "2023", valuation: 12514.8 },
  { year: "2024", valuation: 18939.4 },
];

const profitabilityMetrics = [
  { year: "2020", roa: 61, roe: 98, operatingMargin: 5, netMargin: 4 },
  { year: "2021", roa: 79, roe: 104, operatingMargin: 5, netMargin: 4 },
  { year: "2022", roa: 79, roe: 8905, operatingMargin: 5, netMargin: 4 },
  { year: "2023", roa: 17, roe: 55, operatingMargin: 1, netMargin: 1 },
  { year: "2024", roa: 14, roe: 14107, operatingMargin: 1, netMargin: 1 },
];

const companyInfo = {
  name: "POMELO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  brandName: "Pomelo",
  krs: "0000819536",
  nip: "5322086932",
  regon: "385112692",
  address: "ul. Klonowa 3C, 05-462 Wiązowna",
  voivodeship: "Mazowieckie",
  website: "www.pomelo.com.pl",
  email: "info@pomelo.com.pl",
  foundedYear: "2019",
  businessType: "Catering dietetyczny",
  description: "Przygotowywanie i dostarczanie żywności dla odbiorców zewnętrznych (katering) do klientów w 3000 lokalizacjach. Szeroka oferta diet, w tym wegetariańska, keto, niskokaloryczna i z wyborem menu. Ekologiczne opakowania oraz dostosowanie posiłków do indywidualnych potrzeb klientów. Konsultacje z dietetykiem w celu wyboru odpowiedniej diety. Dostępność mobilnej aplikacji do zarządzania zamówieniami.",
};

export default function Pomelo() {
  const latestYear = financialData[financialData.length - 1];
  const previousYear = financialData[financialData.length - 2];
  const revenueGrowth = ((latestYear.revenue - previousYear.revenue) / previousYear.revenue * 100).toFixed(1);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.setFontSize(20);
    doc.text("Pomelo - Raport Finansowy 2024", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Przychody 2024: ${(latestYear.revenue / 1000).toFixed(1)} mln zl`, 20, 40);
    doc.text(`Zysk netto 2024: ${latestYear.netProfit.toLocaleString('pl-PL')} tys. zl`, 20, 50);
    doc.text(`Wycena firmy: ${(valuationData[valuationData.length - 1].valuation / 1000).toFixed(1)} mln zl`, 20, 60);
    doc.text(`Wzrost przychodow: +${revenueGrowth}% vs 2023`, 20, 70);
    doc.text(`EBITDA 2024: ${latestYear.ebitda.toLocaleString('pl-PL')} tys. zl`, 20, 80);
    doc.text(`Aktywa ogolem: ${latestYear.assets.toLocaleString('pl-PL')} tys. zl`, 20, 90);
    
    doc.setFontSize(14);
    doc.text("Informacje o firmie:", 20, 110);
    doc.setFontSize(10);
    doc.text(`Nazwa: ${companyInfo.name}`, 20, 120);
    doc.text(`KRS: ${companyInfo.krs} | NIP: ${companyInfo.nip}`, 20, 130);
    doc.text(`Adres: ${companyInfo.address}`, 20, 140);
    doc.text(`Rok zalozenia: ${companyInfo.foundedYear}`, 20, 150);
    
    doc.save("pomelo-raport-2024.pdf");
  };

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
                  src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139868878-xe7bdj.webp" 
                  alt="Pomelo logo" 
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
            <Button variant="outline" onClick={handleDownloadPDF}>
              <FileDown className="mr-2 h-4 w-4" />
              Pobierz PDF
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
              <div className="text-2xl font-bold">{latestYear.netProfit.toLocaleString('pl-PL')} k zł</div>
              <p className="text-xs text-success mt-1">
                Pozytywny wynik finansowy
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
              <div className="text-2xl font-bold">3000+</div>
              <p className="text-xs text-muted-foreground mt-1">
                punktów dostawy w Polsce
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
                  <div className="text-3xl font-bold">N/A</div>
                  <p className="text-xs text-muted-foreground mt-2">Bardzo niski kapitał własny</p>
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
                <CardTitle>Trendy Rentowności (ROA)</CardTitle>
                <CardDescription>Wskaźnik zwrotu z aktywów w latach 2020-2024</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    roa: {
                      label: "ROA",
                      color: "hsl(var(--chart-3))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialData.map((item, idx) => ({ year: item.year, roa: profitabilityMetrics[idx].roa }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Area type="monotone" dataKey="roa" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.6} name="ROA (%)" />
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
                  <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Wskaźnik zadłużenia 2024</span>
                      <span className="text-2xl font-bold">100%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Bardzo wysokie zadłużenie - wymaga restrukturyzacji
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
                  <p className="text-xs text-muted-foreground mt-2">Średnia wartość 2024</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wzrost wyceny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">+51.3%</div>
                  <p className="text-xs text-muted-foreground mt-2">vs rok 2023</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dynamika wzrostu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">+224%</div>
                  <p className="text-xs text-muted-foreground mt-2">Od 2020 do 2024</p>
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
                      <div className="text-2xl font-bold text-primary">3000+</div>
                      <div className="text-sm text-muted-foreground">Lokalizacji w Polsce</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">{(latestYear.revenue / 1000).toFixed(1)}M</div>
                      <div className="text-sm text-muted-foreground">Przychody 2024 (zł)</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">📱 Aplikacja mobilna</div>
                      <div className="text-xs text-muted-foreground mt-1">Zarządzanie zamówieniami</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🥗 Konsultacje dietetyczne</div>
                      <div className="text-xs text-muted-foreground mt-1">Dobór odpowiedniej diety</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Oferta</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🥬 Dieta wegetariańska</div>
                      <div className="text-xs text-muted-foreground mt-1">Zdrowe posiłki roślinne</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">🥑 Dieta keto</div>
                      <div className="text-xs text-muted-foreground mt-1">Nisko-węglowodanowa</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">📉 Dieta niskokaloryczna</div>
                      <div className="text-xs text-muted-foreground mt-1">Redukcja wagi</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">♻️ Ekologiczne opakowania</div>
                      <div className="text-xs text-muted-foreground mt-1">Dbałość o środowisko</div>
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
