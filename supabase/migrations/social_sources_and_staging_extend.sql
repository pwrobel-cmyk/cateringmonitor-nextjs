-- =============================================================================
-- Migration: Social sources table + discount_staging social fields + core_fingerprint
-- Run in Supabase SQL Editor. Fully idempotent — safe to re-run.
-- =============================================================================

-- ─── Step 1: Create social_sources table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_sources (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID         NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform      TEXT         NOT NULL DEFAULT 'facebook',
  source_type   TEXT         NOT NULL CHECK (source_type IN ('profile', 'group', 'page', 'channel')),
  source_name   TEXT         NOT NULL,
  url           TEXT         NOT NULL,
  is_official   BOOLEAN      NOT NULL DEFAULT false,
  active        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (platform, url)
);

CREATE INDEX IF NOT EXISTS idx_social_sources_active_platform
  ON social_sources (active, platform);

-- RLS: no direct browser access needed — admin UI goes through
-- /api/admin/social-sources (service_role), scraper through /api/social-sources
-- (service_role). Service role bypasses RLS. No policy needed for anon/authenticated.
ALTER TABLE social_sources ENABLE ROW LEVEL SECURITY;

-- Revoke direct table access from anon and authenticated roles
REVOKE ALL ON social_sources FROM anon, authenticated;
-- Grant only to service_role (which bypasses RLS anyway, but explicit is better)
GRANT ALL ON social_sources TO service_role;

-- Trigger for updated_at (idempotent: DROP IF EXISTS + CREATE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_social_sources_updated_at ON social_sources;
CREATE TRIGGER set_social_sources_updated_at
  BEFORE UPDATE ON social_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Step 2: Extend discount_staging with social fields ─────────────────────

ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS source_platform TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS source_type TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS source_name TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS source_profile_url TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS post_url TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS post_published_at TIMESTAMPTZ NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS is_official BOOLEAN NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS source_text TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS ocr_text TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS screenshot_url TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS social_source_id UUID NULL;

-- FK for social_source_id (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'discount_staging_social_source_id_fkey'
      AND table_name = 'discount_staging'
  ) THEN
    ALTER TABLE discount_staging
      ADD CONSTRAINT discount_staging_social_source_id_fkey
      FOREIGN KEY (social_source_id) REFERENCES social_sources(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Step 3: Add core_fingerprint and related_staging_id ────────────────────

ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS core_fingerprint TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS related_staging_id UUID NULL;

-- FK for related_staging_id (self-reference, idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'discount_staging_related_staging_id_fkey'
      AND table_name = 'discount_staging'
  ) THEN
    ALTER TABLE discount_staging
      ADD CONSTRAINT discount_staging_related_staging_id_fkey
      FOREIGN KEY (related_staging_id) REFERENCES discount_staging(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discount_staging_core_fingerprint
  ON discount_staging (core_fingerprint)
  WHERE core_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discount_staging_related_staging_id
  ON discount_staging (related_staging_id)
  WHERE related_staging_id IS NOT NULL;

-- ─── Step 4: Backfill core_fingerprint for existing records with code ───────
-- Formula must match lib/discountFingerprint.ts buildCoreFingerprint():
--   normBrand: trim, lowercase, ł→l, NFD strip (translate for PL chars), collapse whitespace
--   normCode:  trim, uppercase
--   normNum:   number without trailing zeros → text, or '' for NULL
--
-- Diacritics mapping (verified char-by-char, tested against TS):
--   ą→a  ć→c  ę→e  ł→l  ń→n  ó→o  ś→s  ź→z  ż→z
--   Ą→A  Ć→C  Ę→E  Ł→L  Ń→N  Ó→O  Ś→S  Ź→Z  Ż→Z
--
-- trim_scale() strips trailing zeros from NUMERIC: 20.50 → 20.5, 20.00 → 20
-- This matches JS String(Number(x)) behavior.

UPDATE discount_staging
SET core_fingerprint = md5(
  -- normBrand: trim, lowercase, PL diacritics → ASCII, collapse whitespace
  regexp_replace(
    translate(
      lower(trim(COALESCE(brand_name_raw, ''))),
      'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
      'acelnoszzACELNOSZZ'
    ),
    '\s+', ' ', 'g'
  )
  || '|' ||
  -- normCode: trim, uppercase
  COALESCE(upper(trim(code)), '')
  || '|' ||
  -- normNum(percentage): strip trailing zeros, or ''
  COALESCE(trim_scale(percentage)::text, '')
  || '|' ||
  -- normNum(fixed_amount): strip trailing zeros, or ''
  COALESCE(trim_scale(fixed_amount)::text, '')
)
WHERE code IS NOT NULL
  AND trim(code) != ''
  AND core_fingerprint IS NULL;
