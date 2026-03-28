'use client';

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";

export interface DiscountAlert {
  id: string;
  brandName: string;
  minDiscount: number;
  packageFilter?: string;
}

export interface MatchedAlert {
  alert: DiscountAlert;
  discount: {
    id: string;
    brandName: string;
    percentage: number;
    code: string | null;
    packageName: string | null;
    validFrom: string;
    validUntil: string | null;
  };
}

const ALERTS_STORAGE_KEY = "discount_alerts";

export function useDiscountAlerts() {
  const { selectedCountry } = useCountry();
  const [alerts, setAlerts] = useState<DiscountAlert[]>([]);
  const [activeDiscounts, setActiveDiscounts] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load alerts from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (stored) {
      try {
        setAlerts(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Load dismissed IDs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("dismissed_discount_alerts");
    if (stored) {
      try {
        setDismissedIds(new Set(JSON.parse(stored)));
      } catch {}
    }
  }, []);

  // Fetch active discounts whenever country changes
  useEffect(() => {
    if (alerts.length === 0) return;

    const fetchDiscounts = async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await (supabase as any)
        .from("discounts")
        .select(`
          id,
          percentage,
          code,
          package_name,
          valid_from,
          valid_until,
          brands!inner(name, country)
        `)
        .eq("is_active", true)
        .eq("brands.country", selectedCountry)
        .lte("valid_from", today)
        .or(`valid_until.is.null,valid_until.gte.${today}`);

      if (!error && data) {
        setActiveDiscounts(data);
      }
    };

    fetchDiscounts();
  }, [alerts, selectedCountry]);

  const matchedAlerts = useMemo<MatchedAlert[]>(() => {
    if (alerts.length === 0 || activeDiscounts.length === 0) return [];

    const matched: MatchedAlert[] = [];

    for (const alert of alerts) {
      const matchingDiscounts = activeDiscounts.filter((d) => {
        const brandName = d.brands?.name || "";
        if (brandName.toLowerCase() !== alert.brandName.toLowerCase()) return false;
        if (d.percentage < alert.minDiscount) return false;
        if (alert.packageFilter && d.package_name) {
          if (!d.package_name.toLowerCase().includes(alert.packageFilter.toLowerCase())) {
            return false;
          }
        }
        return true;
      });

      for (const d of matchingDiscounts) {
        const matchId = `${alert.id}-${d.id}`;
        if (!dismissedIds.has(matchId)) {
          matched.push({
            alert,
            discount: {
              id: d.id,
              brandName: d.brands?.name || "",
              percentage: d.percentage,
              code: d.code,
              packageName: d.package_name,
              validFrom: d.valid_from,
              validUntil: d.valid_until,
            },
          });
        }
      }
    }

    return matched;
  }, [alerts, activeDiscounts, dismissedIds]);

  const addAlert = (alert: Omit<DiscountAlert, "id">) => {
    const newAlert: DiscountAlert = {
      ...alert,
      id: crypto.randomUUID(),
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated);
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
  };

  const removeAlert = (id: string) => {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
  };

  const dismissMatch = (alertId: string, discountId: string) => {
    const matchId = `${alertId}-${discountId}`;
    const updated = new Set(dismissedIds);
    updated.add(matchId);
    setDismissedIds(updated);
    localStorage.setItem("dismissed_discount_alerts", JSON.stringify([...updated]));
  };

  return {
    alerts,
    matchedAlerts,
    addAlert,
    removeAlert,
    dismissMatch,
  };
}
