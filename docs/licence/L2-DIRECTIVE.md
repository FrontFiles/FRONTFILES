# L2 — Licence Taxonomy Schema Migration + TypeScript Module Skeleton

**Status:** DRAFT v1.1 — awaiting founder ratification (v1 composed 2026-04-28; v1.1 cascade B amendment 2026-04-30 per L1 v2.2 §10 don't-do #13 + §5.4 — doc-only changes; no schema impact). See §13 revision history.
**Date:** 2026-04-30 (v1.1 amendment); 2026-04-28 (v1 draft)
**Predecessor gates:** L1 v2 ratified via PR #32 (merged 2026-04-28); L1 v2.2 cascade A amendment (PR-A2; awaiting ratification at time of v1.1 composition) — v1.1 amendment lands cascade B per L1 v2.2 §12 cascade impact table; 24-sublabel taxonomy locked
**Governing documents:**
- `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2.2 (L1; cascade A awaiting ratification) — taxonomy locks (§3), schema shape (§4.3), TypeScript shape (§4.4), pricing implications (§5; v2.2 §5.0 dropped `intrusion_level` from pricing dimensions)
- `src/lib/types.ts:360-378` (`LicenceType`) — legacy 8-value enum; UNCHANGED in L2 (kept for dual-read until L8)
- `supabase/migrations/20260413230002_vault_asset_tables.sql:73-105` — existing CHECK constraint shape this migration extends
- `supabase/migrations/20260420000000_rls_all_tables.sql` — RLS conventions for new system pricing tables (mirror service-role-only pattern from `pricing_recommendations` provisioning when F-track lands)
- `src/lib/processing/E2-DIRECTIVE.md` — sister AI-pipeline schema directive (mirror migration + module structure + verification-gate format)

**Objective:** Stand up the schema substrate the new 4-class licence taxonomy will read against, plus the TypeScript module that consumers will import. L2 ships dormant — no engine code, no backfill of existing data, no UI integration. Migration is reversible; new tables are empty (calibration values land at L5); legacy 8-value `LicenceType` enum is untouched.

---

## 1. What L2 is

L2 lays the schema foundation. It produces three things:

1. **Schema migration (additive only)** — extends the existing `vault_assets.enabled_licences` CHECK to allow BOTH legacy 8 values AND new 24 dotted values during the L2-L7 transition; adds three new pricing tables (`pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers`); RLS service-role-only on every new table; reversible DOWN.
2. **TypeScript module** — `src/lib/licence/{types.ts, helpers.ts, labels.ts}` exposing the locked shape from L1 v2 §4.4 + helper functions (parser, partitioner, legacy-detector) + per-class display labels (the abstract `tier_1..tier_4` use-tier codes get their human labels here).
3. **Tests** — schema constraint validators; TypeScript helper unit tests; module-level exhaustiveness checks against the L1 v2 enumeration.

L2 ships dormant. Nothing in the existing engine, transaction, special-offer, fulfilment, or UI codepaths reads from the new tables yet. F-track L4 corrigenda + L5 tooling + L6 engine + L7 UI directives wire them up incrementally.

The migration is reversible. The DOWN script drops the three new tables and restores the legacy 8-value CHECK constraint on `vault_assets.enabled_licences`.

---

## 2. Audit findings (current-state read)

| Surface | State | L2 implication |
|---|---|---|
| `vault_assets.enabled_licences text[]` | Exists; CHECK constrains to 8 legacy values per `20260413230002_vault_asset_tables.sql:73-105` | L2 expands CHECK to allow legacy + new dotted values (32 total during transition); does NOT remove legacy values (L3 backfills; L8 tightens) |
| `src/lib/types.ts:360-378` (`LicenceType`) | Flat 8-value enum | UNCHANGED in L2; stays available for dual-read until L8 cleanup |
| `pricing_*` tables (cc_variants, sublabel_multipliers, use_tier_multipliers) | Do not exist | L2 creates all three; values are NULL until L5 calibration fills them |
| `src/lib/licence/` module | Does not exist | L2 creates it (`types.ts`, `helpers.ts`, `labels.ts` + `__tests__/`) |
| `src/lib/transaction/`, `src/lib/special-offer/`, `src/lib/fulfilment/` | Import `LicenceType` from `src/lib/types.ts` | UNCHANGED in L2; continue reading legacy enum until L3 dual-read directive ships |
| `SessionDefaultsPopover.tsx`, `InspectorFieldEditor.tsx` | Hardcoded list of 8 legacy values | UNCHANGED in L2; UI rewrite is L7 scope |
| Existing pricing tables (none yet) | Phase F2 (price engine schema migration) is gated behind L4 corrigenda | L2 ships pricing tables that L5 calibration + F-track engine will fill; no dependency cycle |

**No prior calibration work or stub tables exist.** L2 is greenfield for the three new tables.

---

## 3. Hard prerequisites

| Prerequisite | Source | L2 handling |
|---|---|---|
| L1 v2 ratified | PR #31 (expected merge before L2 implementation PR opens) | L2 references the locked 24-sublabel taxonomy from v2 §4.2 + §4.3 |
| `vault_assets.enabled_licences` exists with CHECK | `20260413230002_vault_asset_tables.sql:73-105` | L2's migration `ALTER`s this CHECK |
| `users` table exists (for `calibrated_by` FKs on new tables) | Pre-existing | L2 references via `REFERENCES users(id)` |
| RLS conventions documented | `20260420000000_rls_all_tables.sql` | L2 adds RLS policies matching the service-role-only pattern |
| Migration ordering | All migrations to date through `20260428000007_ai_pipeline_settings_auto_accept_threshold.sql` shipped | L2's timestamp will be `20260428T<HHMMSS>` after current latest |

**If L1 v2 is not ratified at L2 implementation time:** L2 implementation PR cannot open. The PR description must reference the merged v2 brief commit.

---

## 4. Scope boundary

L2 **does**:
- Extend `vault_assets.enabled_licences` CHECK to accept legacy 8 + new 24 dotted values (32 total during transition)
- Create `pricing_cc_variants` table (absolute CC variant prices)
- Create `pricing_sublabel_multipliers` table (multipliers for non-CC sublabels)
- Create `pricing_use_tier_multipliers` table (multipliers per `(class, tier_1..tier_4)`)
- RLS policies (service-role-only) on all three new tables
- Partial UNIQUE indexes (one active row per key combination per table)
- Reversible DOWN migration (drops new tables; restores legacy 8-value CHECK)
- Create `src/lib/licence/` module with `types.ts`, `helpers.ts`, `labels.ts`
- Tests for the new module (helpers + label exhaustiveness)
- Tests for schema constraints (CHECK validation; partial unique index behavior; rollback round-trip)

L2 **does not**:
- Touch `src/lib/types.ts` (`LicenceType` stays during transition)
- Backfill existing assets' `enabled_licences` arrays (L3 directive)
- Update `transaction/`, `special-offer/`, `fulfilment/` to read new shape (L3 dual-read)
- Wire any engine to read from the new pricing tables (L4 F-track corrigenda + L5 tooling + L6 engine adapters)
- Update UI components (L7)
- Drop the legacy 8-value enum or its CHECK entries (L8 cleanup, post-backfill stability)
- Fill any calibration values (L5 founder offline calibration)
- Enforce CHECK constraints rejecting CC0 + other classes or CC-NC + Commercial combinations (per L1 v2 §6.2 + §6.3 — those are creator-side UI warnings, not schema CHECKs)

---

## 5. Files added / touched / not touched

### Added

```
supabase/migrations/
├── 20260428T<HHMMSS>_l2_licence_taxonomy_schema.sql           # main migration
└── _rollbacks/
    └── 20260428T<HHMMSS>_l2_licence_taxonomy_schema.DOWN.sql  # rollback

src/lib/licence/
├── types.ts                       # locked TypeScript shape per L1 v2 §4.4
├── helpers.ts                     # parser, partitioner, legacy-detector
├── labels.ts                      # display labels (class/sublabel/use-tier/cc-variant)
└── __tests__/
    ├── types.test.ts              # exhaustiveness checks
    ├── helpers.test.ts            # parser + partitioner correctness
    └── labels.test.ts             # full coverage of label maps
```

### Touched

None.

### Not touched (explicit)

```
src/lib/types.ts                                          # LicenceType stays for L3 dual-read
src/lib/transaction/{types,reducer,context,finalization}.ts  # L3 territory
src/lib/special-offer/{types,services}.ts                 # L3 territory
src/lib/fulfilment/types.ts                               # L3 territory
src/app/api/special-offer/route.ts                        # L3 territory
src/app/vault/upload/_components/SessionDefaultsPopover.tsx     # L7 territory
src/app/vault/upload/_components/inspector/InspectorFieldEditor.tsx  # L7 territory
supabase/migrations/20260413230002_vault_asset_tables.sql # only the CHECK constraint via ALTER, no other change
src/lib/pricing/                                          # F-track territory; L2 lays the schema for it but adds no code
```

---

## 6. Schema specification

### 6.1 Extend `vault_assets.enabled_licences` CHECK constraint

The existing CHECK (per `20260413230002_vault_asset_tables.sql:103-115`) restricts values to the legacy 8. L2 expands it to a UNION of legacy 8 + new 24 dotted values = 32 entries. This is additive: existing rows remain valid; new dotted entries become writable. L3 backfills legacy → new; L8 tightens to new-only.

```sql
-- File: supabase/migrations/20260428T<HHMMSS>_l2_licence_taxonomy_schema.sql

-- ════════════════════════════════════════════════════════════════
-- L2 — Licence Taxonomy Schema Migration
-- Extends vault_assets.enabled_licences CHECK + creates 3 pricing tables.
-- Reversible. RLS service-role-only on all new tables.
-- ════════════════════════════════════════════════════════════════

-- ─── Phase 1: extend vault_assets.enabled_licences CHECK ────────

ALTER TABLE vault_assets DROP CONSTRAINT vault_assets_licences_valid;

ALTER TABLE vault_assets ADD CONSTRAINT vault_assets_licences_valid CHECK (
  enabled_licences <@ ARRAY[
    -- LEGACY (allowed during L2-L7 transition; removed at L8 after backfill stable)
    'editorial', 'commercial', 'broadcast', 'print',
    'digital', 'web', 'merchandise', 'creative_commons',
    -- NEW: Editorial (6) — per L1 v2 §4.3
    'editorial.news', 'editorial.longform', 'editorial.documentary',
    'editorial.book', 'editorial.commentary', 'editorial.educational',
    -- NEW: Creative Commons (7)
    'creative_commons.cc0',
    'creative_commons.cc_by', 'creative_commons.cc_by_sa',
    'creative_commons.cc_by_nc', 'creative_commons.cc_by_nd',
    'creative_commons.cc_by_nc_sa', 'creative_commons.cc_by_nc_nd',
    -- NEW: Commercial (4)
    'commercial.brand_content', 'commercial.corporate_communications',
    'commercial.merchandise', 'commercial.internal_training',
    -- NEW: Advertising (7)
    'advertising.print_ad', 'advertising.digital_ad', 'advertising.social_ad',
    'advertising.out_of_home', 'advertising.broadcast',
    'advertising.native_advertorial', 'advertising.influencer'
  ]
);

COMMENT ON CONSTRAINT vault_assets_licences_valid ON vault_assets IS
  'L2: accepts both legacy 8 values and new 24 dotted values during transition. L3 backfills legacy → new. L8 tightens to new-only after backfill stable for ≥ 30 days.';
```

### 6.2 `pricing_cc_variants` — absolute CC variant prices

Per L1 v2.2 §5.4: CC pricing is **absolute** (CC0 = €0; CC-BY = small admin fee; CC-BY-NC = paid; etc.) — NOT base × multiplier. v1 ships **flat per variant**; the L4 corrigendum (cascade C) will confirm this or upgrade to per-`format` variation only. `intrusion_level` is forbidden from pricing entirely per L1 v2.2 §5.0; see §11 don't-do #13.

```sql
-- ─── Phase 2: create pricing_cc_variants ────────────────────────

CREATE TABLE pricing_cc_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cc_variant TEXT NOT NULL,
  currency TEXT NOT NULL,                    -- ISO 4217; v1 ships EUR only
  price_cents INTEGER NOT NULL,              -- absolute price; can be 0 (CC0)
  -- Provenance
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,                 -- NULL = current
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibrated_by UUID REFERENCES users(id),
  -- Constraints
  CONSTRAINT pricing_cc_variants_variant_valid CHECK (
    cc_variant IN (
      'cc0', 'cc_by', 'cc_by_sa', 'cc_by_nc',
      'cc_by_nd', 'cc_by_nc_sa', 'cc_by_nc_nd'
    )
  ),
  CONSTRAINT pricing_cc_variants_price_nonnegative CHECK (price_cents >= 0)
);

