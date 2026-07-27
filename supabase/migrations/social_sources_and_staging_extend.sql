-- =============================================================================
-- Migration: Social sources table + discount_staging social fields + core_fingerprint
-- Run in Supabase SQL Editor. Safe for tables with existing data.
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

-- RLS
ALTER TABLE social_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON social_sources FOR ALL USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS social_source_id UUID NULL REFERENCES social_sources(id) ON DELETE SET NULL;

-- ─── Step 3: Add core_fingerprint and related_staging_id ────────────────────

ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS core_fingerprint TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS related_staging_id UUID NULL;

-- Non-unique index on core_fingerprint for lookups
CREATE INDEX IF NOT EXISTS idx_discount_staging_core_fingerprint
  ON discount_staging (core_fingerprint)
  WHERE core_fingerprint IS NOT NULL;

-- ─── Step 4: Backfill core_fingerprint for existing records with code ───────
-- Formula: md5(normBrand | normCode | normNum(percentage) | normNum(fixed_amount))

UPDATE discount_staging
SET core_fingerprint = md5(
  translate(
    lower(trim(COALESCE(brand_name_raw, ''))),
    'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
    'acelnoszaACELNOSZZ'
  )
  || '|' || COALESCE(upper(trim(code)), '')
  || '|' || COALESCE(percentage::text, '')
  || '|' || COALESCE(fixed_amount::text, '')
)
WHERE code IS NOT NULL
  AND trim(code) != ''
  AND core_fingerprint IS NULL;
