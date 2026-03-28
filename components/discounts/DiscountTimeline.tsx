'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Copy } from "lucide-react";
import { Discount } from "@/hooks/supabase/useDiscounts";
import { toast } from "sonner";

interface DiscountTimelineProps {
  discounts: Discount[];
}

export function DiscountTimeline({ discounts }: DiscountTimelineProps) {
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Kod skopiowany do schowka");
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Brak daty";
    return new Date(date).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysRemaining = (validUntil: string | null) => {
    if (!validUntil) return null;
    return Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getDiscountAmount = (discount: Discount) => {
    if (discount.percentage) return `${discount.percentage}%`;
    if (discount.fixed_amount) return `${discount.fixed_amount} zł`;
    return "Rabat";
  };

  return (
    <div className="relative space-y-4">
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

      {discounts.map((discount) => {
        const daysRemaining = getDaysRemaining(discount.valid_until);
        const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
        const isExpired = daysRemaining !== null && daysRemaining < 0;

        return (
          <div key={discount.id} className="relative flex gap-6 group">
            <div className="relative z-10 flex-shrink-0">
              <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                isExpired
                  ? "bg-muted border-muted-foreground"
                  : isExpiringSoon
                  ? "bg-yellow-500 border-yellow-500 animate-pulse"
                  : "bg-primary border-primary"
              }`} />
            </div>

            <Card className="flex-1 group-hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {discount.brands?.logo_url && (
                        <img
                          src={discount.brands.logo_url}
                          alt={`${discount.brands.name} logo`}
                          className="w-8 h-8 rounded object-contain"
                        />
                      )}
                      <h3 className="font-bold text-lg">
                        {discount.brands?.name || "Nieznana marka"}
                      </h3>
                      <Badge variant={isExpired ? "secondary" : "default"} className="text-sm">
                        {getDiscountAmount(discount)}
                      </Badge>
                      {isExpiringSoon && !isExpired && (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          Kończy się wkrótce
                        </Badge>
                      )}
                    </div>
                    {discount.description && (
                      <p className="text-sm text-muted-foreground">{discount.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Od:</span>
                      <span className="font-medium">{formatDate(discount.valid_from)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Do:</span>
                      <span className={`font-medium ${isExpiringSoon ? "text-yellow-600" : ""}`}>
                        {formatDate(discount.valid_until)}
                      </span>
                      {daysRemaining !== null && daysRemaining >= 0 && (
                        <span className="text-xs text-muted-foreground">({daysRemaining} dni)</span>
                      )}
                    </div>
                  </div>

                  {discount.code && (
                    <div className="flex items-center justify-end gap-2">
                      <div className="bg-muted px-4 py-2 rounded-md">
                        <span className="font-mono font-bold text-lg">{discount.code}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyCode(discount.code!)}
                        className="flex-shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {(discount.requirements || discount.exclusions_limits || discount.min_days || (discount.code_source && discount.code_source.length > 0)) && (
                  <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                    {discount.min_days && (
                      <div>
                        <span className="font-medium text-muted-foreground">Minimalna ilość dni: </span>
                        <span>{discount.min_days} dni</span>
                      </div>
                    )}
                    {discount.requirements && (
                      <div>
                        <span className="font-medium text-muted-foreground">Wymagania: </span>
                        <span>{discount.requirements}</span>
                      </div>
                    )}
                    {discount.exclusions_limits && (
                      <div>
                        <span className="font-medium text-muted-foreground">Ograniczenia: </span>
                        <span>{discount.exclusions_limits}</span>
                      </div>
                    )}
                    {discount.code_source && discount.code_source.length > 0 && (
                      <div>
                        <span className="font-medium text-muted-foreground">Źródło rabatu: </span>
                        <span>{discount.code_source.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