-- Partial unique index: only one active row per (cc_variant, currency)
CREATE UNIQUE INDEX pricing_cc_variants_unique_active
  ON pricing_cc_variants (cc_variant, currency)
  WHERE superseded_at IS NULL;

COMMENT ON TABLE pricing_cc_variants IS
  'L2: absolute CC variant prices. CC pricing is variant-driven (per L1 v2.2 §5.4); does NOT compose with pricing_format_defaults base × multiplier chain. v1 = flat per variant; v2 may add (format) dimension if L4 corrigendum confirms. intrusion_level is forbidden per L1 v2.2 §5.0 and §10 #13.';

ALTER TABLE pricing_cc_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_cc_variants_service_only ON pricing_cc_variants
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 6.3 `pricing_sublabel_multipliers` — non-CC sublabel multipliers

Per L1 v2 §5.2: 17 multipliers (Editorial 6 + Commercial 4 + Advertising 7). CC sublabels excluded (handled in `pricing_cc_variants`).

```sql
-- ─── Phase 3: create pricing_sublabel_multipliers ───────────────

CREATE TABLE pricing_sublabel_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sublabel TEXT NOT NULL,                    -- dotted "class.sublabel"
  multiplier NUMERIC(5, 3) NOT NULL,         -- e.g., 1.000, 1.200, 2.500
  -- Provenance
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibrated_by UUID REFERENCES users(id),
  -- Constraints
  CONSTRAINT pricing_sublabel_multipliers_sublabel_valid CHECK (
    sublabel IN (
      -- Editorial (6)
      'editorial.news', 'editorial.longform', 'editorial.documentary',
      'editorial.book', 'editorial.commentary', 'editorial.educational',
      -- Commercial (4)
      'commercial.brand_content', 'commercial.corporate_communications',
      'commercial.merchandise', 'commercial.internal_training',
      -- Advertising (7)
      'advertising.print_ad', 'advertising.digital_ad', 'advertising.social_ad',
      'advertising.out_of_home', 'advertising.broadcast',
      'advertising.native_advertorial', 'advertising.influencer'
    )
  ),
  CONSTRAINT pricing_sublabel_multipliers_value_positive CHECK (multiplier > 0)
);

CREATE UNIQUE INDEX pricing_sublabel_multipliers_unique_active
  ON pricing_sublabel_multipliers (sublabel)
  WHERE superseded_at IS NULL;

COMMENT ON TABLE pricing_sublabel_multipliers IS
  'L2: per-sublabel multiplier off the class base price (from pricing_format_defaults at F-track L5). Excludes CC sublabels (those are absolute in pricing_cc_variants). L5 calibration fills 17 rows.';

ALTER TABLE pricing_sublabel_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_sublabel_multipliers_service_only ON pricing_sublabel_multipliers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 6.4 `pricing_use_tier_multipliers` — per-class use-tier multipliers

Per L1 v2 §5.3 + §8 #4 founder pick: abstract codes `tier_1..tier_4`. Vocabulary translation lives in `src/lib/licence/labels.ts` (per-class). CC class excluded (CC pricing is variant-driven).

```sql
-- ─── Phase 4: create pricing_use_tier_multipliers ───────────────

