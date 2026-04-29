# Frontfiles Price Engine — Architecture Detail Brief (F1)

**Status:** REVISED 2026-04-30 (v4; cascade C per L1 v2.2 §12 — drops `intrusion_level` from pricing dimensions per Stage B 2026-04-28 founder discovery; supersedes v3). Awaiting founder ratification of this revision before F2 (schema migration) composes. v4 changes: (a) `intrusion_level` removed from `pricing_format_defaults` + `pricing_platform_floors` cell keys, indexes, and dimension lists — per L1 v2.2 §5.0, watermark intensity is preview-protection only and is not a pricing input; (b) cell counts drop 63 → 21 (full scope) and a new v1 editorial-only Stage B scope of 7 cells is recorded; (c) §10 adds don't-do #22 (don't re-introduce intrusion as pricing dimension); (d) §11 references add L1 v2.2 + CANONICAL-SOURCES.md + STAGE-B-SESSION-LOG + already-shipped watermark migrations. v3 changes (post-L1-v2 corrigendum) retained: (e) `licence_class` enumeration is `editorial | commercial | advertising` (CC handled separately via `pricing_cc_variants`); (f) `use_tier` is a multiplier (Path 2), not a cell dimension; (g) new pricing tables `pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers` introduced by L2 are referenced here. See §12 v4 entry.
**Date:** 2026-04-30 (v4); 2026-04-28 (v3)
**Predecessor:** `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 (locks scope, authority model, inputs, surfaces, trust posture, v1/v2 staging)
**Scope:** Architecture detail that PRICE-ENGINE-BRIEF v3 deferred to "F1 architecture work." Resolves the 9 open decisions in PRICE-ENGINE-BRIEF v3 §9. Specifies engine internals (composer, confidence), format_defaults table structure, platform floors structure, currency handling, refresh cadence, recalibration cadence, anonymization parameters (v2), analytics requirements, and engine quality measurement plan.
**Does NOT:** invent specific currency values for `format_defaults` rows or `pricing_platform_floors` rows. Per CLAUDE.md item 16, monetary values are founder calibration — F1 specifies the structure + the calibration process; founder fills the values in a calibration pass before F3 (format_defaults adapter) ships.
**Revision (2026-04-28):** founder-ratification audit produced six corrections. (1) §2.2 algorithm + §2.3 confidence table reconciled — `format_defaults` confidence scales to 1.0 when sole contributor, per the parent brief v3 §4.2.3 wording. (2) IQRPenalty formula dropped from §2.3 — the brief v3 §4.2.2 + F1 §5.4 dual gate is binary, leaving the formula as dead code; cleaner posture. (3) §4.1 inline `UNIQUE (...) WHERE` moved to a separate `CREATE UNIQUE INDEX ... WHERE` (PostgreSQL syntax requirement). (4) Version-column type drift reconciled to INTEGER across F1 + brief v3 §4.5. (5) §8 readiness-checklist cross-track item (pgvector) removed — AI-track concern, doesn't gate F2. (6) §11 References updated (UX-SPEC-V3 → UX-SPEC-V4; AI-PIPELINE-BRIEF path corrected). See §12 Revision History.

---

## 1. What this brief is

The structural complement to `PRICE-ENGINE-BRIEF.md` v3. The brief locked the engine's intent, scope, and trust posture; this brief locks the architectural details that govern how the engine actually computes recommendations and how operators reason about its behavior.

After ratification of this brief + the source brief, F2 (schema migration) can compose. The directive list's BP-D7-IMPL-equivalent two-stage gate (per PRICE-ENGINE-BRIEF v3 §10) is satisfied.

This brief is build-governing on the same terms as the source brief.

---

## 2. Engine internals — deeper specification

### 2.1 Recommendation function (refined)

Per PRICE-ENGINE-BRIEF v3 §4.1, the engine's core is a pure function:

```
recommendPrice(asset, context) → Recommendation
```

F1 refinement — the function decomposes into three phases:

1. **Adapter execution** — call each enabled adapter's `recommend(asset, context)`; accumulate `PartialRecommendation[]`. Adapters that return null (insufficient data) drop out.
2. **Composition** — the composer combines `PartialRecommendation[]` into a single `Recommendation` per §2.2.
3. **Floor enforcement** — the recommended cents value is clamped against creator + platform floors per §4. The basis statement records the clamping if it occurred.

All three phases are deterministic given inputs + the input-data snapshot (the snapshot from `pricing_inputs` in v2; from in-memory state in v1).

### 2.2 Composer algorithm

The composer combines partial recommendations from N adapters into a single recommendation. Two algorithm choices considered:

| Algorithm | Pros | Cons |
|---|---|---|
| **Weighted average** (chosen) | Simple; explainable; deterministic; matches the "based on N% of this and M% of that" basis-statement language directly | Doesn't account for adapter-confidence interaction effects |
| Bayesian / regression-style | Better accounts for confidence; could learn from acceptance feedback | Opaque; harder to explain in basis statements; over-engineered for v1 |

**Chosen: weighted average with confidence-scaled weights.**

Algorithm (locked):

```
1. Collect non-null partial recommendations from each enabled adapter.
2. Sole-contributor scale-up (per §2.3 format_defaults confidence rule):
   if format_defaults is the only contributing adapter (all others returned
   null), set its confidence to 1.0 BEFORE step 3. Encodes the platform's
   codified rate as a confident answer when no other signal exists, rather
   than a 50%-confident hedge. The basisStatement records this case
   ("limited data — Frontfiles standard rate" per brief v3 §4.3).
