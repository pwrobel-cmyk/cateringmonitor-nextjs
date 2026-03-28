// @ts-nocheck
import { useState, useCallback, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface PDFGeneratorProps {
  reportTitle: string;
  reportSubtitle?: string;
  fileName?: string;
  children?: ReactNode;
  contentRef?: React.RefObject<HTMLDivElement>;
}

declare global {
  interface Window {
    html2pdf: any;
  }
}

export function PDFGenerator({ 
  reportTitle, 
  reportSubtitle,
  fileName,
  contentRef 
}: PDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = useCallback(async () => {
    if (!contentRef?.current) {
      console.error("Content ref not available");
      return;
    }

    setIsGenerating(true);

    try {
      // Dynamically import html2pdf
      const html2pdf = (await import("html2pdf.js")).default;

      // Wait for Recharts to fully render before capturing
      // Recharts SVG charts need time to complete their animations and rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Capture real chart heights from the live DOM so the cloned DOM
      // doesn't collapse (a common cause of "sections overlapping" in PDF)
      const originalChartHeights = Array.from(
        contentRef.current.querySelectorAll('.recharts-responsive-container')
      ).map((el) => {
        const h = (el as HTMLElement).getBoundingClientRect().height;
        // fallback if ResponsiveContainer height is 0 during render
        return Math.max(320, Math.round(h || 0));
      });

      // Force Recharts SVGs to render at full size
      const charts = contentRef.current.querySelectorAll('.recharts-wrapper svg');
      charts.forEach(svg => {
        const svgEl = svg as SVGElement;
        // Remove any animations that might interfere
        svgEl.style.animation = 'none';
        // Ensure SVG is fully visible
        svgEl.style.overflow = 'visible';
      });

      // Additional delay after forcing SVG styles
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clone the content for PDF generation
      const element = contentRef.current.cloneNode(true) as HTMLElement;
      
      // Use full viewport width for better chart rendering
      // This ensures charts are rendered at high quality before scaling down
      const renderWidthPx = 1200; // Full viewport width for rendering
      
      // A4 dimensions for final output
      const a4WidthMM = 210;
      const marginMM = 15;
      const usableWidthMM = a4WidthMM - (marginMM * 2); // 180mm
      
      // Add print-specific styles to the clone
      element.style.width = `${renderWidthPx}px`;
      element.style.maxWidth = `${renderWidthPx}px`;
      element.style.padding = "0";
      element.style.margin = "0";
      element.style.backgroundColor = "white";
      element.style.color = "#1a1a1a";
      element.style.overflow = "hidden";
      element.style.boxSizing = "border-box";

      // Remove elements that shouldn't be in PDF
      element.querySelectorAll('[data-pdf-hide="true"], .print\\:hidden').forEach(el => {
        el.remove();
      });

      // Fix all children to respect container width
      element.querySelectorAll('*').forEach(child => {
        const el = child as HTMLElement;
        if (el.style) {
          el.style.maxWidth = "100%";
          el.style.boxSizing = "border-box";
        }
      });

      // Hide tooltips (they are absolutely positioned and can cover content in canvas capture)
      element.querySelectorAll('.recharts-tooltip-wrapper').forEach((t) => {
        (t as HTMLElement).style.display = 'none';
      });

      // Force Recharts containers to keep a real height in the cloned DOM
      // (prevents subsequent sections from being drawn "on top")
      element.querySelectorAll('.recharts-responsive-container').forEach((container, idx) => {
        const el = container as HTMLElement;
        const targetHeight = originalChartHeights[idx] ?? 360;

        el.style.display = 'block';
        el.style.position = 'relative';
        el.style.width = '100%';
        el.style.minWidth = '100%';
        el.style.height = `${targetHeight}px`;
        el.style.minHeight = `${targetHeight}px`;
        el.style.overflow = 'visible';
      });

      // Scale SVG charts properly
      element.querySelectorAll('.recharts-wrapper').forEach((chart, idx) => {
        const el = chart as HTMLElement;
        const targetHeight = originalChartHeights[idx] ?? 360;

        el.style.width = '100%';
        el.style.maxWidth = '100%';
        el.style.height = `${targetHeight}px`;
        el.style.maxHeight = `${targetHeight}px`;
        el.style.overflow = 'visible';
        el.style.pageBreakInside = 'avoid';
      });

      // Force SVG elements to full width
      element.querySelectorAll('.recharts-wrapper svg').forEach(svg => {
        const svgEl = svg as SVGElement;
        svgEl.setAttribute('width', '100%');
        svgEl.style.width = '100%';
        svgEl.style.maxWidth = '100%';
        svgEl.style.overflow = 'visible';
      });

      // Style cards and tables to avoid breaks within them and add spacing
      element.querySelectorAll('[class*="Card"], table').forEach(card => {
        const el = card as HTMLElement;
        el.style.pageBreakInside = "avoid";
        el.style.marginBottom = "16px";
      });

      // Add spacing between sections
      element.querySelectorAll('section, [data-pdf-section], .space-y-6 > *, .space-y-8 > *').forEach(section => {
        const el = section as HTMLElement;
        el.style.marginBottom = "20px";
        el.style.paddingTop = "8px";
      });

      // Add spacing after chart containers
      element.querySelectorAll('.recharts-responsive-container').forEach(chart => {
        const el = chart as HTMLElement;
        el.style.marginBottom = "16px";
      });

      // Format date for filename
      const dateStr = format(new Date(), "yyyy-MM-dd", { locale: pl });
      const safeTitle = reportTitle.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "").replace(/\s+/g, "_");
      const outputFileName = fileName || `Raport_${safeTitle}_${dateStr}.pdf`;

      // Create temporary container with full width for rendering
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = `${renderWidthPx}px`;
      tempContainer.style.overflow = "visible";
      tempContainer.appendChild(element);
      document.body.appendChild(tempContainer);

      // Wait for cloned content to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // PDF options - render at full width, then scale to A4
      const opt = {
        margin: [25, 15, 20, 15] as [number, number, number, number], // top, right, bottom, left (in mm)
        filename: outputFileName,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: renderWidthPx,
          windowWidth: renderWidthPx,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc: Document) => {
            // Additional processing on cloned document
            const clonedCharts = clonedDoc.querySelectorAll('.recharts-wrapper svg');
            clonedCharts.forEach(svg => {
              const svgEl = svg as SVGElement;
              svgEl.style.width = '100%';
              svgEl.style.overflow = 'visible';
            });
          }
        },
        jsPDF: { 
          unit: "mm" as const, 
          format: "a4" as const, 
          orientation: "portrait" as const
        },
        pagebreak: { 
          mode: ["css", "legacy"],
          avoid: [".recharts-wrapper", ".recharts-responsive-container", "[class*='Card']", "table", "img"]
        }
      };

      // Generate PDF with header/footer
      const worker = html2pdf().set(opt).from(element);
      
      const pdfBlob = await worker.toPdf().get("pdf").then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          // Header
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(reportTitle, 15, 12);
          pdf.text(`Strona ${i} z ${totalPages}`, pageWidth - 15, 12, { align: "right" });
          
          // Header line
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.line(15, 15, pageWidth - 15, 15);
          
          // Footer
          const generatedDate = format(new Date(), "d MMMM yyyy, HH:mm", { locale: pl });
          pdf.setFontSize(8);
          pdf.setTextColor(130, 130, 130);
          
          // Footer line
          pdf.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
          
          pdf.text(`Wygenerowano: ${generatedDate}`, 15, pageHeight - 7);
          pdf.text("cateringmonitor.pl", pageWidth - 15, pageHeight - 7, { align: "right" });
        }
        
        return pdf;
      });
      
      // Save the PDF
      pdfBlob.save(outputFileName);

      // Cleanup
      document.body.removeChild(tempContainer);

    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [contentRef, reportTitle, fileName]);

  return (
    <Button 
      onClick={generatePDF} 
      variant="outline" 
      size="sm"
      disabled={isGenerating}
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generowanie PDF...
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" />
          Pobierz PDF
        </>
      )}
    </Button>
  );
}

