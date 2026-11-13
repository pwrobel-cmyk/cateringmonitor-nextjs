'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  trainAspectModel,
  buildPriceModel,
  brandQuality,
  type ActiveOffer,
  type ReviewRow,
  type PriceChangeRow,
} from "@/lib/retentionModel";
import { classifyDiet, isTestPackage, toKcalBucket } from "@/lib/dietClassification";

const PAGE = 1000;
const MAX_PAGES = 40; // twardy limit: 40 000 opinii na jedno przeliczenie
const MONTHS_BACK = 24;

export interface RetentionBrand {
  id: string;
  name: string;
}

async function loadReviews(since: string, brandIds: Set<string>) {
  const rows: ReviewRow[] = [];
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await (supabase as any)
      .from("reviews")
      .select("brand_id, rating, content, review_date")
      .eq("is_approved", true)
      .gte("review_date", since)
      .order("review_date", { ascending: false })
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);

    if (error) throw error;
    const batch = (data || []) as ReviewRow[];
    for (const r of batch) if (brandIds.has(r.brand_id)) rows.push(r);
    if (batch.length < PAGE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { rows, truncated };
}

export function useRetentionModel() {
  return useQuery({
    queryKey: ["retention-model", MONTHS_BACK],
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data: brandRows, error: brandError } = await (supabase as any)
        .from("brands")
        .select("id, name")
        .neq("country", "Czechy")
        .eq("is_active", true)
        .order("name");
      if (brandError) throw brandError;

      const brands = (brandRows || []) as RetentionBrand[];
      const brandIds = new Set(brands.map((b) => b.id));

      const sinceDate = new Date();
      sinceDate.setMonth(sinceDate.getMonth() - MONTHS_BACK);
      const since = sinceDate.toISOString().slice(0, 10);

      const [{ rows: reviews, truncated }, priceRes, activeRes] = await Promise.all([
        loadReviews(since, brandIds),
        (supabase as any).rpc("get_price_changes"),
        (supabase as any).rpc("get_active_package_prices"),
      ]);

      // Aktualne oferty rynku: jedna pozycja na pakiet i koszyk kaloryczności.
      const offersError: string | null = activeRes.error ? String(activeRes.error.message) : null;
      const offers: ActiveOffer[] = [];
      const seenOffers = new Set<string>();
      for (const row of ((activeRes.data as any[]) || [])) {
        if (row.country === "Czechy" || !row.package_name || isTestPackage(row.package_name)) continue;
        const price = Number(row.price);
        if (!(price > 0)) continue;
        const kcal = toKcalBucket(Number(row.kcal_from), Number(row.kcal_to));
        const key = `${row.package_id}|${kcal}`;
        if (seenOffers.has(key)) continue;
        seenOffers.add(key);
        offers.push({
          brandName: row.brand_name,
          packageName: row.package_name,
          segment: classifyDiet(row.package_name)[0],
          kcal,
          price,
        });
      }

      // Jakość marki (negatywne na 100 opinii) po nazwie, bo oferty nie mają brand_id.
      const qualityById = brandQuality(reviews);
      const qualityByName = new Map<string, number>();
      for (const b of brands) {
        const q = qualityById.get(b.id);
        if (q !== undefined) qualityByName.set(b.name, q);
      }

      // Brak zmian cen nie blokuje modelu aspektów — zgłaszamy to w UI.
      const priceError: string | null = priceRes.error ? String(priceRes.error.message) : null;
      const priceChanges: PriceChangeRow[] = ((priceRes.data as any[]) || [])
        .filter((p) => brandIds.has(p.brand_id) && p.change_date && p.change_percent !== null)
        .map((p) => ({
          brand_id: p.brand_id,
          change_percent: Number(p.change_percent),
          change_date: String(p.change_date),
        }));

      return {
        brands,
        reviews,
        truncated,
        since,
        priceChangesCount: priceChanges.length,
        priceError,
        offers,
        offersError,
        qualityByName,
        aspectModel: trainAspectModel(reviews),
        priceModel: buildPriceModel(reviews, priceChanges),
      };
    },
  });
}
