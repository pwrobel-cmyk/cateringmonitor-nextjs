'use client';

import { useDiscountAlerts } from "@/hooks/useDiscountAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Copy, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function ActiveAlertsSection() {
  const { matchedAlerts, dismissMatch } = useDiscountAlerts();

  if (matchedAlerts.length === 0) return null;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Kod skopiowany do schowka");
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">
          Aktywne alerty rabatowe ({matchedAlerts.length})
        </h3>
        <Link
          href="/discounts"
          className="ml-auto text-xs text-amber-700 underline hover:text-amber-900"
        >
          Zarządzaj alertami
        </Link>
      </div>

      <div className="space-y-2">
        {matchedAlerts.map((match) => (
          <div
            key={`${match.alert.id}-${match.discount.id}`}
            className="flex items-start justify-between bg-white rounded-lg p-3 border border-amber-100"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">
                  {match.discount.brandName}
                </span>
                <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">
                  -{match.discount.percentage}%
                </Badge>
                {match.discount.packageName && (
                  <span className="text-xs text-gray-500">
                    {match.discount.packageName}
                  </span>
                )}
              </div>
              {match.discount.code && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-gray-500">Kod:</span>
                  <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {match.discount.code}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => copyCode(match.discount.code!)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                Alert: min {match.alert.minDiscount}% dla {match.alert.brandName}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
              onClick={() => dismissMatch(match.alert.id, match.discount.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
