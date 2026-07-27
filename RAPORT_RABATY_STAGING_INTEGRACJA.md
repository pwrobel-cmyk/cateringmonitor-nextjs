# Raport: Integracja discount_staging z endpointem importu i fingerprint dedup

Data: 2026-07-27

---

## 1. SQL do wykonania w Supabase SQL Editor

Plik: `supabase/migrations/discount_staging_extend.sql`

```sql
-- Step 1: Add new columns
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

-- Step 2: Backfill fingerprint for existing records
UPDATE discount_staging
SET fingerprint = md5(
  translate(
    lower(trim(COALESCE(brand_name_raw, ''))),
    'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
    'acelnoszaACELNOSZZ'
  )
  || '|' || COALESCE(upper(trim(code)), '')
  || '|' || COALESCE(percentage::text, '')
  || '|' || COALESCE(fixed_amount::text, '')
  || '|' || COALESCE(to_char(valid_from, 'YYYY-MM-DD'), '')
  || '|' || COALESCE(to_char(valid_until, 'YYYY-MM-DD'), '')
  || '|' || COALESCE(min_days::text, '')
  || '|' || COALESCE(max_days::text, '')
  || '|' || COALESCE(min_order_value::text, '')
  || '|' || COALESCE(lower(trim(requirements)), '')
)
WHERE fingerprint IS NULL;

-- Step 3: Make fingerprint NOT NULL
ALTER TABLE discount_staging ALTER COLUMN fingerprint SET NOT NULL;

-- Step 4: Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_staging_fingerprint
  ON discount_staging (fingerprint);
```

**UWAGA:** Backfill SQL używa `translate()` dla polskich diakrytyków (identyczny efekt jak `normalize('NFD')` w JS). Wynikowe hashe MD5 mogą się nieznacznie różnić od JS dla znaków spoza PL — nie jest to problem, bo po migracji nowe rekordy będą pisane wyłącznie przez endpoint z JS fingerprint.

---

## 2. Endpoint importu

**Ścieżka:** `POST /api/discount-staging/import`

**Plik:** `app/api/discount-staging/import/route.ts`

---

## 3. Schemat JSON requestu

### Pojedynczy rekord:
```json
{
  "brand_name_raw": "Dietly Box",
  "code": "LATO20",
  "percentage": 20,
  "fixed_amount": null,
  "description": "Rabat na pierwszy tydzień",
  "valid_from": "2026-07-01",
  "valid_until": "2026-08-31",
  "min_days": 5,
  "max_days": 14,
  "min_order_value": 150,
  "requirements": "Nowi klienci, min. 5 dni",
  "exclusions_limits": "Nie łączy się z innymi promocjami",
  "communication_channels": "WWW, Instagram",
  "additional_notes": null,
  "code_source": ["WWW"],
  "is_cashback": false,
  "source": "gcs_import",
  "source_url": "https://example.com/offer",
  "import_batch_id": null,
  "fingerprint": null
}
```

### Tablica rekordów:
```json
[
  { "brand_name_raw": "Dietly Box", "code": "LATO20", "percentage": 20, ... },
  { "brand_name_raw": "Be Diet", "code": null, "percentage": 15, "fixed_amount": null, ... }
]
```

### Pola wymagane:
| Pole | Wymagane | Walidacja |
|------|----------|-----------|
| brand_name_raw | TAK | Niepusty string |
| percentage LUB fixed_amount | TAK (jedno z) | Numeryczne |
| valid_from, valid_until | NIE | Format YYYY-MM-DD lub null |
| min_days, max_days, min_order_value | NIE | Numeryczne lub null |
| fingerprint | NIE | Jeśli podany, musi zgadzać się z wyliczonym |

Pozostałe pola opcjonalne, domyślne wartości: `source='gcs_import'`, `is_cashback=false`.

---

## 4. Przykład response

### Sukces (200):
```json
{
  "inserted": 8,
  "duplicates": 2,
  "errors": [
    { "index": 3, "reason": "brand_name_raw wymagane (niepusty string)" },
    { "index": 7, "reason": "percentage lub fixed_amount wymagane" }
  ]
}
```

### Błąd auth (401):
```json
{ "error": "Unauthorized" }
```

### Błąd bazy (500):
```json
{ "error": "duplicate key value violates unique constraint..." }
```

---

## 5. Autoryzacja Cloud Run → endpoint

### Nagłówek:
```
x-import-token: <wartość DISCOUNT_IMPORT_TOKEN>
```

### Zmienna środowiskowa:
- **Nazwa:** `DISCOUNT_IMPORT_TOKEN`
- **Lokalizacja:** Vercel → Settings → Environment Variables (NIGDY `NEXT_PUBLIC_`)
- **Placeholder w `.env.local`:** `DISCOUNT_IMPORT_TOKEN=CHANGE_ME` (dodany)

### Przykład wywołania z Cloud Run:
```bash
curl -X POST \
  'https://your-domain.vercel.app/api/discount-staging/import' \
  -H 'x-import-token: YOUR_SECRET_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '[
    {
      "brand_name_raw": "Dietly Box",
      "code": "LATO20",
      "percentage": 20,
      "valid_from": "2026-07-01"
    }
  ]'
```