3. For each contributing adapter:
   - effectiveWeight = configuredWeight × confidence
4. Sum effectiveWeight across contributing adapters; call this W_total.
5. W_total = 0 is a hard error (format_defaults is always enabled and
   non-null by construction; its absence indicates a calibration / data
   defect, not a routine state). The engine raises rather than emitting
   a zero-confidence recommendation.
6. recommendedCents = sum(partial.recommendedCents × partial.effectiveWeight) / W_total
7. confidence = W_total / sum(configuredWeight across contributing adapters)
8. basisBreakdown[] records each contribution: adapter, weight,
   contribution_cents, effectiveWeight / W_total
```

This means low-confidence adapters contribute proportionally less. An adapter with `confidence=0.3` and `weight=0.5` contributes effectively 0.15 share of the final recommendation.

**Worked example (v1, illustrative — actual values locked at calibration):**

- creator_history: configured weight 0.6, returned recommendedCents=23000, confidence=0.8 → effectiveWeight=0.48
- format_defaults: configured weight 0.4, returned recommendedCents=20000, confidence=0.5 → effectiveWeight=0.20

```
W_total = 0.48 + 0.20 = 0.68
recommendedCents = (23000 × 0.48 + 20000 × 0.20) / 0.68 = 22118 (≈€221)
confidence = 0.68 / (0.6 + 0.4) = 0.68
```

basis statement renders as: *"Recommended €221. Based on your past sales of similar work (7 sales, 71% of recommendation) and Frontfiles standard rate for editorial photo (29% of recommendation). Confidence 68%."* (v4: dropped "at standard intrusion" — intrusion_level no longer a pricing dimension per L1 v2.2 §5.0.)

### 2.3 Confidence formula

Per-adapter confidence is computed by each adapter independently. The formulas:

| Adapter | Confidence formula |
|---|---|
| `creator_history` | `min(1.0, sampleSize / 10)` — saturates at N=10 (1.0); below N=3 returns null entirely (insufficient) |
| `frontfiles_comparables` (v2) | `min(1.0, sampleSize / 25)` — saturates at N=25. The IQR ≤ 0.5×median dual gate (per brief v3 §4.2.2 + F1 §5.4) is binary: outside the gate, adapter returns null; inside, no IQR-derived penalty applies. The earlier `IQRPenalty` formula was dropped on 2026-04-28 ratification audit — it operated entirely in the IQR/median > 0.5 region the gate already rules out, making it dead code. Posture-aligned: prefer admitting "no signal" to injecting noise. |
| `format_defaults` | Baseline 0.5 when contributing alongside another non-null adapter; **scales to 1.0 when sole contributor** (per §2.2 step 2). Encodes "platform's codified rate" as a confident answer when no other signal exists, rather than a 50%-confident hedge. Implementation: the adapter always returns `confidence: 0.5`; the composer's §2.2 step 2 rewrites it to 1.0 if it's the only non-null partial. |

Composer-level confidence per §2.2 step 7.

### 2.4 Recommendation freshness + caching

A recommendation is considered "fresh" if generated within 30 days. Stale recommendations are auto-refreshed when:
- The asset is viewed in vault asset edit
- The bulk re-pricing tool is invoked
- The creator changes a `pricing_admin_settings` value (recompute on next view)

Refresh policy locked here in F1 per PRICE-ENGINE-BRIEF v3 §9.6 (open decision #6 — refresh cadence). No background scheduler in v1; refresh is on-view / on-action.

The previous recommendation row's `superseded_at` is stamped when a new recommendation is generated. Old rows are NOT deleted (audit retention).

---

## 3. `format_defaults` — structure + calibration process

### 3.1 Table structure

The engine's behavior in v1 is dominated by `format_defaults` (since `frontfiles_comparables` is deferred to v2, and `creator_history` is sparse for new creators). Getting this structure right is critical.

```sql
CREATE TABLE pricing_format_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dimension 1: format (matches AssetFormat enum from src/lib/types.ts)
  format TEXT NOT NULL,
  -- Dimension 2: licence_class — 3 cell-bearing classes per L1 v2.2 §5.1
  --   editorial | commercial | advertising
  --   (creative_commons EXCLUDED — CC pricing is absolute via pricing_cc_variants per L1 v2.2 §5.4)
  licence_class TEXT NOT NULL,
  -- (intrusion_level removed in v4 corrigendum per L1 v2.2 §5.0 — watermark intensity is preview-protection only, not a pricing input)
  -- (use_tier removed in v3 corrigendum — now a multiplier in pricing_use_tier_multipliers per L1 v2.2 §5.3 + §8 #4 founder pick)
  -- Currency-aware
  currency TEXT NOT NULL,
  baseline_cents INTEGER NOT NULL,
  -- Provenance
  table_version INTEGER NOT NULL,        -- bumps on any change; preserved on rows for audit
  effective_from TIMESTAMPTZ NOT NULL,
  superseded_at TIMESTAMPTZ,             -- NULL = current; stamps when superseded by newer table_version
  calibration_basis TEXT,                -- short note ("fotoQuote 2024 editorial mid-pub midpoint")
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibrated_by UUID REFERENCES users(id),
  UNIQUE (format, licence_class, currency, table_version)
);

CREATE INDEX pricing_format_defaults_active
  ON pricing_format_defaults (format, licence_class, currency)
  WHERE superseded_at IS NULL;
