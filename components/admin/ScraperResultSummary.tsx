'use client';

import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ArrowDown, Minus, PlusCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScraperResultItem {
  diet?: string;
  kcal: number;
  price: number | null;
  status: string;
  previousPrice?: number | null;
  error?: string;
}

interface ScraperResultSummaryProps {
  status: "success" | "partial" | "failed";
  totalVariants: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  executionTimeMs: number;
  results?: ScraperResultItem[];
  errors?: string[];
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'saved':
      return (
        <Badge className="gap-1 bg-green-600 text-white text-xs">
          <PlusCircle className="h-3 w-3" />
          nowa
        </Badge>
      );
    case 'updated':
      return (
        <Badge className="gap-1 bg-blue-600 text-white text-xs">
          <RefreshCw className="h-3 w-3" />
          zmiana
        </Badge>
      );
    case 'skipped':
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
          <Minus className="h-3 w-3" />
          bez zmian
        </Badge>
      );
    case 'no_price':
      return <Badge variant="destructive" className="text-xs">brak ceny</Badge>;
    case 'no_package':
      return <Badge variant="destructive" className="text-xs">brak pakietu</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-xs">błąd</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function ResultIcon({ status }: { status: "success" | "partial" | "failed" }) {
  switch (status) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "partial":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function MainStatusBadge({ status }: { status: "success" | "partial" | "failed" }) {
  switch (status) {
    case "success":
      return <Badge className="bg-green-500">Sukces</Badge>;
    case "partial":
      return <Badge className="bg-amber-500">Częściowy</Badge>;
    case "failed":
      return <Badge variant="destructive">Błąd</Badge>;
  }
}

export function ScraperResultSummary({
  status,
  totalVariants,
  savedCount,
  updatedCount,
  skippedCount,
  executionTimeMs,
  results = [],
  errors = []
}: ScraperResultSummaryProps) {
  const hasChanges = savedCount > 0 || updatedCount > 0;
  const executionSeconds = (executionTimeMs / 1000).toFixed(1);

  const newPrices = results.filter(r => r.status === 'saved');
  const changedPrices = results.filter(r => r.status === 'updated');
  const unchangedPrices = results.filter(r => r.status === 'skipped');
  const errorPrices = results.filter(r => ['error', 'no_price', 'no_package'].includes(r.status));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ResultIcon status={status} />
          <span className="font-medium">Wynik scrapowania</span>
        </div>
        <MainStatusBadge status={status} />
      </div>

      <div className={cn(
        "p-4 rounded-lg border",
        hasChanges ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-muted/30 border-border"
      )}>
        <p className="text-sm font-medium">
          {hasChanges ? (
            <>
              {savedCount > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  <PlusCircle className="inline h-4 w-4 mr-1" />
                  {savedCount} {savedCount === 1 ? 'nowa cena' : savedCount < 5 ? 'nowe ceny' : 'nowych cen'}
                </span>
              )}
              {savedCount > 0 && updatedCount > 0 && <span className="text-muted-foreground"> • </span>}
              {updatedCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  <RefreshCw className="inline h-4 w-4 mr-1" />
                  {updatedCount} {updatedCount === 1 ? 'cena się zmieniła' : updatedCount < 5 ? 'ceny się zmieniły' : 'cen się zmieniło'}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              <Minus className="inline h-4 w-4 mr-1" />
              Wszystkie ceny ({skippedCount}) są aktualne - bez zmian
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Sprawdzono {totalVariants} wariantów w {executionSeconds}s
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded bg-muted/30">
          <div className="text-xs text-muted-foreground">Sprawdzono</div>
          <div className="text-lg font-bold">{totalVariants}</div>
        </div>
        <div className={cn(
          "p-2 rounded",
          savedCount > 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/30"
        )}>
          <div className="text-xs text-green-600 dark:text-green-400">Nowe</div>
          <div className={cn("text-lg font-bold", savedCount > 0 ? "text-green-600" : "text-muted-foreground")}>{savedCount}</div>
        </div>
        <div className={cn(
          "p-2 rounded",
          updatedCount > 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted/30"
        )}>
          <div className="text-xs text-blue-600 dark:text-blue-400">Zmienione</div>
          <div className={cn("text-lg font-bold", updatedCount > 0 ? "text-blue-600" : "text-muted-foreground")}>{updatedCount}</div>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <div className="text-xs text-muted-foreground">Bez zmian</div>
          <div className="text-lg font-bold text-muted-foreground">{skippedCount}</div>
        </div>
      </div>

      {newPrices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
            <PlusCircle className="h-4 w-4" />
            Nowe ceny ({newPrices.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {newPrices.map((r, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded bg-green-50 dark:bg-green-950/30 text-sm border border-green-200 dark:border-green-800">
                <span className="truncate flex-1">{r.diet && `${r.diet} `}{r.kcal} kcal</span>
                <span className="font-bold text-green-600">{r.price} zł</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {changedPrices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <RefreshCw className="h-4 w-4" />
            Zmienione ceny ({changedPrices.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {changedPrices.map((r, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-sm border border-blue-200 dark:border-blue-800">
                <span className="truncate flex-1">{r.diet && `${r.diet} `}{r.kcal} kcal</span>
                <div className="flex items-center gap-1">
                  {r.previousPrice && (
                    <span className="text-muted-foreground line-through text-xs">{r.previousPrice} zł</span>
                  )}
                  <ArrowDown className="h-3 w-3 text-blue-600" />
                  <span className="font-bold text-blue-600">{r.price} zł</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unchangedPrices.length > 0 && !hasChanges && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            Pokaż wszystkie {unchangedPrices.length} cen bez zmian
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto">
            {unchangedPrices.map((r, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded bg-muted/30 text-sm">
                <span className="truncate flex-1 text-muted-foreground">{r.diet && `${r.diet} `}{r.kcal} kcal</span>
                <span className="text-muted-foreground">{r.price} zł</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {errorPrices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            Błędy ({errorPrices.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {errorPrices.map((r, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded bg-red-50 dark:bg-red-950/30 text-sm border border-red-200 dark:border-red-800">
                <span className="truncate flex-1">{r.diet && `${r.diet} `}{r.kcal} kcal</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded">
          <p className="font-medium mb-1">Błędy systemowe:</p>
          <ul className="space-y-0.5">
            {errors.slice(0, 5).map((err, idx) => (
              <li key={idx}>• {err}</li>
            ))}
            {errors.length > 5 && <li className="text-muted-foreground">...i {errors.length - 5} więcej</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
