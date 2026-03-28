'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";

export default function SEOLLM() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
          SEO LLM
        </h1>
        <p className="text-muted-foreground">
          Analiza pozycji w modelach językowych
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Moduł SEO LLM
          </CardTitle>
          <CardDescription>
            Monitorowanie obecności marki w modelach AI (ChatGPT, Claude, Gemini)
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Moduł SEO LLM jest w trakcie implementacji.</p>
        </CardContent>
      </Card>
    </div>
  );
}
