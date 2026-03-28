import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, currency: string = "PLN"): string {
  const currencySymbols: Record<string, string> = {
    "PLN": "zł",
    "CZK": "Kč",
  };
  const symbol = currencySymbols[currency] || currency;
  return `${price.toFixed(2)} ${symbol}`;
}

export function getCurrencySymbol(currency: string = "PLN"): string {
  const currencySymbols: Record<string, string> = {
    "PLN": "zł",
    "CZK": "Kč",
  };
  return currencySymbols[currency] || currency;
}