CREATE TABLE pricing_use_tier_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_class TEXT NOT NULL,
  use_tier TEXT NOT NULL,                    -- abstract: tier_1, tier_2, tier_3, tier_4
  multiplier NUMERIC(5, 3) NOT NULL,
  -- Provenance
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibrated_by UUID REFERENCES users(id),
  -- Constraints
  CONSTRAINT pricing_use_tier_multipliers_class_valid CHECK (
    licence_class IN ('editorial', 'commercial', 'advertising')
    -- creative_commons EXCLUDED — CC pricing is absolute (per L1 v2 §5.4)
  ),
  CONSTRAINT pricing_use_tier_multipliers_tier_valid CHECK (
    use_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')
  ),
  CONSTRAINT pricing_use_tier_multipliers_value_positive CHECK (multiplier > 0)
);

CREATE UNIQUE INDEX pricing_use_tier_multipliers_unique_active
  ON pricing_use_tier_multipliers (licence_class, use_tier)
  WHERE superseded_at IS NULL;

COMMENT ON TABLE pricing_use_tier_multipliers IS
  'L2: per-class use_tier multipliers. Schema uses abstract codes (tier_1..tier_4); src/lib/licence/labels.ts translates per-class for UI. L5 calibration fills 12 rows (3 classes × 4 tiers).';

