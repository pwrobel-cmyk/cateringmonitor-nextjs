'use client'
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

export interface BrandPerformanceEntry {
  brand: string
  revenue: number
  growth: number
  logo: string
  brand_id: string
}

export function useBrandFinancialData() {
  return useQuery({
    queryKey: ["brand-financial-data"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brand_financial_data")
        .select("brand_name, year, revenue, growth_percentage, brand_id, brands(logo_url)")
        .order("year", { ascending: true })
        .order("revenue", { ascending: false })

      if (error) throw error

      const byYear: Record<string, BrandPerformanceEntry[]> = {}
      for (const row of (data || [])) {
        const year = String(row.year)
        if (!byYear[year]) byYear[year] = []
        byYear[year].push({
          brand: row.brand_name,
          revenue: Number(row.revenue) || 0,
          growth: Number(row.growth_percentage) || 0,
          logo: row.brands?.logo_url || "",
          brand_id: row.brand_id,
        })
      }
      return byYear
    },
    staleTime: 30 * 60 * 1000,
  })
}
