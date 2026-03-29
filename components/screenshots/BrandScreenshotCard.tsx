'use client'

interface BrandScreenshot {
  id: string
  brand_id: string
  screenshot_url: string
  website_url: string
  status: 'success' | 'failed' | 'processing'
  error_message: string | null
  file_size_kb: number | null
  created_at: string
  brands: { name: string; logo_url: string | null; website_url: string | null; country: string }
}

export function BrandScreenshotCard({ screenshot }: { screenshot: BrandScreenshot }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <img src={screenshot.screenshot_url} alt={screenshot.brands?.name} className="w-full aspect-video object-cover" />
      <div className="p-3">
        <p className="font-medium text-sm">{screenshot.brands?.name}</p>
        <p className="text-xs text-muted-foreground">{new Date(screenshot.created_at).toLocaleDateString('pl-PL')}</p>
      </div>
    </div>
  )
}
