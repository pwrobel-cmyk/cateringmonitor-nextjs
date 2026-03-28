// @ts-nocheck
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { ArrowLeft, FileDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import Link from "next/link";

// Financial data for Kuchnia Vikinga (2021-2023)
const financialData = [
  { year: "2021", revenue: 46693.0, netProfit: 8565.5, ebitda: 8601.3, assets: 7702.2 },
  { year: "2022", revenue: 78696.0, netProfit: 9469.2, ebitda: 12014.0, assets: 22555.1 },
  { year: "2023", revenue: 267311.7, netProfit: 37306.0, ebitda: 43777.1, assets: 95422.4 }
];

// Balance sheet data 2023
const balanceData2023 = {
  assets: {
    fixed: 66267.3,
    current: 29155.0,
    total: 95422.4
  },
  liabilities: {
    equity: 29232.8,
    debt: 66189.6,
    total: 95422.4
  }
};

// Company valuation data
const valuationData = [
  { year: "2021", value: 68452.4 },
  { year: "2022", value: 97125.8 },
  { year: "2023", value: 349356.5 }
];

// Profitability metrics
const profitabilityMetrics = [
  { year: "2021", roa: 111, roe: 210, operatingMargin: 18, netMargin: 18 },
  { year: "2022", roa: 42, roe: 105, operatingMargin: 15, netMargin: 12 },
  { year: "2023", roa: 39, roe: 128, operatingMargin: 16, netMargin: 14 }
];

// Company information
const companyInfo = {
  name: "WSCHODNI FRONT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  brandName: "Kuchnia Vikinga",
  krs: "0000970748",
  nip: "5423314760",
  regon: "380164402",
  address: "UL. HANDLOWA, 5",
  city: "BIAŁYSTOK",
  postalCode: "15-399",
  voivodeship: "PODLASKIE",
  website: "www.kuchniavikinga.pl",
  email: "faktury@kuchniavikinga.pl",
  legalForm: "SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  shareCapital: "5,000.00 PLN",
  description: "Kuchnia Vikinga to uznany dostawca zdrowych cateringów dietetycznych, znanych jako diety pudełkowe. Firma oferuje 13 gotowych diet i 5 wariantów z wyborem posiłków, obsługując ponad 5400 miejscowości. Specjalizuje się w dietach wegańskich, ketogenicznych, low-carb oraz dla osób z problemami trawiennymi.",
  founded: "2021",
  estimatedClients: "5400+",
  avgOrderValue: "38.90 PLN",
  customerSatisfaction: "4.5/5"
};

const COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  quinary: "hsl(var(--chart-5))"
};

