import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildDiscountFingerprint, buildCoreFingerprint } from '@/lib/discountFingerprint'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface ImportRecord {
  brand_name_raw: string
  code?: string | null
  percentage?: number | null
  fixed_amount?: number | null
  description?: string | null
  valid_from?: string | null
  valid_until?: string | null
  min_days?: number | null
  max_days?: number | null
  min_order_value?: number | null
  requirements?: string | null
  exclusions_limits?: string | null
  communication_channels?: string | null
  additional_notes?: string | null
  code_source?: string[] | null
  is_cashback?: boolean
  source?: string | null
  source_url?: string | null
  import_batch_id?: string | null
  fingerprint?: string | null
  // Social source fields (all optional — WWW import works without them)
  source_platform?: string | null
  source_type?: string | null
  source_name?: string | null
  source_profile_url?: string | null
  post_url?: string | null
  post_published_at?: string | null
  is_official?: boolean | null
  source_text?: string | null
  ocr_text?: string | null
  screenshot_url?: string | null
  social_source_id?: string | null
}

interface ImportError {
  index: number
  reason: string
}

function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function isNumericOrNull(v: unknown): boolean {
  if (v == null) return true
  const n = Number(v)
  return !isNaN(n) && isFinite(n)
}

function isDateOrNull(v: unknown): boolean {
  if (v == null || v === '') return true
  return typeof v === 'string' && DATE_RE.test(v)
}