ALTER TABLE pricing_use_tier_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_use_tier_multipliers_service_only ON pricing_use_tier_multipliers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 6.5 DOWN migration

```sql
-- File: supabase/migrations/_rollbacks/20260428T<HHMMSS>_l2_licence_taxonomy_schema.DOWN.sql

-- Drop new tables in reverse order (no FK dependencies between them in L2 scope).
DROP TABLE IF EXISTS pricing_use_tier_multipliers;
DROP TABLE IF EXISTS pricing_sublabel_multipliers;
DROP TABLE IF EXISTS pricing_cc_variants;

-- Restore the legacy 8-value CHECK on vault_assets.enabled_licences.
ALTER TABLE vault_assets DROP CONSTRAINT vault_assets_licences_valid;

ALTER TABLE vault_assets ADD CONSTRAINT vault_assets_licences_valid CHECK (
  enabled_licences <@ ARRAY[
    'editorial', 'commercial', 'broadcast', 'print',
    'digital', 'web', 'merchandise', 'creative_commons'
  ]
);

-- IMPORTANT: if any vault_assets row contains a new dotted value at rollback time,
-- the CHECK restoration will fail. Rollback is only safe BEFORE L3 backfill writes
-- new dotted values into existing rows. After L3, rollback requires a separate
-- L3-DOWN migration to first un-backfill (revert dotted → legacy), then this
-- L2-DOWN can apply.
COMMENT ON CONSTRAINT vault_assets_licences_valid ON vault_assets IS
  'L2 ROLLED BACK: restored to legacy 8-value enum.';
```

### 6.6 RLS posture

All three new tables: service-role-only. Matches the system-pricing-table convention. No creator-side reads (UI calls server-side endpoints that read these tables via service role).

---

## 7. TypeScript module specification

### 7.1 `src/lib/licence/types.ts`

```typescript
/**
 * Frontfiles Licence Taxonomy — Locked TypeScript shape per L1 v2 §4.4
 *
 * 4 main classes; 24 sublabels (dotted "class.sublabel" string literals).
 * Schema CHECK constraints in supabase/migrations/<L2>_l2_licence_taxonomy_schema.sql
 * mirror these enumerations verbatim — keep in sync if either changes.
 */

export type LicenceClass = 'editorial' | 'creative_commons' | 'commercial' | 'advertising'

export type LicenceSublabel =
  // Editorial (6)
  | 'editorial.news' | 'editorial.longform' | 'editorial.documentary'
  | 'editorial.book' | 'editorial.commentary' | 'editorial.educational'
  // Creative Commons (7)
  | 'creative_commons.cc0'
  | 'creative_commons.cc_by' | 'creative_commons.cc_by_sa'
  | 'creative_commons.cc_by_nc' | 'creative_commons.cc_by_nd'
  | 'creative_commons.cc_by_nc_sa' | 'creative_commons.cc_by_nc_nd'
  // Commercial (4)
  | 'commercial.brand_content' | 'commercial.corporate_communications'
  | 'commercial.merchandise' | 'commercial.internal_training'
  // Advertising (7)
  | 'advertising.print_ad' | 'advertising.digital_ad' | 'advertising.social_ad'
  | 'advertising.out_of_home' | 'advertising.broadcast'
  | 'advertising.native_advertorial' | 'advertising.influencer'

export type CcVariant =
  | 'cc0' | 'cc_by' | 'cc_by_sa' | 'cc_by_nc'
  | 'cc_by_nd' | 'cc_by_nc_sa' | 'cc_by_nc_nd'

export type UseTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'

/**
 * Legacy 8-value licence enum. Kept available during L2-L7 transition for
 * dual-read in transaction/, special-offer/, fulfilment/. L8 cleanup directive
 * removes all references.
 *
 * @deprecated Use LicenceSublabel for new code. Will be removed at L8.
 */
export type LegacyLicenceValue =
  | 'editorial' | 'commercial' | 'broadcast' | 'print'
  | 'digital' | 'web' | 'merchandise' | 'creative_commons'

/**
 * Constants exported as readonly arrays for runtime iteration + tests.
 * Order is: stable (deterministic for snapshot tests).
 */
export const LICENCE_CLASSES: readonly LicenceClass[] = [
  'editorial',
  'creative_commons',
  'commercial',
  'advertising',
] as const

export const LICENCE_SUBLABELS: readonly LicenceSublabel[] = [
  'editorial.news', 'editorial.longform', 'editorial.documentary',
  'editorial.book', 'editorial.commentary', 'editorial.educational',
  'creative_commons.cc0',
  'creative_commons.cc_by', 'creative_commons.cc_by_sa',
  'creative_commons.cc_by_nc', 'creative_commons.cc_by_nd',
  'creative_commons.cc_by_nc_sa', 'creative_commons.cc_by_nc_nd',
  'commercial.brand_content', 'commercial.corporate_communications',
  'commercial.merchandise', 'commercial.internal_training',
  'advertising.print_ad', 'advertising.digital_ad', 'advertising.social_ad',
  'advertising.out_of_home', 'advertising.broadcast',
  'advertising.native_advertorial', 'advertising.influencer',
] as const

export const CC_VARIANTS: readonly CcVariant[] = [
  'cc0', 'cc_by', 'cc_by_sa', 'cc_by_nc',
  'cc_by_nd', 'cc_by_nc_sa', 'cc_by_nc_nd',
] as const

export const USE_TIERS: readonly UseTier[] = ['tier_1', 'tier_2', 'tier_3', 'tier_4'] as const

export const LEGACY_LICENCE_VALUES: readonly LegacyLicenceValue[] = [
  'editorial', 'commercial', 'broadcast', 'print',
  'digital', 'web', 'merchandise', 'creative_commons',
] as const
```

