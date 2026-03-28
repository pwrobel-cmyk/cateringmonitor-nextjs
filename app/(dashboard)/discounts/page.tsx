'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, TrendingDown, Clock, AlertCircle } from "lucide-react";
import { useDiscounts, useDiscountStats } from "@/hooks/supabase/useDiscounts";
import { useBrands } from "@/hooks/supabase/useBrands";
import { DiscountTimeline } from "@/components/discounts/DiscountTimeline";
import { DiscountStatsCard } from "@/components/discounts/DiscountStatsCard";
import { DiscountTrendsChart } from "@/components/dashboard/DiscountTrendsChart";
import { DiscountAlerts } from "@/components/discounts/DiscountAlerts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useState } from "react";

const ITEMS_PER_PAGE = 15;

function DiscountPagination({
  currentPage,
  totalPages,
  setPage,
}: {
  currentPage: number;
  totalPages: number;
  setPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            text="Poprzednia"
            onClick={e => { e.preventDefault(); setPage(Math.max(1, currentPage - 1)); }}
            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        {getPageNumbers().map((page, i) =>
          page === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={e => { e.preventDefault(); setPage(page as number); }}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            text="Następna"
            onClick={e => { e.preventDefault(); setPage(Math.min(totalPages, currentPage + 1)); }}
            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default function Discounts() {
  const { data: discounts, isLoading, error } = useDiscounts();
  const { data: stats } = useDiscountStats();
  const { data: brands } = useBrands();
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [activePage, setActivePage] = useState(1);
  const [existingPage, setExistingPage] = useState(1);
  const [newPage, setNewPage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);

  const handleBrandChange = (value: string | null) => {
    if (!value) return;
    setSelectedBrand(value);
    setActivePage(1);
    setExistingPage(1);
    setNewPage(1);
    setInactivePage(1);
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const activeDiscounts = discounts?.filter(d => {
    if (!d.is_active) return false;
    const validFrom = d.valid_from ? new Date(d.valid_from) : null;
    const validUntil = d.valid_until ? new Date(d.valid_until) : null;
    if (!validFrom && !validUntil) return true;
    const afterStart = !validFrom || validFrom <= todayEnd;
    const beforeEnd = !validUntil || validUntil >= todayStart;
    return afterStart && beforeEnd;
  }) || [];

  const inactiveDiscounts = discounts?.filter(d => {
    if (!d.is_active) return true;
    const validUntil = d.valid_until ? new Date(d.valid_until) : null;
    return validUntil && validUntil < todayStart;
  }) || [];

  const existingCustomersDiscounts = activeDiscounts.filter(d => {
    if (!d.requirements || d.requirements.trim() === "") return true;
    const reqLower = d.requirements.toLowerCase().trim();
    return reqLower.includes("wszyscy") || reqLower.includes("dla wszystkich") ||
           reqLower.includes("istniejący") || reqLower.includes("obecny") || reqLower === "brak";
  });

  const newCustomersDiscounts = activeDiscounts.filter(d => {
    if (!d.requirements || d.requirements.trim() === "") return false;
    const reqLower = d.requirements.toLowerCase().trim();
    return reqLower.includes("nowy") || reqLower.includes("nowi klienci") ||
           reqLower.includes("pierwsze zamówienie") || reqLower.includes("pierwszy");
  });

  const filterByBrand = (discountsList: typeof discounts) => {
    if (!discountsList) return [];
    if (selectedBrand === "all") return discountsList;
    return discountsList.filter(d => d.brand_id?.toString() === selectedBrand);
  };

  const filteredActiveDiscounts = filterByBrand(activeDiscounts);
  const filteredInactiveDiscounts = filterByBrand(inactiveDiscounts);
  const filteredExistingCustomersDiscounts = filterByBrand(existingCustomersDiscounts);
  const filteredNewCustomersDiscounts = filterByBrand(newCustomersDiscounts);

  const paginatedActive = filteredActiveDiscounts.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const paginatedExisting = filteredExistingCustomersDiscounts.slice((existingPage - 1) * ITEMS_PER_PAGE, existingPage * ITEMS_PER_PAGE);
  const paginatedNew = filteredNewCustomersDiscounts.slice((newPage - 1) * ITEMS_PER_PAGE, newPage * ITEMS_PER_PAGE);
  const paginatedInactive = filteredInactiveDiscounts.slice((inactivePage - 1) * ITEMS_PER_PAGE, inactivePage * ITEMS_PER_PAGE);

  const totalActivePages = Math.ceil(filteredActiveDiscounts.length / ITEMS_PER_PAGE);
  const totalExistingPages = Math.ceil(filteredExistingCustomersDiscounts.length / ITEMS_PER_PAGE);
  const totalNewPages = Math.ceil(filteredNewCustomersDiscounts.length / ITEMS_PER_PAGE);
  const totalInactivePages = Math.ceil(filteredInactiveDiscounts.length / ITEMS_PER_PAGE);

  if (error) {
    return (
      <div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Nie udało się załadować rabatów. Spróbuj odświeżyć stronę.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analiza Rabatów</h1>
          <p className="text-muted-foreground mt-2">Szczegółowa analiza aktywnych promocji z podziałem na kategorie</p>
        </div>
        <div className="w-full md:w-64">
          <Select value={selectedBrand} onValueChange={v => v && handleBrandChange(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Wszystkie marki" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie marki</SelectItem>
              {brands?.map(brand => (
                <SelectItem key={brand.id} value={brand.id.toString()}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-3 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <DiscountStatsCard title="Aktywne rabaty" value={filteredActiveDiscounts.length} subtitle="promocji w tym momencie" icon={Percent} trend="neutral" />
          <DiscountStatsCard title="Średni rabat" value={`${stats?.avgPercentage || 0}%`} subtitle="wszystkich promocji" icon={TrendingDown} trend="neutral" />
          <DiscountStatsCard title="Nowi klienci" value={filteredNewCustomersDiscounts.length} subtitle="specjalne oferty" icon={TrendingDown} trend="up" />
          <DiscountStatsCard title="Kończą się wkrótce" value={stats?.expiringSoon || 0} subtitle="w ciągu 7 dni" icon={Clock} trend="down" />
        </div>
      )}

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-5 gap-2">
          <TabsTrigger value="active">Aktywne ({filteredActiveDiscounts.length})</TabsTrigger>
          <TabsTrigger value="existing">Dla wszystkich ({filteredExistingCustomersDiscounts.length})</TabsTrigger>
          <TabsTrigger value="new">Dla nowych ({filteredNewCustomersDiscounts.length})</TabsTrigger>
          <TabsTrigger value="inactive">Nieaktywne ({filteredInactiveDiscounts.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alerty</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
          ) : filteredActiveDiscounts.length > 0 ? (
            <>
              <DiscountTimeline discounts={paginatedActive} />
              <DiscountPagination currentPage={activePage} totalPages={totalActivePages} setPage={setActivePage} />
            </>
          ) : (
            <Card><CardContent className="p-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Brak aktywnych rabatów</h3>
              <p className="text-muted-foreground">Obecnie nie ma dostępnych promocji</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="existing" className="space-y-6">
          <Card className="bg-accent/50 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-primary" />Rabaty dla wszystkich Klientów</CardTitle>
              <CardDescription>Promocje dostępne dla wszystkich klientów, w tym istniejących</CardDescription>
            </CardHeader>
          </Card>
          {!isLoading && filteredExistingCustomersDiscounts.length > 0 && (
            <DiscountTrendsChart
              filterDateFrom={new Date(new Date().setDate(new Date().getDate() - 90))}
              filterDateTo={new Date()}
            />
          )}
          {isLoading ? (
            <div className="space-y-4">{[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
          ) : filteredExistingCustomersDiscounts.length > 0 ? (
            <>
              <DiscountTimeline discounts={paginatedExisting} />
              <DiscountPagination currentPage={existingPage} totalPages={totalExistingPages} setPage={setExistingPage} />
            </>
          ) : (
            <Card><CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Brak rabatów dla wszystkich klientów</h3>
              <p className="text-muted-foreground">Obecnie brak promocji dostępnych dla wszystkich klientów</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-yellow-500" />Rabaty dla nowych Klientów</CardTitle>
              <CardDescription>Promocje dostępne tylko dla nowych klientów</CardDescription>
            </CardHeader>
          </Card>
          {!isLoading && filteredNewCustomersDiscounts.length > 0 && (
            <DiscountTrendsChart
              filterDateFrom={new Date(new Date().setDate(new Date().getDate() - 90))}
              filterDateTo={new Date()}
            />
          )}
          {isLoading ? (
            <div className="space-y-4">{[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
          ) : filteredNewCustomersDiscounts.length > 0 ? (
            <>
              <DiscountTimeline discounts={paginatedNew} />
              <DiscountPagination currentPage={newPage} totalPages={totalNewPages} setPage={setNewPage} />
            </>
          ) : (
            <Card><CardContent className="p-12 text-center">
              <TrendingDown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Brak rabatów dla nowych klientów</h3>
              <p className="text-muted-foreground">Obecnie brak promocji dedykowanych nowym klientom</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" />Nieaktywne rabaty</CardTitle>
              <CardDescription>Promocje, które zostały zakończone lub dezaktywowane</CardDescription>
            </CardHeader>
          </Card>
          {isLoading ? (
            <div className="space-y-4">{[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
          ) : filteredInactiveDiscounts.length > 0 ? (
            <>
              <DiscountTimeline discounts={paginatedInactive} />
              <DiscountPagination currentPage={inactivePage} totalPages={totalInactivePages} setPage={setInactivePage} />
            </>
          ) : (
            <Card><CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Brak nieaktywnych rabatów</h3>
              <p className="text-muted-foreground">Wszystkie rabaty są aktualnie aktywne</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-yellow-500" />Alerty cenowe</CardTitle>
              <CardDescription>Ustawiaj powiadomienia o rabatach dla wybranych marek</CardDescription>
            </CardHeader>
          </Card>
          <DiscountAlerts brands={(brands || []).map(b => ({ id: String(b.id), name: b.name, logo_url: b.logo_url ?? null }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
