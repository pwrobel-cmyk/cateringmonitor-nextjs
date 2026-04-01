'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Calendar, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

interface BrandScreenshotCardProps {
  screenshot: BrandScreenshot
}

export function BrandScreenshotCard({ screenshot }: BrandScreenshotCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const statusConfig = {
    success: { label: 'Sukces', variant: 'default' as const, color: 'bg-green-500' },
    failed: { label: 'Błąd', variant: 'destructive' as const, color: 'bg-red-500' },
    processing: { label: 'W trakcie', variant: 'secondary' as const, color: 'bg-yellow-500' },
  }

  const config = statusConfig[screenshot.status]

  return (
    <>
      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
        <div
          className="relative aspect-video bg-muted cursor-pointer"
          onClick={() => screenshot.status === 'success' && setIsDialogOpen(true)}
        >
          {screenshot.status === 'success' ? (
            <>
              <img
                src={screenshot.screenshot_url}
                alt={`Screenshot ${screenshot.brands.name}`}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          <Badge
            variant={config.variant}
            className="absolute top-2 right-2"
          >
            {config.label}
          </Badge>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{screenshot.brands.name}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(screenshot.created_at), 'dd.MM.yyyy HH:mm', {
                  locale: pl,
                })}
              </p>
            </div>
            {screenshot.brands.logo_url && (
              <img
                src={screenshot.brands.logo_url}
                alt={screenshot.brands.name}
                className="h-10 w-10 object-contain rounded"
              />
            )}
          </div>

          {screenshot.error_message && (
            <p className="text-xs text-destructive line-clamp-2">
              {screenshot.error_message}
            </p>
          )}

          <a
            href={screenshot.website_url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 w-full rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${!screenshot.website_url ? 'pointer-events-none opacity-50' : ''}`}
          >
            <ExternalLink className="h-3 w-3" />
            Odwiedź stronę
          </a>

          {screenshot.file_size_kb && (
            <p className="text-xs text-muted-foreground text-center">
              {screenshot.file_size_kb}KB
            </p>
          )}
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {screenshot.brands.logo_url && (
                <img
                  src={screenshot.brands.logo_url}
                  alt={screenshot.brands.name}
                  className="h-6 w-6 object-contain"
                />
              )}
              {screenshot.brands.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <img
              src={screenshot.screenshot_url}
              alt={`Screenshot ${screenshot.brands.name}`}
              className="w-full h-auto rounded-lg border"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {format(new Date(screenshot.created_at), 'dd.MM.yyyy HH:mm', {
                  locale: pl,
                })}
              </span>
              <a
                href={screenshot.website_url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                Odwiedź stronę
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