```

**Dimensions explained:**

- **format**: photo, illustration, infographic, vector, video, audio, text — matches `AssetFormat` enum
- **licence_class** (v3+): `editorial | commercial | advertising`. Per L1 v2.2 §3 + §5.1, the 3 cell-bearing classes. `creative_commons` is EXCLUDED from this table — CC pricing is absolute per CC variant via `pricing_cc_variants` (L2 directive §6.2). Sublabels (e.g., `editorial.news`, `commercial.brand_content`) modify the base price via `pricing_sublabel_multipliers` (L2 §6.3); `licence_class` itself is the cell key (the class portion of `class.sublabel`).
- **(intrusion_level removed in v4)** — was Dimension 2 in the v1/v2/v3 versions of this brief; per L1 v2.2 §5.0, watermark intensity governs creator preview-protection only, not pricing. The licensed file delivered to the buyer is the original (unwatermarked); pricing has zero structural reason to vary by the creator's preview-protection choice. `vault_assets.intrusion_level` STAYS as a watermark-system column (already shipped via `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`); the pricing engine MUST NOT query it.
- **(use_tier removed)** — was Dimension 4 in the v1/v2 versions of this brief; per L1 v2.2 §5.3 + §8 #4, use_tier is now a multiplier table (`pricing_use_tier_multipliers`) using abstract codes `tier_1..tier_4` translated to per-class vocabulary in `src/lib/licence/labels.ts`.
- **currency**: ISO 4217 (EUR, USD, GBP, etc.). v1 ships EUR only; multi-currency expanded later if creators outside EUR market are common.

**Companion tables (per L2 directive §6, ratification pending):**
- **`pricing_cc_variants`** — absolute CC variant prices keyed on `(cc_variant, currency)`. v1 ships flat per variant (7 rows); v2 may add (format) dimension only per L1 v2.2 §5.4.
- **`pricing_sublabel_multipliers`** — multiplier per non-CC sublabel keyed on dotted `class.sublabel`. 17 rows (Editorial 6 + Commercial 4 + Advertising 7).
- **`pricing_use_tier_multipliers`** — multiplier per `(licence_class, use_tier)` where `licence_class ∈ {editorial, commercial, advertising}` (CC excluded) and `use_tier ∈ {tier_1, tier_2, tier_3, tier_4}`. 12 rows.

**Format families omitted:** PRICE-ENGINE-BRIEF v3 §4.2.3 included `format_family` (portrait/landscape/wide). F1 drops this from `format_defaults` because aspect ratio is not a load-bearing pricing dimension in editorial markets — a portrait photo and a landscape photo for the same use tier price equivalently. Family stays as a watermark-template concern (where it actually affects layout); not a pricing dimension.

**Exclusivity omitted:** PRICE-ENGINE-BRIEF v3 §4.2.3 included exclusivity. F1 drops this from `format_defaults` because exclusivity is handled by the existing `EXCLUSIVE_MULTIPLIERS` constant in `src/lib/types.ts` (per the audit-confirmed multiplier model in PRICE-ENGINE-BRIEF v3 §4.6). Engine recommends a base price; multipliers handle exclusivity downstream.

### 3.2 Cell count (v4 corrigendum)

After dropping format_family + exclusivity (kept from v1) AND dropping use_tier (v3 — moved to multiplier table per L1 v2.2 §5.3) AND excluding `creative_commons` from licence_class (v3 — handled via `pricing_cc_variants` per L1 v2.2 §5.4) AND dropping intrusion_level (v4 — per L1 v2.2 §5.0; watermark intensity is preview-protection only, not a pricing input):

- 7 formats × **3 licence_classes** (editorial / commercial / advertising) × 1 currency (v1) = **21 cells**

That's down 12× from the v1/v2 version of this brief and 3× from v3 (252 → 63 → 21). The v4 step drops `intrusion_level` per L1 v2.2 §5.0 founder discovery — the dimension was inherited into the cell key from the watermark vocabulary (`vault_assets.intrusion_level` shipped for the System A compositor) without explicit founder ratification of the economic logic; founder discovery during Stage B 2026-04-28 surfaced the architectural error. Calibration burden drops accordingly. Engine queries by `(format, licence_class, currency)`; multipliers compose at price-resolution time per L1 v2.2 §5.7.

**v1 editorial-only Stage B scope** (per Stage B 2026-04-28 §3.1/3.2; commercial + advertising deferred to v2): **7 cells** (one editorial cell per format). Calibrated drop-in values land via `docs/pricing/calibration/CANONICAL-SOURCES.md` §11.

**v4 total founder calibration burden** (per L1 v2.2 §5.5):

| Table | Full scope (v4) | v1 editorial-only Stage B scope |
|---|---|---|
| `pricing_format_defaults` (cells) | 21 (was 63 in v3) | 7 |
| `pricing_sublabel_multipliers` (L2 §6.3) | 17 (unchanged) | 6 |
| `pricing_use_tier_multipliers` (L2 §6.4) | 12 (unchanged) | 4 |
| `pricing_cc_variants` (L2 §6.2; flat per variant in v1) | 7 (unchanged) | 7 |
| `EXCLUSIVE_MULTIPLIERS` (existing in `src/lib/types.ts`) | 3 (unchanged) | 3 |
| **Total** | **~60** (was ~102 in v3; ~315 in v1/v2 of this brief) | **~31** (Stage B path-(1) target) |

### 3.3 Calibration process

**Calibration is founder-led, not Claude-generated.** F1 specifies the process; F1.5 (a small follow-on directive) produces the seed values:

```
F1.5 — format_defaults calibration pass (between F1 and F3)

  Step 1: Founder reviews the 5-CSV structure (v4): 21 format_defaults cells + 21 platform_floors cells + 17 sublabel multipliers + 12 use_tier multipliers + 7 CC variant absolute prices = ~78 total values (full scope)
          v1 editorial-only Stage B scope: 7 + 7 + 6 + 4 + 7 = ~31 total values
  Step 2: Founder consults offline calibration sources:
          - fotoQuote / fotoBiz pricing calculators
          - Getty Images published rate cards (where public)
          - AP / Reuters published editorial rates (where public)
          - PhotoShelter / similar industry pricing guides
          - Founder's own market knowledge of FF's positioning
          (Stage B Phase α completed the 5-tier source authority hierarchy
           per docs/pricing/calibration/CANONICAL-SOURCES.md; §11 of that
           doc carries the v1 editorial cell drop-in spec.)
  Step 3: Founder fills the 5 CSVs (21+21+17+12+7 = 78 cells full scope; or 7+7+6+4+7 = 31 v1 editorial-only)
  Step 4: Claude composes a SQL seed migration (5 INSERT blocks) from the CSVs
  Step 5: Founder reviews the seed migration before F3 ships
