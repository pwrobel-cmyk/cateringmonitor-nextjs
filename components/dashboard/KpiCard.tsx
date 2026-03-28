'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import Image from "next/image";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  change?: {
    value: string;
    type: "increase" | "decrease" | "neutral";
    period?: string;
  };
  isFetching?: boolean;
  logoUrl?: string;
  dataInfo?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  change,
  isFetching,
  logoUrl,
  dataInfo,
}: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            {isFetching && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {icon && (
              <div className="text-muted-foreground">{icon}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          {logoUrl && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <Image
                src={logoUrl}
                alt=""
                fill
                className="object-contain"
                sizes="40px"
              />
            </div>
          )}
          <div className="text-2xl font-bold text-foreground leading-tight">
            {value}
          </div>
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
        )}

        {change && (
          <div className="flex items-center gap-1.5 mt-3">
            {change.type === "increase" ? (
              <TrendingUp className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            ) : change.type === "decrease" ? (
              <TrendingDown className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <Badge
              variant="secondary"
              className={`text-xs px-1.5 py-0 ${
                change.type === "increase"
                  ? "bg-red-50 text-red-600"
                  : change.type === "decrease"
                  ? "bg-green-50 text-green-600"
                  : ""
              }`}
            >
              {change.value}
            </Badge>
            {change.period && (
              <span className="text-xs text-muted-foreground">{change.period}</span>
            )}
          </div>
        )}

        {dataInfo && (
          <p className="text-xs text-muted-foreground mt-1">{dataInfo}</p>
        )}
      </CardContent>
    </Card>
  );
}
