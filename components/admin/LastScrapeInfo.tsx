'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Calendar, Loader2, AlertTriangle, RotateCcw, ArrowUpDown, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow, parseISO, differenceInMinutes } from "date-fns";
import { pl } from "date-fns/locale";
import { useLastScrapeRun } from "@/hooks/useScrapeRuns";
import { useQueryClient } from "@tanstack/react-query";

interface LastScrapeInfoProps {
  lastScrapeAt: string | null;
  pricesCount: number;
  scraperName?: string;
  isLoading?: boolean;
}

const STALE_RUN_THRESHOLD_MINUTES = 12;

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return (
        <Badge variant="outline" className="text-xs gap-1 bg-green-500/10 text-green-600 border-green-500/30">
          <CheckCircle className="h-3 w-3" />
          Sukces
        </Badge>
      );
    case "partial":
      return (
        <Badge variant="outline" className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
          <AlertTriangle className="h-3 w-3" />
          Częściowy
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-xs gap-1 bg-red-500/10 text-red-600 border-red-500/30">
          <XCircle className="h-3 w-3" />
          Błąd
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="text-xs gap-1 bg-blue-500/10 text-blue-600 border-blue-500/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          W trakcie
        </Badge>
      );
    default:
      return null;
  }
}

export function LastScrapeInfo({ lastScrapeAt, pricesCount, scraperName, isLoading }: LastScrapeInfoProps) {
  const queryClient = useQueryClient();
  const { data: lastRun, isLoading: runLoading, isFetching } = useLastScrapeRun(scraperName || "");

  const showScrapeRuns = scraperName && lastRun;
  const isAnyLoading = isLoading || (scraperName && runLoading);

  const handleRefreshStatus = () => {
    if (scraperName) {
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", scraperName] });
    }
  };

  const isStaleRunning = lastRun?.status === "running" && lastRun.started_at
    ? differenceInMinutes(new Date(), parseISO(lastRun.started_at)) > STALE_RUN_THRESHOLD_MINUTES
    : false;

  if (isAnyLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <Clock className="h-3 w-3 animate-pulse" />
        <span>Ładowanie...</span>
      </div>
    );
  }

  if (showScrapeRuns) {
    const runDate = parseISO(lastRun.started_at);
    const formattedDate = format(runDate, "dd.MM.yyyy HH:mm", { locale: pl });
    const relativeTime = formatDistanceToNow(runDate, { addSuffix: true, locale: pl });
    const executionSeconds = lastRun.execution_time_ms
      ? (lastRun.execution_time_ms / 1000).toFixed(1)
      : null;

    return (
      <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Ostatnie uruchomienie:</span>
          <span className="font-medium">{formattedDate}</span>
          <span className="text-muted-foreground">({relativeTime})</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={lastRun.status} />
          {executionSeconds && (
            <Badge variant="outline" className="text-xs gap-1 bg-muted/50">
              <Clock className="h-3 w-3" />
              {executionSeconds}s
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastRun.saved_count > 0 && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
              +{lastRun.saved_count} zapisane
            </Badge>
          )}
          {lastRun.updated_count > 0 && (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              {lastRun.updated_count} zaktualizowane
            </Badge>
          )}
          {lastRun.skipped_count > 0 && (
            <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1" />
              {lastRun.skipped_count} pominięte
            </Badge>
          )}
          {lastRun.error_count > 0 && (
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
              <XCircle className="h-3 w-3 mr-1" />
              {lastRun.error_count} błędów
            </Badge>
          )}
        </div>

        {lastRun.status === "running" && !isStaleRunning && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Scraper w trakcie działania...</span>
          </div>
        )}

        {isStaleRunning && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 p-2 rounded mt-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Run trwa &gt;{STALE_RUN_THRESHOLD_MINUTES} min — możliwe zawieszenie.</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-xs text-amber-600 hover:text-amber-700"
              onClick={handleRefreshStatus}
              disabled={isFetching}
            >
              {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Odśwież
            </Button>
          </div>
        )}

        {lastRun.error_message && lastRun.status === "failed" && (
          <div className="text-xs text-red-500 bg-red-500/5 p-2 rounded mt-1">
            {lastRun.error_message.substring(0, 150)}
            {lastRun.error_message.length > 150 && "..."}
          </div>
        )}

        <div className="flex justify-end mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleRefreshStatus}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Odśwież status
          </Button>
        </div>
      </div>
    );
  }

  if (!lastScrapeAt) {
    return (
      <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Brak danych z ostatnich 7 dni</span>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Uruchom scraper, aby pobrać aktualne ceny
        </p>
      </div>
    );
  }

  const date = parseISO(lastScrapeAt);
  const formattedDate = format(date, "dd.MM.yyyy HH:mm", { locale: pl });
  const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: pl });

  const isRecent = Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
  const isSuccess = pricesCount > 0;

  return (
    <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2 text-xs">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Ostatnie scrapowanie:</span>
        <span className="font-medium">{formattedDate}</span>
        <span className="text-muted-foreground">({relativeTime})</span>
      </div>
      <div className="flex items-center gap-2">
        {isSuccess ? (
          <Badge variant="outline" className="text-xs gap-1 bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3" />
            {pricesCount} cen zapisanych
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs gap-1 bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="h-3 w-3" />
            0 cen - błąd?
          </Badge>
        )}
        {isRecent && (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
            Aktualne
          </Badge>
        )}
      </div>
    </div>
  );
}
