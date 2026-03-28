'use client';

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TrendingUp, TrendingDown, Loader2, ArrowRight } from "lucide-react";
import { usePriceChanges } from "@/hooks/supabase/usePriceHistory";
import { getCurrencySymbol } from "@/lib/utils";
import { useCountry } from "@/contexts/CountryContext";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

interface PriceChangesTableProps {
  limit?: number;
}

export function PriceChangesTable({ limit }: PriceChangesTableProps) {
  const { selectedCountry } = useCountry();
  const currencySymbol = getCurrencySymbol(selectedCountry === "Czechy" ? "CZK" : "PLN");
  const { data: priceChanges, isLoading, error } = usePriceChanges();
  const [currentPage, setCurrentPage] = useState(1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ostatnie Zmiany Cen</CardTitle>
          <CardDescription>Ładowanie zmian cenowych...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !priceChanges || priceChanges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ostatnie Zmiany Cen</CardTitle>
          <CardDescription>
            {error ? "Błąd podczas ładowania danych" : "Brak zmian cenowych w ostatnim dniu"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground">
          {error ? "Nie można załadować zmian cenowych" : "Brak danych do wyświetlenia"}
        </CardContent>
      </Card>
    );
  }

  // If limit is provided, show only that many items without pagination
  const displayItems = limit ? priceChanges.slice(0, limit) : priceChanges;

  // Calculate pagination (only if no limit is set)
  const totalPages = limit ? 1 : Math.ceil(priceChanges.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = limit ? displayItems : priceChanges.slice(startIndex, endIndex);

  // Smart pagination: show limited page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5; // Show max 5 page numbers on desktop

    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if total is small
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    // Adjust range if at the beginning or end
    if (currentPage <= 3) {
      endPage = Math.min(totalPages - 1, 4);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - 3);
    }

    // Add ellipsis after first page if needed
    if (startPage > 2) {
      pages.push('...');
    }

    // Add pages in range
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page
    pages.push(totalPages);

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ostatnie Zmiany Cen</CardTitle>
            <CardDescription>
              Zmiany cenowe w ostatnim dniu ({priceChanges.length} zmian)
            </CardDescription>
          </div>
          {limit && priceChanges.length > limit && (
            <Link
              href="/packages?tab=history"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
            >
              Zobacz wszystkie
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marka</TableHead>
              <TableHead>Pakiet</TableHead>
              <TableHead>Kcal</TableHead>
              <TableHead>Zmiana</TableHead>
              <TableHead>Cena</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  <div className="flex items-center justify-center w-12 h-12">
                    {item.brandLogoUrl ? (
                      <img
                        src={item.brandLogoUrl}
                        alt={`${item.brand} logo`}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                        {item.brand}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{item.package}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {item.kcal}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    {item.changePercent > 0 ? (
                      <TrendingUp className="h-3 w-3 text-destructive" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-success" />
                    )}
                    <span className={item.changePercent > 0 ? "text-destructive" : "text-success"}>
                      {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.newPrice.toFixed(2)} {currencySymbol}</span>
                    <span className="text-xs text-muted-foreground line-through">
                      {item.oldPrice.toFixed(2)} {currencySymbol}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(item.changeDate).toLocaleDateString('pl-PL')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!limit && totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent className="flex-wrap justify-center gap-1">
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {pageNumbers.map((page, index) => (
                  <PaginationItem key={`${page}-${index}`}>
                    {page === '...' ? (
                      <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
