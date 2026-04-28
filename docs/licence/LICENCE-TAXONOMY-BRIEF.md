# Frontfiles Licence Taxonomy — Architecture Brief (L1)

**Status:** DRAFT — awaiting founder ratification before any L2+ directive composes
**Date:** 2026-04-28
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
| L3 | **Schema shape (Shape A)** | `enabled_licences text[]` with **dotted `class.sublabel` entries** | Examples: `['editorial.news', 'editorial.feature', 'commercial.brand_content']`, `['creative_commons.cc_by_nc', 'editorial.documentary']`. Single column, simple queries, smallest refactor. |
| L4 | **CC pricing model** | **Absolute prices** in `pricing_cc_variants` table — NOT `base × multiplier` | CC0 = €0 (or platform admin fee TBD); CC-BY = small fee; CC-BY-NC = paid for commercial use only; etc. Each CC variant has one absolute price per (format, intrusion). CC class does NOT consume cells in `pricing_format_defaults`. |
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
| **Editorial** | `news` · `feature` · `documentary` · `book` · `op_ed` · `educational` |
| **Creative Commons** | `cc0` · `cc_by` · `cc_by_sa` · `cc_by_nc` · `cc_by_nd` · `cc_by_nc_sa` · `cc_by_nc_nd` |
| **Commercial** | `brand_content` · `corporate` · `merchandise` · `internal_training` |
| **Advertising** | `print_ad` · `digital_social_ad` · `out_of_home` · `broadcast` · `native_influencer` |

**Notes on sublabel choices:**

- **Editorial / `educational`** — placed under Editorial because it's information-dissemination, not revenue-generation. Some platforms split Educational off as its own peer class; v1 keeps it under Editorial for simplicity.
- **Editorial — no medium-restriction sublabels in v1** (per L6). An Editorial asset is licensed across all media. If a creator wants "print only" pricing later, that's a v2 enrichment via additional sublabels.
- **Creative Commons — full 7 variants** (proposed). Curated 3-4 (e.g., CC0 + CC-BY + CC-BY-NC) is an alternative; founder picks. Full 7 is more cognitive load but more legally accurate.
- **Commercial — no `sponsored_editorial` sublabel.** Sponsored editorial / branded journalism is paid promotional content; FTC native-advertising guidance treats it as advertising. It belongs under Advertising → `native_influencer`. Prior turn's draft put it under Commercial; that was wrong.
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
    'editorial.news', 'editorial.feature', 'editorial.documentary',
    'editorial.book', 'editorial.op_ed', 'editorial.educational',
    -- Creative Commons (7)
    'creative_commons.cc0',
    'creative_commons.cc_by', 'creative_commons.cc_by_sa',
    'creative_commons.cc_by_nc', 'creative_commons.cc_by_nd',
    'creative_commons.cc_by_nc_sa', 'creative_commons.cc_by_nc_nd',
    -- Commercial (4)
    'commercial.brand_content', 'commercial.corporate',
    'commercial.merchandise', 'commercial.internal_training',
    -- Advertising (5)
    'advertising.print_ad', 'advertising.digital_social_ad',
    'advertising.out_of_home', 'advertising.broadcast',
    'advertising.native_influencer'
  ]
);
```

**Total enumerated values: 22** (6 + 7 + 4 + 5).

### 4.4 TypeScript shape

```typescript
// src/lib/licence/types.ts (NEW MODULE; L2 directive creates)

export type LicenceClass = 'editorial' | 'creative_commons' | 'commercial' | 'advertising'

export type LicenceSublabel =
  // Editorial
  | 'editorial.news' | 'editorial.feature' | 'editorial.documentary'
  | 'editorial.book' | 'editorial.op_ed' | 'editorial.educational'
  // Creative Commons
  | 'creative_commons.cc0'
  | 'creative_commons.cc_by' | 'creative_commons.cc_by_sa'
  | 'creative_commons.cc_by_nc' | 'creative_commons.cc_by_nd'
  | 'creative_commons.cc_by_nc_sa' | 'creative_commons.cc_by_nc_nd'
  // Commercial
  | 'commercial.brand_content' | 'commercial.corporate'
  | 'commercial.merchandise' | 'commercial.internal_training'
  // Advertising
  | 'advertising.print_ad' | 'advertising.digital_social_ad'
  | 'advertising.out_of_home' | 'advertising.broadcast'
  | 'advertising.native_influencer'

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
| `digital` | (dropped — same as `print`) | Notification suggests `advertising.digital_social_ad` if applicable |
| `web` | (dropped — same as `print`) | Same |
| `merchandise` | `commercial.merchandise` | Direct rename |
| `creative_commons` | `creative_commons.cc_by` (**review**) | Default to CC-BY because it's the most permissive of the attribution-required variants. Backfill flags every such asset for creator review (toast on next edit; admin batch tool for review). |

