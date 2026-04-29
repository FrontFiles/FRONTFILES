# Frontfiles Licence Taxonomy — Architecture Brief (L1)

**Status:** REVISED 2026-04-29 (v2.2; architectural change — drop `intrusion_level` from pricing dimension per Stage B 2026-04-28 founder discovery; supersedes v2). v2 sublabel-naming corrections retained. v1 ratified 2026-04-28 via PR #30; v2 ratified 2026-04-28 via PR #32; v2.2 awaiting founder ratification (§12 v2.2 entry).
**Date:** 2026-04-29
**Scope:** Frontfiles licence taxonomy — main classes, sublabels, schema shape, pricing implications, sequencing
**Governs:** Phase L (licence taxonomy refactor) — runs in parallel with Phases B (backend), C (UI rebuild), E (AI pipeline). Phase F (price engine) is **gated on this brief** because the existing 8-value `LicenceType` enum cannot drive F1.5 calibration as currently shaped.
**Supersedes:** the flat 8-value `LicenceType` enum in `src/lib/types.ts:360-378` (legacy; Phase L decommissions it after backfill stabilises)
**Reads underlying:**
- `src/lib/types.ts:360-378` (`LicenceType`), `:381-397` (`EXCLUSIVE_MULTIPLIERS`)
- `supabase/migrations/20260413230002_vault_asset_tables.sql:73-105` (`enabled_licences text[]` + CHECK)
- `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 §4.6 (multiplier model for licence/exclusivity derivation; flagged "TBD in src/lib/types.ts audit")
- `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1) §3.1 (licence_class as cell dimension; assumed `Social/Editorial/Campaign`)
- `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` (F1.5) §3 (hard prerequisite: verify `LICENCE_TYPE_LABELS` — verification done in this brief, drift confirmed)
- `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` (BP-D7 — language discipline; "Creative Commons" alone is not legally meaningful)
- `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` §4 (System A vocabulary — `intrusion_level` cross-system observations; v2.2 lock anchor)
- `src/lib/processing/profiles.ts:60-169` (SEED_PROFILES — source of truth for the watermark `intrusionLevel` vocabulary; v2.2 lock anchor)
- Consumers (must update through Phase L): `src/lib/transaction/{types,reducer,context,finalization}.ts`, `src/lib/special-offer/{types,services}.ts`, `src/lib/fulfilment/types.ts`, `src/app/api/special-offer/route.ts`, `src/app/vault/upload/_components/{SessionDefaultsPopover,inspector/InspectorFieldEditor}.tsx`

---

## 1. What this brief is

A founder-locked record of the licence taxonomy: what the four main classes are, what sublabels live under each, how the SET shape carries on the asset, how the engine recommends prices against this taxonomy, and where Frontfiles' editorial-platform language discipline is enforced.

This brief is build-governing. If a later directive proposes a structure that contradicts §3 (locked decisions), §4 (taxonomy architecture), or §6 (trust + governance), the directive is wrong, not the brief. The CC0-dedication paradox handling and the no-medium-restriction-in-Editorial scope decision in particular are non-negotiable v1 constraints — any drift requires an explicit revision pass on this brief, not a quiet override.

This brief is the **L1 (architecture) layer** of Phase L. The L2-L8 directives below implement against it. F1.5 tooling is **blocked at L5** until L1-L4 ratify.

---

## 2. Current-state read

### 2.1 What exists today

The flat 8-value `LicenceType` enum at `src/lib/types.ts:360-368`:

```typescript
export type LicenceType =
  | 'editorial' | 'commercial' | 'broadcast' | 'print'
  | 'digital'   | 'web'        | 'merchandise' | 'creative_commons'
```

Backed by `vault_assets.enabled_licences text[]` with a CHECK constraint listing all 8 values (`supabase/migrations/20260413230002_vault_asset_tables.sql:73-105`).

Used in: `transaction/{types,reducer,context,finalization}.ts`, `special-offer/{types,services}.ts`, `fulfilment/types.ts`, `api/special-offer/route.ts`, `vault/upload/_components/{SessionDefaultsPopover,inspector/InspectorFieldEditor}.tsx`.

### 2.2 What's structurally wrong

| Value | What it actually is | Right dimension |
|---|---|---|
| `editorial`, `commercial` | Legal use class | RIGHTS / USE |
| `broadcast`, `print`, `digital`, `web` | Distribution channel | MEDIUM (not licence) |
| `merchandise` | A subset of commercial use | RIGHTS subset |
| `creative_commons` | A licence FAMILY (CC0/CC-BY/CC-BY-NC/etc.) | METADATA layer |

Three orthogonal dimensions packed into one flat enum. The legal/trust risk surfaces sharpest at `creative_commons` — flat without a CC variant, the value tells a buyer nothing legally (CC0 = public domain, CC-BY-NC-ND = attribution + non-commercial + no-derivatives are radically different rights). Per BP-D7 + CLAUDE.md item 9 (protect terminology — provenance/rights/legal claims), this is a real exposure surface.

### 2.3 The pricing-brief mismatch (the trigger for this work)

`PRICE-ENGINE-BRIEF.md` v3 §4.6 noted "licence-class multipliers (TBD in `src/lib/types.ts` audit)" — flagged as TBD. F1 §3.1 + F1.5 §3 then assumed a 3-bucket pricing taxonomy `Social/Editorial/Campaign` and hard-prerequisited that those values exist as `LICENCE_TYPE_LABELS`. They do not. The audit step that would have caught this never closed; F1.5 cell count (252) is built on the wrong assumption.

This brief resolves the mismatch at the source: by replacing the flat 8-value taxonomy with a structured 4-class + sublabels model that pricing can read directly.

### 2.4 What does NOT exist

- No code-level `licence_class` abstraction distinct from `LicenceType`
- No CC variant column or enum
- No `pricing_cc_variants` table
- No use_tier multiplier table
- No sublabel multiplier table
- `docs/licence/` directory until this brief

---

## 3. Locked decisions

