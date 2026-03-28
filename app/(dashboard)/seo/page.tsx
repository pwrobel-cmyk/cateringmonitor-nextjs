'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";

export default function SEO() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
          SEO
        </h1>
        <p className="text-muted-foreground">
          Zarządzanie słowami kluczowymi i monitorowanie pozycji
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Moduł SEO
          </CardTitle>
          <CardDescription>
            Monitorowanie pozycji słów kluczowych, analiza konkurencji i optymalizacja widoczności
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Moduł SEO jest w trakcie implementacji.</p>
        </CardContent>
      </Card>
    </div>
  );
}