```

The calibration is recorded with its basis (per row's `calibration_basis` column). External sources inform the values but are not cited as authoritative — per PRICE-ENGINE-BRIEF v3 §4.2.4, the engine never references external benchmarks at runtime.

**Recalibration cadence (per PRICE-ENGINE-BRIEF v3 §9.9):** quarterly review by founder. Out-of-cycle update triggered by significant market move (e.g., Getty changes rates 30%+) or founder judgment. Each recalibration bumps `table_version`; old rows preserved for audit; recommendations stamp the `format_defaults_version` they used (per the brief's §4.5 schema).

**Initial table content:** explicitly NOT provided in this F1 brief. F1.5 directive produces it.

---

## 4. `pricing_platform_floors` — structure + calibration process

### 4.1 Table structure

Per PRICE-ENGINE-BRIEF v3 §4.5.1:

```sql
CREATE TABLE pricing_platform_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  -- (intrusion_level removed in v4 corrigendum per L1 v2.2 §5.0 — watermark intensity is preview-protection only, not a pricing input)
  licence_class TEXT NOT NULL,
  currency TEXT NOT NULL,
  min_cents INTEGER NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibrated_by UUID REFERENCES users(id)
  -- (no inline UNIQUE — partial uniqueness requires a separate
  --  CREATE UNIQUE INDEX ... WHERE in PostgreSQL; see below)
);

-- Partial unique index: only one "active" floor per (format, licence_class,
-- currency) combination at any given time. Superseded rows are preserved for
-- audit but excluded from the uniqueness constraint.
CREATE UNIQUE INDEX pricing_platform_floors_unique_active
  ON pricing_platform_floors (format, licence_class, currency)
  WHERE superseded_at IS NULL;
```

**Dimensions:** same as `format_defaults` minus `use_tier` (floors are below-which-engine-never-recommends; not segmented by use tier — protects against the engine ever recommending below FF's market positioning regardless of use tier). v4 also drops `intrusion_level` from this table per L1 v2.2 §5.0 (same rationale as `format_defaults` §3.1).

### 4.2 Cell count

7 formats × 3 licence_classes × 1 currency (v1) = **21 cells** (v4; was 63 in v3 — same `intrusion_level` drop math as §3.2). Even smaller calibration pass. **v1 editorial-only Stage B scope: 7 cells** (one floor per format).

### 4.3 Calibration process

Same as §3.3 — founder-led; F1.5 includes platform floors alongside format_defaults. Same offline sources inform values.

### 4.4 Floor enforcement (engine behavior)

Per PRICE-ENGINE-BRIEF v3 §4.5.1:

```
After composer produces recommendedCents:
  platformMin = lookup pricing_platform_floors for (format, licence_class, currency)
  creatorMin = lookup pricing_admin_settings.creator_floors for (creator, format)
  effectiveFloor = max(platformMin or 0, creatorMin or 0)
  if recommendedCents < effectiveFloor:
    clampedCents = effectiveFloor
    basisStatement += " (clamped to platform/creator floor)"
  emit recommendation with clampedCents
  log to pricing_audit_log if clamped