| # | Decision | Locked answer | Implication |
|---|---|---|---|
| L1 | **Main licence classes** | Four peer-level values: `editorial` · `creative_commons` · `commercial` · `advertising` | A licence asset is governed by exactly one class at any given (class, sublabel) tuple it carries; multi-select carries multiple tuples but each tuple is class-anchored |
| L2 | **Multi-select** | Yes — `vault_assets.enabled_licences` carries a SET of (class, sublabel) tuples | Creators offer the asset under multiple licences in parallel (e.g., Editorial + Commercial); buyer picks ONE tuple at checkout. Existing `enabled_licences text[]` shape preserved; only the *values* change. |
| L3 | **Schema shape (Shape A)** | `enabled_licences text[]` with **dotted `class.sublabel` entries** | Examples: `['editorial.news', 'editorial.longform', 'commercial.brand_content']`, `['creative_commons.cc_by_nc', 'editorial.documentary']`. Single column, simple queries, smallest refactor. |
| L4 | **CC pricing model** | **Absolute prices** in `pricing_cc_variants` table — NOT `base × multiplier` | CC0 = €0 (or platform admin fee TBD); CC-BY = small fee; CC-BY-NC = paid for commercial use only; etc. Per v2.2: each CC variant has one absolute price per (cc_variant[, format]). CC class does NOT consume cells in `pricing_format_defaults`. |
| L5 | **use_tier model** | Multiplier table per non-CC class — NOT a cell dimension (Path 2 from prior audit) | `pricing_use_tier_multipliers` keyed on `(class, use_tier)` — 4 use_tier values × 3 non-CC classes = 12 multipliers. Drops calibration burden 3× vs F1's original. |
| L6 | **Editorial medium restriction** | **None in v1** — Editorial-licensed asset is licensed across all media | Drops Print/Digital/Web/Broadcast as Editorial-side licence dimensions. v2 enrichment if creators ask for medium-restricted Editorial offerings. |
| L7 | **Engine return shape (α)** | `recommendPrice(asset, context) → Recommendation[]` — one per enabled class | Brief v3 §4.4 single-`Recommendation` shape replaced. Cart/offer carries the (class, sublabel) tuple selected at checkout, not the whole array. |
| L8 | **use_tier upload UI surface (γ)** | All `N classes × 4 use_tiers` prices shown at upload time | Heavy UI but transparent. Creator sees the full price matrix per enabled class. v2 enrichment may add a collapsed "default tier" affordance. |
| L9 | **CC0 + other classes** | **Warn at creator-side; do NOT block via CHECK** | CC0 dedicates the asset to the public domain, making paid licences alongside it economically pointless (anyone can use freely). Legally allowed but creator should explicitly acknowledge. UI warning + creator override required. |
| L10 | **Authority** | Creator picks enabled licences; engine recommends prices per enabled class; buyer picks one (class, sublabel) tuple at checkout. Engine is advisory; it never writes to `enabled_licences`. | Mirrors F2 (price engine authority model) — engine recommends, creator decides. |

---

## 4. Taxonomy architecture

### 4.1 Main classes (locked at L1)

| Class | Plain definition |
|---|---|
| **Editorial** | News, journalism, documentary, books/longform, op-ed/commentary, educational use. Information-dissemination context. The dominant Frontfiles use-class. |
| **Creative Commons** | Asset offered under a Creative Commons licence variant (CC0 through CC-BY-NC-ND). The variant determines what use is permitted; Frontfiles surfaces the variant verbatim, never "Creative Commons" alone. |
| **Commercial** | Revenue-adjacent use that is NOT paid promotional placement: brand-owned content, corporate communications, merchandise/packaging, internal training. |
| **Advertising** | Paid promotional placement: print ads, digital/social ads, OOH, broadcast spots, native/influencer content. Premium tier; highest rights review. |

The Commercial-vs-Advertising split is intentional and follows industry-standard editorial-rights practice. They differ in pricing tier, rights scrutiny, and (downstream) disclosure requirements (FTC native-advertising rules apply to Advertising, not all Commercial).

### 4.2 Sublabels per class (proposed; founder amends in review before L2 composes)

| Main class | Sublabels |
|---|---|
| **Editorial** | `news` · `longform` · `documentary` · `book` · `commentary` · `educational` |
| **Creative Commons** | `cc0` · `cc_by` · `cc_by_sa` · `cc_by_nc` · `cc_by_nd` · `cc_by_nc_sa` · `cc_by_nc_nd` |
| **Commercial** | `brand_content` · `corporate_communications` · `merchandise` · `internal_training` |
| **Advertising** | `print_ad` · `digital_ad` · `social_ad` · `out_of_home` · `broadcast` · `native_advertorial` · `influencer` |

**Notes on sublabel choices (v2):**

- **Editorial / `commentary` (v2; was `op_ed` in v1)** — broader than the print-newspaper-specific "op-ed"; covers opinion writing, analysis, editorial cartoons, longform takes, podcast commentary. Aligns with the platform's multi-format reality (text + audio + video creators).
- **Editorial / `longform` (v2; was `feature` in v1)** — generic disambiguation from `documentary`; kept format-agnostic (no `magazine_` prefix because longform also lives in digital essays + podcasts).
- **Editorial / `educational`** — placed under Editorial because it's information-dissemination, not revenue-generation. Some platforms split Educational off as its own peer class; v1 keeps it under Editorial for simplicity.
- **Editorial — no medium-restriction sublabels in v1** (per L6). An Editorial asset is licensed across all media. If a creator wants "print only" pricing later, that's a v2 enrichment via additional sublabels.
- **Creative Commons — full 7 variants** (locked at v2 ratification). Per founder pick on §8 #2: legal completeness over reduced cognitive load. UI labels each variant verbatim with plain-English summary (per §6.1).
- **Commercial / `corporate_communications` (v2; was `corporate` in v1)** — disambiguates from `brand_content` (marketing-side) and `internal_training` (training-specific). Captures annual reports, employee comms, executive bios, internal/external corporate-comms work.
- **Commercial — no `sponsored_editorial` sublabel.** Sponsored editorial / branded journalism is paid promotional content; FTC native-advertising guidance treats it as advertising. It belongs under Advertising → `native_advertorial`. Prior turn's draft put it under Commercial; that was wrong.
- **Advertising / `digital_ad` + `social_ad` split (v2; was `digital_social_ad` bundled in v1)** — programmatic display ads and paid-social ads are distinct products with distinct pricing models (CPM-based programmatic vs paid-social CPM/engagement). Schema reflects.
- **Advertising / `native_advertorial` + `influencer` split (v2; was `native_influencer` bundled in v1)** — native advertorial is publisher-side paid editorial-style content; influencer endorsement is creator/talent-side paid placement. Different rights structure (publisher owns native; talent licenses to brand for influencer) and different pricing model (CPM-based vs flat-fee per post).
- **Advertising sublabels are medium-anchored** because medium IS the load-bearing distinction within advertising (an OOH billboard licence and a print-ad licence price differently). Medium restriction within Advertising is appropriate; medium restriction within Editorial is not (per L6).