export default function KuchniaVikinga() {
  const latestYear = financialData[financialData.length - 1];
  const previousYear = financialData[financialData.length - 2];
  const revenueGrowth = ((latestYear.revenue - previousYear.revenue) / previousYear.revenue * 100).toFixed(1);
  const profitGrowth = ((latestYear.netProfit - previousYear.netProfit) / previousYear.netProfit * 100).toFixed(1);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.setFontSize(20);
    doc.text("Kuchnia Vikinga - Raport Finansowy 2023", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Przychody 2023: ${(latestYear.revenue / 1000).toFixed(1)} mln zl`, 20, 40);
    doc.text(`Zysk netto 2023: ${(latestYear.netProfit / 1000).toFixed(1)} mln zl`, 20, 50);
    doc.text(`Wycena firmy: ${(valuationData[valuationData.length - 1].value / 1000).toFixed(1)} mln zl`, 20, 60);
    doc.text(`Wzrost przychodow: +${revenueGrowth}% vs 2022`, 20, 70);
    doc.text(`EBITDA 2023: ${(latestYear.ebitda / 1000).toFixed(1)} mln zl`, 20, 80);
    doc.text(`Aktywa ogolem: ${(latestYear.assets / 1000).toFixed(1)} mln zl`, 20, 90);
    
    doc.setFontSize(14);
    doc.text("Informacje o firmie:", 20, 110);
    doc.setFontSize(10);
    doc.text(`Nazwa: ${companyInfo.name}`, 20, 120);
    doc.text(`KRS: ${companyInfo.krs} | NIP: ${companyInfo.nip}`, 20, 130);
    doc.text(`Adres: ${companyInfo.address}, ${companyInfo.postalCode} ${companyInfo.city}`, 20, 140);
    doc.text(`Rok zalozenia: ${companyInfo.founded}`, 20, 150);
    
    doc.save("kuchnia-vikinga-raport-2023.pdf");
  };

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Breadcrumb & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/reports">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-4">
              <img 
                src="https://jpwabrhowkjmuaxnnfhk.supabase.co/storage/v1/object/public/brand-logos/logos/1759139828363-253v6o.png" 
                alt="Kuchnia Vikinga Logo" 
                className="h-12 w-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold">{companyInfo.brandName}</h1>
                <p className="text-sm text-muted-foreground">
                  KRS: {companyInfo.krs} | NIP: {companyInfo.nip}
                </p>
              </div>
            </div>
          </div>
          <Button onClick={handleDownloadPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Pobierz PDF
          </Button>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Przychody 2023</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">267.3M zł</div>
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +{revenueGrowth}% vs 2022
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zysk Netto 2023</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">37.3M zł</div>
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +{profitGrowth}% vs 2022
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wycena Spółki</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">349.4M zł</div>
              <p className="text-xs text-muted-foreground mt-1">
                Średnia wycena 2023
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ryzyko Niewypłacalności</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">Niskie</div>
              <p className="text-xs text-muted-foreground mt-1">
                Stabilna kondycja finansowa
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
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
                <CardTitle>Trendy Przychodów i Zysku</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financialData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}M`} />
                      <Tooltip 
                        formatter={(value: number) => `${(value/1000).toFixed(1)}M zł`}
                        labelFormatter={(label) => `Rok ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={COLORS.primary} 
                        strokeWidth={3}
                        name="Przychody"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="netProfit" 
                        stroke={COLORS.secondary} 
                        strokeWidth={3}
                        name="Zysk netto"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wzrost Rok do Roku</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { category: "Przychody 2022", value: 68.5 },
                        { category: "Przychody 2023", value: 239.6 },
                        { category: "Zysk 2022", value: 10.5 },
                        { category: "Zysk 2023", value: 294.0 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="category" angle={-15} textAnchor="end" height={80} />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Bar dataKey="value" fill={COLORS.tertiary} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Aktywa Ogółem 2023</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">95.4M zł</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Wzrost o 323.1% względem 2022
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>EBITDA 2023</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">43.8M zł</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Marża EBITDA: 16.4%
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="profitability" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>ROA 2023</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">39%</div>
                  <p className="text-sm text-muted-foreground mt-2">Zwrot z aktywów</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ROE 2023</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">128%</div>
                  <p className="text-sm text-muted-foreground mt-2">Zwrot z kapitału</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża Operacyjna</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">16%</div>
                  <p className="text-sm text-muted-foreground mt-2">Efektywność operacyjna</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marża Netto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">14%</div>
                  <p className="text-sm text-muted-foreground mt-2">Rentowność netto</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trendy Rentowności</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={profitabilityMetrics}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="roa" 
                        stackId="1"
                        stroke={COLORS.primary} 
                        fill={COLORS.primary}
                        fillOpacity={0.6}
                        name="ROA"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="roe" 
                        stackId="2"
                        stroke={COLORS.secondary} 
                        fill={COLORS.secondary}
                        fillOpacity={0.6}
                        name="ROE"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marże Operacyjna i Netto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={profitabilityMetrics}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="operatingMargin" 
                        stroke={COLORS.tertiary} 
                        strokeWidth={3}
                        name="Marża operacyjna"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="netMargin" 
                        stroke={COLORS.quaternary} 
                        strokeWidth={3}
                        name="Marża netto"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Tab */}
          <TabsContent value="balance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Struktura Aktywów 2023</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Aktywa trwałe", value: balanceData2023.assets.fixed },
                            { name: "Aktywa obrotowe", value: balanceData2023.assets.current }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill={COLORS.primary} />
                          <Cell fill={COLORS.secondary} />
                        </Pie>
                        <Tooltip formatter={(value: number) => `${(value/1000).toFixed(1)}M zł`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Struktura Pasywów 2023</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Kapitał własny", value: balanceData2023.liabilities.equity },
                            { name: "Zobowiązania", value: balanceData2023.liabilities.debt }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill={COLORS.tertiary} />
                          <Cell fill={COLORS.quaternary} />
                        </Pie>
                        <Tooltip formatter={(value: number) => `${(value/1000).toFixed(1)}M zł`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wskaźnik Zadłużenia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">69%</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Zobowiązania / Aktywa
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Kapitał Własny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">29.2M zł</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    31% wartości aktywów
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wskaźnik Płynności</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0.44</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Aktywa obrotowe / Zobowiązania
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Wzrost Aktywów</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}M`} />
                      <Tooltip 
                        formatter={(value: number) => `${(value/1000).toFixed(1)}M zł`}
                        labelFormatter={(label) => `Rok ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="assets" 
                        stroke={COLORS.quinary} 
                        fill={COLORS.quinary}
                        fillOpacity={0.6}
                        name="Aktywa"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Valuation Tab */}
          <TabsContent value="valuation" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Minimalna Wycena</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">21.9M zł</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Konserwatywne podejście
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Średnia Wycena</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">349.4M zł</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Najbardziej prawdopodobna
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Maksymalna Wycena</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">668.3M zł</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Optymistyczny scenariusz
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trend Wyceny Spółki</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={valuationData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}M`} />
                      <Tooltip 
                        formatter={(value: number) => `${(value/1000).toFixed(1)}M zł`}
                        labelFormatter={(label) => `Rok ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={COLORS.primary} 
                        fill={COLORS.primary}
                        fillOpacity={0.7}
                        name="Wycena"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metodologia Wyceny</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Metoda DCF (Discounted Cash Flow)</h4>
                  <p className="text-sm text-muted-foreground">
                    Wycena oparta na zdyskontowanych przepływach pieniężnych, uwzględniająca przyszłe zyski i koszty kapitału.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Mnożniki Rynkowe</h4>
                  <p className="text-sm text-muted-foreground">
                    Porównanie z podobnymi firmami w branży cateringowej, z uwzględnieniem wskaźników P/E i EV/EBITDA.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Kluczowe Parametry</h4>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Stopa dyskontowa (WACC): 10-12%</li>
                    <li>Prognozowany wzrost: 15-20% rocznie</li>
                    <li>Terminal growth rate: 3%</li>
                    <li>Mnożnik EV/EBITDA: 8-10x</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informacje o Spółce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pełna nazwa</p>
                    <p className="text-base">{companyInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nazwa handlowa</p>
                    <p className="text-base">{companyInfo.brandName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Adres</p>
                    <p className="text-base">{companyInfo.address}, {companyInfo.postalCode} {companyInfo.city}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Województwo</p>
                    <p className="text-base">{companyInfo.voivodeship}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">KRS</p>
                    <p className="text-base">{companyInfo.krs}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">NIP</p>
                    <p className="text-base">{companyInfo.nip}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">REGON</p>
                    <p className="text-base">{companyInfo.regon}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Forma prawna</p>
                    <p className="text-base">Sp. z o.o.</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Strona WWW</p>
                    <p className="text-base">{companyInfo.website}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-base">{companyInfo.email}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Opis działalności</p>
                  <p className="text-base leading-relaxed">{companyInfo.description}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dane Operacyjne</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rok założenia</p>
                    <p className="text-2xl font-bold">{companyInfo.founded}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Obsługiwane miejscowości</p>
                    <p className="text-2xl font-bold">{companyInfo.estimatedClients}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Średnia wartość zamówienia</p>
                    <p className="text-2xl font-bold">{companyInfo.avgOrderValue}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Satysfakcja klientów</p>
                    <p className="text-2xl font-bold">{companyInfo.customerSatisfaction}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analiza Ryzyka</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <p className="font-semibold">Niskie ryzyko niewypłacalności</p>
                    <p className="text-sm text-muted-foreground">
                      Bardzo dynamiczny wzrost przychodów i zysków, stabilna pozycja na rynku.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <p className="font-semibold">Silne wskaźniki rentowności</p>
                    <p className="text-sm text-muted-foreground">
                      ROE na poziomie 128%, ROA 39%, marża netto 14% - wskaźniki znacznie powyżej średniej branżowej.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-semibold">Podwyższone zadłużenie</p>
                    <p className="text-sm text-muted-foreground">
                      Wskaźnik zadłużenia 69% wymaga monitorowania, jednak wzrost aktywów go uzasadnia.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  <div>
                    <p className="font-semibold">Wysoka skala operacyjna</p>
                    <p className="text-sm text-muted-foreground">
                      Obsługa 5400+ miejscowości, szerokie portfolio diet, silna pozycja konkurencyjna.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