```

Clamping is logged so analytics can monitor how often the engine wants to recommend below floor (signal that defaults need recalibration upward, or that floor is too aggressive).

---

## 5. Resolved IPs from PRICE-ENGINE-BRIEF v3 §9

### 5.1 Per-licence price overrides (§9.4)

**Resolution: NO per-licence override on the asset in v1.** The strict multiplier model holds. Engine recommends one base price; existing `EXCLUSIVE_MULTIPLIERS` and licence-class multipliers (TBD in `src/lib/types.ts` audit) handle derivation downstream.

Rationale:
- Adding per-licence override columns to `vault_assets` is a non-trivial schema migration
- Creators rarely need per-licence override at v1 (typical pattern: set base price; rely on multipliers)
- If demand emerges, add as v2 schema extension with backfill

If founder wants per-licence overrides in v1, this resolution flips and adds 1 schema migration to F2 scope.

### 5.2 Currency handling (§9.5)

**Resolution: per-creator currency preference, stored on `creator_profile`.** Engine recommendations are emitted in the creator's preferred currency.

Schema: add `pricing_currency TEXT NOT NULL DEFAULT 'EUR'` to `creator_profiles` (or wherever creator preferences live). Engine reads this at recommendation time and queries `format_defaults` rows with matching currency.

v1 ships EUR only — single currency loaded into `format_defaults`. Other currencies require their own calibration passes (separate F1.5-equivalent directive per currency added).

### 5.3 Refresh cadence (§9.6)

**Resolution: on-view / on-action only. No background scheduler in v1.**

A recommendation is "fresh" if generated within 30 days. Stale ones auto-refresh when:
- Vault asset edit screen opens for the asset
- Bulk re-pricing tool runs across a selection containing the asset
- Creator changes a `pricing_admin_settings` value (recompute on next view)
- Format defaults table version bumps (background sweep adds stale flags; on-view recomputes)

No nightly cron in v1. Compute cost is bounded by view volume (which is small relative to 24/7 recompute).

If background recompute is later needed (e.g., for analytics requiring fresh recs across the vault), add a scheduled directive post-v1.

### 5.4 Anonymization parameters for comparables (v2, §9.3)

**Resolution: dual gate (already in PRICE-ENGINE-BRIEF v3 §4.2.2) plus four additional rules:**

1. **Sample size N ≥ 10** for the adapter to contribute non-trivially
2. **IQR ≤ 50% of median** for the median to be considered a meaningful aggregate
3. **Date bucketing**: month-level precision; never day-level (prevents temporal-correlation deanonymization)
4. **Display-format**: aggregate-only in basis statements (median + IQR); never individual prices visible
5. **No drill-down to specific assets** in v1 — even when comparable count is high
6. **Cross-creator pricing visibility**: no individual creator's prices ever inferable from aggregate display, even with knowledge of the platform's full creator list

Per-creator k-anonymity threshold: a comparable cohort must contain ≥ 5 distinct creators (not just ≥ 10 transactions) before the aggregate is exposed. This prevents one prolific creator's price history from dominating an aggregate that appears representative.

Specific anonymization-test methodology: locked in F1.5 alongside the format_defaults calibration.

### 5.5 Recalibration cadence (§9.9)

**Resolution: quarterly founder review.** Specific calendar: end-of-Q review (Mar/Jun/Sep/Dec). Out-of-cycle triggers:
- External rate-card change > 30% in any major source (founder discretion to assess)
- Platform sale-price drift > 25% from current `format_defaults` baselines for any cell-bucket (analytics surface this)
- Founder judgment

Each recalibration: bump `table_version`; preserve old rows; new recommendations stamp the new version. Old recommendations remain attributable to the version that produced them.

### 5.6 Pricing analytics (§9.7)

**Resolution: ship 3 baseline metrics in v1; expand based on patterns.**

v1 baseline metrics (queryable from `pricing_audit_log`):
1. **Acceptance rate per generation** — % of recommendations the creator accepted (per format / per use_tier / per creator)
2. **Override delta distribution** — when creator overrides, how far from recommendation (median delta as % of recommendation)
3. **Floor-clamp frequency** — how often the engine wants to recommend below floor (signal for calibration adjustment)

These three answer "is the engine getting better or worse" and "is calibration drifting." Implementation: SQL views over `pricing_audit_log`, queryable by ops dashboards.

v2 extensions (deferred): conversion-rate correlation (how engine acceptance correlates with sale completion); per-adapter contribution analysis; recommendation freshness distribution.

### 5.7 Engine quality measurement (§9.8)

**Resolution: feedback loop is creator override patterns + acceptance rate, both surfaced via §5.6 analytics.**

Definitions:
- **Engine is "good" when**: acceptance rate is high (>70%) AND override deltas are small (<20% from recommendation)
- **Engine is "bad" when**: acceptance rate is low (<40%) OR override deltas are large (>50% from recommendation) OR floor-clamp frequency is high (>30% of recommendations clamped)
- **Engine quality is unknown when**: insufficient data per cell (<10 recommendations in a cell-bucket)

Quality measurement is a **read-only pass** in v1 — no automated action taken on bad signals. Quarterly recalibration uses these signals as input. v2 may automate (e.g., adapter weight auto-tuning) once signal stability is established.

Conversion-rate correlation requires sale data which is not in scope for v1 quality measurement.

---

## 6. Analytics requirements (consolidated)

Per §5.6, three metrics ship in v1 as SQL views over `pricing_audit_log`:

```sql
-- View 1: acceptance_rate_per_cell
CREATE VIEW pricing_acceptance_rate AS
  SELECT
    asset.format, asset.licence_class,
    COUNT(*) FILTER (WHERE event_type = 'recommendation_generated') AS gen_count,
    COUNT(*) FILTER (WHERE event_type = 'recommendation_accepted') AS accepted_count,
    -- ratio with NULL-safe division
    NULLIF(...) AS acceptance_rate
  FROM pricing_audit_log
  JOIN vault_assets asset ON asset.id = pricing_audit_log.asset_id
  WHERE event_at >= now() - interval '90 days'
  GROUP BY 1, 2;

