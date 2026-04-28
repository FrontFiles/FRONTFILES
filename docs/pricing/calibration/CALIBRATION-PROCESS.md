# Price engine calibration — founder offline guide (F1.5 v2 Stage B)

**Status:** Founder-facing process notes. Read once before starting Stage B.
**Date:** 2026-04-28
**Predecessors:** PRICE-ENGINE-BRIEF v3 ✓ + F1 v3 corrigendum ratified + F1.5 v2 directive ratified + L1 v2 (licence taxonomy) ratified
**Estimated time:** 6-9 hours total (spread across days; not contiguous)

---

## 1. What this is

The 5 CSV templates in this directory hold the values that govern the price engine's behavior in v1. The engine's output is dominated by these values until Frontfiles accumulates enough cross-creator transaction volume to ship the `frontfiles_comparables` adapter (F5, v2).

Get this right and the engine produces sensible recommendations from day one. Get it wrong and every creator who sees a price suggestion sees a wrong number. Per F1 §5.7 + brief v3 §7.1, these are advisory only — but advisory wrong is worse than advisory uncertain.

---

## 2. The 5 CSVs

| File | Rows | What it controls |
|---|---|---|
| `format_defaults_v1_eur.csv` | 63 | Base price per (format, intrusion, class) cell at the **anchor** use_tier (tier_2 by convention; multiplier 1.000). Other tiers derive via the use_tier multiplier table. |
| `platform_floors_v1_eur.csv` | 63 | Minimum price the engine will recommend per (format, intrusion, class). Engine clamps any sub-floor recommendation up to this value. Protects FF's market positioning. |
| `sublabel_multipliers_v1.csv` | 17 | Per-sublabel multiplier off the cell base (e.g., `editorial.news = 1.0` anchor, `editorial.documentary = 1.4`). Excludes CC sublabels (those are absolute). |
| `use_tier_multipliers_v1.csv` | 12 | Per-class buyer-tier multiplier (e.g., editorial small_pub vs major_pub). Anchor: tier_2 = 1.000 per class. |
| `cc_variants_v1_eur.csv` | 7 | Absolute prices for the 7 CC variants (not multipliers). CC0 = 0 always; other variants per founder calibration. |

Total: ~162 founder-input values across the 5 files.

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
2. Read F1 v3 §3.1 + §3.2 (table definitions + cell math) and F1.5 v2 §6, §6A, §6B, §6C (CSV schemas).
3. Open the 5 CSVs in your editor / spreadsheet of choice (Numbers, Excel, Google Sheets — anything that respects CSV).
4. Skim the calibration sources in §3 above and pick the 2-3 you'll consult most.

### Phase 2 — Spine cells in `format_defaults_v1_eur.csv` (~1 hr)

Anchor 3-5 spine cells per F1.5 v2 §6.3:

| Spine cell | Why anchor here |
|---|---|
| `photo / standard / editorial` | The most common cell on Frontfiles; market data densest |
| `photo / standard / commercial` | Defines the editorial → commercial spread |
| `photo / standard / advertising` | Defines the commercial → advertising premium |
| `photo / heavy / editorial` | Defines the intrusion-level spread within editorial |

For each spine cell: consult sources, pick a value, write a 1-2 sentence `calibration_basis` (e.g., `"fotoQuote 2026 mid-pub editorial midpoint × 0.85 FF positioning"`).

### Phase 3 — Derive remaining `format_defaults` (~2-3 hr)

Fill the remaining 58 cells by ratio from the spine:

- Other photo cells by simple ratios (e.g., `light` ≈ 0.7× standard; `heavy` ≈ 1.3× standard; light/standard/heavy spread roughly equal)
- Illustration cells: photo × 0.7-1.2 depending on creator effort (illustrations are sometimes premium, sometimes discounted vs photos in editorial markets)
- Infographic cells: typically higher than photo for editorial use (research + design effort)
- Vector cells: usually below illustration (format simplicity)
- Video / audio / text cells: use format-specific external sources

Each cell needs a `calibration_basis`. If a cell is derived by ratio, write that: `"derived from photo/standard/editorial × 0.7 for illustration discount"`.

### Phase 4 — Floors in `platform_floors_v1_eur.csv` (~20 min)

Fill the 63 floor cells. Floors should sit **strictly below** the corresponding `format_defaults` cell at the lowest use_tier multiplier.

Specifically: for any `(format, intrusion_level, licence_class)` cell in `platform_floors`, `min_cents` ≤ `baseline_cents × min(use_tier_multiplier across 4 tiers for that class)`.

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
1. Validates each CSV (errors block; warnings allow continuation).
2. Cross-checks floors vs defaults × min use_tier multiplier (warning-only).
3. Cross-checks CC0 = 0 (warning).
4. Emits SQL seed migration to `supabase/migrations/_pending/<TIMESTAMP>_pricing_seed_v1.sql` with 5 INSERT blocks.

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

The bootstrap is idempotent — it refuses to overwrite a CSV that has user-supplied values (anything beyond the documented anchors). To force a rewrite, delete the CSV first.

---

## 7. References

- F1 (architecture detail): `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` v3
- F1.5 (calibration directive): `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` v2
- L1 (licence taxonomy): `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2
- L2 (schema migration): `docs/licence/L2-DIRECTIVE.md`
- Bootstrap script: `scripts/pricing/bootstrap-calibration-csvs.ts`
- Converter script: `scripts/pricing/csv-to-seed-migration.ts`
- Converter tests: `scripts/pricing/__tests__/csv-to-seed-migration.test.ts`

---

End of calibration process notes.