### 7.2 `src/lib/licence/helpers.ts`

```typescript
import type { LicenceClass, LicenceSublabel, CcVariant, LegacyLicenceValue } from './types'
import { LEGACY_LICENCE_VALUES } from './types'

/**
 * Parse a LicenceSublabel into its LicenceClass.
 * "editorial.news" → "editorial"; "creative_commons.cc_by_nc" → "creative_commons"
 */
export function getClass(s: LicenceSublabel): LicenceClass {
  const idx = s.indexOf('.')
  return s.slice(0, idx) as LicenceClass
}

/**
 * Parse a LicenceSublabel into its sublabel-only portion.
 * "editorial.news" → "news"; "creative_commons.cc_by_nc" → "cc_by_nc"
 */
export function getSublabelOnly(s: LicenceSublabel): string {
  const idx = s.indexOf('.')
  return s.slice(idx + 1)
}

/**
 * If the LicenceSublabel is a Creative Commons variant, return the CcVariant
 * code; otherwise null. CC variants drive absolute pricing in pricing_cc_variants.
 */
export function getCcVariant(s: LicenceSublabel): CcVariant | null {
  if (getClass(s) !== 'creative_commons') return null
  return getSublabelOnly(s) as CcVariant
}

/**
 * Type guard: is this string a legacy 8-value licence?
 * Used during L2-L7 dual-read transition.
 */
const LEGACY_SET: ReadonlySet<string> = new Set(LEGACY_LICENCE_VALUES)
export function isLegacyValue(value: string): value is LegacyLicenceValue {
  return LEGACY_SET.has(value)
}

/**
 * Type guard: is this string a new dotted LicenceSublabel?
 * (Cheap structural check; does NOT validate against the locked enumeration.
 * For full validation, use the runtime `LICENCE_SUBLABELS.includes()` check.)
 */
export function isModernSublabel(value: string): value is LicenceSublabel {
  return value.includes('.') && !isLegacyValue(value)
}

/**
 * Partition a vault_assets.enabled_licences array into legacy vs modern entries.
 * Used by L3 backfill + dual-read consumers to handle mixed states cleanly.
 */
export function partitionLicences(values: readonly string[]): {
  legacy: LegacyLicenceValue[]
  modern: LicenceSublabel[]
  unknown: string[]
} {
  const legacy: LegacyLicenceValue[] = []
  const modern: LicenceSublabel[] = []
  const unknown: string[] = []
  for (const v of values) {
    if (isLegacyValue(v)) legacy.push(v)
    else if (isModernSublabel(v)) modern.push(v as LicenceSublabel)
    else unknown.push(v)
  }
  return { legacy, modern, unknown }
}
```

### 7.3 `src/lib/licence/labels.ts`

