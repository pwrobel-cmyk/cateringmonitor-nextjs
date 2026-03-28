'use client';

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBrands } from "@/hooks/supabase/useBrands";
import { usePriceChanges } from "@/hooks/supabase/usePriceHistory";
import { Loader2, TrendingDown, TrendingUp, CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { getCurrencySymbol } from "@/lib/utils";
import { useCountry } from "@/contexts/CountryContext";

const ITEMS_PER_PAGE = 20;

export function PriceHistoryTab() {
  const { selectedCountry } = useCountry();
  const currencySymbol = getCurrencySymbol(selectedCountry === "Czechy" ? "CZK" : "PLN");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedPackage, setSelectedPackage] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: brands } = useBrands();
  const { data: priceChanges, isLoading, error } = usePriceChanges({
    brandId: selectedBrand,
    packageName: selectedPackage,
    dateFrom,
    dateTo,
  });

  const uniquePackages = useMemo(() => {
    if (!priceChanges) return [];
    const packages = new Set(priceChanges.map(change => change.package));
    return Array.from(packages).sort();
  }, [priceChanges]);

  const totalPages = Math.ceil((priceChanges?.length || 0) / ITEMS_PER_PAGE);
  const paginatedChanges = priceChanges?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-center p-6">
          <div>
            <p className="text-muted-foreground mb-2">Błąd podczas ładowania historii cen</p>
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={selectedBrand} onValueChange={v => { if (v) { setSelectedBrand(v); setCurrentPage(1); } }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Wszystkie marki" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie marki</SelectItem>
              {brands?.map(brand => (
                <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPackage} onValueChange={v => { if (v) { setSelectedPackage(v); setCurrentPage(1); } }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Wszystkie pakiety" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie pakiety</SelectItem>
              {uniquePackages.map(pkg => (
                <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger className={buttonVariants({ variant: "outline" }) + " w-[160px] justify-start"}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd.MM.yyyy", { locale: pl }) : "Od daty"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={pl} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger className={buttonVariants({ variant: "outline" }) + " w-[160px] justify-start"}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd.MM.yyyy", { locale: pl }) : "Do daty"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={pl} />
            </PopoverContent>
          </Popover>
        </div>

        {!paginatedChanges || paginatedChanges.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Brak danych o zmianach cen dla wybranych filtrów</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Pakiet</TableHead>
                  <TableHead>Kcal</TableHead>
                  <TableHead className="text-right">Stara cena</TableHead>
                  <TableHead className="text-right">Nowa cena</TableHead>
                  <TableHead className="text-right">Zmiana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedChanges.map((change, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{change.changeDate}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {change.brandLogoUrl && (
                          <img src={change.brandLogoUrl} alt={change.brand} className="w-5 h-5 object-contain" />
                        )}
                        <span className="text-sm">{change.brand}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{change.package}</TableCell>
                    <TableCell className="text-sm">{change.kcal || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{change.oldPrice.toFixed(2)} {currencySymbol}</TableCell>
                    <TableCell className="text-right text-sm">{change.newPrice.toFixed(2)} {currencySymbol}</TableCell>
                    <TableCell className="text-right">
                      <span className={`flex items-center justify-end gap-1 text-sm font-medium ${change.changePercent > 0 ? "text-destructive" : "text-green-600"}`}>
                        {change.changePercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {change.changePercent > 0 ? "+" : ""}{change.changePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                    <PaginationItem key={page}>
                      <PaginationLink isActive={currentPage === page} onClick={() => setCurrentPage(page)}>
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
