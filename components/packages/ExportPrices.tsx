'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function ExportPrices() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      toast.info("Eksport cen nie jest jeszcze zaimplementowany");
    } catch (error) {
      toast.error("Błąd podczas eksportu");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting}>
      <Download className="h-4 w-4 mr-2" />
      {isExporting ? "Eksportowanie..." : "Eksportuj ceny"}
    </Button>
  );
}