```typescript
import type { LicenceClass, LicenceSublabel, CcVariant, UseTier } from './types'

/**
 * Display labels for the 4 main classes.
 */
export const LICENCE_CLASS_LABELS: Record<LicenceClass, string> = {
  editorial: 'Editorial',
  creative_commons: 'Creative Commons',
  commercial: 'Commercial',
  advertising: 'Advertising',
}

/**
 * Display labels for the 24 dotted sublabels.
 *
 * Per L1 v2 §6.1: CC variants are always displayed with the variant
 * (never "Creative Commons" alone). The CC labels here include the
 * canonical CC abbreviation; CC_VARIANT_LABELS below adds the full
 * plain-English summary used at checkout.
 */
export const LICENCE_SUBLABEL_LABELS: Record<LicenceSublabel, string> = {
  // Editorial
  'editorial.news': 'News',
  'editorial.longform': 'Longform',
  'editorial.documentary': 'Documentary',
  'editorial.book': 'Book',
  'editorial.commentary': 'Commentary',
  'editorial.educational': 'Educational',
  // Creative Commons (compact labels for picker UIs)
  'creative_commons.cc0': 'CC0',
  'creative_commons.cc_by': 'CC BY',
  'creative_commons.cc_by_sa': 'CC BY-SA',
  'creative_commons.cc_by_nc': 'CC BY-NC',
  'creative_commons.cc_by_nd': 'CC BY-ND',
  'creative_commons.cc_by_nc_sa': 'CC BY-NC-SA',
  'creative_commons.cc_by_nc_nd': 'CC BY-NC-ND',
  // Commercial
  'commercial.brand_content': 'Brand Content',
  'commercial.corporate_communications': 'Corporate Communications',
  'commercial.merchandise': 'Merchandise',
  'commercial.internal_training': 'Internal / Training',
  // Advertising
  'advertising.print_ad': 'Print Ad',
  'advertising.digital_ad': 'Digital Ad',
  'advertising.social_ad': 'Social Ad',
  'advertising.out_of_home': 'Out-of-Home',
  'advertising.broadcast': 'Broadcast (TV / Radio)',
  'advertising.native_advertorial': 'Native / Advertorial',
  'advertising.influencer': 'Influencer',
}

/**
 * Per L1 v2 §5.3: schema uses abstract use_tier codes (tier_1..tier_4); UI
 * translates per-class. Vocabulary differs by class:
 *
 *   editorial:   small_pub / mid_pub / major_pub / wire_syndication
 *   commercial:  small_business / mid / enterprise / fortune500
 *   advertising: local / regional / national / global
 *   creative_commons: n/a (CC pricing is variant-driven, not tier-driven)
 */
export const USE_TIER_LABELS: Record<LicenceClass, Record<UseTier, string>> = {
  editorial: {
    tier_1: 'Small Publication',
    tier_2: 'Mid-Size Publication',
    tier_3: 'Major Publication',
    tier_4: 'Wire / Syndication',
  },
  commercial: {
    tier_1: 'Small Business',
    tier_2: 'Mid-Size Business',
    tier_3: 'Enterprise',
    tier_4: 'Fortune 500',
  },
  advertising: {
    tier_1: 'Local',
    tier_2: 'Regional',
    tier_3: 'National',
    tier_4: 'Global',
  },
  creative_commons: {
    // CC pricing is variant-driven, not use_tier-driven. These exist for
    // UI consistency only (e.g., if CC is shown alongside other classes in
    // a multi-class matrix, the empty cells are labelled "—").
    tier_1: '—',
    tier_2: '—',
    tier_3: '—',
    tier_4: '—',
  },
}

/**
 * Plain-English CC variant summaries. Used at checkout per L1 v2 §6.1.
 */
export const CC_VARIANT_LABELS: Record<CcVariant, string> = {
  cc0: 'CC0 1.0 Universal (Public Domain)',
  cc_by: 'CC BY 4.0 (Attribution)',
  cc_by_sa: 'CC BY-SA 4.0 (Attribution + Share-Alike)',
  cc_by_nc: 'CC BY-NC 4.0 (Attribution + Non-Commercial)',
  cc_by_nd: 'CC BY-ND 4.0 (Attribution + No Derivatives)',
  cc_by_nc_sa: 'CC BY-NC-SA 4.0 (Attribution + Non-Commercial + Share-Alike)',
  cc_by_nc_nd: 'CC BY-NC-ND 4.0 (Attribution + Non-Commercial + No Derivatives)',
}
```

---

## 8. Tests

### 8.1 `src/lib/licence/__tests__/types.test.ts`

- `LICENCE_CLASSES` contains exactly 4 values, in stable order
- `LICENCE_SUBLABELS` contains exactly 24 values; each parses to a valid `LicenceClass`
- `CC_VARIANTS` contains exactly 7 values
- `USE_TIERS` contains exactly 4 values
- `LEGACY_LICENCE_VALUES` contains exactly 8 values (matches the legacy enum from `src/lib/types.ts`)
- TypeScript exhaustiveness: a switch on `LicenceClass` over `LICENCE_CLASSES` is exhaustive at compile time

### 8.2 `src/lib/licence/__tests__/helpers.test.ts`

- `getClass('editorial.news')` returns `'editorial'`
- `getClass('creative_commons.cc_by_nc')` returns `'creative_commons'`
- `getClass('advertising.native_advertorial')` returns `'advertising'`
- `getSublabelOnly('editorial.news')` returns `'news'`
- `getSublabelOnly('creative_commons.cc_by_nc_sa')` returns `'cc_by_nc_sa'`
- `getCcVariant('creative_commons.cc0')` returns `'cc0'`
- `getCcVariant('editorial.news')` returns `null`
- `isLegacyValue('editorial')` returns `true`
- `isLegacyValue('editorial.news')` returns `false`
- `isModernSublabel('editorial.news')` returns `true`
- `isModernSublabel('editorial')` returns `false`
- `isModernSublabel('foo.bar')` returns `true` (structural-only check; full validation is the schema CHECK + the LICENCE_SUBLABELS includes check)
- `partitionLicences(['editorial', 'editorial.news', 'unknown_value', 'commercial.merchandise'])` returns:
  - `legacy: ['editorial']`
  - `modern: ['editorial.news', 'commercial.merchandise']`
  - `unknown: ['unknown_value']`

### 8.3 `src/lib/licence/__tests__/labels.test.ts`