**Backfill safety:** L3 dual-reads — code prefers the new value; falls back to old value during transition. The legacy 8-value enum stays in `LicenceType` until L8 cleanup (after backfill is stable in production for ≥ 30 days).

---

## 5. Pricing implications (corrigendum to F1 + F1.5; lands in L4 directive)

### 5.1 Cell count and structure

`pricing_format_defaults` is keyed on (format, intrusion_level, **licence_class**, currency). v1 ships EUR only.

**Excluded from cells:** Creative Commons (handled separately per L4 / §5.4); use_tier (handled as multiplier per L5 / §5.3).

```
Cells = 7 formats × 3 intrusion_levels × 3 classes (editorial, commercial, advertising) × 1 currency = 63
```

That's the v1 founder calibration target — down from F1.5's original 252 by 4x.

### 5.2 Sublabel multipliers

`pricing_sublabel_multipliers` keyed on `LicenceSublabel`. CC variants are NOT in this table (they're absolute, per §5.4). Editorial/Commercial/Advertising sublabels are multipliers off their class's base price.

```
Editorial × 6 sublabels = 6 multipliers
Commercial × 4 sublabels = 4 multipliers
Advertising × 5 sublabels = 5 multipliers
Total: 15 sublabel multipliers
```

Founder calibrates each as a single number (e.g., `editorial.news = 1.0` anchor; `editorial.feature = 1.2`; `editorial.documentary = 1.4`; etc.).

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

### 5.4 CC variants (absolute price table)

`pricing_cc_variants` keyed on `(cc_variant, format, intrusion_level)`. v1 ships EUR only.

```
7 CC variants × 7 formats × 3 intrusion_levels × 1 currency = 147 cells absolute
```

But many cells will be `0` (e.g., CC0 across all formats/intrusions = free) or repeat (e.g., CC-BY may carry the same admin fee across formats). Practical calibration burden is much lower than 147 — likely ~20-30 distinct values, with the rest derivable by ratio.

**Open question for the L4 corrigendum directive:** whether CC pricing varies by (format, intrusion) at all, or is just per-variant flat. If flat per-variant: 7 absolute prices total. Founder decides at L4.

### 5.5 Total founder calibration burden

| Table | Values to fill |
|---|---|
| `pricing_format_defaults` (cells) | 63 |
| `pricing_sublabel_multipliers` | 15 |
| `pricing_use_tier_multipliers` | 12 |
| `pricing_cc_variants` (if flat per variant) | 7 |
| `pricing_cc_variants` (if varying by format/intrusion) | up to 147 (likely ~20-30 distinct) |
| `EXCLUSIVE_MULTIPLIERS` (existing) | 3 (no change) |
| **Total v1 (CC flat)** | **~100** |
| **Total v1 (CC by format/intrusion)** | **~120-240** |

Recommend CC-flat for v1. ~100 calibration values is tractable for a founder calibration pass; 240 is not. CC-by-format becomes a v2 enrichment if data shows variant prices need format differentiation.

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

L4 corrigendum locks the precise shape change against F1 §4.4.

### 5.7 Buyer-side at checkout

Buyer picks (licence_class, sublabel, use_tier, exclusivity_tier). Final price computed at checkout:

```
final_price = format_default(format, intrusion, class)
            × sublabel_multiplier(sublabel)
            × use_tier_multiplier(class, use_tier)
            × exclusivity_multiplier(exclusivity_tier)

# CC variants override — direct lookup, no multiplier chain:
if class == 'creative_commons':
    final_price = cc_variant_price(sublabel)  # absolute
```

The multiplier chain is the same shape F1's existing model uses; only the cell-vs-multiplier split changes.

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
       • F1.5 §3.2: cell count math 63 (not 252)
       • F1.5 §6.1, §7.1: new CSV templates reflect new dimensions
       • Founder ratifies before L5 tooling resumes

  L5 — F1.5 tooling RESUMES (was blocked here pending L1-L4)
       • Bootstrap script generates new CSV set:
           - format_defaults_v1_eur.csv (63 rows)
           - sublabel_multipliers_v1.csv (15 rows)
           - use_tier_multipliers_v1.csv (12 rows)
           - cc_variants_v1_eur.csv (7 rows for flat CC variant pricing)
       • Converter script emits SQL seed for all four tables
       • Templates + process notes per F1.5
       • Founder calibration pass (~100 values; 6-10 hr offline)

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

**Realistic calendar: L1-L4 = 1 week of audit-first composition + founder ratification. L5 founder calibration = 6-10 hours offline. L6-L8 = ongoing through F-track ship.**

---

## 8. Open decisions still pending

These do NOT block L1 ratification but must be resolved in their respective downstream directives:

1. **Sublabel naming review** (§4.2) — founder may amend any of the 22 proposed values before L2 composes. Naming-only change; no architectural impact.
2. **CC variant curation vs full 7** (§4.2) — full 7 is proposed; curated 3-4 is alternative for cognitive-load reduction. Decided at L2.
3. **CC pricing shape — flat per variant or vary by (format, intrusion)?** (§5.4) — recommend flat for v1 (7 prices); v2 enrichment if data shows differentiation needed. Decided at L4.
4. **use_tier vocabulary per class** (§5.3) — proposed as `small_pub/mid_pub/major_pub/wire_syndication` for editorial, `small_business/mid/enterprise/fortune500` for commercial, `local/regional/national/global` for advertising. Founder amends at L4.
5. **Buyer-side use_tier picker UX** — at checkout, how does the buyer indicate their tier? (Dropdown? Inferred from buyer profile?) Decided in L7 UI directive.
6. **Backfill defaults for legacy `creative_commons` assets** (§4.5) — proposed default `cc_by` with creator review flag. Founder amends at L3.
7. **`pricing_cc_variants` numerical values** — founder calibration in L5.
8. **Sublabel multiplier values + use_tier multiplier values** — founder calibration in L5.
9. **Whether to drop `LicenceType` legacy enum entirely at L8 or keep it as a backward-compat alias** — decided at L8 based on backfill stability.

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

---

## 11. References

- Source mismatch (the trigger for this work): `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` §3 hard-prerequisite (assumed `Social/Editorial/Campaign` in `LICENCE_TYPE_LABELS`; verification step found drift)
- Existing flat enum: `src/lib/types.ts:360-378` (`LicenceType`)
- Existing multiplier pattern (model for §5): `src/lib/types.ts:381-397` (`EXCLUSIVE_MULTIPLIERS`)
- Existing schema: `supabase/migrations/20260413230002_vault_asset_tables.sql:73-105` (`enabled_licences text[]` + CHECK)
- Sister architecture (price engine): `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 + `PRICE-ENGINE-ARCHITECTURE.md` (F1) + `PRICE-ENGINE-CALIBRATION-V1.md` (F1.5)
- Trust language posture: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` (BP-D7)
- Standing posture: root `CLAUDE.md` (item 9 — protect terminology; item 14 — red-team for broken mappings)
- Future:
  - `docs/licence/L2-DIRECTIVE.md` (schema migration + new module — TBD on Stage A approval)
  - `docs/licence/L3-DIRECTIVE.md` (backfill + dual-read — TBD)
  - `docs/pricing/F1-CORRIGENDUM-LICENCE-TAXONOMY.md` (L4 — TBD)
  - `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` revision (L4 — TBD)

---

## 12. Revision history

### v1 — 2026-04-28 (initial composition)

Composed after audit-first review of `LicenceType` enum drift surfaced during F1.5 tooling pre-flight. Found three orthogonal dimensions (USE/MEDIUM/LICENCE FAMILY) packed into one flat enum, plus pricing-brief assumption mismatch (`Social/Editorial/Campaign` not in code). Resolved via 4-class peer model + sublabels + multi-select. Founder picked α (Recommendation[] per asset), γ (full N × 4 tier matrix at upload), ε (no medium restriction in Editorial v1). Three retractions applied from prior audit pass: CC-NC + Commercial NOT a contradiction; Sponsored editorial moved from Commercial to Advertising (→ `native_influencer`); CC pricing shifted from base × multiplier to absolute table.

---

End of licence taxonomy brief (L1, 2026-04-28).
