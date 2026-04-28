# Frontfiles Price Engine — Architecture Brief

**Status:** REVISED v4 2026-04-28 (post-L1-v2 corrigendum) — v3 was ratified 2026-04-26; v4 awaits founder ratification before L5 implementation composes. v4 applies L1 (Licence Taxonomy Brief) v2 + α decision changes to §4.1 + §4.3 + §4.4 + §4.5: engine returns `AssetRecommendations` (one wrapper + N per-class `Recommendation` entries), CC class uses absolute-price branch (discriminated union), `pricing_recommendations` schema gains `licence_class` column. See §13 v4 entry.
**Date:** 2026-04-26 (v3); 2026-04-28 (v4)
**Scope:** Frontfiles pricing platform — recommendation engine, integration surfaces, governance, consolidation of existing pricing logic
**Governs:** Phase F (price engine) — runs in parallel with Phases B (backend), C (UI rebuild), and E (AI suggestion pipeline) of the upload rebuild
**Supersedes:**
  - v1 (2026-04-26) — treated external benchmarks as a deferred runtime adapter; wrong for FF's internal-only-at-runtime posture
  - v2 (2026-04-26) — fixed external benchmarks framing but had a residual contradiction in §5.4 (still mentioned an "external benchmarks opt-in" toggle gated by a non-existent F6 directive); also bundled all 5 audit events in v1 when `recommendation_shown` is high-noise/low-value and belongs in v2
  - v3 (2026-04-26, ratified) — assumed single-`Recommendation`-per-asset shape; superseded by v4 after L1 v2 introduced multi-class licence taxonomy that requires `Recommendation[]` per asset
**v3 changes:** §5.4 restructured into v1/v2 control sets with no external benchmarks toggle; §7.2 audit trail split into 4 v1 events + 1 v2 event (`recommendation_shown` deferred); §8 F2.5 snapshots softened to "optional v2+" rather than firm v2 commitment; §5.4 weight tuning UI deferred to v2 (schema provisioned in v1); §11 don't-do list extended with three guards against premature code work and v1 over-exposure
**v4 changes:** §4.1 recommendPrice signature returns `AssetRecommendations` (was single `Recommendation`); §4.3 composer iterates per enabled licence_class (one Recommendation per class, plus a CC-specific branch for absolute pricing); §4.4 output shape replaced with discriminated-union `StandardRecommendation | CcRecommendation` wrapped in `AssetRecommendations`; §4.5 schema adds `licence_class TEXT NOT NULL` to `pricing_recommendations` with new UNIQUE on `(asset_id, licence_class, generated_at)`. No architectural change to authority model (§3 F2), trust posture (§7), or surfaces (§5) — only the SHAPE of the engine's output changes per L1 v2 + α decision (`Recommendation[]` per asset, with the buyer picking ONE class+sublabel+tier tuple at checkout).
**Reads underlying:** `docs/upload/UX-BRIEF.md` v3, `src/lib/offer/pricing.ts`, `src/app/vault/pricing/page.tsx`, `src/lib/types.ts`, `src/lib/special-offer/`, `vault_assets` schema

---

## 1. What this brief is

A founder-locked record of the pricing platform's architecture: what the engine produces, what feeds it, what its authority is, where it surfaces in the product, how it integrates with the existing scattered pricing logic, and the trust posture that governs every recommendation it emits.

This brief is build-governing. If a later directive proposes a structure that contradicts §3 (locked decisions) or §4 (engine architecture) or §7 (trust posture), the directive is wrong, not the brief. The trust posture in particular is non-negotiable — any drift toward authoritative claims, certified pricing, or "fair value" language requires an explicit revision pass on this brief, not a quiet override during implementation.

The engine is a **system**, not a feature. It is one of three architectural pillars of the upload + vault platform alongside the derivative pipeline (Phase B, governed by `IMPLEMENTATION-PLAN.md`) and the AI suggestion pipeline (Phase E, brief TBD). It is consumed by — but not subordinate to — the upload UI, the vault asset edit surface, the bulk re-pricing tool, and the pricing admin.

---

## 2. Current-state read

Pricing as a domain has no consolidated owner. Logic is scattered across the codebase, with no governing module and no design document.

### 2.1 What exists today

| Surface | Location | Role | Audit finding |
|---|---|---|---|
| Schema base price | `vault_assets.creator_price_cents` | Single integer per asset (nullable) | Engine output shape matches: one base price per asset |
| Licence multipliers | `LICENCE_TYPE_LABELS`, `EXCLUSIVE_TIER_LABELS`, `EXCLUSIVE_MULTIPLIERS` in `src/lib/types.ts` | Constants for per-licence and per-tier price derivation | **Pricing is base × multiplier**, not stored per-licence. Engine does not need to output a price matrix. |
| Fee decomposition | `src/lib/offer/pricing.ts` | Banker's-rounded gross → platform fee + creator net (offer transaction math) | **Not a recommendation system.** It consumes a gross price; engine is upstream of it. Keep as-is. |
| Special offer pricing | `src/lib/special-offer/services.ts` (+ types/guards) | Special offer price overrides and validation | Likely consumes the engine for default price; offer-specific overrides are separate concern. |
| Transaction execution | `src/lib/transaction/reducer.ts` | Transaction state machine | Consumes prices; not a source of pricing logic. Keep as-is. |
| Creator pricing page | `src/app/vault/pricing/page.tsx` | Static list of priced/unpriced assets with multiplier reference panel | **Currently a placeholder.** Becomes the pricing admin surface (§5.4). |
| Upload-time price input | `src/components/upload-v2/{AssetDetailPanel,CommitScreen,StoryGroupsPanel}.tsx` | Per-asset price input fields in the existing upload flow | Replaced by engine-fed advisory input in the new UI (Phase C). |

### 2.2 What does not exist

- `src/lib/pricing/` — no module
- `docs/pricing/` — no directory until this brief
- Recommendation logic of any kind — there is no code that suggests prices today; creators set them by hand
- Audit trail for pricing decisions
- Any data-driven pricing input (no comparables aggregation, no benchmark ingestion)

### 2.3 Implication for the engine

The engine is **additive**, not a replacement. It sits upstream of the existing fee/transaction math, downstream of nothing. The consolidation work in §6 is smaller than a pure rebuild because:

- `pricing.ts` (fee decomposition) stays — it consumes the engine's output, doesn't compete with it
- `transaction/`, `special-offer/` stay — they consume prices, don't generate them
- `vault/pricing/page.tsx` evolves — it becomes the pricing admin surface
- `vault_assets.creator_price_cents` stays as the canonical authoritative price; the engine writes into a separate `pricing_recommendations` table and never auto-mutates `creator_price_cents`

---

## 3. Locked decisions