- `LICENCE_CLASS_LABELS` has exactly 4 keys covering all `LicenceClass` values
- `LICENCE_SUBLABEL_LABELS` has exactly 24 keys covering all `LicenceSublabel` values
- `USE_TIER_LABELS[class][tier]` defined for all 4 classes × 4 tiers (16 entries)
- `USE_TIER_LABELS.creative_commons.tier_*` returns `'—'` for all 4 tiers
- `CC_VARIANT_LABELS` has exactly 7 keys covering all `CcVariant` values

### 8.4 Schema constraint tests (e.g., in `supabase/__tests__/` matching existing convention; or co-located with new tables)

These run via `supabase db reset` + SQL fixtures and assert via direct SQL queries:

- INSERT into `vault_assets` with new dotted values (e.g., `'editorial.news'`) succeeds
- INSERT into `vault_assets` with legacy 8 values (e.g., `'editorial'`) still succeeds
- INSERT into `vault_assets` with bogus values (e.g., `'editorial.bogus'`) is rejected by CHECK
- INSERT into `pricing_cc_variants` with valid `cc_variant` succeeds
- INSERT into `pricing_cc_variants` with `cc_variant = 'invalid'` is rejected
- INSERT into `pricing_cc_variants` with `price_cents = -1` is rejected
- INSERT two `pricing_cc_variants` rows with same `(cc_variant, currency)` and both `superseded_at IS NULL` violates the partial unique index
- Same partial unique index test for `pricing_sublabel_multipliers (sublabel)` and `pricing_use_tier_multipliers (licence_class, use_tier)`
- INSERT into `pricing_use_tier_multipliers` with `licence_class = 'creative_commons'` is rejected
- INSERT into `pricing_use_tier_multipliers` with `use_tier = 'tier_5'` is rejected
- DOWN migration drops all 3 new tables (cleanup) + restores the legacy 8-value CHECK
- After DOWN, INSERT with new dotted value is rejected (legacy CHECK is back)
- UP after DOWN succeeds (idempotent re-apply)

---

## 9. Verification gates (before merge)