### 4.3 Schema shape (Shape A)

```sql
-- vault_assets table column unchanged in NAME and TYPE; values change.
enabled_licences TEXT[] NOT NULL DEFAULT '{}'

-- Updated CHECK constraint enumerates the dotted "class.sublabel" pairs.
-- L2 directive ships this migration with the precise enumeration.
ALTER TABLE vault_assets DROP CONSTRAINT vault_assets_licences_valid;

ALTER TABLE vault_assets ADD CONSTRAINT vault_assets_licences_valid CHECK (
  enabled_licences <@ ARRAY[
    -- Editorial (6)
    'editorial.news', 'editorial.longform', 'editorial.documentary',
    'editorial.book', 'editorial.commentary', 'editorial.educational',
    -- Creative Commons (7)
    'creative_commons.cc0',
    'creative_commons.cc_by', 'creative_commons.cc_by_sa',
    'creative_commons.cc_by_nc', 'creative_commons.cc_by_nd',
    'creative_commons.cc_by_nc_sa', 'creative_commons.cc_by_nc_nd',
    -- Commercial (4)
    'commercial.brand_content', 'commercial.corporate_communications',
    'commercial.merchandise', 'commercial.internal_training',
    -- Advertising (7)
    'advertising.print_ad', 'advertising.digital_ad', 'advertising.social_ad',
    'advertising.out_of_home', 'advertising.broadcast',
    'advertising.native_advertorial', 'advertising.influencer'
  ]
);
```

**Total enumerated values: 24** (6 + 7 + 4 + 7).

### 4.4 TypeScript shape

```typescript
// src/lib/licence/types.ts (NEW MODULE; L2 directive creates)

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

// Helpers
export function getClass(s: LicenceSublabel): LicenceClass {
  return s.split('.', 1)[0] as LicenceClass
}

export function getSublabelOnly(s: LicenceSublabel): string {
  return s.split('.', 2)[1]
}
```

### 4.5 Backfill mapping (L3 directive)

Existing 8-value entries map to new dotted entries as follows. Picks marked **review** require the creator to manually confirm at next vault edit (one-time migration affordance).

