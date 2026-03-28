'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface TopicData {
  mentions: number;
  positiveCount: number;
  negativeCount: number;
  positivePercentage: number;
  negativePercentage: number;
}

interface BrandTopics {
  [brandName: string]: {
    [topic: string]: TopicData;
  };
}

export function BrandParametersComparison() {
  const { data: brandData, isLoading } = useQuery({
    queryKey: ["brand-parameters-comparison"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_brand_parameters_comparison", {
        filter_brand_id: null,
        time_filter: null
      });

      if (error) throw error;

      return data as unknown as BrandTopics;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!brandData || Object.keys(brandData).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Porównanie parametrów między markami</CardTitle>
          <CardDescription>Brak danych do wyświetlenia</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const topics = ["smak", "jakość", "dostawa", "cena", "porcje", "obsługa"];
  const brands = Object.keys(brandData).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Porównanie parametrów między markami</CardTitle>
        <CardDescription>
          Analiza najczęstszych aspektów w opiniach dla każdej marki
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Parametr</TableHead>
                {brands.map((brand) => (
                  <TableHead key={brand} className="text-center min-w-[150px]">
                    {brand}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((topic) => (
                <TableRow key={topic}>
                  <TableCell className="font-medium capitalize">{topic}</TableCell>
                  {brands.map((brand) => {
                    const data = brandData[brand]?.[topic];
                    if (!data || data.mentions === 0) {
                      return (
                        <TableCell key={brand} className="text-center text-muted-foreground">
                          -
                        </TableCell>
                      );
                    }

                    const difference = data.positivePercentage - data.negativePercentage;
                    const bgColor = difference > 5
                      ? "bg-green-50 dark:bg-green-950/20"
                      : difference < -5
                      ? "bg-red-50 dark:bg-red-950/20"
                      : "bg-muted";

                    return (
                      <TableCell key={brand} className={`text-center ${bgColor}`}>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {data.mentions} {data.mentions === 1 ? "wzmianka" : "wzmianek"}
                          </div>
                          <div className="flex justify-center gap-2 text-xs">
                            <span className="text-green-600 dark:text-green-400">
                              P {data.positivePercentage}%
                            </span>
                            <span className="text-red-600 dark:text-red-400">
                              N {data.negativePercentage}%
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