export async function POST(request: Request) {
  // Auth: machine token
  const token = request.headers.get('x-import-token')
  if (!token || token !== process.env.DISCOUNT_IMPORT_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const records: ImportRecord[] = Array.isArray(body) ? body : [body]

  if (records.length === 0) {
    return Response.json({ inserted: 0, duplicates: 0, errors: [] })
  }

  // Load brands for matching
  const { data: allBrands } = await service
    .from('brands')
    .select('id, name')
    .eq('is_active', true)

  const brandMap = new Map<string, { id: string; count: number }>()
  for (const b of allBrands || []) {
    const key = normalizeName(b.name)
    const existing = brandMap.get(key)
    if (existing) {
      existing.count++
    } else {
      brandMap.set(key, { id: b.id, count: 1 })
    }
  }

  // Validate and prepare rows
  const errors: ImportError[] = []
  const validRows: Array<Record<string, unknown>> = []

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const reasons: string[] = []

    // brand_name_raw required
    if (!r.brand_name_raw || typeof r.brand_name_raw !== 'string' || !r.brand_name_raw.trim()) {
      reasons.push('brand_name_raw wymagane (niepusty string)')
    }

    // at least one value indicator required: percentage, fixed_amount, or requirements
    if (r.percentage == null && r.fixed_amount == null && (!r.requirements || !r.requirements.trim())) {
      reasons.push('percentage, fixed_amount lub requirements wymagane')
    }

    // numeric validation
    if (!isNumericOrNull(r.percentage)) reasons.push('percentage musi być liczbą')
    if (!isNumericOrNull(r.fixed_amount)) reasons.push('fixed_amount musi być liczbą')
    if (!isNumericOrNull(r.min_days)) reasons.push('min_days musi być liczbą')
    if (!isNumericOrNull(r.max_days)) reasons.push('max_days musi być liczbą')
    if (!isNumericOrNull(r.min_order_value)) reasons.push('min_order_value musi być liczbą')

    // date validation
    if (!isDateOrNull(r.valid_from)) reasons.push('valid_from: format YYYY-MM-DD')
    if (!isDateOrNull(r.valid_until)) reasons.push('valid_until: format YYYY-MM-DD')

    // social validation: if source_platform=facebook then post_url required
    if (r.source_platform === 'facebook' && (!r.post_url || !r.post_url.trim())) {
      reasons.push('post_url wymagany dla source_platform=facebook')
    }

    if (reasons.length > 0) {
      errors.push({ index: i, reason: reasons.join('; ') })
      continue
    }

    // Compute fingerprint
    const computed = buildDiscountFingerprint({
      brand_name_raw: r.brand_name_raw,
      code: r.code ?? null,
      percentage: r.percentage != null ? Number(r.percentage) : null,
      fixed_amount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
      valid_from: r.valid_from ?? null,
      valid_until: r.valid_until ?? null,
      min_days: r.min_days != null ? Number(r.min_days) : null,
      max_days: r.max_days != null ? Number(r.max_days) : null,
      min_order_value: r.min_order_value != null ? Number(r.min_order_value) : null,
      requirements: r.requirements ?? null,
    })

    // Compute core fingerprint (only when code is non-empty)
    const coreComputed = buildCoreFingerprint({
      brand_name_raw: r.brand_name_raw,
      code: r.code ?? null,
      percentage: r.percentage != null ? Number(r.percentage) : null,
      fixed_amount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
    })

    // Verify provided fingerprint if present
    if (r.fingerprint && r.fingerprint !== computed) {
      errors.push({ index: i, reason: `fingerprint niezgodny: podany=${r.fingerprint}, wyliczony=${computed}` })
      continue
    }

    // Brand matching: exact match on normalized name
    let brandId: string | null = null
    const normalizedBrand = normalizeName(r.brand_name_raw)
    const match = brandMap.get(normalizedBrand)
    if (match && match.count === 1) {
      brandId = match.id
    }

    validRows.push({
      brand_name_raw: r.brand_name_raw.trim(),
      brand_id: brandId,
      code: r.code?.trim() || null,
      percentage: r.percentage != null ? Number(r.percentage) : null,
      fixed_amount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
      description: r.description?.trim() || null,
      valid_from: r.valid_from || null,
      valid_until: r.valid_until || null,
      min_days: r.min_days != null ? Number(r.min_days) : null,
      max_days: r.max_days != null ? Number(r.max_days) : null,
      min_order_value: r.min_order_value != null ? Number(r.min_order_value) : null,
      requirements: r.requirements?.trim() || null,
      exclusions_limits: r.exclusions_limits?.trim() || null,
      communication_channels: r.communication_channels?.trim() || null,
      additional_notes: r.additional_notes?.trim() || null,
      code_source: r.code_source || null,
      is_cashback: r.is_cashback || false,
      source: r.source?.trim() || 'gcs_import',
      source_url: r.source_url?.trim() || null,
      import_batch_id: r.import_batch_id || null,
      fingerprint: computed,
      core_fingerprint: coreComputed,
      // Social source fields
      source_platform: r.source_platform?.trim() || null,
      source_type: r.source_type?.trim() || null,
      source_name: r.source_name?.trim() || null,
      source_profile_url: r.source_profile_url?.trim() || null,
      post_url: r.post_url?.trim() || null,
      post_published_at: r.post_published_at || null,
      is_official: r.is_official ?? null,
      source_text: r.source_text?.trim() || null,
      ocr_text: r.ocr_text?.trim() || null,
      screenshot_url: r.screenshot_url?.trim() || null,
      social_source_id: r.social_source_id || null,
    })
  }

  if (validRows.length === 0) {
    return Response.json({ inserted: 0, duplicates: 0, errors })
  }

  // Upsert with ignoreDuplicates — existing records (any status) untouched
  const { data: upserted, error: upsertErr } = await service
    .from('discount_staging')
    .upsert(validRows, { onConflict: 'fingerprint', ignoreDuplicates: true })
    .select('id, core_fingerprint')

  if (upsertErr) {
    return Response.json({ error: upsertErr.message }, { status: 500 })
  }

  const insertedCount = upserted?.length ?? 0
  const duplicates = validRows.length - insertedCount

  // Link inserted records to existing ones by core_fingerprint
  if (upserted && upserted.length > 0) {
    const coreIds = upserted.filter((r: any) => r.core_fingerprint != null)
    for (const row of coreIds) {
      const { data: related } = await service
        .from('discount_staging')
        .select('id')
        .eq('core_fingerprint', row.core_fingerprint)
        .in('status', ['pending', 'accepted'])
        .neq('id', row.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (related && related.length > 0) {
        await service
          .from('discount_staging')
          .update({ related_staging_id: related[0].id })
          .eq('id', row.id)
      }
    }
  }

  return Response.json({ inserted: insertedCount, duplicates, errors })
}
