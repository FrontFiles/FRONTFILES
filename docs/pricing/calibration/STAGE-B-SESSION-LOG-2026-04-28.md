# Stage B — Session Log (2026-04-28 evening)

**Status:** Partial Stage B — 1 of 162 founder cells captured. Remaining work deferred to next session pending L1 v2.1 amendment (social licence).
**Date:** 2026-04-28
**Operator:** João Nuno Martins (founder)
**Reviewer / structurer:** Claude

---

## 1. Context

Session opened with the L4a F1.5 v2 corrigenda + L5 calibration tooling fully merged to main earlier in the day (PRs #34, #37). All predecessor doc-layer gates ratified. Stage B unblocked.

Founder elected to do Phase 2 (spine cells) of the 9-phase calibration workflow per `docs/pricing/calibration/CALIBRATION-PROCESS.md` §4. Targeted ~1 hour of focused source-consulting + judgment + commit.

Session ended after ~30 minutes due to scope-pivot accumulation (see §3 below) — the right call per CLAUDE.md item 10 ("architecture before implementation").

---

## 2. What got done

### Spine cell #1 — `photo / standard / editorial` mid_pub anchor

**Value:** **€220 (22000 cents)**

**Calibration basis:**

> "Mid-market anchor: 2× above Reuters self-service (~€110), ~20% below format.com per-image guidance (~€275); back-solves to €550 at major_pub (multiplier 2.5×) matching format.com full-page rate, and €88-132 at small_pub matching wire territory. Sources researched 2026-04-28 (NUJ Freelance Fees Guide; format.com magazine resources; Reuters self-service)."

**Sources consulted (pre-locking):**
- [Photography / mags rate guide (NUJ / London Freelance), updated 2026-02-27](https://www.londonfreelance.org/rates/index.php?work=Photography&sect=mags)
- [Photography / news rate guide (NUJ / London Freelance), updated 2026-04-07](https://www.londonfreelance.org/rates/index.php?work=Photography&sect=news)
- [How Much Do Magazines Pay for Photos? — format.com](https://www.format.com/magazine/resources/photography/who-pays-photographers-jobs)
- [Reuters Pictures Pricing — Trustradius](https://www.trustradius.com/products/reuters-pictures/pricing)
- [Getty Images Plans and Pricing](https://www.gettyimages.com/plans-and-pricing)
- [Alamy Licensing and Pricing](https://www.alamy.com/help/licensing-and-pricing/)

**Reference data points used:**

| Source | EUR (~) | Role in anchor decision |
|---|---|---|
| format.com major-pub full-page editorial photo | €550 | Back-solve target for major_pub multiplier 2.5× |
| format.com per-image editorial midpoint | €275 | Cross-publication-size midpoint |
| Reuters self-service larger audience | €110-120 | Wire reference / floor |
| Alamy single-image stock | €36 | Pure stock floor (must sit clearly above) |
| National print ad campaign (1 year, multi-asset) | €1,800-€4,500 | Advertising upper bound (not directly in scope) |

**Status:** captured into `format_defaults_v1_eur.csv` line 5 in this same commit. Founder ratified.

---

## 3. Scope decisions made tonight (significant)

The following scope pivots happened during Stage B and are logged here so the next session has the full picture:

### 3.1 Commercial licence class — DEFERRED to v2

Founder decision: *"Commercial will not be available in this phase."*

Implications:
- format_defaults: 63 cells → 42 cells (drop 21 commercial rows)
- platform_floors: 63 → 42
- sublabel_multipliers: 17 → 13 (drop 4 commercial sublabels)
- use_tier_multipliers: 12 → 8 (drop 4 commercial rows)
- cc_variants: unchanged (7)
- Total founder calibration: 162 → 112 (before social addition)

L1 v2 / L2 / L4a / L4b stand as-is for the schema layer (CHECK still accepts commercial values for forward-compat); UI hides commercial as enabled-licence option in v1.

### 3.2 Advertising licence class — DEFERRED to v2 (pending social outcome)

Founder decision (implicit): *"Only Editorial, CC and Social in v1."*

Originally L1 v2 had `advertising` as one of 4 classes with 7 sublabels (print_ad / digital_ad / social_ad / out_of_home / broadcast / native_advertorial / influencer). All 7 deferred for v1.

Implications:
- format_defaults: 42 → 21 cells (drop 21 advertising rows)
- platform_floors: 42 → 21
- sublabel_multipliers: 13 → 6 (drop 7 advertising sublabels)
- use_tier_multipliers: 8 → 4 (drop 4 advertising rows)
- cc_variants: unchanged (7)

### 3.3 Social Media Licence — INTRODUCED as `editorial.social` sublabel (pending L1 v2.1 amendment)

Founder authored a comprehensive spec (now `docs/licence/SOCIAL-LICENCE-SPEC-V1-DRAFT.md`). Initial proposal was a new top-level `social` class; refined during review to `editorial.social` sublabel under existing Editorial class.

Key constraints (per founder refinement):
- One licensee-controlled social media account per licence
- Editorial-only in nature (no commercial, no advertising)
- Channel-restricted to social media platforms (per spec §2.1)
- Pricing: `0.20 × P_editorial.news_at_(format, intrusion, mid_pub)`, floored at €10

All 5 Claude corrections (C1-C5) folded into the spec draft. Awaiting founder ratification before L1 v2.1 amendment composition begins.

Implications if ratified:
- L1 v2 brief: small amendment to §4.2 (+1 sublabel) and §6.1 (medium-restriction rule update)
- L2 schema CHECK: +1 entry (`editorial.social`)
- L4a F1: +1 sublabel multiplier (anchored at 0.20 vs `editorial.news` 1.0)
- L5 calibration: +1 row in `sublabel_multipliers_v1.csv`

Cell count for revised v1 calibration scope (Editorial + CC + editorial.social):
- format_defaults: 21 cells (7 formats × 3 intrusion × 1 cell-bearing class — editorial only)
- platform_floors: 21 cells
- sublabel_multipliers: 7 (6 editorial + 1 editorial.social)
- use_tier_multipliers: 4 (1 class × 4 tiers)
- cc_variants: 7 (unchanged)
- **Total revised v1 calibration: 60 cells (down from 162)**

---

## 4. Calibration cells captured this session

| Cell | Class | Sublabel anchor | Use-tier anchor | EUR | Cents | Status |
|---|---|---|---|---|---|---|
| `photo / standard / editorial` | editorial | (per-class base) | mid_pub (tier_2) | €220 | 22000 | ✓ Captured |

**Tracker:** 1 of 60 (estimated revised-scope total, post-social-amendment).

---

## 5. Open work for next session

### 5.1 Social Licence ratification + L1 v2.1 amendment cascade (HIGH-PRIORITY)

Before more Stage B work proceeds:

1. Founder reviews `docs/licence/SOCIAL-LICENCE-SPEC-V1-DRAFT.md` (§13 approval gate)
2. Founder approves / approves-with-corrections / revises / rejects
3. If approved: compose L1 v2.1 + L2 + L4a (small) + L5 (single-row) amendments — ~35-45 min
4. Merge amendments
5. Stage B resumes with revised scope

### 5.2 Stage B remaining cells (60 cells across 5 CSVs, post-amendment)

After §5.1 closes:
- 20 more `format_defaults` cells (Phase 2 spine cells #2-#3 deferred or replaced + Phase 3 derived cells)
- 21 `platform_floors` cells (Phase 4)
- 6 sublabel multipliers (Phase 5; reduced from 17 due to scope cuts)
- 4 use-tier multipliers (Phase 6; reduced from 12)
- 7 CC variant absolute prices (Phase 7)

Estimated remaining work: ~3-5 hours, can be spread across days.

### 5.3 Phase 8-9 (validation + ratification)

After all CSVs are filled:
- Run `bun run scripts/pricing/csv-to-seed-migration.ts`
- Review generated SQL seed
- Commit + open PR (`docs/pricing-calibration-stage-b`)

---

## 6. Lessons learned this session (for the meta-record)

1. **Scope decisions surfaced mid-calibration.** The Editorial-CC-only scope was not locked before Stage B started; it emerged during the calibration session as the founder reviewed pricing implications. Better practice: lock v1 scope BEFORE calibration starts, not during.

2. **"Research more" was the right founder instinct.** Initial calibration anchors based on "founder market knowledge" alone would have been weaker than research-derived anchors. Web research grounded the €220 anchor in actual market data points.

3. **Stale local `origin/main` caused two false alarms.** My local sandbox couldn't fetch fresh after the morning's host-key error, leading to two confidently-wrong claims (the L1 v2 §5.5 "stale numbers" and the α/γ "citation inaccuracy"). Lesson: when local refs are stale, don't make claims about main's content — read from the branch refs directly.

4. **One scope pivot per session, not three.** Tonight had three scope changes (commercial deferred → advertising deferred → social introduced) compressed into ~30 minutes. Each is defensible individually; together they signaled "stop and re-plan." Stopping was the right call.

---

## 7. References

- F1 (architecture): `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` v3
- F1.5 (calibration directive): `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` v2
- L1 (licence taxonomy): `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2
- Calibration process: `docs/pricing/calibration/CALIBRATION-PROCESS.md`
- Social licence spec: `docs/licence/SOCIAL-LICENCE-SPEC-V1-DRAFT.md` (this session's output)

---

End of Stage B session log 2026-04-28 evening.
