import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

interface BrandScreenshot {
  id: string
  brand_id: string
  screenshot_url: string
  website_url: string
  status: 'success' | 'failed' | 'processing'
  error_message: string | null
  file_size_kb: number | null
  created_at: string
  brands: {
    name: string
    logo_url: string | null
    website_url: string | null
    country: string
  }
}

export function useBrandScreenshots(brandId?: string, country?: string) {
  return useQuery<BrandScreenshot[]>({
    queryKey: ['brand-screenshots', brandId, country],
    queryFn: async () => {
      let query = supabase
        .from('brand_screenshots')
        .select('id, brand_id, screenshot_url, website_url, status, error_message, file_size_kb, created_at, brands(name, logo_url, website_url, country)')
        .order('created_at', { ascending: false })

      if (brandId) query = query.eq('brand_id', brandId)
      if (country) query = query.eq('brands.country', country)

      const { data } = await query
      return (data || []) as unknown as BrandScreenshot[]
    },
  })
}
