import { createHash } from 'crypto'

interface FingerprintInput {
  brand_name_raw: string | null
  code: string | null
  percentage: number | null
  fixed_amount: number | null
  valid_from: string | null
  valid_until: string | null
  min_days: number | null
  max_days: number | null
  min_order_value: number | null
  requirements: string | null
}

function normBrand(v: string | null | undefined): string {
  if (!v) return ''
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function normCode(v: string | null | undefined): string {
  if (!v || !v.trim()) return ''
  return v.trim().toUpperCase()
}

function normNum(v: number | null | undefined): string {
  if (v == null || v === undefined) return ''
  const n = Number(v)
  if (isNaN(n)) return ''
  return String(n)
}

function normDate(v: string | null | undefined): string {
  if (!v) return ''
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function normReq(v: string | null | undefined): string {
  if (!v || !v.trim()) return ''
  return v.trim().toLowerCase()
}

export function buildDiscountFingerprint(r: FingerprintInput): string {
  const parts = [
    normBrand(r.brand_name_raw),
    normCode(r.code),
    normNum(r.percentage),
    normNum(r.fixed_amount),
    normDate(r.valid_from),
    normDate(r.valid_until),
    normNum(r.min_days),
    normNum(r.max_days),
    normNum(r.min_order_value),
    normReq(r.requirements),
  ]
  const raw = parts.join('|')
  return createHash('md5').update(raw).digest('hex')
}

interface CoreFingerprintInput {
  brand_name_raw: string | null
  code: string | null
  percentage: number | null
  fixed_amount: number | null
}

/**
 * Core fingerprint for cross-source dedup (WWW ↔ social).
 * Only computed when code is non-empty. Returns null otherwise.
 * Formula: md5(brand | code | percentage | fixed_amount)
 */
export function buildCoreFingerprint(r: CoreFingerprintInput): string | null {
  const code = normCode(r.code)
  if (!code) return null
  const parts = [
    normBrand(r.brand_name_raw),
    code,
    normNum(r.percentage),
    normNum(r.fixed_amount),
  ]
  const raw = parts.join('|')
  return createHash('md5').update(raw).digest('hex')
}