1. `npx tsc --noEmit` — exit 0 (no new errors; existing 12-error baseline tolerated per the pre-existing main HEAD state)
2. `npx vitest run src/lib/licence` — all green (≥ 30 cases across 3 test files)
3. `supabase db reset` from clean state applies all migrations through L2 cleanly
4. RLS = `t` on all 3 new tables (verified via `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'pricing_%'`)
5. Schema constraint tests pass (per §8.4)
6. Rollback round-trip: apply L2 → DOWN → apply L2 again, all clean
7. Existing `vault_assets_licences_valid` CHECK accepts both legacy + new values during transition (mixed-array INSERT works)
8. `bun run build` exit 0
9. No new API routes created (L2 is schema + module only; routes land at L3/L4/L6)
10. Existing test suites unaffected: 76 V3 reducer parity + transaction/special-offer/fulfilment all green (L2 doesn't change `LicenceType` so these are sanity checks, not behavioral)

---

## 10. Approval gate

Founder ratifies this directive before L2 implementation PR opens.

Approval means:
- Schema migration shape (§6) is correct
- TypeScript module shape (§7) is correct
- Tests (§8) are sufficient
- Verification gates (§9) are appropriate
- L2 scope boundary (§4) honored — no scope creep into L3/L4/L7

Founder's options:
1. **Approve** — L2 implementation PR composes against this directive
2. **Approve with corrections** — name section(s) needing change; revise; re-approve
3. **Revise** — substantive concerns; redraft
4. **Reject** — would mean L1 v2 was wrong about the schema model, not just sublabel naming

---

## 11. Don't-do list

To keep L2 implementation from drifting:

1. **Don't touch `src/lib/types.ts` `LicenceType` enum.** Stays available for dual-read. L8 cleanup removes it.
2. **Don't backfill any existing `vault_assets.enabled_licences` values in L2.** That's L3 territory. L2 only expands the CHECK to allow both shapes.
3. **Don't tighten the CHECK constraint to new-only in L2.** Tightening happens at L8 after backfill is stable for ≥ 30 days in production.
4. **Don't wire any engine, transaction, special-offer, fulfilment, or UI code to read from the new pricing tables.** L2 ships dormant. Wire-up is L4-L7 territory.
5. **Don't add CHECK constraints rejecting CC0 + other classes.** Per L1 v2 §6.2 + L9 — that's a creator-side UI warning at L7, not a schema CHECK. Schema allows; UI warns.
6. **Don't add CHECK constraints rejecting CC-NC + Commercial / CC-NC + Advertising combinations.** Per L1 v2 §6.3 — legitimate dual-licensing. Schema must allow.
7. **Don't make use_tier multipliers class-dependent at the schema level.** Per L1 v2 §5.3 + §8 #4 founder pick — abstract codes (`tier_1..tier_4`); per-class vocabulary lives in `labels.ts`, not the schema.
8. **Don't fill any calibration values in L2.** All 3 new tables ship empty. L5 founder calibration fills `pricing_cc_variants` (7 rows), `pricing_sublabel_multipliers` (17 rows), and `pricing_use_tier_multipliers` (12 rows).
9. **Don't introduce `pricing_format_defaults` or `pricing_platform_floors` in L2.** Both are F-track L4 corrigendum + F2 schema migration territory. L2 only ships the licence-specific tables (`pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers`).
10. **Don't introduce a `licence_class` column on `vault_assets`.** Per L1 v2 §10 don't-do #12 — derived from `enabled_licences` via `getClass()` helper. Storing introduces sync risk.
11. **Don't introduce a `media[]` column.** Per L1 v2 §10 don't-do #11. Medium is encoded in Advertising sublabels only.
12. **Don't introduce default values for any new column.** Provenance fields (`effective_from`, `calibrated_at`) default to `now()` only. Numeric/text columns require explicit values.
13. **Don't introduce `intrusion_level` (or any watermark-related dimension) into any pricing table.** Per L1 v2.2 §5.0 + §10 don't-do #13: watermark intensity is creator preview-protection only, not a pricing input. The licensed file delivered to the buyer is the original, unwatermarked file. `vault_assets.intrusion_level` (already shipped in `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`) stays as a watermark-system column; pricing engine and `pricing_*` tables MUST NOT reference it.

---

## 12. References

- L1 v2.2 brief: `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2.2 (taxonomy + schema lock; v2.2 §5.0 + §10 don't-do #13 drives this v1.1 cascade B amendment)
- Legacy enum: `src/lib/types.ts:360-378` (`LicenceType`)
- Existing CHECK: `supabase/migrations/20260413230002_vault_asset_tables.sql:73-105`
- RLS conventions: `supabase/migrations/20260420000000_rls_all_tables.sql`
- Sister directive (mirror structure): `src/lib/processing/E2-DIRECTIVE.md` (AI-pipeline schema; same migration + module + verification-gate format)
- Multiplier-pattern precedent: `src/lib/types.ts:381-397` (`EXCLUSIVE_MULTIPLIERS`)
- Future L3 (backfill + dual-read): `docs/licence/L3-DIRECTIVE.md` (TBD; composes after L2 ratifies)
- Future L4 (F1 + F1.5 corrigenda — cascade C per L1 v2.2): `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` v3 → v4 + `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` v2 → v3 (per L4a PR #34 precedent — corrigenda land in existing files, not a separate `F1-CORRIGENDUM-*` doc)
- Future L5 (calibration tooling resumes): `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` (revised at L4)

---

## 13. Revision history

### v1.1 — 2026-04-30 (cascade B amendment per L1 v2.2 §10 don't-do #13 + §5.4)

**Trigger:** L1 v2.2 amendment (cascade A; PR-A2) drops `intrusion_level` from any pricing-table cell key per founder discovery during Stage B 2026-04-28. Per L1 v2.2 §12 cascade impact table, cascade B = narrow L2 amendment. L2 itself does not define `pricing_format_defaults` or `pricing_platform_floors` (those are F-track L4 + F2 territory per §11 don't-do #9), so cascade B's scope is limited to the `pricing_cc_variants` forward-compat language + the don't-do list.

**Changes (doc-only; no schema impact):**

| # | Surface | Change |
|---|---|---|
| 1 | Top status block | v1 → v1.1; date 2026-04-28 → 2026-04-30 (v1.1 amendment); predecessor gates updated to reference L1 v2.2 + cascade A; governing-documents reference updated to v2.2 |
| 2 | §6.2 paragraph (line ~175) | v1 ships flat per variant; L4 corrigendum may upgrade to per-`format` only (was: "format/intrusion-varying"). Added explicit "intrusion_level forbidden per L1 v2.2 §5.0" cross-reference. |
| 3 | §6.2 `COMMENT ON TABLE pricing_cc_variants` (line ~206) | Forward-compat speculation `(format, intrusion) dimensions` → `(format) dimension` only; added "intrusion_level is forbidden per L1 v2.2 §5.0 and §10 #13" |
| 4 | §11 don't-do #9 | Tightened to forbid both `pricing_format_defaults` AND `pricing_platform_floors` from L2 (was `pricing_format_defaults` only); enumerated the 3 licence-specific tables L2 actually ships |
| 5 | §11 NEW don't-do #13 | Forbids `intrusion_level` from any pricing table; cross-refs L1 v2.2 §5.0 + §10 #13; notes already-shipped watermark migrations |
| 6 | §12 References | `L1 v2 brief` → `L1 v2.2 brief`; `Future L4: F1-CORRIGENDUM-LICENCE-TAXONOMY.md (TBD)` → actual cascade C targets (`PRICE-ENGINE-ARCHITECTURE.md` v3→v4 + `PRICE-ENGINE-CALIBRATION-V1.md` v2→v3) per L4a PR #34 precedent |
| 7 | §13 (this entry) | Revision history added |

**Sections unchanged:** §1 (purpose), §2 (audit findings), §3 (prerequisites), §4 (scope), §5 (files), §6.1 (CHECK), §6.3-§6.6 (other table specs + DOWN + RLS), §7 (TypeScript), §8 (tests), §9 (verification gates), §10 (approval gate), §11 don't-dos #1-#8, #10-#12.

**Migration impact:** none. v1 migration was unshipped at v1.1 composition; v1.1 ships the same migration as v1 with updated comments only.

### v1 — 2026-04-28 (initial composition)

Composed per L1 v2 §3 + §4.3 + §5 to lay the schema substrate for the new 4-class licence taxonomy. Three new tables (`pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers`); CHECK constraint expansion; reversible DOWN; service-role-only RLS; new `src/lib/licence/` module; tests for schema constraints + helpers + label exhaustiveness. Ships dormant — no engine code, no backfill, no UI integration.

---

End of L2 schema migration directive (v1.1, 2026-04-30; v1 2026-04-28).
