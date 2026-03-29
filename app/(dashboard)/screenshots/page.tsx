'use client'

import { useState } from 'react'
import { Camera, Calendar, Download } from 'lucide-react'
import { useBrandScreenshots } from '@/hooks/useBrandScreenshots'
import { BrandScreenshotCard } from '@/components/screenshots/BrandScreenshotCard'
import { useCountry } from '@/contexts/CountryContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScreenshotsTimeline } from '@/components/screenshots/ScreenshotsTimeline'
import { usePackageAccess } from '@/hooks/usePackageAccess'
import { UpgradePrompt } from '@/components/upgrade/UpgradePrompt'
import { FeatureAccessGate } from '@/components/upgrade/FeatureAccessGate'

export default function Screenshots() {
  const { selectedCountry } = useCountry()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isExporting, setIsExporting] = useState(false)
  const { hasFullAccess, needsUpgrade, upgradeTarget, userType, getPreviewLimit } = usePackageAccess()

  const { data: screenshots, isLoading } = useBrandScreenshots(undefined, selectedCountry)

  const canAccessScreenshots = hasFullAccess('screenshots')
  const previewLimit = getPreviewLimit('screenshots') || 3

  const filteredScreenshots = screenshots?.filter((s) => {
    if (s.status !== 'success') return false
    if (!selectedDate) return true
    const screenshotDate = new Date(s.created_at)
    const filterDate = new Date(selectedDate)
    screenshotDate.setHours(0, 0, 0, 0)
    filterDate.setHours(0, 0, 0, 0)
    return screenshotDate.getTime() === filterDate.getTime()
  })

  const displayedScreenshots = canAccessScreenshots
    ? filteredScreenshots
    : filteredScreenshots?.slice(0, previewLimit)

  const handleExportPDF = async () => {
    if (!filteredScreenshots || filteredScreenshots.length === 0) {
      toast.error('Brak screenshotów do eksportu')
      return
    }
    setIsExporting(true)
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pageWidth - margin * 2

      for (let i = 0; i < filteredScreenshots.length; i++) {
        const screenshot = filteredScreenshots[i]
        if (i > 0) pdf.addPage()
        pdf.setFontSize(14)
        pdf.text(screenshot.brands?.name || 'Unknown', margin, margin + 7)
        pdf.setFontSize(10)
        pdf.text(format(new Date(screenshot.created_at), 'dd.MM.yyyy HH:mm', { locale: pl }), margin, margin + 13)
        try {
          const response = await fetch(screenshot.screenshot_url)
          const blob = await response.blob()
          const img = new Image()
          const imageLoadPromise = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
          })
          img.src = URL.createObjectURL(blob)
          await imageLoadPromise
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const maxWidth = 800
          const scale = maxWidth / img.naturalWidth
          canvas.width = maxWidth
          canvas.height = img.naturalHeight * scale
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imgData = canvas.toDataURL('image/jpeg', 0.85)
          URL.revokeObjectURL(img.src)
          const imgWidth = contentWidth
          const imgHeight = (canvas.height * imgWidth) / canvas.width
          const maxHeight = pageHeight - margin * 3 - 15
          const finalHeight = Math.min(imgHeight, maxHeight)
          const finalWidth = (canvas.width * finalHeight) / canvas.height
          pdf.addImage(imgData, 'JPEG', margin, margin + 20, finalWidth, finalHeight)
        } catch {
          pdf.setFontSize(10)
          pdf.text('Nie udało się załadować obrazu', margin, margin + 25)
        }
      }
      const fileName = `screenshots_${format(selectedDate || new Date(), 'yyyy-MM-dd')}.pdf`
      pdf.save(fileName)
      toast.success('PDF został wygenerowany')
    } catch {
      toast.error('Błąd podczas generowania PDF')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <FeatureAccessGate
      feature="screenshots"
      title="Zrzuty Ekranu wymagają planu Pro"
      description="Monitoruj wygląd stron konkurencji, śledź zmiany wizualne i generuj raporty."
    >
      <main className="container mx-auto px-4 py-4 md:py-8 max-w-full overflow-x-hidden">
        <div className="space-y-6">
          <div className="flex flex-col space-y-2">
            <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
              <Camera className="h-6 w-6 md:h-8 md:w-8" />
              Zrzuty Ekranu
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Monitorowanie wyglądu stron internetowych firm cateringowych
            </p>
          </div>

          <Tabs defaultValue="gallery" className="space-y-6">
            <TabsList>
              <TabsTrigger value="gallery">Galeria</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="gallery" className="space-y-6">
              {needsUpgrade('screenshots') ? (
                <div className="flex justify-center py-12">
                  <div className="w-full max-w-2xl">
                    <UpgradePrompt
                      feature="screenshots"
                      currentPackage={userType}
                      targetPackage={upgradeTarget('screenshots')}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                    <Popover>
                      <PopoverTrigger>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full sm:w-[240px] md:w-[280px] justify-start text-left font-normal',
                            !selectedDate && 'text-muted-foreground'
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: pl }) : 'Wybierz datę'}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          initialFocus
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          locale={pl}
                        />
                      </PopoverContent>
                    </Popover>

                    <Button
                      onClick={handleExportPDF}
                      disabled={isExporting || !filteredScreenshots || filteredScreenshots.length === 0}
                      variant="default"
                      className="w-full sm:w-auto"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      <span className="truncate">{isExporting ? 'Generowanie...' : 'Pobierz PDF'}</span>
                    </Button>

                    {filteredScreenshots && (
                      <p className="text-sm text-muted-foreground text-center sm:text-left">
                        Znaleziono: {filteredScreenshots.length} screenshotów
                      </p>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="space-y-3">
                          <Skeleton className="aspect-video w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : displayedScreenshots && displayedScreenshots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayedScreenshots.map((screenshot) => (
                        <BrandScreenshotCard key={screenshot.id} screenshot={screenshot} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Brak screenshotów</h3>
                      <p className="text-muted-foreground">Nie znaleziono żadnych zrzutów ekranu dla wybranej daty.</p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="timeline">
              <ScreenshotsTimeline />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </FeatureAccessGate>
  )
}