| # | Decision | Locked answer | Implication |
|---|---|---|---|
| F1 | Engine scope | **Pricing platform + consolidate existing logic** | Recommendations available for any vault asset at any time. Engine is the canonical recommendation source called by upload, vault asset edit, bulk re-pricing, and pricing admin. Existing scattered logic gets a governing module to defer to. |
| F2 | Authority model | **Advisory only — creator always sets the price** | Engine recommends. Creator decides. Recommendations are surfaced inline as suggestions and never become the authoritative `creator_price_cents` without explicit creator action. Bulk-accept actions allowed; auto-apply is not. |
| F3 | Inputs / basis | **Internal-only at runtime.** Three runtime input classes: (a) creator's own pricing + sales history, (b) cross-creator anonymized comparables within Frontfiles, (c) format-based defaults grounded in editorial-tier rate cards. **External market data (Getty/AP/Reuters/fotoQuote etc.) is a calibration source only** — used offline to inform the initial format_defaults table and to sanity-check multipliers; never called by the engine at runtime. | Removes vendor cost, IP/competitive law risk, latency, and data-residency concerns from the runtime path. Engine remains internally coherent and Frontfiles-positioned, not anchored to incumbents. Calibration rationale documented in §4.2.4. |
| F4 | Surfaces | **Four surfaces**: (a) upload flow, (b) vault asset edit, (c) bulk re-pricing tool, (d) pricing admin / settings | Engine integrates with all four. Surfaces are creator-facing tools; engine is the system underneath. |
| F5 | Buyer-facing visibility | **Out of scope for v1** (founder selected option 1, not option 4 in the scope question) | Engine output is creator-facing only. Buyers see the actual `creator_price_cents` set by the creator, not the engine's recommendation. Re-evaluate after v1 trust track record. |
| F6 | Trust posture | **Precision, transparency, defensibility, governance** — not "powerful" | Every recommendation has a documented basis. Every recommendation is drillable. Every input source is named. No "fair value" or "certified" language. Audit trail for every generation and every creator decision. |

---

## 4. Engine architecture

### 4.1 Pure recommendation function (v4)

The engine's core is a pure function:

```
recommendPrice(asset, context) → AssetRecommendations
```

Where:

- `asset` is a `VaultAsset` (format, intrusion_level, declaration_state, creator_id, capture_date, geography, tags, **enabled_licences** — the SET of dotted `class.sublabel` entries per L1 v2)
- `context` includes the current timestamp, the creator's pricing settings (§4.6), the platform's current multiplier table, and any explicit basis-weight overrides
- `AssetRecommendations` is the output shape (§4.4) — a wrapper carrying ONE `Recommendation` entry per enabled licence_class on the asset (zero or more standard-class entries + zero or one CC entry, depending on what the creator enabled)

The function is deterministic given its inputs and the snapshot of input data at call time. Reproducibility is a hard requirement: given the same asset + context + input snapshot, the engine returns the same set of per-class recommendations. This is what makes the audit trail meaningful.

**Per-class iteration semantics (v4):** the engine groups enabled sublabels by class, then dispatches per-class:
- For `editorial`, `commercial`, `advertising` — runs the standard composer (§4.3) producing a `StandardRecommendation` keyed on `(format, intrusion_level, licence_class)` against `pricing_format_defaults`, with sublabel + use_tier multipliers applied.
- For `creative_commons` — does NOT run the standard composer; instead reads absolute prices from `pricing_cc_variants` for each enabled CC variant the creator has on this asset, producing a `CcRecommendation` (per L1 v2 §5.4 — CC pricing is variant-driven absolute, not adapter-composed).

If the asset has no enabled licences, the engine returns `recommendations: []` (empty array). Creator must enable at least one licence before pricing is meaningful.

### 4.2 Input adapters (three runtime adapters; external as calibration only)

Each runtime input class is implemented as an adapter behind a common interface:

```
InputAdapter {
  name: string                        // 'creator_history' | 'frontfiles_comparables' | 'format_defaults'
  enabled: boolean                    // creator-controlled, except format_defaults always-on
  weight: number                      // 0..1, set by composer (§4.3)
  recommend(asset, context) → PartialRecommendation | null
}

PartialRecommendation {
  recommendedCents: number
  confidence: number                  // 0..1
  sampleSize: number                  // number of data points the recommendation rests on
  comparables: Comparable[]           // drillable evidence
  basisStatement: string              // creator-readable, e.g. "based on 7 of your past sales of standard-tier photos in the past 12 months"
}
```

The engine has **three runtime adapters** plus a separate **calibration sources** concept (§4.2.4) that informs the format_defaults table offline but is never called at runtime.

#### 4.2.1 `creator_history` adapter
Self-referential. Queries the creator's own past sold assets, filters by similarity (format + format_family + intrusion_level + similar dimensions), aggregates median price.
- **Strengths:** safest basis ("based on YOUR past work"); no cross-creator data exposure; high creator trust
- **Weaknesses:** sparse for new creators; only useful once transaction history exists
- **Confidence formula:** scales with sample size; below N=3 historical sales, returns null (insufficient data)

#### 4.2.2 `frontfiles_comparables` adapter (v2 — see §8 staging)
Cross-creator aggregation. Queries platform-wide sold assets matching similarity criteria, anonymizes (no creator-identifying info in the breakdown), aggregates median + IQR.
- **Strengths:** richer data set; surfaces market reality once platform volume exists
- **Weaknesses:** requires anonymization rules to prevent inference attacks (small sample sizes can deanonymize); requires careful similarity criteria to avoid bad comparables; needs platform volume before it produces useful signal
- **Dual gate (both required to contribute non-trivial weight):**
  - Sample size N ≥ 10 comparables matching similarity criteria
  - IQR ≤ 50% of median (tight enough that the median is meaningful)
- **Failure mode (explicit):** if either gate fails, the adapter returns `null` — not a low-confidence noisy recommendation. The engine prefers admitting "no signal" to injecting noise. The composer either falls back to other adapters or, if everything is null, emits a `format_defaults`-only recommendation with explicit "limited platform data" basis statement.
- **Anonymization rule (open):** in addition to the N ≥ 10 gate, no individual comparable price visible in a way that, combined with public asset metadata, could be matched to a specific creator. Sold dates bucketed (month, not day). Specific anonymization parameters resolved in F1 (§9.3).
- **Staging:** deferred to v2 (post initial v1 ship). Frontfiles does not yet have the cross-creator transaction volume for this adapter to produce useful signal; building it in v1 is wasted effort until the platform has accumulated comparable sales.

#### 4.2.3 `format_defaults` adapter
The platform's codified pricing judgment, expressed as a structured table.

