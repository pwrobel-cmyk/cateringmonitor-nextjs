'use client';

import { useMemo } from "react";
import { format, startOfWeek, startOfMonth } from "date-fns";

interface Discount {
  percentage: number | null;
  valid_from: string | null;
  valid_until: string | null;
  brands: {
    name: string;
  };
}

interface DiscountSeriesParams {
  discounts: Discount[];
  dateFrom: Date;
  dateTo: Date;
  aggregation: "daily" | "weekly" | "monthly";
}

export function useDiscountSeries({
  discounts,
  dateFrom,
  dateTo,
  aggregation,
}: DiscountSeriesParams) {
  return useMemo(() => {
    if (!discounts || discounts.length === 0) {
      return { chartData: [], brands: [] };
    }

    // Build date series based on aggregation
    const dateSeries: Date[] = [];
    const current = new Date(dateFrom);
    const end = new Date(dateTo);

    while (current <= end) {
      dateSeries.push(new Date(current));

      if (aggregation === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (aggregation === "weekly") {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Get unique brands
    const brands = Array.from(new Set(discounts.map((d) => d.brands.name)));

    // Build chart data
    const chartData = dateSeries.map((date) => {
      const periodStart = new Date(date);
      let periodEnd = new Date(date);

      if (aggregation === "daily") {
        periodEnd.setDate(periodEnd.getDate() + 1);
      } else if (aggregation === "weekly") {
        periodEnd = new Date(startOfWeek(date));
        periodEnd.setDate(periodEnd.getDate() + 7);
      } else {
        periodEnd = new Date(startOfMonth(date));
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const periodStartStr = periodStart.toISOString().split("T")[0];
      const periodEndStr = periodEnd.toISOString().split("T")[0];

      const dataPoint: any = {
        day: format(date, "yyyy-MM-dd"),
      };

      brands.forEach((brandName) => {
        const brandDiscounts = discounts
          .filter((d) => d.brands.name === brandName)
          .filter((d) => {
            if (!d.valid_from) return false;
            const validFrom = new Date(d.valid_from);
            const validUntil = d.valid_until ? new Date(d.valid_until) : null;

            if (validFrom > periodEnd) return false;
            if (validUntil && validUntil < periodStart) return false;

            return true;
          });

        const avgDiscount =
          brandDiscounts.length > 0
            ? brandDiscounts.reduce((sum, d) => sum + (d.percentage ?? 0), 0) /
              brandDiscounts.length
            : 0;

        dataPoint[brandName] = avgDiscount;
      });

      return dataPoint;
    });

    return { chartData, brands };
  }, [discounts, dateFrom, dateTo, aggregation]);
}