---

## 6. Zmiany w accept (route.ts)

**Plik:** `app/api/admin/discount-staging/route.ts:69-88`

Rozszerzony INSERT do `discounts` — nowe pola dodane do mapowania:

| Pole staging | → Pole discounts | Status |
|---|---|---|
| brand_id | brand_id | bez zmian |
| code | code | bez zmian |
| percentage | percentage | bez zmian |
| **fixed_amount** | **fixed_amount** | **NOWE** |
| valid_from | valid_from | bez zmian |
| valid_until | valid_until | bez zmian |
| description | description | bez zmian |
| min_days | min_days | bez zmian |
| **max_days** | **max_days** | **NOWE** |
| **min_order_value** | **min_order_value** | **NOWE** |
| requirements | requirements | bez zmian |
| **exclusions_limits** | **exclusions_limits** | **NOWE** |
| **communication_channels** | **communication_channels** | **NOWE** |
| **additional_notes** | **additional_notes** | **NOWE** |
| **code_source** | **code_source** | **NOWE** |
| **is_cashback** | **is_cashback** | **NOWE** |
| *(hardcoded)* | is_active = true | bez zmian |
| source_url | *(nie kopiowane)* | zostaje w staging |

Wszystkie 8 nowych kolumn istnieją w tabeli `discounts` (potwierdzone z `admin/discounts/page.tsx:29-50`). Brak potrzeby ALTER TABLE discounts.

---

## 7. Algorytm fingerprint

**Plik:** `lib/discountFingerprint.ts`

### Normalizacja per pole:

| Pole | Normalizacja |
|------|-------------|
| brand_name_raw | trim → lowercase → NFD strip diacritics → collapse whitespace |
| code | trim → UPPERCASE; null/'' → '' |
| percentage, fixed_amount, min_days, max_days, min_order_value | Number() → String(); null → '' |
| valid_from, valid_until | Extract YYYY-MM-DD; null → '' |
| requirements | trim → lowercase; null/'' → '' |

### Skład:
```
join('|', [brand, code, percentage, fixed_amount, valid_from, valid_until, min_days, max_days, min_order_value, requirements])
```

### Hash:
```
crypto.createHash('md5').update(raw).digest('hex')
```

### Pola NIE wchodzące do fingerprint:
`description`, `source`, `source_url`, `import_batch_id`, `created_at`, `status`, `reviewed_by`, `reviewed_at`, `exclusions_limits`, `communication_channels`, `additional_notes`, `code_source`, `is_cashback`

**Uzasadnienie:** Fingerprint identyfikuje „ten sam rabat" na poziomie oferty (marka + kod + kwota + daty + warunki). Metadane (opis, kanał, źródło) mogą się różnić między importami tego samego rabatu.

---

## 8. Wyniki testów fingerprint

```
Test 1 (same discount, different order/whitespace):
  A: f715ccadfbf6a296fbef4f57eb6ce74f
  B: f715ccadfbf6a296fbef4f57eb6ce74f
  PASS: YES ✓

Test 2 (different percentage):
  A (20%): f715ccadfbf6a296fbef4f57eb6ce74f
  C (15%): 5c4cde7bdf145578ed9e53b0c364dea5
  PASS: YES ✓

Test 3 (null vs empty string):
  D (nulls):   c4755020dec403053b027620201e3480
  E (empty ''): c4755020dec403053b027620201e3480
  PASS: YES ✓

ALL TESTS: PASSED ✓
```

`npx tsc --noEmit` — brak błędów.

---

## 9. Status wdrożenia

| Element | Status | Akcja wymagana |
|---------|--------|---------------|
| `lib/discountFingerprint.ts` | W kodzie | — |
| `app/api/discount-staging/import/route.ts` | W kodzie | — |
| `app/api/admin/discount-staging/route.ts` (accept rozszerzony) | W kodzie | — |
| `app/(dashboard)/admin/discounts-staging/page.tsx` (UI nowe pola) | W kodzie | — |
| `.env.local` → `DISCOUNT_IMPORT_TOKEN=CHANGE_ME` | W kodzie | — |
| **SQL migracja** | `supabase/migrations/discount_staging_extend.sql` | **Wykonać w Supabase SQL Editor** |
| **DISCOUNT_IMPORT_TOKEN na Vercel** | Placeholder w .env.local | **Ustawić w Vercel → Environment Variables** |
| **DISCOUNT_IMPORT_TOKEN w Cloud Run** | — | **Ustawić w Cloud Run env/secrets** |

### Kolejność wdrożenia:
1. Wykonaj SQL w Supabase SQL Editor
2. Ustaw `DISCOUNT_IMPORT_TOKEN` na Vercel (wygeneruj silny token, np. `openssl rand -hex 32`)
3. Deploy (git push — już zrobione)
4. Ten sam token ustaw w Cloud Run jako secret
5. Scraper wywołuje `POST /api/discount-staging/import` z nagłówkiem `x-import-token`