| Legacy value | New value | Notes |
|---|---|---|
| `editorial` | `editorial.news` | Default sublabel within Editorial; creator can add other Editorial sublabels |
| `commercial` | `commercial.brand_content` | Default sublabel within Commercial |
| `broadcast` | `advertising.broadcast` | Was structurally wrong (medium ≠ licence); reclassified to Advertising |
| `print` | (dropped from this asset's enabled set) | MEDIUM, not licence. Backfill emits a one-time creator notification: "Your asset previously offered 'print' use. Editorial-licensed assets now cover all media; if you want print-restricted Advertising specifically, enable `advertising.print_ad`." |
| `digital` | (dropped — same as `print`) | Notification suggests `advertising.digital_ad` or `advertising.social_ad` if applicable |
| `web` | (dropped — same as `print`) | Same |
| `merchandise` | `commercial.merchandise` | Direct rename |
| `creative_commons` | `creative_commons.cc_by` (**review**) | Default to CC-BY because it's the most permissive of the attribution-required variants. Backfill flags every such asset for creator review (toast on next edit; admin batch tool for review). |

**Backfill safety:** L3 dual-reads — code prefers the new value; falls back to old value during transition. The legacy 8-value enum stays in `LicenceType` until L8 cleanup (after backfill is stable in production for ≥ 30 days).

---

## 5. Pricing implications (corrigendum to F1 + F1.5; lands in L4 directive)

**v2.2 corrigendum:** §5 sections rewritten to drop `intrusion_level` from pricing dimensions per path-(1) (Stage B 2026-04-28 founder discovery; v2.2 §12 entry; cascades A through F follow). §5.0 (new) makes the pricing dimensions explicit lock-in. §5.1, §5.4, §5.5, §5.7 reflect the new shape. §5.2, §5.3, §5.6 unchanged.

### 5.0 Pricing dimensions — what does and doesn't drive price (v2.2)

**The pricing engine reads exactly these dimensions for any (format, licence) pair:**

```
final_price = format_default(format, licence_class)        # baseline cell
            × sublabel_multiplier(sublabel)                # use-type refinement
            × use_tier_multiplier(class, use_tier)         # audience size
            × exclusivity_multiplier(exclusivity_tier)     # exclusivity premium

# CC variants override — direct lookup, no multiplier chain:
if class == 'creative_commons':
    final_price = cc_variant_price(sublabel[, format])     # absolute
```

**These dimensions DO drive price** (locked v2.2):

- **`format`** — photo / illustration / infographic / vector / video / audio / text (creator-side asset shape)
- **`licence_class`** — editorial / commercial / advertising / creative_commons (use-rights category)
- **`sublabel`** — within class (e.g., `editorial.news` vs `editorial.documentary`)
- **`use_tier`** — buyer audience size (small_pub / mid_pub / major_pub / wire_syndication for editorial; per-class vocabulary per §5.3)
- **`exclusivity_tier`** — existing `EXCLUSIVE_MULTIPLIERS` per F1 §4.6
- **CC variant** — for `creative_commons` class only (absolute price per §5.4)

**These dimensions DO NOT drive price** (locked v2.2):

- **`intrusion_level` (light / standard / heavy)** — this is the creator's chosen WATERMARK INTENSITY on the public preview image (System A vocabulary per `BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` §4; defined at `src/lib/processing/profiles.ts:60-169` SEED_PROFILES). It governs **preview protection only**. The licensed file delivered to the buyer is the original, unwatermarked file. Pricing has zero structural reason to vary by the creator's preview-protection choice.
- **medium / channel / format-size** (print vs digital vs broadcast) — explicitly out of scope for Editorial v1 per L6. Advertising sublabels are medium-anchored because medium IS load-bearing within Advertising; Editorial / Commercial / CC are media-agnostic.
- **geography** — not in v1 model. v2 enrichment if creators / buyers ask for region-restricted licensing.
- **time window / reach beyond use_tier** — handled implicitly by sublabel + use_tier in v1.

**Why intrusion_level was incorrectly in pricing through v2:**

The `intrusion_level` dimension was inherited into `pricing_format_defaults` cell key from `vault_assets.intrusion_level` (a watermark-system column, present because System A's compositor needed it). The cell key was constructed without explicit founder ratification of the economic logic. The 0.7× / 1.3× ratios in `CALIBRATION-PROCESS.md` §4 Phase 3 were drift defaults; no documented economic story justified them. Founder discovery during Stage B 2026-04-28 surfaced the architectural error; v2.2 corrects it.

**`vault_assets.intrusion_level` STAYS** — it remains valid as the creator's watermark choice for preview generation (already shipped in `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`). Just no longer queried by the pricing engine.

### 5.1 Cell count and structure (v2.2)

`pricing_format_defaults` is keyed on (format, **licence_class**, currency). v1 ships EUR only.

**Excluded from cells:** Creative Commons (handled separately per L4 / §5.4); `use_tier` (handled as multiplier per L5 / §5.3); `intrusion_level` (per §5.0 — not a pricing dimension).

```
Cells = 7 formats × 3 classes (editorial, commercial, advertising) × 1 currency = 21
```

That's the v2.2 founder calibration target — down from v2's 63 (and from F1.5's original 252).

**Editorial-only v1 scope** (per Stage B 2026-04-28 session log §3.1/3.2; commercial + advertising deferred to v2): **7 cells**.

### 5.2 Sublabel multipliers

`pricing_sublabel_multipliers` keyed on `LicenceSublabel`. CC variants are NOT in this table (they're absolute, per §5.4). Editorial/Commercial/Advertising sublabels are multipliers off their class's base price.

```
Editorial × 6 sublabels = 6 multipliers
Commercial × 4 sublabels = 4 multipliers
Advertising × 7 sublabels = 7 multipliers   (v2; was 5 in v1)
Total: 17 sublabel multipliers              (v2; was 15 in v1)
```

Founder calibrates each as a single number (e.g., `editorial.news = 1.0` anchor; `editorial.longform = 1.2`; `editorial.documentary = 1.4`; etc.).

**v1 editorial-only scope per Stage B**: 6 editorial sublabel multipliers; commercial + advertising rows stay in CSV shape as forward-compat placeholders (per L2 schema CHECK accepting both).

### 5.3 use_tier multipliers (L5)

`pricing_use_tier_multipliers` keyed on `(licence_class, use_tier)`. CC class excluded.

```
3 classes × 4 use_tier values = 12 multipliers
```

Per-class use_tier vocabulary differs (per prior audit Path 1 → Path 2 transition):

| use_tier code | Editorial | Commercial | Advertising |
|---|---|---|---|
| `tier_1` | small_pub | small_business | local |
| `tier_2` | mid_pub | mid | regional |
| `tier_3` | major_pub | enterprise | national |
| `tier_4` | wire_syndication | fortune500 | global |

UI displays the right vocabulary based on selected class (the codes are abstract; the labels render contextually).

**v1 editorial-only scope per Stage B**: 4 editorial use_tier multipliers; commercial + advertising rows as forward-compat placeholders.

### 5.4 CC variants (absolute price table) (v2.2)

`pricing_cc_variants` keyed on `(cc_variant, format)` (v2.2; intrusion_level dropped per §5.0). v1 ships EUR only.

```
v2 (pre-v2.2):  7 variants × 7 formats × 3 intrusions × 1 currency = 147 cells absolute
v2.2:           7 variants × 7 formats × 1 currency               = 49 cells absolute (if varying by format)
v1 recommended: 7 variants flat per variant                       = 7 cells absolute
```

Many cells will be `0` (e.g., CC0 across all formats = free) or repeat (e.g., CC-BY may carry the same admin fee across formats). Practical calibration burden is much lower than 49 — likely ~10-15 distinct values if varying by format, with the rest derivable by ratio.

**Open question for the L4 corrigendum directive:** whether CC pricing varies by `format` at all, or is just per-variant flat. If flat per-variant: 7 absolute prices total. Founder decides at L4 (recommended: flat for v1).

### 5.5 Total founder calibration burden (v2.2)

| Table | Values to fill (v2.2) | v2 baseline | Δ |
|---|---|---|---|
| `pricing_format_defaults` (cells; full scope) | 21 | 63 | -42 |
| `pricing_format_defaults` (cells; v1 editorial-only scope per Stage B) | **7** | n/a | new scope |
| `pricing_sublabel_multipliers` | 17 (unchanged) | 17 | — |
| `pricing_sublabel_multipliers` (v1 editorial-only) | **6** | n/a | new scope |
| `pricing_use_tier_multipliers` | 12 (unchanged) | 12 | — |
| `pricing_use_tier_multipliers` (v1 editorial-only) | **4** | n/a | new scope |
| `pricing_cc_variants` (flat per variant — recommended) | 7 (unchanged) | 7 | — |
| `pricing_cc_variants` (varying by format) | up to 49 (~10-15 distinct) | 147 (~20-30 distinct) | -98 |
| `EXCLUSIVE_MULTIPLIERS` (existing) | 3 (unchanged) | 3 | — |
| **Total v2.2 full scope (CC flat)** | **60** | 102 | -42 |
| **Total v2.2 v1 editorial-only scope** | **~31** | n/a | new scope |
| **Total v2.2 full scope (CC by format)** | **~80** | ~122-242 | -42 to -162 |

**Recommend CC-flat for v1.** ~31 calibration values for v1 editorial-only scope is highly tractable (was ~60 under v2 with intrusion in scope). Path-(1) cascade (cascade A–F per Stage B 2026-04-28 follow-on plan composed 2026-04-29) implements this reduction.

**v1 editorial-only Stage B status (post Phase α.3, per `docs/pricing/calibration/CANONICAL-SOURCES.md` §11):** all 7 `format_defaults` editorial cells calibrated and ready for L5 regeneration drop-in (photo €220 HIGH; illustration €200 MEDIUM-HIGH; infographic €280 MEDIUM; vector €150 MEDIUM; video €300 MEDIUM-HIGH; audio €130 MEDIUM-HIGH; text €350 HIGH).

### 5.6 Engine return shape (L7 / α)

```typescript
type AssetRecommendations = {
  asset_id: string
  generated_at: ISODateTime
  recommendations: Recommendation[]   // one per enabled licence_class on the asset
}

// Recommendation shape per F1 §4.4 stays the same per-class; the asset-level wrapper changes.
```

Each `Recommendation` carries:
- `licence_class` (NEW field — which class this recommendation targets)
- `recommended_cents` per (class, default_sublabel, default_use_tier)
- `basis_breakdown` per F1
- A `tier_matrix` field with the 4 use_tier prices (display-only; surfaces in upload UI per L8 / γ)

L4 corrigendum locks the precise shape change against F1 §4.4. (L4b BRIEF v4 — PR #35, merged 8d95b89 — already locked the `Recommendation[]` per-asset wrapper; v2.2 path-(1) is dimension-only and does not affect the wrapper shape.)

### 5.7 Buyer-side at checkout (v2.2)

Buyer picks (licence_class, sublabel, use_tier, exclusivity_tier). Final price computed at checkout:

```
final_price = format_default(format, class)
            × sublabel_multiplier(sublabel)
            × use_tier_multiplier(class, use_tier)
            × exclusivity_multiplier(exclusivity_tier)

# CC variants override — direct lookup, no multiplier chain:
if class == 'creative_commons':
    final_price = cc_variant_price(sublabel[, format])  # absolute
```

The multiplier chain is the same shape F1's existing model uses; `intrusion_level` is dropped from `format_default()` lookup per §5.0. The cell-vs-multiplier split otherwise unchanged.

---

## 6. Trust + governance

The taxonomy's load-bearing property is **legal precision**. The four guards below are non-negotiable.

### 6.1 "Creative Commons" alone is never displayed

Per BP-D7 + CLAUDE.md item 9. UI always renders the variant: `CC BY-NC 4.0`, not `Creative Commons`. The bare phrase tells a buyer nothing legally; permitting it in any creator-facing or buyer-facing surface re-introduces the legal exposure this brief eliminates.

The buyer at checkout sees the full variant string + a one-line plain-English summary (e.g., "CC BY-NC 4.0 — attribution required, non-commercial use only").

### 6.2 CC0 + other classes — warn, don't block (L9)

A CC0-dedicated asset is in the public domain. Anyone can use it freely. The creator may also offer paid licences alongside (legitimate dual-licensing pattern), but the paid licences are economically pointless because the CC0 dedication makes the asset free under any use.

**v1 behavior:**
- Default-enable: if creator enables `creative_commons.cc0`, all other licence-class toggles default OFF
- Override: creator can manually re-enable other classes; UI shows a warning: "CC0 dedicates this asset to the public domain. Buyers can use it for free under CC0 regardless of any paid licences you offer. Continue?"
- No CHECK constraint enforcing exclusion — the override is intentional

### 6.3 CC-BY-NC + Commercial / Advertising IS allowed (NOT a contradiction)

Dual-licensing CC-BY-NC for non-commercial users + a paid licence for commercial/advertising users is standard practice (e.g., open-source software does this routinely). Frontfiles allows it. The CHECK constraint MUST NOT reject this combination.

(Prior audit's claim that CC-NC + Commercial was contradictory was wrong; retracted at L1.)

### 6.4 Legal-precision language discipline

Per BP-D7 audit:
- Allowed: `editorial use`, `commercial use`, `advertising use`, `non-commercial use`, `attribution required`, `share-alike`, `no derivatives`
- Forbidden: `certified licence`, `verified rights`, `fair use guaranteed` (overclaims), `Creative Commons` alone (per §6.1), `royalty-free` (creates ambiguity vs CC0; use specific language instead)

UI surfacing follows the existing pricing engine pattern (per `PRICE-ENGINE-BRIEF.md` v3 §7.1) — recommendations are advisory; rights are creator-stated; engine never asserts authority over rights.

---

## 7. Phase L sequencing

```
Phase L — Licence Taxonomy Refactor (8 directives)

  L1 — This brief (LICENCE-TAXONOMY-BRIEF) — locks taxonomy + schema + pricing model
       • Output: docs/licence/LICENCE-TAXONOMY-BRIEF.md (this document)
       • Founder ratifies before any L2+ work composes
       • Resolves §3 locked decisions; surfaces §8 open decisions

  L2 — Schema migration (additive only)
       • Update CHECK constraint on vault_assets.enabled_licences with new dotted values
       • Add pricing_cc_variants table (absolute CC prices)
       • Add pricing_sublabel_multipliers table
       • Add pricing_use_tier_multipliers table
       • Reversible (DOWN drops new tables + restores old CHECK)
       • Touches: supabase/migrations/, src/lib/licence/ (new module: types + helpers)
       • Tests: schema constraints; helper functions; type exhaustiveness

  L3 — Backfill (transitional)
       • Backfill existing 8-value enabled_licences to new dotted shape per §4.5
       • Dual-read in code: prefer new values, fall back to old during transition
       • LicenceType enum keeps both old and new during this phase
       • Creator notification on assets requiring review (CC-default + dropped media values)
       • Touches: scripts/migrate/backfill-licences.ts, transaction/, special-offer/, fulfilment/

  L4 — F1 + F1.5 corrigenda
       • F1 §3.1: licence_class is `editorial | commercial | advertising` (3, not 3 with CC); CC handled separately
       • F1 §4.1: schema additions for pricing_cc_variants, pricing_sublabel_multipliers, pricing_use_tier_multipliers
       • F1 §4.4: Recommendation shape — wrap in AssetRecommendations with array of per-class entries
       • F1.5 §3.2: cell count math (v2.2: 21, not 63 or 252)
       • F1.5 §6.1, §7.1: new CSV templates reflect new dimensions (no intrusion_level column per v2.2)
       • Founder ratifies before L5 tooling resumes

  L5 — F1.5 tooling RESUMES (was blocked here pending L1-L4)
       • Bootstrap script generates new CSV set per v2.2 shape:
           - format_defaults_v1_eur.csv (21 rows full scope; 7 rows v1 editorial-only)
           - sublabel_multipliers_v1.csv (17 rows full; 6 v1)
           - use_tier_multipliers_v1.csv (12 rows full; 4 v1)
           - cc_variants_v1_eur.csv (7 rows for flat CC variant pricing)
       • Converter script emits SQL seed for all four tables
       • Templates + process notes per F1.5
       • Founder calibration pass (~31 v1 editorial-only values; ~60 full scope; hours not days)

  L6 — F2-F11 (engine + adapters + UI) — ships against new taxonomy
       • F2 schema migration absorbs L2 + L4 changes
       • F3-F11 build on Recommendation[] return shape (α)
       • Tests reference new CHECK enumeration; old values rejected

  L7 — UI updates (SessionDefaultsPopover + InspectorFieldEditor + new buyer checkout)
       • Multi-select picker per main class with sublabel pickers per enabled class
       • Tier matrix display per γ (all N × 4 prices visible at upload)
       • CC0 warning per L9
       • CC variant display per §6.1

  L8 — LicenceType cleanup (after backfill stable for ≥ 30 days)
       • Drop legacy 8-value enum
       • Drop dual-read fallback
       • Update remaining LicenceType type-only references to LicenceSublabel
       • Verify no production assets retain legacy values
       • Reversible if backfill issues surface
```

**Phase L runs in parallel with Phases B (worker), C (UI rebuild — already on main via PR #15 + V4 redesign), E (AI pipeline — at E6.A/B/C in main).**

**Phase F is gated on L1-L4.** F1.5 tooling cannot ship until the licence taxonomy is locked and F1+F1.5 reflect the new model. F1.5 → F2 → F3+ all sit downstream of L4 ratification.

**Realistic calendar: L1-L4 = 1 week of audit-first composition + founder ratification. L5 founder calibration = ~hours under v2.2 v1-editorial-only scope (was 6-10 hr under v2). L6-L8 = ongoing through F-track ship.**

---

## 8. Open decisions still pending

These do NOT block L1 ratification but must be resolved in their respective downstream directives:

1. **Sublabel naming review** (§4.2) — founder may amend any of the 24 proposed values before L2 composes. Naming-only change; no architectural impact.
2. **CC variant curation vs full 7** (§4.2) — full 7 is proposed; curated 3-4 is alternative for cognitive-load reduction. Decided at L2.
3. **CC pricing shape — flat per variant or vary by `format`?** (§5.4; v2.2-updated) — recommend flat for v1 (7 prices); v2 enrichment if data shows differentiation needed. Decided at L4.
4. **use_tier vocabulary per class** (§5.3) — proposed as `small_pub/mid_pub/major_pub/wire_syndication` for editorial, `small_business/mid/enterprise/fortune500` for commercial, `local/regional/national/global` for advertising. Founder amends at L4.
5. **Buyer-side use_tier picker UX** — at checkout, how does the buyer indicate their tier? (Dropdown? Inferred from buyer profile?) Decided in L7 UI directive.
6. **Backfill defaults for legacy `creative_commons` assets** (§4.5) — proposed default `cc_by` with creator review flag. Founder amends at L3.
7. **`pricing_cc_variants` numerical values** — founder calibration in L5.
8. **Sublabel multiplier values + use_tier multiplier values** — founder calibration in L5.
9. **Whether to drop `LicenceType` legacy enum entirely at L8 or keep it as a backward-compat alias** — decided at L8 based on backfill stability.
10. **Social licence (v2.2-pending L1 v2.1 amendment)** — per Stage B 2026-04-28 §3.2, v1 scope = Editorial + CC + Social. Social licence draft composed 2026-04-28 (`docs/licence/SOCIAL-LICENCE-SPEC-V1-DRAFT.md`); 4 outstanding corrections + architectural placement lock (sublabel under editorial vs new top-level class) pending founder decision before L1 v2.1 amendment composes.

---

## 9. Approval gate

**Two-stage approval (matches PRICE-ENGINE-BRIEF v3 §10 + AI-PIPELINE-BRIEF v2 §10 patterns):**

1. **Stage A — This brief (L1)** — high-level taxonomy + schema model + pricing implications + sequencing. Locks the 10 decisions in §3 and the architecture in §4-§7. Founder ratifies before any L2+ work composes.
2. **Stage B — L4 corrigenda** — F1 + F1.5 changes, sublabel naming amendments, CC pricing shape decision. Founder ratifies before L5 tooling composes.

Founder's options at Stage A:
- **Approve** — L2 directive composes against this brief.
- **Approve with corrections** — name the section(s) that need adjustment; revise; founder approves the revision.
- **Revise before approval** — substantial concerns; redraft.
- **Reject** — kill or restart; this brief was wrong about taxonomy architecture, not just sublabels.

---

## 10. Don't-do list

To keep subsequent sessions from drifting:

1. **Don't display "Creative Commons" alone as a licence value anywhere.** Per §6.1 — always with the variant. UI/copy/audit/exports all comply.
2. **Don't enforce a CHECK constraint rejecting CC-BY-NC + Commercial (or + Advertising) combinations.** Per §6.3 — legitimate dual-licensing. Any directive proposing such a CHECK is wrong.
3. **Don't silently exclude CC0 + other classes.** Per §6.2 + L9 — warn, allow override. The exclusion-by-default at the UI layer is a creator-side guard, not a schema CHECK.
4. **Don't conflate `licence_class`, USE, MEDIUM, and LICENCE FAMILY in any new code.** The whole point of this brief is decomposition. Any future schema column or enum that re-mixes them is wrong.
5. **Don't bypass the L4 corrigenda before L5.** F1.5 tooling cannot start until F1 + F1.5 docs reflect the new taxonomy. Composing tooling against the old model is wasted work.
6. **Don't introduce per-licence-tier base price overrides on `vault_assets`.** Use multipliers (per L5 + F1 §4.6 multiplier model). Schema change for per-licence overrides is a separate decision out of v1 scope.
7. **Don't treat "Educational" as a top-level peer class in v1.** It's a sublabel of Editorial (per §4.2). v2 may promote it if creators demand.
8. **Don't ship engine code from this brief alone.** L2 → L3 → L4 must compose in order. Code skeletons that precede L4 ratification (or L5 tooling that precedes calibration) skip resolution of §8 open decisions.
9. **Don't preserve the legacy 8-value `LicenceType` after L8.** It's tech debt by design — kept during L3-L7 only for dual-read backfill safety.
10. **Don't expose engine cost (per BP-D7 + F1) or licence-rights certifications (per BP-D7) in any creator- or buyer-facing copy.** Trust language stays advisory: "Recommended licence pricing", "Suggested CC variant", never "Verified" / "Certified" / "Authoritative".
11. **Don't introduce a `media[]` column.** v1 explicitly drops the medium dimension as a separate column (per §2.2 + L6). Medium is encoded in Advertising sublabels only; Editorial/Commercial/CC are media-agnostic.
12. **Don't require `licence_class` as a stored column on `vault_assets`.** It's derived from `enabled_licences` entries via `getClass()` helper. Storing it separately introduces sync risk.
13. **Don't re-introduce `intrusion_level` (or any watermark-related dimension) into pricing tables.** Per v2.2 §5.0: watermark intensity is creator preview-protection only, not a pricing input. The licensed file delivered to the buyer is the original, unwatermarked file. Pricing has zero structural reason to vary by the creator's preview-protection choice. `vault_assets.intrusion_level` stays as a watermark-system column; pricing engine MUST NOT query it.
14. **Don't introduce new pricing dimensions (geography, medium, time-window, reach) without an explicit founder ratification + new economic-story doc.** The current pricing dimension set per §5.0 is locked at v2.2. v2 enrichment may add geography or medium-restriction; each addition requires its own L1 amendment with explicit economic justification, NOT a quiet schema add.

---

## 11. References

- Source mismatch (the trigger for this work): `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` §3 hard-prerequisite (assumed `Social/Editorial/Campaign` in `LICENCE_TYPE_LABELS`; verification step found drift)
- Existing flat enum: `src/lib/types.ts:360-378` (`LicenceType`)
- Existing multiplier pattern (model for §5): `src/lib/types.ts:381-397` (`EXCLUSIVE_MULTIPLIERS`)
- Existing schema: `supabase/migrations/20260413230002_vault_asset_tables.sql:73-105` (`enabled_licences text[]` + CHECK)
- Sister architecture (price engine): `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 + `PRICE-ENGINE-ARCHITECTURE.md` (F1) + `PRICE-ENGINE-CALIBRATION-V1.md` (F1.5)
- Trust language posture: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` (BP-D7)
- Standing posture: root `CLAUDE.md` (item 9 — protect terminology; item 14 — red-team for broken mappings)
- **v2.2 path-(1) anchors:**
  - `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` §4 (System A vocabulary cross-system observations; intrusion_level is watermark, not pricing)
  - `src/lib/processing/profiles.ts:60-169` (SEED_PROFILES — source of truth for `intrusionLevel: 'light' | 'standard' | 'heavy'` watermark vocabulary)
  - `supabase/migrations/20260417100001_watermark_profile_enums.sql`, `20260417100002_watermark_profile_tables.sql`, `20260417100003_watermark_profile_indexes.sql` (already-shipped watermark layer; `vault_assets.intrusion_level` STAYS per §5.0)
  - `docs/pricing/calibration/STAGE-B-SESSION-LOG-2026-04-28.md` (founder discovery + v1 scope decisions: Editorial + CC + Social only; commercial + advertising deferred to v2)
  - `docs/pricing/calibration/CANONICAL-SOURCES.md` (Phase α — 5-tier authority hierarchy + §11 path-(1)-ready 7-cell editorial spec drop-in)
- Future:
  - `docs/licence/L2-DIRECTIVE.md` (schema migration + new module — composed PR #33; v2.2 cascade B = narrow comment amendment per L2 §11 don't-do #9)
  - `docs/licence/L3-DIRECTIVE.md` (backfill + dual-read — TBD)
  - `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` (F1 v4 corrigendum — cascade C; v3 → v4 drops `intrusion_level` from `pricing_format_defaults` + `pricing_platform_floors` schemas + indexes). Replaces the v2-era reference to a separate `F1-CORRIGENDUM-*` file; L4a PR #34 confirmed the corrigenda land directly in F1/F1.5 docs, not a dedicated corrigendum doc.
  - `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` (F1.5 v3 corrigendum — cascade C; v2 → v3 drops intrusion column from CSV schemas in §6 / §6A / §6B)
  - L1 v2.1 amendment (social licence) — pending founder resolution of 4 corrections + placement lock per `docs/licence/SOCIAL-LICENCE-SPEC-V1-DRAFT.md`

---

## 12. Revision history

### v2.2 — 2026-04-29 (architectural change — drop `intrusion_level` from pricing dimension)

**Composition note:** This v2.2 entry was originally composed 2026-04-29 evening on the working tree of branch `docs/pricing-stage-b-editorial-format-defaults`; the working-tree composition was lost on 2026-04-30 during a runbook git operation that overwrote unstaged changes. The current entry is **reconstructed 2026-04-30 from session-context recall** — substantive content (cascade impact table, §5.0 dimension lock, §10 don't-do additions) preserved verbatim; minor phrasing in §11 references and v2.2 reasoning narrative may differ from the original. Founder review against intent recommended before merge.

**Trigger:** Founder discovery during Stage B 2026-04-28 calibration session. While deriving editorial cells under v2's 7×3×3=63 schema, founder asked "what's the difference between light, standard and heavy?" Audit revealed `intrusion_level` was inherited into `pricing_format_defaults` cell key from System A watermark vocabulary (per `BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` §4; `src/lib/processing/profiles.ts:60-169` SEED_PROFILES). Watermark intensity governs preview protection only; the licensed file delivered to the buyer is the original (unwatermarked); pricing has zero structural reason to vary by the creator's preview-protection choice. Founder verdict: "watermark has nothing to do with the suggested price for the asset."

**Decision:** Path (1) — drop `intrusion_level` from pricing entirely. Alternative paths considered:
- Path (2) repurpose dimension to "use intrusion" — required new data source (buyer-side picker / creator-declared field) which is its own UX + data-model decision. Deferred.
- Path (3) keep with watermark semantic + add economic story — rejected per founder ("that's stupid"). Watermark and pricing are orthogonal concerns.

**Cascade impact (this is amendment A; cascades B-F follow per Stage B 2026-04-28 follow-on plan composed 2026-04-29):**

| # | Section | Change |
|---|---|---|
| 1 | §5.0 (NEW) | Add explicit "Pricing dimensions — what does and doesn't drive price" section; locks the 6 dimensions that DO drive price + the 4 that don't (intrusion_level / medium / geography / time-window-or-reach beyond use_tier) |
| 2 | §5.1 | Cell formula: 7 × 3 × 3 = 63 → **7 × 3 = 21**. Cell key: (format, intrusion_level, licence_class, currency) → (format, licence_class, currency). v1 editorial-only Stage B scope = **7 cells** |
| 3 | §5.4 | CC variants key: (cc_variant, format, intrusion_level) → (cc_variant, format). Cell count if varying by format: 147 → **49**. v1 flat-per-variant unchanged at 7 |
| 4 | §5.5 | Calibration burden table rewritten: format_defaults full scope 63 → 21 (v1 ed-only = 7); CC by format 147 → 49; total v2.2 full scope CC-flat 102 → **60**; total v1 editorial-only scope = **~31** |
| 5 | §5.7 | Final price formula: drop intrusion arg from `format_default()` lookup |
| 6 | §10 | New don't-do #13 (don't re-introduce intrusion as pricing dimension) + #14 (don't add new pricing dimensions without explicit founder ratification + economic-story doc) |
| 7 | §11 | Add references to CANONICAL-SOURCES.md (Phase α composition), STAGE-B-SESSION-LOG, watermark audit doc, profiles.ts source-of-truth, and already-shipped watermark migrations |
| 8 | §12 | This entry |
| 9 | Top status block | v2.2 status + dating |

**Sections unchanged in v2.2:** §1 (purpose), §2 (current state), §3 (locked decisions L1-L10 — intrusion was never a top-level locked decision; it was a downstream cell-key choice that drifted in via watermark vocabulary), §4 (taxonomy + sublabels), §5.2 (sublabel multipliers — 17 unchanged; v1 editorial-only = 6), §5.3 (use_tier multipliers — 12 unchanged; v1 editorial-only = 4), §5.6 (engine return shape — Recommendation didn't reference intrusion; L4b BRIEF v4 wrapper unaffected), §6 (trust + governance), §7 (sequencing — minor edits to L4/L5 estimates reflecting new shape), §8 (open decisions — added #10 social licence pending), §9 (approval gate).

**Stage B Phase α companion artifact:** `docs/pricing/calibration/CANONICAL-SOURCES.md` (composed 2026-04-29 in same session) — 5-tier source authority hierarchy (1A direct rate cards → 1B authoritative-but-no-public-tariff → 2 published commercial rates → 3 stock floor → 4 heuristic); per-format source registry; EU collecting societies cross-reference (VG Bild-Kunst, GEMA, SACEM, ALCS, VG Wort, etc.); §11 path-(1)-ready cell spec for the 7 editorial cells (photo €220, illustration €200, infographic €280, vector €150, video €300, audio €130, text €350).

**Already-shipped watermark layer (no migration action needed):** `vault_assets.intrusion_level` + `watermark_profiles` + `watermark_intrusion_level` enum + indexes already landed in `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`. These are correct System A surface; cascade B-F do NOT touch them. `vault_assets.intrusion_level` STAYS as a watermark-system column; pricing engine MUST NOT query it.

**Cascade sequencing (post-v2.2 ratification):**
- **Cascade A** — this amendment (L1 v2.2)
- **Cascade B** — L2 directive amendment (NARROW: L2 only defines `pricing_cc_variants`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers` per L2 §11 don't-do #9; cascade B = drop `(format, intrusion)` speculation from L2 §6.2 line 206 comment; tighten §11 don't-do #9; ~10 min)
- **Cascade C** — L4a F1 v4 + F1.5 v3 corrigenda (drop intrusion_level from `pricing_format_defaults` + `pricing_platform_floors` schemas + indexes; F1.5 CSV schemas drop intrusion column; ~30 min). L4b BRIEF v4 unaffected (`Recommendation[]` shape is taxonomy-driven, not intrusion-driven; no L4b corrigendum).
- **Cascade D** — L5 tooling rebuild (regenerate 5 CSVs without intrusion column; v1 fill scope is editorial-only ~31 cells, not 162; tests update; CALIBRATION-PROCESS.md §2/§4/§6 rewrite; ~45 min)
- **Cascade E** — DEFERRED. Original opener listed "pricing engine TypeScript update" but that work is downstream of F2 (schema migration) + F3 (`format_defaults` adapter), neither of which exists yet (`src/lib/pricing/` does not exist; no `pricing_*` migrations). Re-evaluate after F2 + F3 ship against cascade-D-regenerated CSVs.
- **Cascade F** — drop reverted format_defaults CSV; populate 7-row CSV from CANONICAL-SOURCES.md §11 spec values (~15 min)

### v2 — 2026-04-28 (sublabel-naming corrections; no architectural change)

Post-ratification audit of v1 surfaced five sublabel-naming concerns. Founder delegated the resolution call ("you decide the best"); all 5 amendments applied. Sublabel count: 22 → 24. Architectural locks in §3 unchanged.

| # | v1 | v2 | Why |
|---|---|---|---|
| 1 | `editorial.op_ed` | `editorial.commentary` | "Op-ed" is print-newspaper-specific; "commentary" matches the platform's multi-format reality (text + audio + video creators). Broader and less era-specific. |
| 2 | `editorial.feature` | `editorial.longform` | Disambiguates from `documentary` (both were longform); kept format-agnostic (no `magazine_` prefix because longform also lives in digital essays + podcasts). |
| 3 | `commercial.corporate` | `commercial.corporate_communications` | "Corporate" alone overlapped with `brand_content` and `internal_training`. Industry term `corporate_communications` captures annual reports, employee comms, executive bios. |
| 4 | `advertising.digital_social_ad` | `advertising.digital_ad` + `advertising.social_ad` (split) | Programmatic display and paid-social are distinct products with distinct pricing (CPM-based programmatic vs paid-social CPM/engagement). Schema reflects. |
| 5 | `advertising.native_influencer` | `advertising.native_advertorial` + `advertising.influencer` (split) | Publisher-side native advertorial and creator/talent-side influencer have different rights structure (publisher-owned vs talent-licensed) and pricing model (CPM-based vs flat-fee per post). |

**Sections touched in v2:** §4.2 (sublabel table) · §4.3 (CHECK enumeration) · §4.4 (TypeScript types) · §3 (L3 row example) · §5.2 (sublabel multiplier count: 15 → 17) · §5.5 (total calibration: ~100 → ~102) · §12 (this entry).

**Sections unchanged:** §1, §2, §3 (other rows), §4.1, §4.5 (backfill mapping — none of the legacy 8 values map to v2-renamed entries), §5.1 (cell count 63 unchanged), §5.3, §5.4, §5.6, §5.7, §6, §7 (sequencing), §8 (open decisions; #1 closed by v2), §9, §10, §11.

### v1 — 2026-04-28 (initial composition)

Composed after audit-first review of `LicenceType` enum drift surfaced during F1.5 tooling pre-flight. Found three orthogonal dimensions (USE/MEDIUM/LICENCE FAMILY) packed into one flat enum, plus pricing-brief assumption mismatch (`Social/Editorial/Campaign` not in code). Resolved via 4-class peer model + sublabels + multi-select. Founder picked α (Recommendation[] per asset), γ (full N × 4 tier matrix at upload), ε (no medium restriction in Editorial v1). Three retractions applied from prior audit pass: CC-NC + Commercial NOT a contradiction; Sponsored editorial moved from Commercial to Advertising (→ `native_influencer`); CC pricing shifted from base × multiplier to absolute table.

---

End of licence taxonomy brief (L1 v2.2, 2026-04-29).
