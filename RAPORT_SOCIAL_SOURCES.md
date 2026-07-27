# Raport: Social Sources + Cross-Source Dedup

Data: 2026-07-27

---

## Zmienione pliki

| Plik | Zmiana |
|------|--------|
| `lib/discountFingerprint.ts` | Dodano `buildCoreFingerprint()` — md5(brand\|code\|pct\|amt), null gdy code pusty |
| `app/api/discount-staging/import/route.ts` | Nowe pola social w ImportRecord, walidacja FB (post_url wymagany), core_fingerprint + related_staging_id linking |
| `app/api/social-sources/route.ts` | **NOWY** — GET, auth x-import-token, zwraca aktywne źródła z nazwą marki |
| `app/(dashboard)/admin/social-sources/page.tsx` | **NOWY** — CRUD źródeł social: tabela z filtrami, modal dodaj/edytuj |
| `app/(dashboard)/admin/discounts-staging/page.tsx` | Rozszerzony interface, social display, grouping po core_fingerprint, screenshot modal |
| `app/(dashboard)/admin/{prices,reviews,scrapers,discounts}/page.tsx` | Link "Źródła social" w nawigacji admina |
| `supabase/migrations/social_sources_and_staging_extend.sql` | SQL migracja (do wykonania ręcznie) |

---

## SQL do wykonania w Supabase SQL Editor

Plik: `supabase/migrations/social_sources_and_staging_extend.sql`

### 1. Tabela social_sources
```sql
CREATE TABLE IF NOT EXISTS social_sources (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID         NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform      TEXT         NOT NULL DEFAULT 'facebook',
  source_type   TEXT         NOT NULL CHECK (source_type IN ('profile','group','page','channel')),
  source_name   TEXT         NOT NULL,
  url           TEXT         NOT NULL,
  is_official   BOOLEAN      NOT NULL DEFAULT false,
  active        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (platform, url)
);
CREATE INDEX IF NOT EXISTS idx_social_sources_active_platform ON social_sources (active, platform);
ALTER TABLE social_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON social_sources FOR ALL USING (true);
```
+ trigger `update_updated_at_column()` na `BEFORE UPDATE`.

### 2. Rozszerzenie discount_staging
```sql
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
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS core_fingerprint TEXT NULL;
ALTER TABLE discount_staging ADD COLUMN IF NOT EXISTS related_staging_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_discount_staging_core_fingerprint
  ON discount_staging (core_fingerprint) WHERE core_fingerprint IS NOT NULL;
```

### 3. Backfill core_fingerprint
```sql
UPDATE discount_staging
SET core_fingerprint = md5(
  translate(lower(trim(COALESCE(brand_name_raw, ''))), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszaACELNOSZZ')
  || '|' || COALESCE(upper(trim(code)), '')
  || '|' || COALESCE(percentage::text, '')
  || '|' || COALESCE(fixed_amount::text, '')
)
WHERE code IS NOT NULL AND trim(code) != '' AND core_fingerprint IS NULL;
```

---

## Adres strony admina

`/admin/social-sources`

---

## Endpoint konfiguracji źródeł

### GET /api/social-sources

**Auth:** `x-import-token: <DISCOUNT_IMPORT_TOKEN>`

**Query params:** `?platform=facebook` (opcjonalny)

**Response 200:**
```json
{
  "sources": [
    {
      "id": "uuid",
      "brand_id": "uuid",
      "brand_name": "MaczFit",
      "platform": "facebook",
      "source_type": "group",
      "source_name": "MaczFit kody rabatowe",
      "url": "https://facebook.com/groups/maczfit-kody",
      "is_official": false
    }
  ]
}
```

**Response 401:** `{ "error": "Unauthorized" }`

---

## Rozszerzony JSON importu

### Nowe opcjonalne pola (import bez nich działa jak dotychczas):

```json
{
  "brand_name_raw": "MaczFit",
  "code": "LATO20",
  "percentage": 20,
  "valid_from": "2026-07-01",
  "description": "Letnia promocja",

  "source_platform": "facebook",
  "source_type": "group",
  "source_name": "MaczFit kody rabatowe",
  "source_profile_url": "https://facebook.com/groups/maczfit-kody",
  "post_url": "https://facebook.com/groups/maczfit-kody/posts/123456",
  "post_published_at": "2026-07-25T14:30:00Z",
  "is_official": false,
  "source_text": "Nowy kod LATO20 na -20%! Ważny do końca sierpnia.",
  "ocr_text": "LATO20 -20%",
  "screenshot_url": "https://storage.example.com/screenshots/abc.png",
  "social_source_id": "uuid-of-social-source"
}
```

**Walidacja:** `source_platform=facebook` → `post_url` wymagany. Brak pól social → zachowanie identyczne jak dotychczas.

---

## Decyzja o deduplikacji z uzasadnieniem