-- View 2: override_delta_distribution (similar pattern)
-- View 3: floor_clamp_frequency (similar pattern)
-- (v4 corrigendum: dropped asset.intrusion_level from SELECT/GROUP BY — pricing
--  cells no longer keyed on intrusion per L1 v2.2 §5.0; vault_assets.intrusion_level
--  remains a watermark-system column but pricing analytics MUST NOT group by it.)
```

These views ship as part of F2 (schema migration) so they're queryable from day one.

---

## 7. Engine quality + recalibration loop

The §5.5 quarterly recalibration uses §5.6 analytics:

```
Quarter end:
  1. Run acceptance_rate query — identify cells with rate < 40%
  2. Run override_delta query — identify cells where median delta > 30%
  3. Run floor_clamp query — identify cells clamping > 25% of recommendations
  4. Founder reviews flagged cells; updates format_defaults baseline_cents
  5. New format_defaults rows written with bumped table_version
  6. Old rows superseded but preserved for audit
  7. Old recommendations remain attributed to prior version
```

This is the founder-governed feedback loop. No automated parameter adjustment in v1.

---

## 8. v1 readiness checklist (gates F2 schema migration)

Before F2 ships (v4):
- [ ] This brief (F1 v4) ratified
- [ ] L1 v2.2 (Licence Taxonomy Brief — cascade A) ratified (PR #45 merged 2026-04-29)
- [ ] L2 v1.1 directive (Licence Schema Migration — cascade B) ratified (PR #44)
- [ ] F1.5 v3 (calibration directive — cascade C) ratified (this PR)
- [ ] Founder fills format_defaults seed — full scope: 21 cells; v1 editorial-only Stage B scope: **7 cells** (per CANONICAL-SOURCES.md §11 drop-in)
- [ ] Founder fills platform floors seed — full scope: 21 cells; v1 editorial-only Stage B scope: 7 cells
- [ ] Founder fills sublabel multipliers seed (17 multipliers; v1 editorial-only: 6)
- [ ] Founder fills use_tier multipliers seed (12 multipliers; v1 editorial-only: 4)
- [ ] Founder fills CC variants seed (7 absolute prices; flat per variant per L1 v2.2 §5.4)
- [ ] F2 schema migration includes seed migration with all 5 tables
- [ ] Decision on per-licence overrides confirmed (default: NO; per §5.1)
- [ ] Decision on currency confirmed (default: EUR-only v1; per §5.2)

---

## 9. Approval gate

This brief (F1) is the ratification gate for the engine's architecture. F1.5 (calibration directive) is its own ratification gate before F3 (format_defaults adapter) — once founder fills the seed values.

After both gates: F2 (schema migration) composes; subsequent F3-F11 directives compose against the now-fully-specified architecture.

The two-stage approval mirrors PRICE-ENGINE-BRIEF v3 §10:
1. **PRICE-ENGINE-BRIEF v3** — high-level locks (already ratified)
2. **F1 (this brief)** — architectural details
3. **F1.5** — calibration values (founder-input data)

Three gates total before F2. This is heavier than other phases because pricing is the highest-trust-stakes pillar (legal/commercial language sensitivity per CLAUDE.md item 9).

---

## 10. Don't-do list (additions to PRICE-ENGINE-BRIEF v3 §11)

PRICE-ENGINE-BRIEF v3 §11's 16 don't-do items still apply. Additional items from this brief:

17. **Don't auto-tune adapter weights from acceptance signal in v1.** Quality measurement is a read-only pass. Founder-governed recalibration only. Auto-tuning ships in v2 once signal stability is established.
18. **Don't add per-licence override columns to `vault_assets` in v1.** Multiplier model holds. Per §5.1.
19. **Don't load multiple currencies into format_defaults in v1.** EUR only. Other currencies require their own F1.5-equivalent calibration directives.
20. **Don't run a background recompute scheduler in v1.** Refresh on-view / on-action only. Per §5.3.
21. **Don't expose individual creator prices in cross-creator comparables aggregates** even when sample size is high. K-anonymity threshold of ≥ 5 distinct creators per cohort. Per §5.4.
22. **Don't re-introduce `intrusion_level` (or any watermark-related dimension) into `pricing_format_defaults`, `pricing_platform_floors`, or any other pricing table.** Per L1 v2.2 §5.0 + §10 don't-do #13: watermark intensity is creator preview-protection only, not a pricing input. The licensed file delivered to the buyer is the original (unwatermarked); pricing has zero structural reason to vary by the creator's preview-protection choice. `vault_assets.intrusion_level` STAYS as a watermark-system column (already shipped via `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`); the pricing engine MUST NOT query it.

---

## 11. References

- PRICE-ENGINE-BRIEF v3 (parent): `docs/pricing/PRICE-ENGINE-BRIEF.md` (this brief is the F1 detail brief that v3 §10 calls for)
- UX brief (price field surfaces): `docs/upload/UX-BRIEF.md` v3 §4.4
- UX spec (price visual treatment + "Why this price?" affordance): `docs/upload/UX-SPEC-V4.md` §11 (V4 supersedes V3 per UX-SPEC-V4 §0)
- AI pipeline brief (sister architecture): `src/lib/processing/AI-PIPELINE-BRIEF.md`
- BP/Watermark audit (intrusion vocabulary; clarifies intrusion_level is watermark, not pricing): `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` §4
- Existing fee decomposition (preserved): `src/lib/offer/pricing.ts`
- Existing multipliers (preserved): `src/lib/types.ts`
- **v4 cascade C anchors:**
  - `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2.2 (cascade A; §5.0 pricing dimensions lock — this is the authority anchor for the v4 intrusion_level drop)
  - `docs/pricing/calibration/CANONICAL-SOURCES.md` (Phase α; §11 path-(1)-ready 7-cell editorial spec drop-in for cascade F regeneration)
  - `docs/pricing/calibration/STAGE-B-SESSION-LOG-2026-04-28.md` (founder discovery + v1 scope decisions: editorial + CC + social only; commercial + advertising deferred to v2)
  - Already-shipped watermark migrations (no migration action needed; `vault_assets.intrusion_level` STAYS as watermark column; pricing engine MUST NOT query): `supabase/migrations/20260417100001_watermark_profile_enums.sql`, `20260417100002_watermark_profile_tables.sql`, `20260417100003_watermark_profile_indexes.sql`
  - SEED_PROFILES source-of-truth for watermark `intrusionLevel` vocabulary: `src/lib/processing/profiles.ts:60-169`
