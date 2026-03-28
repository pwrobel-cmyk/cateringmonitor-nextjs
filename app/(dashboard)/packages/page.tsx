'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useBrandsWithPackages } from "@/hooks/supabase/useBrandsWithPackages";
import { PriceHistoryTab } from "@/components/packages/PriceHistoryTab";
import { ExportPrices } from "@/components/packages/ExportPrices";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { format, subDays } from "date-fns";
import { getCurrencySymbol } from "@/lib/utils";
import { useCountry } from "@/contexts/CountryContext";

type DateFilter = "today" | "yesterday";

export default function PackagesCalories() {
  const { selectedCountry } = useCountry();
  const { data: userRole } = useUserRole();
  const currencySymbol = getCurrencySymbol(selectedCountry === "Czechy" ? "CZK" : "PLN");
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'packages';
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const filterDate = dateFilter === "today"
    ? format(new Date(), "yyyy-MM-dd")
    : format(subDays(new Date(), 1), "yyyy-MM-dd");

  const { data: brandsData, isLoading, error } = useBrandsWithPackages(filterDate);

  const togglePackage = (packageId: string) => {
    setExpandedPackages(prev => {
      const next = new Set(prev);
      if (next.has(packageId)) next.delete(packageId);
      else next.add(packageId);
      return next;
    });
  };

  const toggleBrand = (brandId: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Card>
          <CardContent className="flex items-center justify-center h-32 text-center p-6">
            <div>
              <p className="text-muted-foreground mb-2">Błąd podczas ładowania danych</p>
              <p className="text-sm text-red-500">{(error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pakiety i Kalorie</h1>
        <p className="text-muted-foreground mt-2">Kompletna lista pakietów z wariantami kalorycznymi i cenami</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-fit">
          <TabsTrigger value="packages">Pakiety</TabsTrigger>
          <TabsTrigger value="history">Historia Cen</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            {(userRole === 'admin' || userRole === 'super_admin') && <ExportPrices />}
            <div className="flex gap-2 ml-auto">
              <Button
                variant={dateFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("today")}
              >
                Dzisiaj
              </Button>
              <Button
                variant={dateFilter === "yesterday" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("yesterday")}
              >
                Wczoraj
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {brandsData?.map(brand => (
              <Collapsible
                key={brand.id}
                open={expandedBrands.has(brand.id)}
                onOpenChange={() => toggleBrand(brand.id)}
              >
                <Card>
                  <CardHeader>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {brand.logo_url ? (
                            <img src={brand.logo_url} alt={brand.name} className="w-12 h-12 object-contain" />
                          ) : (
                            <Package className="w-12 h-12 text-primary" />
                          )}
                          <div className="text-left">
                            <CardTitle className="text-2xl">{brand.name}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{brand.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {brand.packages.filter(pkg => pkg.calorie_variants.some(v => v.price !== null)).length} pakietów
                          </Badge>
                          {expandedBrands.has(brand.id) ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent>
                      {brand.packages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Brak dostępnych pakietów</div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nazwa pakietu</TableHead>
                              <TableHead>Kategoria</TableHead>
                              <TableHead className="text-center">Posiłki/dzień</TableHead>
                              <TableHead className="text-center">Warianty kaloryczne i ceny</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {brand.packages
                              .filter(pkg => pkg.calorie_variants.some(v => v.price !== null))
                              .map(pkg => (
                                <TableRow key={pkg.id}>
                                  <TableCell className="font-medium">{pkg.name}</TableCell>
                                  <TableCell>
                                    {pkg.category ? (
                                      <Badge variant="outline">{pkg.category}</Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">{pkg.meals_per_day || "-"}</TableCell>
                                  <TableCell>
                                    {(() => {
                                      const variantsWithPrices = pkg.calorie_variants.filter(v => v.price !== null);
                                      if (variantsWithPrices.length === 0) {
                                        return <span className="text-muted-foreground text-sm">Brak danych</span>;
                                      }
                                      return (
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="gap-1 text-xs">
                                                <Flame className="h-3 w-3" />
                                                {variantsWithPrices[0].kcal} kcal
                                              </Badge>
                                              <span className="font-semibold text-sm">
                                                {variantsWithPrices[0].price!.toFixed(2)} {currencySymbol}
                                              </span>
                                            </div>
                                            {variantsWithPrices.length > 1 && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => togglePackage(pkg.id)}
                                                className="h-6 text-xs px-2"
                                              >
                                                {expandedPackages.has(pkg.id) ? (
                                                  <><ChevronUp className="h-3 w-3 mr-1" />Zwiń</>
                                                ) : (
                                                  <><ChevronDown className="h-3 w-3 mr-1" />Rozwiń ({variantsWithPrices.length - 1})</>
                                                )}
                                              </Button>
                                            )}
                                          </div>
                                          {variantsWithPrices.length > 1 && expandedPackages.has(pkg.id) && (
                                            <div className="space-y-1.5 pl-2 border-l-2 border-muted">
                                              {variantsWithPrices.slice(1).map((variant, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                  <Badge variant="secondary" className="gap-1 text-xs">
                                                    <Flame className="h-3 w-3" />
                                                    {variant.kcal} kcal
                                                  </Badge>
                                                  <span className="font-semibold text-sm">
                                                    {variant.price!.toFixed(2)} {currencySymbol}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <PriceHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