### core_fingerprint
- **Definicja:** `md5(normBrand | normCode | normNum(percentage) | normNum(fixed_amount))`
- **Obliczany TYLKO** gdy `code` jest niepusty po normalizacji
- Gdy `code=null` → `core_fingerprint = null`, brak automatycznego linkowania
- **Indeks nieunikalny** — nie powoduje ON CONFLICT, nie blokuje insertów
- Obecny `fingerprint` i jego UNIQUE constraint **bez zmian**

### related_staging_id
- Po insercie nowego rekordu z `core_fingerprint != null`: szukaj najstarszego rekordu o tym samym `core_fingerprint` ze statusem `pending` lub `accepted`
- Jeśli znaleziony → zapisz jego `id` w `related_staging_id` nowego rekordu
- **Nie modyfikuje statusu** żadnego istniejącego rekordu

### UI grouping
- Rekordy z wspólnym `core_fingerprint` grupowane wizualnie
- **Główny rekord** = ten z największą liczbą niepustych pól kluczowych (richness score)
- Pod głównym rekordem: lista powiązanych źródeł z evidence (post URL, tekst, screenshot)
- **Brak automatycznej akceptacji** powiązanych rekordów — każdy wymaga osobnej decyzji

### Uzasadnienie
- Konserwatywne podejście: tylko `brand + code + percentage + fixed_amount` → minimalne ryzyko false positives
- Brak code → brak linkowania: sformułowania marketingowe FB vs WWW są niestabilne
- related_staging_id wskazuje kierunek (pierwszy → nowszy), ale UI prezentuje bogatszy rekord jako główny

---

## Wyniki testów

### npx tsc --noEmit
```
(brak błędów)
```

### npm run build
```
Build zakończony sukcesem
```

### Testy produkcyjne
**ZABLOKOWANE** — endpoint zwraca 401 Unauthorized mimo poprawnego tokenu. Prawdopodobna przyczyna: `DISCOUNT_IMPORT_TOKEN` nie jest ustawiony na Vercel (`.env.local` jest tylko dla lokalnego dev). Wcześniejsze testy (przed tym commitem) działały poprawnie z tym tokenem.

**Akcja wymagana:** Zweryfikuj `DISCOUNT_IMPORT_TOKEN` w Vercel → Settings → Environment Variables.

Po ustawieniu tokenu, do uruchomienia:

```bash
# Test 1: Regresja WWW (bez pól social)
curl -s -X POST https://www.cateringmonitor.pl/api/discount-staging/import \
  -H "Content-Type: application/json" -H "x-import-token: $TOKEN" \
  -d '[{"brand_name_raw":"RegresjaTest","code":"REG001","percentage":25,"valid_from":"2026-08-01"}]'
# Oczekiwane: inserted:1

# Test 2: Duplicate
# (ten sam curl ponownie) → Oczekiwane: duplicates:1

# Test 3: Social-sources endpoint
curl -s https://www.cateringmonitor.pl/api/social-sources -H "x-import-token: $TOKEN"
# Oczekiwane: {"sources":[]}

# Test 4: Social-sources bez tokenu
curl -s https://www.cateringmonitor.pl/api/social-sources
# Oczekiwane: 401

# Test 5: Import z pełnym payloadem social
curl -s -X POST https://www.cateringmonitor.pl/api/discount-staging/import \
  -H "Content-Type: application/json" -H "x-import-token: $TOKEN" \
  -d '[{"brand_name_raw":"MaczFit","code":"LATO20","percentage":20,"valid_from":"2026-07-01","source_platform":"facebook","source_type":"group","source_name":"MaczFit kody","post_url":"https://fb.com/post/123","source_text":"Kod LATO20 -20%!"}]'
# Oczekiwane: inserted:1

# Test 6: Dedup FB↔WWW (ten sam kod, inne daty)
# Najpierw WWW:
curl -s -X POST https://www.cateringmonitor.pl/api/discount-staging/import \
  -H "Content-Type: application/json" -H "x-import-token: $TOKEN" \
  -d '[{"brand_name_raw":"DedupTest","code":"DEDUP01","percentage":15,"valid_from":"2026-08-01","valid_until":"2026-09-30","min_days":5}]'
# Potem FB (uboższe dane, ten sam kod):
curl -s -X POST https://www.cateringmonitor.pl/api/discount-staging/import \
  -H "Content-Type: application/json" -H "x-import-token: $TOKEN" \
  -d '[{"brand_name_raw":"DedupTest","code":"DEDUP01","percentage":15,"source_platform":"facebook","post_url":"https://fb.com/post/456"}]'
# Oczekiwane: oba inserted:1, drugi ma related_staging_id wskazujący na pierwszy
```

---

## Status wdrożenia

| Element | Status | Akcja |
|---------|--------|-------|
| Kod (fingerprint, import, social-sources, UI) | Wdrożony na Vercel | — |
| **SQL migracja** | Plik w repo | **Wykonać w Supabase SQL Editor** |
| **DISCOUNT_IMPORT_TOKEN na Vercel** | Prawdopodobnie brak | **Zweryfikować/ustawić** |
| Testy produkcyjne | Oczekujące na SQL + token | Uruchomić po powyższych |
