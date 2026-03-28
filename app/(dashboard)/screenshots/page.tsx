'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { cn } from "@/lib/utils";

function useBrandScreenshots(country: string) {
  return useQuery({
    queryKey: ["brand-screenshots", country],
    queryFn: async () => {
      let query = (supabase as any)
        .from("brand_screenshots")
        .select(`
          *,
          brands!inner (
            id,
            name,
            country
          )
        `)
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(200);

      if (country === "Czechy") {
        query = query.eq("brands.country", "Czechy");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export default function Screenshots() {
  const { selectedCountry } = useCountry();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { data: screenshots, isLoading } = useBrandScreenshots(selectedCountry);

  const filteredScreenshots = screenshots?.filter((s: any) => {
    if (!selectedDate) return true;
    const screenshotDate = new Date(s.created_at);
    screenshotDate.setHours(0, 0, 0, 0);
    const filterDate = new Date(selectedDate);
    filterDate.setHours(0, 0, 0, 0);
    return screenshotDate.getTime() === filterDate.getTime();
  });

  return (
    <div className="max-w-full overflow-x-hidden">
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <Popover>
            <PopoverTrigger
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
            >
              <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
              {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: pl }) : "Wybierz datę"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={pl}
              />
            </PopoverContent>
          </Popover>

          {filteredScreenshots && (
            <p className="text-sm text-muted-foreground">
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
        ) : filteredScreenshots && filteredScreenshots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScreenshots.map((screenshot: any) => (
              <Card key={screenshot.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {screenshot.brands?.name}
                    <span className="text-xs text-muted-foreground font-normal ml-auto">
                      {format(new Date(screenshot.created_at), "HH:mm", { locale: pl })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {screenshot.screenshot_url ? (
                    <a href={screenshot.screenshot_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={screenshot.screenshot_url}
                        alt={screenshot.brands?.name}
                        className="w-full h-48 object-cover object-top hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Brak screenshotów</h3>
            <p className="text-muted-foreground">
              Nie znaleziono żadnych zrzutów ekranu dla wybranej daty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
