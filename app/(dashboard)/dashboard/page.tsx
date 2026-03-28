'use client';

import { KpiCard } from "@/components/dashboard/KpiCard";
import { BrandAverageChart } from "@/components/dashboard/BrandAverageChart";
import { BrandPriceTrends } from "@/components/dashboard/BrandPriceTrends";
import { DiscountTrendsChart } from "@/components/dashboard/DiscountTrendsChart";
import { PriceChangesTable } from "@/components/dashboard/PriceChangesTable";
import { ActiveAlertsSection } from "@/components/dashboard/ActiveAlertsSection";
import { Building2, TrendingUp, Percent, RefreshCw } from "lucide-react";
import { useDashboardStats } from "@/hooks/supabase/useDashboardStats";
import { subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/contexts/CountryContext";

export default function DashboardPage() {
  const { selectedCountry } = useCountry();
  const { data, isLoading, isFetching, refetch } = useDashboardStats();

  const currencySymbol = selectedCountry === "Czechy" ? "Kč" : "zł";

  // Date filters for consistent data across charts (last 30 days)
  const dateFrom = subDays(new Date(), 30);
  const dateTo = new Date();

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Odświeżanie..." : "Odśwież dane"}
        </Button>
      </div>

      {/* Active Alerts Section */}
      <ActiveAlertsSection />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-6 animate-pulse border">
                <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <KpiCard
              title="Największy Wzrost Ceny"
              value={data?.biggestChange ? `${data.biggestChange.brand_name}` : "N/A"}
              subtitle={data?.biggestChange ? data.biggestChange.package_name : "Brak istotnych zmian"}
              icon={<TrendingUp className="h-4 w-4" />}
              isFetching={isFetching}
              change={
                data?.biggestChange
                  ? {
                      value: `${data.biggestChange.new_price.toFixed(2)} ${currencySymbol}`,
                      type: "increase" as const,
                      period: `+${data.biggestChange.change_percentage.toFixed(1)}%`,
                    }
                  : undefined
              }
            />

            <KpiCard
              title="Średnia Cena Rynkowa"
              value={`${(data?.averagePrice || 0).toFixed(2)} ${currencySymbol}`}
              subtitle="cena za dzień"
              icon={<TrendingUp className="h-4 w-4" />}
              isFetching={isFetching}
              change={{
                value: `${(data?.priceChange || 0) > 0 ? "+" : ""}${(data?.priceChange || 0).toFixed(1)}%`,
                type:
                  (data?.priceChange || 0) > 0
                    ? "increase"
                    : (data?.priceChange || 0) < 0
                    ? "decrease"
                    : "neutral",
                period: "vs poprzednie 7 dni",
              }}
            />

            <KpiCard
              title="Aktywne Marki"
              value={data?.activeBrands || 0}
              subtitle="marki w systemie"
              icon={<Building2 className="h-4 w-4" />}
              change={{
                value: `${data?.activePackages || 0} pakietów`,
                type: "neutral",
                period: "łącznie dostępnych",
              }}
            />

            <KpiCard
              title="Aktywne Rabaty"
              value={data?.activeDiscounts || 0}
              subtitle="obecnie aktywnych promocji"
              icon={<Percent className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Discount Trends */}
      <DiscountTrendsChart filterDateFrom={dateFrom} filterDateTo={dateTo} />

      {/* Brand Average Chart */}
      <BrandAverageChart showAllPackages={true} showLogosOnXAxis={true} />

      {/* Brand Price Trends Chart */}
      <BrandPriceTrends />

      {/* Recent Changes */}
      <PriceChangesTable limit={10} />
    </div>
  );
}