// Wrapper component for PDF content with proper styling
interface PDFContentWrapperProps {
  children: ReactNode;
  reportTitle: string;
  reportSubtitle?: string;
}

export function PDFContentWrapper({ 
  children, 
  reportTitle,
  reportSubtitle 
}: PDFContentWrapperProps) {
  return (
    <div className="pdf-content">
      {/* PDF Title Page - will be first section */}
      <div 
        data-pdf-section="true" 
        className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-[60vh] print:text-center print:py-12"
      >
        <h1 className="text-4xl font-bold mb-4">{reportTitle}</h1>
        {reportSubtitle && (
          <p className="text-xl text-muted-foreground">{reportSubtitle}</p>
        )}
        <p className="mt-8 text-sm text-muted-foreground">
          Wygenerowano: {format(new Date(), "d MMMM yyyy", { locale: pl })}
        </p>
      </div>
      
      {children}
    </div>
  );
}

// Section wrapper that ensures proper page breaks
interface PDFSectionProps {
  children: ReactNode;
  className?: string;
  avoidBreak?: boolean;
}

export function PDFSection({ children, className = "", avoidBreak = false }: PDFSectionProps) {
  return (
    <section 
      data-pdf-section="true"
      className={`pdf-section ${className}`}
      style={{
        pageBreakBefore: avoidBreak ? "auto" : "always",
        pageBreakInside: "avoid"
      }}
    >
      {children}
    </section>
  );
}