**Definition (precise):** A `format_defaults` row represents a reasonable starting price for a specific combination of:
- **Format** (photo, illustration, video, infographic, vector)
- **Format family** where applicable (e.g., portrait/landscape/wide for photo)
- **Intrusion level** (light/standard/heavy) — corresponds to existing `vault_assets.intrusion_level`
- **Licence class** (Social, Editorial, Campaign — matches Frontfiles' existing licence taxonomy)
- **Use tier** (small newsroom, mid-sized publication, major publication, commercial brand)
- **Exclusivity** (non-exclusive 12-month default; exclusive variants derived via `EXCLUSIVE_MULTIPLIERS`)

The reference baseline a row encodes: *"a reasonable starting price for a [format] at [intrusion level] under [licence class] usage by a [use tier] for [exclusivity period]."*

- **Strengths:** always-available; no data dependency; always-on safety floor; encodes platform pricing positioning explicitly
- **Weaknesses:** static; doesn't reflect market changes without manual table update; risk of drift if not periodically recalibrated
- **Confidence formula:** medium baseline confidence; scales up when other adapters have insufficient data (becomes the dominant contributor by default for new creators / sparse markets)
- **Calibration cadence:** initial table seeded from offline calibration sources (§4.2.4); reviewed quarterly; explicit version stamp on every recommendation traceable to which `format_defaults` table version produced it

#### 4.2.4 Calibration sources (offline, not runtime adapters)

External market data is a **calibration input**, not a runtime adapter. The engine never calls external APIs at recommendation time.

**How calibration works:**
- During initial setup of the `format_defaults` table, external sources may be consulted: editorial photography rate cards, fotoQuote and similar pricing calculators, published industry guides, Getty/AP/Reuters published rate sheets where publicly available
- These sources inform the founder's + platform's judgment on initial baseline values
- The resulting `format_defaults` rows are recorded as Frontfiles' codified judgment, not as references to external sources
- Periodic recalibration (quarterly review) may reconsult external sources to validate that the table hasn't drifted out of step with market reality
- The basis disclosed to creators on recommendations is "Frontfiles standard rate for [format] in [licence class / use tier]" — never "Getty rate" or "fotoQuote rate"

**Why this is the right model for Frontfiles:**
- No vendor cost at runtime
- No vendor reliability dependency
- No IP/competitive law exposure from sending asset metadata to external services or framing competitor pricing as authoritative benchmarks
- No data-residency concerns
- Engine remains coherent with FF's editorial positioning rather than anchored to incumbents
- Calibration is a transparent, traceable, founder-governed process

**What this is NOT:**
- Not a wrapper around external APIs
- Not a runtime fallback when other adapters return null (format_defaults itself is the fallback)
- Not a backdoor for surfacing external rates to creators or buyers

### 4.3 Composer / weighting

The composer takes the partial recommendations from enabled adapters and combines them into a per-class `StandardRecommendation` (v4 — was a single `Recommendation` in v3).

The composer runs **once per enabled non-CC licence class** on the asset. For an asset with `enabled_licences: ['editorial.news', 'commercial.brand_content']`, the composer runs twice (once for `editorial`, once for `commercial`). Creative Commons does NOT go through the composer — it uses absolute pricing per `pricing_cc_variants` (per L1 v2 §5.4 + §4.1 above).

```
composeStandard(partials, weights, licence_class) → StandardRecommendation {
  licence_class: 'editorial' | 'commercial' | 'advertising'
  base_cents: weighted average of partial.recommendedCents (against pricing_format_defaults
    cell for (format, intrusion_level, licence_class))
  confidence: aggregate confidence (lowest of contributing adapters, weighted)
  basis_breakdown: [
    { adapter: 'creator_history', weight: 0.5, contribution_cents, sample_size, basis_statement }
    { adapter: 'frontfiles_comparables', weight: 0.3, contribution_cents, sample_size, basis_statement }
    { adapter: 'format_defaults', weight: 0.2, contribution_cents, basis_statement }
  ]
  // Per L1 v2 γ: full N×4 tier matrix surfaced at upload
  tier_matrix: [
    { use_tier: 'tier_1', recommended_cents: base × use_tier_multiplier(class, 'tier_1') × default_sublabel_multiplier }
    { use_tier: 'tier_2', recommended_cents: base × 1.0 × default_sublabel_multiplier }   // anchor
    { use_tier: 'tier_3', recommended_cents: base × use_tier_multiplier(class, 'tier_3') × default_sublabel_multiplier }
    { use_tier: 'tier_4', recommended_cents: base × use_tier_multiplier(class, 'tier_4') × default_sublabel_multiplier }
  ]
  // Per-sublabel breakdown (one row per enabled sublabel in this class on the asset)
  sublabel_prices: [
    { sublabel: 'editorial.news', multiplier: 1.000, base_at_anchor_tier: base × 1.000 }
    ...
  ]
  basis_summary: human-readable composite, e.g. "Editorial: recommended €240 base (mid_pub anchor tier). Based primarily on your past sales of similar photos (7 sales, median €230), supported by standard rate for editorial-class photos at standard intrusion. Tier matrix: small_pub €120 / mid_pub €240 / major_pub €480 / wire €720."
}
```

For Creative Commons, no composition is done — the CC branch directly reads from `pricing_cc_variants`:

```
buildCc(asset_enabled_cc_sublabels, currency) → CcRecommendation {
  licence_class: 'creative_commons'
  cc_variants: [
    { cc_variant: 'cc_by', price_cents: <absolute from pricing_cc_variants> }
    { cc_variant: 'cc_by_nc', price_cents: <absolute from pricing_cc_variants> }
    ... (one entry per enabled CC variant on this asset)
  ]
  basis_summary: e.g. "Creative Commons absolute prices: CC0 free, CC-BY €5, CC-BY-NC €40."
  model_version: <version string>
}
```

Default weights (v1):
- `creator_history`: 0.6 if sufficient sample (N ≥ 3); 0 if insufficient
- `format_defaults`: 0.4 baseline; scales up to fill missing weight when other adapters return null

Default weights (v2, after `frontfiles_comparables` ships):
- `creator_history`: 0.5 if sufficient sample; 0 if insufficient
- `frontfiles_comparables`: 0.3 if dual gate satisfied (N ≥ 10 AND IQR ≤ 50% of median); 0 otherwise
- `format_defaults`: 0.2 baseline; scales up to fill missing weight from disabled or insufficient adapters

If the creator has set custom weights via pricing admin (§5.4), those override the defaults. If all data-driven adapters return null (new creator, no comparables match), the composer falls back to `format_defaults` only and emits a recommendation with explicit "limited data — Frontfiles standard rate" basis statement. The recommendation is still emitted; absence of data does not silently fail.

### 4.4 Output shape (v4 — discriminated union per licence class, wrapped in `AssetRecommendations`)

The engine returns ONE `AssetRecommendations` wrapper per call, carrying ZERO OR MORE `Recommendation` entries — one per enabled licence_class on the asset. Per L1 v2 §5.6 (α decision), this replaces v3's single-`Recommendation`-per-asset shape.

```typescript
type AssetRecommendations = {
  asset_id: string
  generated_at: ISODateTime
  currency: string                    // matches creator's preferred currency
  recommendations: Recommendation[]   // one per enabled licence_class on the asset
  model_version: string               // engine version + adapter versions (shared across all per-class recommendations)
  input_snapshot_id: UUID | null      // FK to pricing_inputs table for reproducibility (v2+; null in v1)
}

// Discriminated union: one shape for editorial/commercial/advertising,
// a separate shape for creative_commons (per L1 v2 §5.4 — absolute pricing).
type Recommendation = StandardRecommendation | CcRecommendation

type StandardRecommendation = {
  type: 'standard'
  licence_class: 'editorial' | 'commercial' | 'advertising'
  base_cents: number                  // baseline from pricing_format_defaults at the (format, intrusion, class) cell
  confidence: number                  // 0..1
  basis_summary: string               // creator-readable composite (1-2 sentences)
  basis_breakdown: BasisContribution[]
  // Per L1 v2 γ — full tier matrix shown at upload
  tier_matrix: TierMatrixEntry[]      // 4 entries: tier_1..tier_4
  // Per-sublabel breakdown (one entry per enabled sublabel on this asset within this class)
  sublabel_prices: SublabelPrice[]
  comparables: Comparable[]           // drillable evidence (anonymized for cross-creator; v2+)
}

type CcRecommendation = {
  type: 'cc'
  licence_class: 'creative_commons'
  // Absolute prices per CC variant the creator has enabled on this asset
  cc_variants: CcVariantPrice[]       // one entry per enabled creative_commons.* sublabel
  basis_summary: string               // e.g., "Creative Commons absolute prices per variant"
  // No basis_breakdown / tier_matrix / sublabel_prices for CC — CC pricing
  // is variant-driven absolute, not adapter-composed.
}

type BasisContribution = {
  adapter: 'creator_history' | 'frontfiles_comparables' | 'format_defaults'
  weight: number                      // 0..1, applied weight
  contribution_cents: number          // this adapter's contribution to base_cents
  confidence: number                  // this adapter's confidence
  sample_size: number
  basis_statement: string
}

type TierMatrixEntry = {
  use_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'
  recommended_cents: number           // base_cents × use_tier_multiplier(class, tier) × default_sublabel_multiplier
}

type SublabelPrice = {
  sublabel: string                    // dotted 'class.sublabel' per L1 v2 §4.2 (excluding CC)
  multiplier: number                  // from pricing_sublabel_multipliers
  base_at_anchor_tier: number         // base_cents × multiplier (at tier_2 anchor)
}

type CcVariantPrice = {
  cc_variant: 'cc0' | 'cc_by' | 'cc_by_sa' | 'cc_by_nc' | 'cc_by_nd' | 'cc_by_nc_sa' | 'cc_by_nc_nd'
  sublabel: string                    // 'creative_commons.cc0' etc. — full dotted form for round-trip with enabled_licences
  price_cents: number                 // absolute from pricing_cc_variants
}

type Comparable = {
  comparable_id: UUID                 // not the underlying asset id (anonymization)
  format: string
  intrusion_level: string
  licence_class: string               // v4: included for cohort matching
  sold_price_cents: number
  sold_at: ISODate                    // bucketed for anonymization (e.g., month, not day)
  context: 'creator_own' | 'frontfiles_anon' | 'format_default'  // 'frontfiles_anon' only appears in v2+
}
```

**Cart / offer / transaction state** carries the SINGLE (class, sublabel, use_tier) tuple the buyer picks at checkout, NOT the whole `AssetRecommendations` array. The array is the engine's output to the creator-facing UI for display + bulk-accept; the buyer-facing transaction picks one path through it.

**Audit trail** (per §7.2): one `recommendation_generated` event per `AssetRecommendations` call (records `recommendation_id` referring to the parent row in `pricing_recommendations` per §4.5). Per-class generation is implied by the row's `licence_class` column. Creator accept/override/dismiss events reference a specific (asset_id, licence_class) tuple via the recommendation_id FK.

### 4.5 Schema additions

New tables in Phase F migrations. v1 ships three tables; v2 adds the snapshot table.

**v1 tables (Phase F2):**

```sql
-- v4: schema gains licence_class (one row per asset per licence_class per generation).
-- Each AssetRecommendations call inserts N rows, one per enabled licence_class.
-- For Creative Commons rows, base_cents is NULL and cc_variants JSONB carries the
-- absolute prices (per L1 v2 §5.4 + §4.4 above).

CREATE TABLE pricing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES vault_assets(id) ON DELETE CASCADE,
  licence_class TEXT NOT NULL,                -- v4: 'editorial' | 'commercial' | 'advertising' | 'creative_commons'
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Standard-class fields (NULL when licence_class = 'creative_commons')
  base_cents INTEGER,                         -- v4: was 'recommended_cents' single column; now base; NULL for CC
  tier_matrix JSONB,                          -- v4: TierMatrixEntry[] for standard; NULL for CC
  sublabel_prices JSONB,                      -- v4: SublabelPrice[] for standard; NULL for CC
  basis_breakdown JSONB,                      -- BasisContribution[] for standard; NULL for CC
  -- CC-class fields (NULL for standard)
  cc_variants JSONB,                          -- v4: CcVariantPrice[] for CC; NULL for standard
  -- Common fields
  currency TEXT NOT NULL,
  confidence NUMERIC(3,2),                    -- 0.00 to 1.00 for standard; NULL for CC (CC is absolute, no confidence)
  basis_summary TEXT NOT NULL,
  comparables JSONB NOT NULL,                 -- Comparable[] (anonymized; empty in v1)
  model_version TEXT NOT NULL,
  format_defaults_version INTEGER,            -- v4: NULL for CC (CC doesn't read format_defaults); INTEGER for standard
  input_snapshot_id UUID,                     -- nullable in v1; FK added in v2 when pricing_inputs ships
  superseded_at TIMESTAMPTZ,                  -- set when a newer recommendation is generated
  CONSTRAINT pricing_recommendations_class_valid CHECK (
    licence_class IN ('editorial', 'commercial', 'advertising', 'creative_commons')
  ),
  -- Discriminated-union enforcement: standard rows have base_cents + tier_matrix; CC rows have cc_variants
  CONSTRAINT pricing_recommendations_shape CHECK (
    (licence_class != 'creative_commons' AND base_cents IS NOT NULL AND tier_matrix IS NOT NULL AND cc_variants IS NULL) OR
    (licence_class = 'creative_commons' AND base_cents IS NULL AND tier_matrix IS NULL AND cc_variants IS NOT NULL)
  )
);

CREATE INDEX pricing_recommendations_asset_class_generated
  ON pricing_recommendations(asset_id, licence_class, generated_at DESC);

CREATE UNIQUE INDEX pricing_recommendations_active
  ON pricing_recommendations(asset_id, licence_class) WHERE superseded_at IS NULL;

CREATE TABLE pricing_admin_settings (
  creator_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weights JSONB,                              -- creator-overridden weights per adapter; null = defaults
  creator_floors JSONB,                       -- per-format creator-set minimum recommendation cents
  enabled_adapters TEXT[],                    -- subset of adapter names; null = all defaults
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pricing_audit_log (
  -- v1 ships 4 of 5 event types. 'recommendation_shown' is deferred to v2
  -- (highest-volume event with weakest analytical value vs the others).
  -- 'recommendation_generated' IS kept in v1 — without it, you cannot compute
  -- acceptance rate per generation, which is the primary engine quality metric.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  asset_id UUID NOT NULL REFERENCES vault_assets(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,                   -- v1: 'recommendation_generated' | 'recommendation_accepted' | 'recommendation_overridden' | 'recommendation_dismissed'
                                              -- v2: + 'recommendation_shown' (view-tracking, deferred)
  recommendation_id UUID REFERENCES pricing_recommendations(id),
  before_cents INTEGER,                       -- previous price (null on first set)
  after_cents INTEGER,                        -- new price (or null on dismiss)
  override_reason TEXT,                       -- nullable; surfaced for analytics
  surface TEXT NOT NULL                       -- 'upload' | 'vault_edit' | 'bulk_reprice' | 'admin'
);

CREATE INDEX pricing_audit_log_asset_creator_time
  ON pricing_audit_log(asset_id, creator_id, event_at DESC);

-- Platform-controlled (not creator-editable) — admin migration, not a UI setting
CREATE TABLE pricing_platform_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  intrusion_level TEXT NOT NULL,
  licence_class TEXT NOT NULL,
  min_cents INTEGER NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ
);
```

**v2 table (Phase F directive TBD, post v1 ship):**

```sql
CREATE TABLE pricing_inputs (
  -- Snapshot of the input data used for a recommendation, for full reproducibility.
  -- Deferred to v2 because the storage cost only pays off once recommendations
  -- need to be replayed (e.g., to diagnose a creator complaint or to validate
  -- engine behavior across a model version bump). v1 recommendations carry
  -- enough metadata (basis_summary, basis_breakdown, format_defaults_version,
  -- model_version) to be inspectable; full replay requires v2.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  creator_history_snapshot JSONB,
  comparables_snapshot JSONB,                 -- only populated when frontfiles_comparables ships
  expires_at TIMESTAMPTZ                      -- snapshots can be GC'd after 90 days
);

ALTER TABLE pricing_recommendations
  ADD CONSTRAINT pricing_recommendations_input_snapshot_fk
  FOREIGN KEY (input_snapshot_id) REFERENCES pricing_inputs(id);
```

### 4.5.1 Floors model (two-tier)

| Tier | Source | Authority | Surface |
|---|---|---|---|
| **Platform floor** | `pricing_platform_floors` table; admin-managed | Engine **never** recommends below this; if other adapters would, recommendation is clamped up | Not directly visible to creators; surfaces as "Frontfiles platform minimum" attribution if a recommendation was clamped |
| **Creator floor** | `pricing_admin_settings.creator_floors`; creator-managed via pricing admin (§5.4) | Engine **never** recommends below this for that creator; if engine would, recommendation is clamped up to the creator floor | Visible to the creator in pricing admin |

If a recommendation is clamped by either floor, the basis statement makes it explicit ("clamped to platform minimum" / "clamped to your floor"). Floor-clamping is logged in `pricing_audit_log`.

Platform floors protect FF's market positioning. Creator floors protect the creator from the engine recommending below their personal pricing posture.

### 4.5.2 Engine never mutates `creator_price_cents`

`vault_assets.creator_price_cents` is **not modified by the engine**. It is the authoritative price set by the creator. The engine writes only to `pricing_recommendations` and `pricing_audit_log`. This is the architectural enforcement of advisory-only authority.

### 4.6 Per-licence price model

Pricing is currently `base price × constant multiplier per licence type / exclusive tier` (audit finding from §2.1; constants in `src/lib/types.ts`). The engine recommends a single base price; the existing multiplier model handles per-licence and per-tier derivation.

The engine does NOT need to output a price matrix. The engine does NOT need to know about licence types directly — the recommendation is the base price, and downstream consumers (offer flow, transaction execution) apply the multipliers as they do today.

**Open decision §9.4:** whether to allow per-licence price overrides on the asset (vs strict multiplier model). If the founder wants per-licence overrides, schema needs to change separately — out of scope for Phase F unless the founder revises this brief.

---

## 5. Surfaces

### 5.1 Upload flow integration (replaces UX brief §4.4)

The price suggestion field in the new upload UI (`UX-BRIEF.md` §4.4) becomes engine-fed:

- During asset analysis, the AI suggestion pipeline (Phase E) calls the engine for each asset
- Engine returns a `Recommendation`
- The UI renders the `recommendedCents` as ghost-text in the price input, with a tooltip/affordance showing `basisSummary`
- A "Why this price?" link expands the `basisBreakdown` and `comparables` for transparency
- One-click accept fills the price field; confirms via creator action (no bulk-accept for prices per UX brief §9.8)
- Editing the field transitions it to creator-authored
- Dismissing the suggestion (without accepting) is logged in `pricing_audit_log` as `recommendation_dismissed`

The UI never auto-applies the engine's recommendation — the creator always sets the price.

### 5.2 Vault asset edit

Existing vault asset edit screens get a recommended-price affordance:

- "Recommended: €X (based on Y comparables in the past Z months)" inline with the price field
- Click expands the basis breakdown
- One-click accept replaces the current price (with confirmation if delta > N%)
- Edit triggers a re-recommendation request (engine recomputes with current data)
- Stale recommendations (>30 days old, or based on input snapshot >90 days old) auto-refresh on view

### 5.3 Bulk re-pricing tool

New surface in the vault. Workflow:

- Creator selects scope (all priced assets, by format, by date range, by tag)
- Engine runs across the selection; produces a recommendation per asset
- UI displays a sortable list: current price | recommended price | delta | confidence | basis summary
- Per-asset actions: accept / edit / dismiss
- Bulk actions: accept all where delta < N%; accept all above confidence threshold; dismiss all
- Audit log records every accept/edit/dismiss with surface='bulk_reprice'

This is the surface that makes archive uploads tractable — the creator can run the engine across their archive, accept high-confidence recommendations, and review only the borderline cases.

### 5.4 Pricing admin / settings

`src/app/vault/pricing/page.tsx` evolves into the pricing admin surface. Surface scope is staged with the engine (v1 ships less than v2):

**v1 controls (creator-facing):**
- **Adapter on/off:** enable or disable `creator_history` (format_defaults is always on; floor-clamping enforces platform minimums regardless)
- **Creator floors:** per-format minimum recommendation cents — engine never recommends below this for the creator
- **Recommendations off (global):** opt the creator out of seeing any recommendations across all surfaces. Engine still runs (so post-opt-out re-enable is instant); UI hides the proposals.
- **Recommendation history:** simple list of past recommendations and the creator's accept/override/dismiss decisions
- **Engine version display:** which engine + adapter versions are in use

**v2 additions (deferred):**
- **Adapter weight tuning:** custom weights overriding the composer defaults. Schema (`weights JSONB` in `pricing_admin_settings`) is provisioned in v1 so the storage exists; the editing UI is hidden until v2 to avoid premature support surface for an advanced control few creators need early.

**Not in this surface:**
- No external benchmarks toggle. Per §4.2.4, external sources are calibration-only and never exposed at runtime; there is no per-creator setting for them.
- No buyer-facing controls (per F5: buyer visibility is out of scope for v1).

This is where the creator establishes their pricing posture. The engine respects these settings on every subsequent recommendation.

---

## 6. Consolidation strategy

The engine is additive. Existing scattered logic mostly stays intact and consumes the engine as a new input source.

| Existing surface | Action | Rationale |
|---|---|---|
| `src/lib/offer/pricing.ts` (fee decomposition) | **Keep as-is** | Transaction-side math, downstream of pricing decision. Consumes whatever gross price the creator set (engine-recommended or hand-set). |
| `src/lib/special-offer/services.ts` | **Keep; consume engine** | Special offer flows can call engine for default price; offer-specific overrides remain. |
| `src/lib/transaction/reducer.ts` | **Keep as-is** | Transaction execution; not a source of pricing logic. |
| `src/app/vault/pricing/page.tsx` | **Replace / evolve into pricing admin** (§5.4) | Currently a static list with multiplier reference panel. Becomes the configurable pricing surface. |
| Upload-time price input components in `src/components/upload-v2/*` | **Replaced in Phase C UI rebuild** | New upload UI in Phase C uses engine-fed advisory price input per §5.1. |
| `src/lib/types.ts` (`LICENCE_TYPE_LABELS`, `EXCLUSIVE_TIER_LABELS`, `EXCLUSIVE_MULTIPLIERS`) | **Keep as-is** | Multiplier model is preserved; engine output is base price. |
| `vault_assets.creator_price_cents` schema | **Keep as canonical price** | Engine never mutates this column. Creator-authored only. |

**New module:** `src/lib/pricing/`

```
src/lib/pricing/
  engine.ts                           # recommendPrice() entry point + composer
  adapters/
    creator-history.ts                # v1
    format-defaults.ts                # v1
    frontfiles-comparables.ts         # v2 (deferred)
  schema.ts                           # input/output types
  audit.ts                            # pricing_audit_log helpers
  settings.ts                         # pricing_admin_settings access
  floors.ts                           # platform + creator floor enforcement
  format-defaults-table.ts            # the codified table; calibration-source-derived
  __tests__/
    engine.test.ts
    adapters.test.ts
    composer.test.ts
    floors.test.ts
```

There is no `external-benchmarks.ts`. External market data is offline calibration only, expressed in `format-defaults-table.ts` as the source of the codified judgment — not as runtime adapter code.

---

## 7. Trust + governance

The engine's load-bearing property is trust, not power. The trust posture is non-negotiable.

### 7.1 Basis language (terminology rules)

Every recommendation surfaces a basis statement to the creator. Language must be precise and avoid overclaiming. Per founder standing posture:

| Allowed | Forbidden |
|---|---|
| "Recommended €X based on…" | "Fair value €X" / "Certified price" |
| "Based on N similar assets sold on Frontfiles" | "Validated by Frontfiles" |
| "Comparable to market rate of €Y" | "Verified market price" |
| "Estimated from your past sales" | "Authoritative price recommendation" |
| "Median of N comparables" | "True value" |
| "Suggested price" | "Correct price" |

The engine is a recommender, not an authority. Its output is advisory. The creator's choice is authoritative.

### 7.2 Audit trail

Recommendation events are logged in `pricing_audit_log`. v1 ships four event types; the fifth (`recommendation_shown`) is deferred to v2 because it is the highest-volume event with the weakest analytical value (every render fires it; it does not contribute to acceptance-rate or override-distribution metrics that the other four cover).

**v1 events:**
- `recommendation_generated` — engine ran for an asset (kept in v1: load-bearing for acceptance-rate analytics; cost is trivial since it's bounded by ingest volume, ~one row per asset)
- `recommendation_accepted` — creator accepted the recommendation (price set to recommendedCents)
- `recommendation_overridden` — creator set a price different from the recommendation
- `recommendation_dismissed` — creator viewed and explicitly dismissed without accepting

**v2 event (deferred):**
- `recommendation_shown` — creator viewed the recommendation in a UI surface (added when v2 admin surface ships per §8 F7.5)

Every event records: asset, creator, surface, before/after cents, recommendation ID, optional override reason. This is the data foundation for engine quality measurement and any future auditability requirement.

### 7.3 No silent changes

- The engine does not modify `creator_price_cents` ever
- Recommendations are immutable once generated; new recommendations supersede old ones (`superseded_at`)
- Adapter version + model version are stamped on every recommendation
- Input snapshots are preserved for 90 days for full reproducibility
- Engine version bumps require a new model_version string; old recommendations remain attributable to the version that produced them

### 7.4 Per-creator opt-in / opt-out

- Engine runs by default for all assets at ingestion (Phase E AI suggestion pipeline)
- Creators can opt out per asset (dismiss recommendation), per format (admin floor of "do not recommend"), or globally (settings toggle in §5.4 v1)
- A creator who has opted out still gets a `vault_assets.creator_price_cents` that they set by hand; the engine simply does not surface recommendations to them
- Engine continues to generate recommendations server-side even when a creator has opted out of the UI surfacing — this keeps re-enable instant and preserves data for analytics
- (No per-creator external benchmarks opt-in exists. Per §4.2.4 external data is calibration-only, never runtime; nothing to opt into.)

### 7.5 Anonymization (cross-creator comparables — v2 only)

When the `frontfiles_comparables` adapter ships in v2 and surfaces comparables to a creator, those comparables are anonymized via a dual gate plus presentation rules:

**Dual gate (must both be satisfied):**
- Sample size N ≥ 10 comparables matching similarity criteria
- IQR ≤ 50% of median (tight enough that the median is meaningful)

If either gate fails, the adapter returns `null` — not a low-confidence aggregate, not a partial reveal. The engine prefers admitting "no signal" to leaking partial information from small samples.

**Presentation rules:**
- No creator identifier visible
- Sold dates bucketed at month granularity (not day)
- Aggregate-only display in basis statements (median, IQR — never individual prices)
- No comparable's price visible in a way that, combined with public asset metadata, could be matched back to a specific creator
- Specific anonymization parameters (date bucketing, minimum spread, drill-down rules) resolved in F1 v2-extension before F5 composes

---

## 8. Phase F sequencing

Phase F is staged into **v1 (ship)** and **v2 (growth)**. v1 is the load-bearing minimum that gives FF a working, trustworthy, well-governed engine without over-building for platform volume that doesn't exist yet. v2 adds the data-driven adapter, the bulk surface, and the snapshot infrastructure once v1 is in production and there's signal to drive them.

```
Phase F — Price Engine v1 (parallel-able with Phases B, C, E)

  F1  Architecture brief — engine internals, schema, basis disclosure rules,
      calibration source documentation, format_defaults initial table content
       • Output: docs/pricing/PRICE-ENGINE-ARCHITECTURE.md (extends this brief)
       • Founder ratifies before F2 starts
       • Resolves open decisions §9.1–§9.4

  F2  Schema migration + recommendation service skeleton
       • Tables: pricing_recommendations, pricing_admin_settings, pricing_audit_log,
         pricing_platform_floors  (NOT pricing_inputs — deferred to v2)
       • Module: src/lib/pricing/{engine.ts, schema.ts, audit.ts, settings.ts, floors.ts}
       • Composer with stub adapters (all returning null)
       • Full audit logging from day one (all 5 event types)
       • Tests: composer logic, audit logging, schema constraints, floor-clamping

  F3  Adapter — format_defaults (always-on baseline)
       • Codified table seeded from offline calibration (§4.2.4)
       • Schema: format × format_family × intrusion_level × licence_class × use_tier × exclusivity
       • Tests: adapter returns expected values for each combination
       • Integration test: composer produces format-default-only recommendation;
         platform floor clamps when format_defaults would recommend below

  F4  Adapter — creator_history (self-referential)
       • Query historical sales for creator + similarity criteria
       • Confidence scaling by sample size; null below N=3
       • Tests: insufficient data fallback; confidence scaling; similarity filter

  F7  Pricing admin / settings UI (replaces vault/pricing/page.tsx)
       • Adapter controls (enable/disable creator_history, format_defaults baseline weight)
       • Creator floors per format
       • Recommendation history view (basic list)
       • Tests: settings persist; engine respects settings on next call

  F8  Vault asset edit integration
       • Recommended-price affordance on existing vault edit screens
       • Re-recommendation on edit; staleness refresh
       • Tests: surface logging; recommendation freshness

  F10 Upload flow integration (replaces UX brief §4.4 placeholder)
       • Engine called from AI suggestion pipeline (Phase E)
       • Advisory ghost-text in upload UI price field
       • One-click accept; basis breakdown drillable
       • Tests: end-to-end with mock engine; UI states

  F11 Consolidation passes (refactor surfaces to use engine)
       • Special offer flows: pull default price from engine
       • Any remaining hand-rolled price logic: route through engine
       • Tests: regression on existing offer/transaction flows

  v1 EXIT: 8 directives. Engine producing recommendations from creator_history +
           format_defaults; integrated in upload + vault edit + admin; full audit
           trail; consolidated with offer flow. No comparables, no bulk re-pricing,
           no input snapshots. Deployable.

Phase F — Price Engine v2 (after v1 ships and platform volume justifies)

  F5  Adapter — frontfiles_comparables (cross-creator anonymized)
       • Anonymization rules implementation
       • Dual gate: N ≥ 10 AND IQR ≤ 50% of median; null on fail (no noise)
       • Tests: anonymization (no leakage); dual gate enforcement; null-on-fail

  F7.5 Pricing admin v2 surface additions
       • Adapter weight tuning UI (schema already provisioned in v1)
       • Comparables-specific controls (drill-down rules; date bucketing display)
       • recommendation_shown event tracking added to audit log
       • Tests: weight overrides respected by composer; v2 events log correctly

  F9  Bulk re-pricing tool (new vault surface)
       • Selection by scope; per-asset and bulk actions
       • Sortable list with current vs recommended
       • Tests: bulk-accept correctness; audit logging at scale

  F2.5 pricing_inputs snapshot table + retroactive snapshot capture (OPTIONAL — only build if needed)
       • Reproducibility need has not been demonstrated as of v1 ship
       • Acceptance/override patterns + basis_summary + basis_breakdown +
         format_defaults_version + model_version on each recommendation row are
         likely sufficient for diagnosing creator complaints and engine
         quality questions
       • Build only if a concrete reproducibility scenario emerges that the
         existing recommendation row metadata cannot answer
       • If built: new table per §4.5 v2; snapshot capture in composer;
         nullable input_snapshot_id on existing rows; 90-day GC

  v2 EXIT: comparables adapter shipped; bulk re-pricing tool live; admin v2
           controls available; snapshots built only on demonstrated need.
```

Estimated **v1: 8 directives** (F1 ratification gate + F2 + F3 + F4 + F7 + F8 + F10 + F11). F1 is its own ratification gate before F2 starts.

**v2: 3 additional directives** (F5 + F2.5 + F9), composed after v1 is in production and has accumulated enough cross-creator volume to make `frontfiles_comparables` produce useful signal (likely 3–6 months post-v1 ship).

Calendar shape for v1: F1 → F2 → (F3 + F4 in series for engine; F7 + F8 + F10 starting after F2 in parallel for surfaces; F11 last). Realistic estimate: 3–5 weeks for v1 at recent pace.

Phase F runs in parallel with Phases B, C, E — it touches a disjoint surface (new `src/lib/pricing/` module, new schema migrations, new tables). The integration points (Phase C upload UI calling engine, Phase E AI pipeline calling engine) are the synchronization moments.

**External benchmarks adapter is removed entirely** — see §4.2.4 for the calibration-source-only model that replaces it. There is no F6 anymore.

---

## 9. Open decisions still pending

These do not block F1 (the architecture brief) but must be resolved before the relevant directive composes:

1. **Format defaults table content + calibration sources** — the actual numbers per format × format_family × intrusion_level × licence_class × use_tier × exclusivity. Initial table seeded from offline calibration sources (§4.2.4) — which sources? what's the reasoning behind each baseline? Resolved in F1; gates F3. This is the single highest-leverage F1 decision since the engine's behavior in v1 is dominated by format_defaults.
2. **Platform floors initial table** — minimum prices below which the engine never recommends. Per format × intrusion_level × licence_class. Founder-set; protects FF's market positioning. Resolved in F1; gates F2.
3. **Anonymization parameters for comparables (v2)** — beyond the N ≥ 10 + IQR ≤ 50% dual gate, what additional rules? Date bucketing granularity (week vs month)? Whether comparables can be drilled into per-asset or only as aggregate? Resolved in F1 v2-extension when F5 is being composed.
4. **Per-licence price overrides** — is the strict multiplier model sufficient, or does the engine need to support per-licence-tier price recommendations / overrides on the asset? Affects schema. Resolved in F1.
5. **Currency handling** — does the engine recommend in the creator's preferred currency or in a canonical currency? Per-creator preference vs platform default. Resolved in F1.
6. **Recommendation refresh cadence** — how often should the engine re-run for an existing asset? On view? On schedule (nightly)? On event (new sale by this creator)? Affects compute cost and recommendation freshness. Resolved in F2.
7. **Pricing analytics** — what reports does the platform need on engine performance (acceptance rate, override delta distribution, basis-class wins, floor-clamp frequency)? Drives schema additions to `pricing_audit_log`. Resolved in F2.
8. **Engine quality measurement** — how do we know when the engine's recommendations are good or bad? What's the feedback loop (creator override patterns? sale conversion? both?). Resolved post-F10 once data accumulates.
9. **format_defaults recalibration cadence** — quarterly review proposed in §4.2.3. Who reviews? What's the trigger for an out-of-cycle update (significant market move, founder judgment)? Resolved in F1.

---

## 10. Approval gate

Before any Phase F directive composes (including F1), the founder ratifies this brief.

Ratification means: the six locked decisions in §3 stand, the engine architecture in §4 is the target, the trust posture in §7 is the boundary condition, the sequencing in §8 is the order. If any of those is wrong, this brief gets revised before F1 starts.

F1 itself is a separate ratification gate — F1 produces the detailed architecture brief that resolves §9.1-§9.5, and the founder ratifies F1's output before F2 (schema migration) starts. Two gates, not one, because the open decisions in §9 are substantive enough to warrant their own ratification.

---

## 11. Don't-do list

To keep subsequent sessions from drifting:

1. **Don't auto-apply recommendations to `creator_price_cents`.** Engine is advisory only. The column is creator-authoritative. Any directive that proposes engine writes to `creator_price_cents` is wrong.
2. **Don't use authoritative or certifying language.** Per §7.1, language is "recommended", "estimated", "comparable to" — never "fair", "certified", "validated", "true value". Any UI copy that drifts toward authority gets rejected.
3. **Don't skip the audit log on any recommendation event.** Every generation, view, accept, override, dismiss is logged from v1. Trust infrastructure is not deferrable. The audit trail is what makes the engine trustworthy.
4. **Don't add a runtime external benchmarks adapter.** External market data (Getty/AP/Reuters/fotoQuote) is a calibration source only — used offline to inform the format_defaults table. The engine never calls external APIs at runtime. Any directive proposing a runtime external adapter is wrong; revisit only if §3 F3 is explicitly revised.
5. **Don't ship `frontfiles_comparables` in v1.** Frontfiles does not yet have the cross-creator transaction volume to make this adapter produce useful signal. Building it before there is data to feed it produces low-confidence noise. Deferred to v2 per §8.
6. **Don't expose cross-creator comparables without the dual gate.** When `frontfiles_comparables` ships in v2, both N ≥ 10 AND IQR ≤ 50% of median must be satisfied. If either fails, the adapter returns null — not a low-confidence noisy recommendation.
7. **Don't replace `src/lib/offer/pricing.ts`.** It's transaction-side fee decomposition, downstream of the engine. Keep it.
8. **Don't replace the multiplier model unless founder revises §9.4.** Engine recommends one base price; multipliers handle per-licence/per-tier derivation. Schema change for per-licence overrides is a separate decision.
9. **Don't conflate the engine with the AI suggestion pipeline (Phase E).** They're separate pillars. Phase E calls Phase F as one of several proposal types. Mixing their schemas, workers, or trust postures is wrong.
10. **Don't skip the F1 ratification gate.** F1 is the architecture brief; it resolves substantive open decisions including the format_defaults initial table; founder must ratify before F2 schema migration. No code work between F1 brief and F1 ratification.
11. **Don't expose engine recommendations to buyers in v1.** Per F5, buyer-facing visibility is out of scope. Re-evaluate after v1 trust track record. Until then, buyers see only the actual price the creator set.
12. **Don't bypass platform floors.** If the engine would recommend below `pricing_platform_floors`, the recommendation is clamped up and the basis statement says so. Any directive proposing floor-bypass is wrong (it would undermine FF's market positioning).
13. **Don't ship engine code from this brief alone.** Code skeletons that precede F1 architecture brief ratification skip resolution of §9.1–§9.5 (format_defaults table content, per-licence overrides, currency handling, refresh cadence). Code drifts from spec the moment F1 resolves any open decision. The composition order is: ratify this brief → F1 architecture brief → founder ratifies F1 → F2 schema migration directive → F3+ engine code via audit-first directives. No engine.ts before F2.
14. **Don't expose `pricing_inputs` snapshots in v1.** Schema column `input_snapshot_id` is nullable in v1 and stays null. Snapshot table itself is v2+ optional per §8 — only built if demonstrated reproducibility need emerges that the existing recommendation row metadata cannot answer.
15. **Don't expose adapter weight tuning UI in v1.** Schema (`weights JSONB`) is provisioned in v1 to avoid v2 migration; the editing UI is v2 per §5.4. Premature exposure adds support surface for an advanced control few creators need early.
16. **Don't reference System B watermark vocabulary (`none/subtle/standard/strong`) in `format_defaults` or any engine-facing schema.** The engine's `format_defaults` table is keyed on `intrusion_level` (`light/standard/heavy`) per System A — this aligns with `vault_assets.intrusion_level` and the ongoing watermark consolidation per `BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md`. System B is being retired (Phase D D1.5 in `UX-BRIEF.md` v3). Any future contributor who keys engine logic on `watermark_mode` is wrong; reject the change. Vocabulary mismatch between price engine basis and per-asset watermark display would surface as confusing UI like "asset shown with strong overlay but priced as light intrusion."

---

## 12. References

- Vault upload UX brief: `docs/upload/UX-BRIEF.md` v2 (this brief subsumes its §4.4 and §7.9)
- Architecture brief (derivative pipeline): `src/lib/processing/ARCHITECTURE-BRIEF.md`
- Implementation plan (8-PR derivative): `src/lib/processing/IMPLEMENTATION-PLAN.md`
- Existing fee decomposition: `src/lib/offer/pricing.ts`
- Current creator pricing page: `src/app/vault/pricing/page.tsx`
- Multiplier constants: `src/lib/types.ts` (`LICENCE_TYPE_LABELS`, `EXCLUSIVE_TIER_LABELS`, `EXCLUSIVE_MULTIPLIERS`)
- Special offer system: `src/lib/special-offer/`
- Transaction execution: `src/lib/transaction/reducer.ts`
- AI pipeline brief (TBD): `src/lib/processing/AI-PIPELINE-BRIEF.md` (Phase E1)
- Phase F architecture brief (TBD): `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (Phase F1)

---

End of price engine brief.