- Future: F1.5 calibration directive: `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` (v3 corrigendum lands as cascade C alongside this F1 v4)
- Future: F2 schema migration: TBD when F1.5 v3 ratifies + Stage B values land

---

## 12. Revision history

### v4 — 2026-04-30 (cascade C per L1 v2.2; awaiting ratification)

L1 (Licence Taxonomy Brief) v2.2 §5.0 locks the pricing-engine dimension set and explicitly drops `intrusion_level` from pricing per Stage B 2026-04-28 founder discovery. F1 v4 brings the F1 pricing tables into structural compliance with the L1 v2.2 lock; corrigendum scope is dimension-drop only (no new architecture; engine internals + composer + confidence model + adapter contracts unchanged from v3 + 2026-04-28 corrections).

| # | Section | Change | Rationale |
|---|---|---|---|
| 1 | Status header | REVISED 2026-04-28 (v3) → REVISED 2026-04-30 (v4; cascade C per L1 v2.2) | New ratification gate per cascade C |
| 2 | §2.2 basis statement example | Drop "at standard intrusion" from runtime basis-statement language | Engine no longer differentiates by intrusion per L1 v2.2 §5.0; runtime copy aligns |
| 3 | §3.1 schema | `intrusion_level` column DROPPED from `pricing_format_defaults`; UNIQUE constraint + INDEX updated to `(format, licence_class, currency[, table_version])`; dimension bullet removed; `cc_variants` v2 speculation rephrased to drop "(format, intrusion)" → "(format) only per L1 v2.2 §5.4"; format-families paragraph rephrased to drop "at the same intrusion level" | Per L1 v2.2 §5.0 — watermark intensity is preview-protection only, not a pricing input |
| 4 | §3.2 cell count | 252 → 63 (v3) → **21** (v4). New v1 editorial-only Stage B scope = **7 cells**. Calibration burden table rewritten: total ~102 → ~60 (full scope) and ~31 (v1 ed-only). Engine query-by tuple reduced to `(format, licence_class, currency)` | Direct consequence of #3 |
| 5 | §3.3 calibration process | Step 1 + Step 3 cell-count narrative updated to v4 numbers (21+21+17+12+7 = ~78 full scope; 7+7+6+4+7 = ~31 v1 ed-only). Step 2 references CANONICAL-SOURCES.md Phase α 5-tier source authority hierarchy | Reflects new shape; v1 ed-only Stage B path-(1) target |
| 6 | §4.1 schema | `intrusion_level` column DROPPED from `pricing_platform_floors`; partial UNIQUE INDEX updated to `(format, licence_class, currency)` | Same rationale as #3 — floors mirror defaults shape |
| 7 | §4.2 cell count | 63 → **21** (full scope); v1 editorial-only Stage B scope = 7 floors | Same math as §3.2 |
| 8 | §4.4 floor enforcement | Lookup tuple updated to `(format, licence_class, currency)` | Same rationale as #3 |
| 9 | §6 analytics view | View 1 SELECT/GROUP BY drops `asset.intrusion_level`; comment added that v4 corrigendum forbids grouping pricing analytics by `vault_assets.intrusion_level` (the column STAYS as a watermark surface, but pricing analytics MUST NOT use it) | Per L1 v2.2 §5.0 — analytics align with cell key |
| 10 | §8 readiness checklist | Cell counts updated (21 / 21); v1 ed-only Stage B scope explicitly added; gate references updated to v2.2 / v1.1 / v3 | Reflects v4 shape + cascade A / B / C versioning |
| 11 | §10 don't-do | New item #22 — don't re-introduce `intrusion_level` (or any watermark-related dimension) into pricing tables | Per L1 v2.2 §5.0 + §10 don't-do #13 |
| 12 | §11 references | Add L1 v2.2 (cascade A authority anchor), CANONICAL-SOURCES.md Phase α + §11 7-cell drop-in, STAGE-B-SESSION-LOG, already-shipped watermark migrations, SEED_PROFILES source-of-truth | Per L1 v2.2 §11 cascade C reference set |
| 13 | §12 | This entry added; v3 entry marked superseded | Build-governing record |
| 14 | Closing line | "End of price engine architecture detail brief (F1, revised 2026-04-28)" → "End of F1 brief (v4, 2026-04-30)" | Versioning |

**Sections unchanged in v4:** §1 (purpose), §2.1 (recommendation function), §2.3 (confidence formulas — no intrusion reference), §2.4 (freshness), §5 (resolved IPs §5.1-§5.7 — no intrusion as pricing dimension), §7 (engine quality + recalibration loop — no intrusion reference; flagged-cell criteria still apply per cell shape), §9 (approval gate — two-stage model holds; cascade C inserts a new gate but the two-stage shape is unchanged).

