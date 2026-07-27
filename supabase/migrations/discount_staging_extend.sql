-- =============================================================================
-- Migration: Extend discount_staging with new columns + fingerprint dedup
-- Run in Supabase SQL Editor. Safe for tables with existing data.
-- =============================================================================

-- ─── Step 1: Add new columns ────────────────────────────────────────────────

ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS max_days INTEGER NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS min_order_value NUMERIC NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS exclusions_limits TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS communication_channels TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS additional_notes TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS code_source TEXT[] NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS is_cashback BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS source_url TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS fingerprint TEXT NULL;

-- ─── Step 2: Backfill fingerprint for existing records ──────────────────────
-- Uses the same normalization as lib/discountFingerprint.ts:
--   brand = lower(trim(brand_name_raw)) with diacritics (NFD strip not available
--   in pure SQL, but md5 is deterministic — we use translate() for PL diacritics)
--   code = upper(trim(code)) or ''
--   numbers = cast to text or ''
--   dates = to_char or ''
--   requirements = lower(trim(requirements)) or ''
--   Join all with '|', md5 the result

UPDATE discount_staging
SET fingerprint = md5(
  -- brand: lowercase, trim, remove PL diacritics
  translate(
    lower(trim(COALESCE(brand_name_raw, ''))),
    'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
    'acelnoszaACELNOSZZ'
  )
  || '|' ||
  -- code: uppercase, trim, or ''
  COALESCE(upper(trim(code)), '')
  || '|' ||
  -- percentage: number as text or ''
  COALESCE(percentage::text, '')
  || '|' ||
  -- fixed_amount: number as text or ''
  COALESCE(fixed_amount::text, '')
  || '|' ||
  -- valid_from: YYYY-MM-DD or ''
  COALESCE(to_char(valid_from, 'YYYY-MM-DD'), '')
  || '|' ||
  -- valid_until: YYYY-MM-DD or ''
  COALESCE(to_char(valid_until, 'YYYY-MM-DD'), '')
  || '|' ||
  -- min_days: number as text or ''
  COALESCE(min_days::text, '')
  || '|' ||
  -- max_days: number as text or ''
  COALESCE(max_days::text, '')
  || '|' ||
  -- min_order_value: number as text or ''
  COALESCE(min_order_value::text, '')
  || '|' ||
  -- requirements: lowercase, trim, or ''
  COALESCE(lower(trim(requirements)), '')
)
WHERE fingerprint IS NULL;

-- ─── Step 3: Make fingerprint NOT NULL ──────────────────────────────────────

ALTER TABLE discount_staging ALTER COLUMN fingerprint SET NOT NULL;

-- ─── Step 4: Create unique index on fingerprint ─────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_staging_fingerprint
  ON discount_staging (fingerprint);
