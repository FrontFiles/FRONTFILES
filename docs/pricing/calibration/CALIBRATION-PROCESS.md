# Price engine calibration — founder offline guide (F1.5 v3 Stage B; cascade D per L1 v2.2)

**Status:** REVISED 2026-04-30 (v2; cascade D per L1 v2.2 §5.0). Founder-facing process notes. Read once before starting Stage B. v2 changes drop `intrusion_level` from `format_defaults` + `platform_floors` workflow per L1 v2.2 §5.0 + F1 v4 §3.1 + §4.1: watermark intensity is preview-protection only, not a pricing input. The v1/v2 of this guide carried 63-row format_defaults + platform_floors tables and a 4-cell intrusion-spread spine; both are dropped here. See §8 Revision history.
**Date:** 2026-04-30 (v2); 2026-04-28 (v1)
**Predecessors:** PRICE-ENGINE-BRIEF v3 ✓ + F1 v4 (cascade C per L1 v2.2 §5.0) + F1.5 v3 (cascade C corrigendum) + L1 v2.2 (cascade A; PR #45 merged 2026-04-29) + L2 v1.1 (cascade B; PR #44)
**Estimated time:** 4-6 hours total full scope (was 6-9 hr in v1; spread across days; not contiguous). **v1 editorial-only Stage B scope: ~1 hour** since `docs/pricing/calibration/CANONICAL-SOURCES.md` §11.2 already carries the 7 editorial cell values + calibration_basis text.

---

## 1. What this is

The 5 CSV templates in this directory hold the values that govern the price engine's behavior in v1. The engine's output is dominated by these values until Frontfiles accumulates enough cross-creator transaction volume to ship the `frontfiles_comparables` adapter (F5, v2).

Get this right and the engine produces sensible recommendations from day one. Get it wrong and every creator who sees a price suggestion sees a wrong number. Per F1 §5.7 + brief v3 §7.1, these are advisory only — but advisory wrong is worse than advisory uncertain.

---

## 2. The 5 CSVs

v2 (cascade D) drops `intrusion_level` from `format_defaults` + `platform_floors` per L1 v2.2 §5.0; cell counts collapse from 63 → 21 in each table. The 3 multiplier + CC CSVs from v1 are unaffected (they never carried intrusion_level).

| File | Rows (full scope) | Rows (v1 editorial-only Stage B) | What it controls |
|---|---|---|---|
| `format_defaults_v1_eur.csv` | 21 (was 63 in v1) | 7 | Base price per (format, class) cell at the **anchor** use_tier (tier_2 by convention; multiplier 1.000). Other tiers derive via the use_tier multiplier table. |
| `platform_floors_v1_eur.csv` | 21 (was 63 in v1) | 7 | Minimum price the engine will recommend per (format, class). Engine clamps any sub-floor recommendation up to this value. Protects FF's market positioning. |
| `sublabel_multipliers_v1.csv` | 17 | 6 (Editorial only) | Per-sublabel multiplier off the cell base (e.g., `editorial.news = 1.0` anchor, `editorial.documentary = 1.4`). Excludes CC sublabels (those are absolute). |
| `use_tier_multipliers_v1.csv` | 12 | 4 (Editorial only) | Per-class buyer-tier multiplier (e.g., editorial small_pub vs major_pub). Anchor: tier_2 = 1.000 per class. |
| `cc_variants_v1_eur.csv` | 7 | 7 | Absolute prices for the 7 CC variants (not multipliers). CC0 = 0 always; other variants per founder calibration. |

Total: ~78 founder-input values across the 5 files full scope (was ~162 in v1); **~31 values v1 editorial-only Stage B scope** per L1 v2.2 §5.5.

`vault_assets.intrusion_level` STAYS as a watermark-system column (already shipped via `supabase/migrations/20260417100001/2/3_watermark_profile_*.sql`); the pricing engine MUST NOT query it (per F1 v4 §10 don't-do #22 + L1 v2.2 §10 don't-do #13).

---

## 3. Calibration sources (consult before filling)

External sources inform the values but are never cited as authoritative in the engine's runtime basis statements (per brief v3 §4.2.4). The `calibration_basis` column in `format_defaults_v1_eur.csv` is internal documentation for future-self recalibration; it never surfaces to creators or buyers.

| Source | Use for | Notes |
|---|---|---|
| **fotoQuote / fotoBiz** | Editorial + commercial photography pricing midpoints | Most directly applicable to photo + illustration cells; explicit per-use-tier breakdowns |
| **Getty Images published rate cards** | Editorial / news rates where public | Use as upper-bound reference for major_pub cells |
| **AP / Reuters published editorial rates** | Editorial wire rates | Anchor the small_pub / mid_pub editorial cells |
| **PhotoShelter pricing guides** | Cross-format photographer-side guidance | Useful for illustration + vector format cells |
| **Adobe Stock / Shutterstock published prices** | Commercial bulk-licence reference | Use as lower-bound; FF's commercial cells should sit above stock-pricing |
| **Founder's market knowledge** | FF positioning relative to incumbents | The actual editorial choice; sources inform but founder decides |

For non-photo formats (video, audio, text):
- Video: published broadcast / streaming licence rates
- Audio: PRS / ASCAP / BMI rate schedules where public
- Text: AP / Reuters article rates; Society of Authors editorial rates

---

## 4. Recommended workflow (9 phases)

### Phase 1 — Preparation (~30 min)

1. Read this document end to end.
2. Read F1 v4 §3.1 + §3.2 (table definitions + cell math) and F1.5 v3 §6, §6A, §6B, §6C (CSV schemas).
3. Read L1 v2.2 §5.0 (pricing dimensions lock — the authority anchor for the v2 cascade D shape) + §5.5 (v1 editorial-only Stage B scope).
4. Open the 5 CSVs in your editor / spreadsheet of choice (Numbers, Excel, Google Sheets — anything that respects CSV).
5. Skim the calibration sources in §3 above and pick the 2-3 you'll consult most.

**v1 editorial-only Stage B path:** `docs/pricing/calibration/CANONICAL-SOURCES.md` §11.2 carries the 7 editorial cells (photo €220, illustration €200, infographic €280, vector €150, video €300, audio €130, text €350) with full `calibration_basis` text. Founder paste-into-CSV; ~1 hr total. Skip Phases 2 + 3 ratio-derivation if scope is editorial-only.

### Phase 2 — Spine cells in `format_defaults_v1_eur.csv` (~1 hr full scope; covered by §11.2 drop-in for v1 editorial-only)

Anchor 1-3 spine cells per F1.5 v3 §6.3 (v2 spine drops the intrusion-level spread row per L1 v2.2 §5.0):

| Spine cell | Why anchor here |
|---|---|
| `photo / editorial` | The most common cell on Frontfiles; market data densest. **v1 editorial-only Stage B drop-in: €220 HIGH per CANONICAL-SOURCES.md §11.2.** |
| `photo / commercial` | Defines the editorial → commercial spread (deferred to v2 per Stage B scope). |
| `photo / advertising` | Defines the commercial → advertising premium (deferred to v2 per Stage B scope). |

For each spine cell: consult sources, pick a value, write a 1-2 sentence `calibration_basis` (e.g., `"fotoQuote 2026 mid-pub editorial midpoint × 0.85 FF positioning"`). For v1 editorial-only Stage B, the §11.2 drop-in spec carries both the value and the basis text verbatim.

### Phase 3 — Derive remaining `format_defaults` (~2-3 hr full scope; skip for v1 editorial-only — §11.2 covers all 7 editorial cells)

Full scope: fill the remaining 18 cells by ratio from the spine (21 total – 3 spine = 18). v1 editorial-only Stage B: skip — §11.2 already covers all 7 editorial cells with full basis text.

- Illustration cells: photo × 0.7-1.2 depending on creator effort (illustrations are sometimes premium, sometimes discounted vs photos in editorial markets). v1 editorial-only Stage B: €200 MEDIUM-HIGH per §11.2.
- Infographic cells: typically higher than photo for editorial use (research + design effort). v1 editorial-only Stage B: €280 MEDIUM per §11.2.
- Vector cells: usually below illustration (format simplicity). v1 editorial-only Stage B: €150 MEDIUM per §11.2.
- Video / audio / text cells: use format-specific external sources. v1 editorial-only Stage B: video €300 MEDIUM-HIGH / audio €130 MEDIUM-HIGH / text €350 HIGH per §11.2.

Each cell needs a `calibration_basis`. If a cell is derived by ratio, write that: `"derived from photo/editorial × 0.7 for illustration discount"`.

### Phase 4 — Floors in `platform_floors_v1_eur.csv` (~20 min)

Fill the 21 floor cells (full scope; 7 cells v1 editorial-only). Floors should sit **strictly below** the corresponding `format_defaults` cell at the lowest use_tier multiplier.

Specifically: for any `(format, licence_class)` cell in `platform_floors`, `min_cents` ≤ `baseline_cents × min(use_tier_multiplier across 4 tiers for that class)`.

The converter's cross-CSV check warns if a floor exceeds this — flagged combinations let the engine clamp every recommendation up, which means `format_defaults` is effectively dead for those cells.

### Phase 5 — Sublabel multipliers in `sublabel_multipliers_v1.csv` (~1 hr)

17 multipliers. Anchor: `editorial.news = 1.000` (already pre-filled by the bootstrap script). Derive others by ratio. Examples:

| Sublabel | Suggested ratio range | Reasoning |
|---|---|---|
| `editorial.news` | 1.0 (anchor) | Most common editorial use |
| `editorial.longform` | 1.2-1.4 | Magazine + web longform commands premium |
| `editorial.documentary` | 1.3-1.5 | Documentary use is rights-heavy |
| `editorial.book` | 1.5-2.0 | Book rights are typically more expensive (perpetual + print) |
| `editorial.commentary` | 0.9-1.1 | Op-ed / commentary similar to news |
| `editorial.educational` | 0.6-0.8 | Educational use often discounted |
| `commercial.brand_content` | 1.0 (anchor for commercial cells) | Most common commercial use |
| `commercial.corporate_communications` | 0.8-1.0 | Internal-leaning use |
| `commercial.merchandise` | 1.4-1.8 | Broader rights (physical product + retail) |
| `commercial.internal_training` | 0.5-0.7 | Limited audience |
| `advertising.print_ad` | 1.0 (anchor for advertising) | Standard print advertising |
| `advertising.digital_ad` | 0.9-1.1 | Programmatic-display similar to print |
| `advertising.social_ad` | 0.8-1.0 | Smaller per-impression value |
| `advertising.out_of_home` | 1.5-2.0 | OOH commands premium (high-traffic) |
| `advertising.broadcast` | 2.0-3.0 | TV / radio reach is highest tier |
| `advertising.native_advertorial` | 1.0-1.2 | Editorial-style paid placement |
| `advertising.influencer` | 0.8-1.5 | Variable by reach; talent-side licensing |

These are guidance; founder calibrates per market knowledge.

### Phase 6 — Use-tier multipliers in `use_tier_multipliers_v1.csv` (~30 min)

12 multipliers (3 classes × 4 tiers). Anchor: `tier_2 = 1.000` per class (pre-filled). Derive tier_1 (smaller) and tier_3, tier_4 (larger).

| Class | tier_1 (small) | tier_2 (mid) | tier_3 (large) | tier_4 (max) |
|---|---|---|---|---|
| editorial | small_pub: ~0.4-0.6 | mid_pub: 1.0 | major_pub: ~2.0-2.5 | wire/syndication: ~3.0-4.0 |
| commercial | small_business: ~0.5-0.7 | mid: 1.0 | enterprise: ~1.8-2.2 | fortune500: ~2.5-3.0 |
| advertising | local: ~0.4-0.6 | regional: 1.0 | national: ~2.5-3.0 | global: ~4.0-5.0 |

These are illustrative; calibrate per market knowledge.

### Phase 7 — CC variant absolute prices in `cc_variants_v1_eur.csv` (~30 min)

7 variants. CC0 = 0 (already pre-filled, public domain dedication is canonically free).

| Variant | Suggested range | Reasoning |
|---|---|---|
| `cc0` | 0 (locked) | Public domain — no rights to sell |
| `cc_by` | small admin fee (e.g., 200-500) | Attribution-only; minimal additional value |
| `cc_by_sa` | similar to CC-BY | Share-alike adds little for editorial photo use |
| `cc_by_nc` | mid-tier (e.g., 1000-3000) | Commercial-use buyers pay; non-commercial is free under CC |
| `cc_by_nd` | similar to CC-BY (small fee) | No-derivatives is a constraint, not a price increase |
| `cc_by_nc_sa` | similar to CC-BY-NC | Commercial-use price |
| `cc_by_nc_nd` | mid-to-high tier | Most restrictive; commercial buyers pay highest CC fee |

These prices are absolute, not multipliers. CC pricing is variant-driven (per L1 v2 §5.4), independent of `format_defaults`.

### Phase 8 — Validation + seed generation (~10 min)

Once all 5 CSVs are filled:

```
cd /Users/jnmartins/dev/frontfiles
CALIBRATED_BY_USER_ID=<your-founder-uuid> bun run scripts/pricing/csv-to-seed-migration.ts
```

The converter:

1. **v2 stale-template check** (cascade D per L1 v2.2 §5.0; F1.5 v3 §6.4 / §7.4) — rejects any `format_defaults_v1_eur.csv` or `platform_floors_v1_eur.csv` that still carries an `intrusion_level` column from the v1 bootstrap shape. Error message points back to the bootstrap script. Fix: delete the stale CSV and re-run `bootstrap-calibration-csvs.ts` to regenerate the v2 shape.
2. **Per-row validation** of each CSV: format / licence_class enumeration, currency = EUR, positive integer cents, unique `(format, licence_class)` tuple for `format_defaults` + `platform_floors` (was `(format, intrusion_level, licence_class)` in v1), 17 sublabels matching the L1 v2.2 §4.2 enumeration, 12 (class, tier) rows for use_tier multipliers, 7 CC variants. Errors block; warnings allow continuation.
3. **Cross-CSV check** — floors vs defaults × min use_tier multiplier; warning-only. Tuple is `(format, licence_class)` per v2.
4. **CC0 sanity check** — CC0 should be 0 (public-domain dedication); warning if not.
5. **SQL seed emission** — writes `supabase/migrations/_pending/<TIMESTAMP>_pricing_seed_v1.sql` with 5 INSERT blocks (78 rows full scope; 31 rows v1 editorial-only Stage B). The `format_defaults` + `platform_floors` INSERT shapes drop `intrusion_level` from both column lists and per-row values per F1 v4 §3.1 + §4.1.

If the converter prints validation errors, fix the CSVs and re-run. Warnings are advisory — review each but you can proceed.

### Phase 9 — Review + ratify (founder)

1. Open the generated SQL seed and sanity-check 5-10 random cells against the source.
2. Commit the filled CSVs + the generated SQL seed as a docs PR (`docs/pricing-calibration-stage-b`).
3. Approve the calibration in the PR description; F2 schema migration directive composes against the now-known seed values.

---

## 5. Editing tips

- **Open in a spreadsheet, save as CSV.** Numbers / Excel / Google Sheets all handle the format. Be careful: Excel sometimes auto-converts `1.000` to `1` (drops trailing zeros) — use Numbers or LibreOffice if Excel mangles values.
- **Don't reorder rows.** The bootstrap script generates rows in a specific order; the converter doesn't depend on order, but re-running bootstrap will rewrite in the original order if the CSV lacks user values.
- **`calibration_basis` may contain commas.** Wrap in double quotes if so: `"fotoQuote, 2026 edition, mid-pub midpoint"`. The converter handles standard CSV quoting.
- **Anchors are pre-filled** by the bootstrap script (`editorial.news = 1.000`, `tier_2 = 1.000` per class, `cc0 = 0`). You can change them but their semantic meaning is the anchor.

---

## 6. Re-running the bootstrap script

If you delete a CSV and re-run `bootstrap-calibration-csvs.ts`, it regenerates that CSV with empty values. Useful when:
- Dimension enumerations change (new format added; new sublabel; etc.)
- You want to start over on a specific CSV
- You're holding a v1 6-column `format_defaults` or 5-column `platform_floors` CSV from before cascade D — the v2 bootstrap regenerates the 5-column / 4-column shape per L1 v2.2 §5.0. The converter's v2 stale-template check (Phase 8 step 1) catches stale shapes if you forget.

The bootstrap is idempotent — it refuses to overwrite a CSV that has user-supplied values (anything beyond the documented anchors). To force a rewrite, delete the CSV first.

---

## 7. References

- F1 (architecture detail): `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` v4 (cascade C per L1 v2.2 §5.0)
- F1.5 (calibration directive): `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` v3 (cascade C corrigendum)
- L1 (licence taxonomy): `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2.2 (cascade A — §5.0 pricing dimensions lock is the authority anchor for cascade D)
- L2 (schema migration): `docs/licence/L2-DIRECTIVE.md` v1.1 (cascade B)
- Calibration sources registry: `docs/pricing/calibration/CANONICAL-SOURCES.md` (Phase α + §11 path-(1)-ready 7-cell editorial drop-in spec)
- Bootstrap script: `scripts/pricing/bootstrap-calibration-csvs.ts`
- Converter script: `scripts/pricing/csv-to-seed-migration.ts`
- Converter tests: `scripts/pricing/__tests__/csv-to-seed-migration.test.ts`
- Watermark vocabulary source-of-truth (clarifies `intrusion_level` is watermark-only, not pricing): `src/lib/processing/profiles.ts:60-169` SEED_PROFILES
- Already-shipped watermark migrations (no migration action needed; pricing engine MUST NOT query): `supabase/migrations/20260417100001_watermark_profile_enums.sql`, `20260417100002_watermark_profile_tables.sql`, `20260417100003_watermark_profile_indexes.sql`

---

## 8. Revision history

### v2 — 2026-04-30 (cascade D per L1 v2.2; awaiting ratification)

L1 (Licence Taxonomy Brief) v2.2 §5.0 locks the pricing-engine dimension set and drops `intrusion_level` per Stage B 2026-04-28 founder discovery. F1 v4 (cascade C) updates the architectural schemas; F1.5 v3 (cascade C) updates the calibration directive; this v2 brings the founder-facing process notes into structural compliance with the v3 cell shape.

| # | Section | Change | Rationale |
|---|---|---|---|
| 1 | Status header | v1 → v2 (cascade D per L1 v2.2 §5.0); date 2026-04-30; predecessors updated to F1 v4 + F1.5 v3 + L1 v2.2 + L2 v1.1; estimated time 6-9 hr → 4-6 hr full scope (~1 hr v1 editorial-only) | Per L1 v2.2 §5.0 cascade C versioning + reduced cell count per L1 v2.2 §5.5 |
| 2 | §2 The 5 CSVs | Table restructured into "full scope" + "v1 editorial-only Stage B" columns; row counts updated (format_defaults 63 → 21; platform_floors 63 → 21); intrusion qualifier removed from "what it controls" copy; total cells ~162 → ~78 (full) and ~31 (v1 ed-only); footnote added about `vault_assets.intrusion_level` watermark column status | Per L1 v2.2 §5.0 + F1 v4 §3.2 + §4.2 + L1 v2.2 §5.5 (Stage B path-1) |
| 3 | §4 Phase 1 | Added L1 v2.2 §5.0 + §5.5 read-list item; added v1 editorial-only Stage B drop-in pointer to CANONICAL-SOURCES.md §11.2 | Per cascade D scope expansion |
| 4 | §4 Phase 2 spine cells | Removed `photo / heavy / editorial` (intrusion-level spread row) from spine table; renamed remaining spine cells to drop `/standard/` qualifier (now `photo / editorial`, `photo / commercial`, `photo / advertising`); added v1 editorial-only Stage B drop-in pointer per CANONICAL-SOURCES.md §11.2 | Per L1 v2.2 §5.0 — intrusion no longer a pricing dimension |
| 5 | §4 Phase 3 | Removed `light ≈ 0.7× standard` / `heavy ≈ 1.3× standard` ratio guidance (the architectural error L1 v2.2 §5.0 trigger narrative cites); remaining-cells count updated 58 → 18 (full scope; or 0 for v1 editorial-only since §11.2 covers all 7 editorial cells); v1 editorial-only Stage B values added per format with §11.2 cross-references | Per L1 v2.2 §5.0 trigger narrative — drift defaults dropped |
| 6 | §4 Phase 4 | Floor count 63 → 21 (full scope; 7 v1 ed-only); cross-check tuple `(format, intrusion_level, licence_class)` → `(format, licence_class)` | Per F1 v4 §4.1 |
| 7 | §4 Phase 8 | Validation steps reorganized: (1) v2 stale-template check added — rejects v1 6-column `format_defaults` and 5-column `platform_floors` CSVs with reference to F1.5 v3 §6.4 / §7.4; (2) per-row validation section enumerates the v3 unique-combo `(format, licence_class)`; (3) total INSERT row count 162 → 78 (full) / 31 (v1 ed-only) | Per L1 v2.2 §5.0 + F1.5 v3 §6.4 / §7.4 |
| 8 | §6 Re-running bootstrap | Added third bullet about regenerating from v1 6/5-column shapes; reference to v2 stale-template check | Per cascade D shape change |
| 9 | §7 References | F1 v3 → F1 v4; F1.5 v2 → F1.5 v3; L1 v2 → L1 v2.2; L2 → L2 v1.1; added CANONICAL-SOURCES.md, SEED_PROFILES, already-shipped watermark migrations | Per cascade C/D reference set |
| 10 | §8 (this section) | New section added | Build-governing record |
| 11 | Closing line | Removed (replaced by §8 Revision history close) | Versioning |

**Sections unchanged in v2:** §1 (What this is — process posture holds), §3 (Calibration sources — external sources still inform initial values), §4 Phases 5-7 (sublabel + use_tier + CC variant CSVs unaffected by intrusion drop), §4 Phase 9 (review + ratify gate), §5 (Editing tips — same).

### v1 — 2026-04-28 (initial composition)

Composed alongside F1.5 v2 directive. 9-phase founder workflow covering 5 CSVs. 6-9 hr founder-time estimate. v2 corrigendum applied 2026-04-30 after L1 v2.2 + F1 v4 + F1.5 v3 cascade.

---

End of calibration process notes.
