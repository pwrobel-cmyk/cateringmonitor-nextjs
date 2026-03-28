/**
 * Centralized discount filtering utilities
 */

/**
 * Normalize text for consistent comparison (remove diacritics, lowercase)
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Check if discount matches customer type based on requirements field
 */
export function matchesCustomerType(
  requirements: string | null,
  customerType: "existing" | "new"
): boolean {
  // No requirements text -> treat as available for everyone
  if (!requirements || requirements.trim() === "") return customerType === "existing";

  const normalized = normalize(requirements);

  const hasNewKeywords =
    normalized.includes("nowy") ||
    normalized.includes("nowi") ||
    normalized.includes("nowych") ||
    normalized.includes("dla nowych") ||
    normalized.includes("pierwsze zamowienie") ||
    normalized.includes("pierwszy");

  const hasAllKeywords =
    normalized.includes("wszyscy") ||
    normalized.includes("dla wszystkich") ||
    normalized.includes("wszystkich klientow") ||
    normalized.includes("dla kazdego") ||
    normalized.includes("dla kazdy");

  const hasExistingKeywords =
    normalized.includes("istniejacy") ||
    normalized.includes("obecny") ||
    normalized.includes("staly") ||
    normalized.includes("stali");

  if (customerType === "existing") {
    if (normalized === "brak") return true;
    const isNewOnly = hasNewKeywords && !hasAllKeywords && !hasExistingKeywords;
    return !isNewOnly;
  } else {
    if (normalized === "brak") return false;
    return hasNewKeywords;
  }
}

/**
 * Check if discount date range overlaps with given period
 * Handles NULL valid_until (means no end date)
 */
export function overlapsRange(
  valid_from: string,
  valid_until: string | null,
  dateFrom: string,
  dateTo: string
): boolean {
  const from = new Date(valid_from);
  const until = valid_until ? new Date(valid_until) : null;
  const periodStart = new Date(dateFrom);
  const periodEnd = new Date(dateTo);

  if (!until) {
    return from <= periodEnd;
  }

  return from <= periodEnd && until >= periodStart;
}