**Already-shipped watermark layer (no migration action needed in cascade C):** `vault_assets.intrusion_level` + `watermark_profiles` + `watermark_intrusion_level` enum + indexes already landed in `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`. These are correct System A surface; cascade C does NOT touch them. `vault_assets.intrusion_level` STAYS as a watermark-system column; pricing engine MUST NOT query it (don't-do #22 enforces this at the architecture layer).

**L4b BRIEF v4 unaffected:** the `Recommendation[]` per-asset wrapper is taxonomy-driven (one Recommendation per enabled `licence_class`), not intrusion-driven. No L4b corrigendum needed for cascade C.

### v3 — 2026-04-28 (post-L1-v2 corrigendum; awaiting ratification)

**Superseded by v4 (cascade C per L1 v2.2 §12) — v3's `intrusion_level` cell-key entries are the architectural error v4 corrects. v3 entry retained below for audit trail.**

L1 (Licence Taxonomy Brief) v2 + L2 (Licence Schema Migration directive) introduced architectural changes that contradicted F1 v2's pricing model. Corrigendum scope: alignment only, no new architecture.

| # | Section | Change | Rationale |
|---|---|---|---|
| 1 | Status header | RATIFIED → REVISED 2026-04-28 (post-L1-v2) | New ratification gate |
| 2 | §3.1 schema | `licence_class` enumeration changed from `Social/Editorial/Campaign` to `editorial/commercial/advertising` | Per L1 v2 §3 — `Social/Editorial/Campaign` was a brief-side assumption that never matched code; v2 locks 3 cell-bearing classes |
| 3 | §3.1 schema | `use_tier` column DROPPED from `pricing_format_defaults`; UNIQUE constraint + index updated | Per L1 v2 §5.3 + §8 #4 — use_tier is a multiplier table now (Path 2), not a cell dimension. Lighter calibration. |
| 4 | §3.1 schema | Added cross-references to companion tables `pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers` (created by L2 directive §6) | Per L1 v2 §5 — these tables coexist with `pricing_format_defaults` and compose into the final price |
| 5 | §3.2 cell count | 252 → 63 cells; total founder calibration ~315 → ~102 | Direct consequence of changes #2 and #3 + CC excluded |
| 6 | §12 | This entry added | Build-governing record |

Sections unchanged: §1, §2, §3.3 (calibration process; mostly survives — 252 references in the F1.5 directive will update via the F1.5 corrigendum), §4 (`pricing_platform_floors` — already lacked use_tier so cell count of 63 stands), §5 resolutions, §6 analytics views (queries already group by (format, intrusion, licence_class) without use_tier — survives), §7 quality loop, §8 readiness checklist, §9 approval gate, §10 don't-do list, §11 references.

### 2026-04-28 — post-ratification corrections

Founder-ratification audit on 2026-04-28 produced six corrections. All local; no architectural change. The engine's intent + scope + trust posture from the source brief v3 stand unchanged.

| # | Section | Change | Rationale |
|---|---|---|---|
| 1 | §2.2 algorithm + §2.3 confidence formulas | `format_defaults` confidence scales to 1.0 when sole contributor; algorithm step 2 added to make this explicit | §2.2 and §2.3 were inconsistent in v1 — §2.3 said "scales up to 1.0" but §2.2 algorithm didn't implement it. Resolved per founder pick (1a): align to brief v3 §4.2.3 wording; sole-contributor case asserts platform's codified rate as confident answer rather than 50%-confident hedge |
| 2 | §2.3 confidence formula for `frontfiles_comparables` | IQRPenalty formula dropped | Dead code given the brief v3 §4.2.2 + F1 §5.4 dual gate (IQR ≤ 0.5×median). The penalty operated entirely in the IQR > 0.5×median region the gate already rules out. Founder pick (2a): drop the formula; binary gate suffices; matches "prefer no signal to noisy signal" posture |
| 3 | §4.1 schema | Inline `UNIQUE (...) WHERE` moved to a separate `CREATE UNIQUE INDEX ... WHERE` | PostgreSQL syntax requirement — partial UNIQUE constraints aren't supported inline in `CREATE TABLE`; require a separate index statement |
| 4 | §3.1 + brief v3 §4.5 type alignment | `format_defaults_version` aligned to INTEGER on both `pricing_recommendations` (was TEXT in brief v3) and `pricing_format_defaults.table_version` (already INTEGER in F1) | Type drift between brief and F1; INTEGER chosen as monotonic-counter fits the use case better than free-form string |
| 5 | §8 readiness checklist | pgvector / vector-storage bullet removed | Cross-track scope (AI-pipeline concern, not F-track); pgvector is shipped per migration `20260419110000`; doesn't gate F2 |
| 6 | §11 references | UX-SPEC-V3 cite → UX-SPEC-V4 §11; AI-PIPELINE-BRIEF path → `src/lib/processing/AI-PIPELINE-BRIEF.md` | Stale references; V3 retired per UX-SPEC-V4 §0; AI brief actual location |

### 2026-04-26 — initial composition

Composed alongside PRICE-ENGINE-BRIEF v3 (third revision same day). F1 detail brief that the brief's §10 two-stage approval gate calls for. Awaited ratification until 2026-04-28.

---

End of F1 brief (v4, 2026-04-30).
