# Frontfiles Social Media Licence — v1 Spec (DRAFT)

**Status:** DRAFT — founder-authored 2026-04-28; awaiting ratification of 4 outstanding corrections + architectural placement lock before L1 v2.1 amendment composes.
**Date:** 2026-04-28
**Author:** João Nuno Martins (founder)
**Reviewer:** Claude (audit pass 2026-04-28)
**Predecessor gates:** L1 v2 ratified ✓ (PR #32) — this spec amends L1 v2 with a new sublabel.

---

## 0. Background

Founder logged the following core ideas that motivated this spec:

> - It is separate from the main editorial licences (newspaper/magazine/site, 1-year, non-exclusive).
> - It is intended as a low-price, high-throughput distribution channel, potentially important for overall revenue if the volume of social usage is large enough.
> - I am evaluating business viability: whether the platform earns enough per use and whether such a licence cannibalizes or complements the main editorial licences.

Founder then added a critical refinement during review:

> Social media licence must be very similar to editorial licence. **One account per licence only**, no commercial use, no advertising use, editorial only.

The refinement reframes the architectural placement (see §11 below).

---

## 1. Name and purpose

**Name:** Frontfiles Social Media Licence (Standard)
**Short label:** Social Media Licence
**Purpose:** Low-price, high-volume licence that allows buyers to use an asset **only on social media platforms**, on **a single licensee-controlled account per licence**, without granting editorial-on-publisher-site, advertising, or archival rights. It is designed to monetize social distribution while preserving the value of full editorial licences.

---

## 2. Scope

### 2.1 Permitted channels

Use is allowed **only** on third-party social media platforms, including but not limited to:

- X/Twitter
- Instagram
- Facebook
- TikTok
- LinkedIn
- YouTube (posts and Shorts only — see §2.1a)
- Threads, Bluesky, Mastodon, and similar feed-based services

**§2.1a — Platform-format test (per Claude correction C3):**

Coverage is restricted to feed-mechanics content: posts, stories, reels, short-form videos (≤4 minutes), and equivalent ephemeral formats. Long-form content on the same platforms is **NOT covered**:
- Videos ≥4 minutes (e.g., regular YouTube uploads, IGTV-equivalent long-form)
- Articles ≥800 words (e.g., LinkedIn long-form articles, Medium-style posts)
- Podcast episodes
- Newsletter / Substack-style publications

Long-form uses on social platforms require a separate Editorial Licence.

Generic legal phrasing:

> "Permitted channels: public posts, stories, reels, and short-form video formats on third-party social media platforms that primarily distribute content via algorithmic or chronological feeds. Long-form formats (videos ≥4 minutes; articles ≥800 words; podcasts; email newsletters) are not covered by this licence."

### 2.2 Prohibited channels (by this licence alone)

The Social Media Licence **does not** permit:

- print (newspaper, magazine, book)
- web articles or feature pages on owned sites
- paid advertising or sponsored posts (ad accounts, boost campaigns)
- broadcast (TV, radio, streaming news programmes)
- out-of-home (billboards, signage, projections)
- internal use (reports, pitch decks, internal comms)

Those uses require a separate Editorial Licence, Advertising Licence, or other product once defined.

### 2.3 Account restriction (founder refinement, addresses Claude C1)

**One licensee-controlled social media account per licence.**

A buyer may post the licensed asset on **exactly one social media account** under their control during the term. Multiple accounts (e.g., a brand managing both `@brand_main` and `@brand_news`) require multiple licences, one per account.

This caps cannibalization risk by scaling licence cost with the buyer's audience reach naturally — a journalist with one personal account pays €15; a brand with 20 accounts pays €300. No post-count enforcement needed.

---

## 3. Term and territory

### 3.1 Term

**1 year from licence grant**, aligning with the standard editorial licence term.

Optional product variation deferred to v2: **30-day Social Burst** for intense campaigns.

### 3.2 Territory

**Worldwide**, subject to applicable export, sanctions, and platform rules.

If territory banding becomes commercially relevant, region-limited social licences ship as a separate SKU in v2.

---

## 4. Rights granted

The Social Media Licence grants the buyer a **non-exclusive, non-transferable, limited licence** to:

- reproduce the asset within social media posts, stories, thumbnails, and cover images on permitted platforms (per §2.1)
- crop, resize, and minimally edit (color-correction, exposure, aspect ratio) to fit platform formats
- combine with text overlays and simple graphics, as long as the use does not materially distort the meaning of the underlying event or misrepresent the people depicted

**Attribution:** required where platform format permits — "Credit: Creator Name / Frontfiles" in the caption, tweet, post body, or equivalent metadata field. Platforms with no caption support (e.g., pure image posts on certain feeds) carry the attribution obligation forward to the next platform that supports it.

**§4.1 — Derivative-format opt-in (per Claude correction C4):**

Derivative formats — memes, satirical edits, captioned reaction images, and similar repurposings — require **explicit creator opt-in via asset-level setting** (default: NOT permitted). This protects creator agency over how their work is repurposed and addresses the reputational risk of journalistic imagery being meme-ified.

---

## 5. Restrictions

The licence forbids:

1. **Use outside social media** — no print, web articles, broadcast, out-of-home, internal docs, or product packaging.
2. **Advertising / sponsored posts** — no paid campaigns, boosted posts, or ad-account usage. Those require a future Advertising Licence.
3. **§5.3 — Promotional political use (per Claude correction C5; narrowed):**

   No use in **paid political advertising, campaign fundraising materials, voter-targeting messaging, or other promotional political content.**

   Journalistic or commentary-style political posting (e.g., a journalist tweeting their own article with one-line opinion) is permitted — the restriction targets *promotional* political use, not *editorial* commentary on political subjects.

4. **Hate / harassment / deep misrepresentation** — no use that promotes hate, harassment, or disinformation, or that materially misrepresents the event or people depicted.
5. **Sub-licensing** — buyer may not sub-license, resell, or make the asset available in any media library, template pack, or stock pool.
6. **Derivative branding** — buyer may not register trademarks, logos, or similar marks that incorporate the asset.
7. **Multi-account use under a single licence** — per §2.3.

---

## 6. Relationship to other licences

- **Non-exclusive:** This licence is always non-exclusive. The same asset can be licensed to multiple buyers for social use.
- **No upgrade by implication:** Holding a Social Media Licence does NOT imply or include any editorial or advertising licence; upgrades must be purchased separately.
- **Stacking:** A buyer can hold an Editorial Licence and a Social Media Licence for the same asset; their rights are cumulative, each within its own scope.

---

## 7. Pricing logic

### 7.1 Reference (per Claude correction C2; locked)

```
P_social = 0.20 × P_editorial.news_at_(format, intrusion_level, mid_pub)
P_social = MAX(P_social, €10)   # floor
```

Reasoning:
- Use `editorial.news` at `mid_pub` use-tier as the canonical anchor across all assets — gives stable, predictable social pricing independent of which editorial sublabels the creator has enabled
- 0.20× ratio sits at the midpoint of the founder-proposed 0.15-0.25× range
- €10 floor protects against degenerate cases (very-low-priced editorial cells)

Worked example (using current editorial calibration):
- Editorial mid_pub anchor for photo / standard / editorial = €220 (per Stage B cell #1)
- Editorial.news multiplier = 1.0 (anchor)
- P_social = 0.20 × €220 × 1.0 = **€44** per asset, per account, per year

### 7.2 Future multipliers (deferred to v2)

The Social Media Licence price could vary by:
- Story importance / newsworthiness band (asset-level field — does not exist in v1 model)
- Creator tier / rating (creator-level field — does not exist in v1 model)
- Exclusivity of editorial licences held (already in `EXCLUSIVE_MULTIPLIERS`)
- Format (photo / illustration / video) — could differ from editorial's format multipliers
- Demand / usage history (requires `frontfiles_comparables` adapter, F5 v2)

For v1: lock the simple `0.20 × P_editorial.news` rule. Defer multipliers to v2.

---

## 8. Enforcement and detection

- **Licence type:** add `editorial.social` to L1 v2's `LicenceSublabel` enum (per §11 architectural placement).
- **Account-binding:** the licence record on issue captures the buyer-declared social account handle. Renewals re-bind to the same handle by default; switching handles requires re-issue.
- **Scope guard in API:** any delivery route serving an `editorial.social`-only fulfilment package cannot include editorial-on-publisher-site, advertising, or print rights. Schema CHECK + application-layer guard.
- **UI constraints:**
  - `editorial.social` appears in the licence picker as a dedicated row under Editorial, with explanatory copy ("for use on a single social media account; not for publisher sites or boosted posts")
  - Buyer-side checkout collects the social handle that will host the asset, enforces single-account binding
- **Renewals:** at 1-year expiry, renewals UX proposes a repeat licence at the current `0.20 × P_editorial.news` rate; if the rate has changed, the new rate applies.

---

## 9. LAW SUITE snippet (founder draft, retained verbatim from concept)

> **Frontfiles Social Media Licence (Standard)**
>
> A non-exclusive, non-transferable, worldwide licence permitting use of the Asset only in public posts, stories, or equivalent feed-mechanics content on a single Licensee-controlled third-party social media account, for a term of one (1) year from the Licence Grant Date.
>
> No print, web article, broadcast, out-of-home, paid advertising, sponsored placement, promotional political, or internal uses are permitted under this licence. Long-form content (videos ≥4 minutes; articles ≥800 words; podcasts; newsletters) on social platforms is excluded.
>
> Cropping and minimal adjustments for platform formatting are allowed, but Licensee may not materially distort the meaning of the underlying event or the people depicted. Derivative formats (memes, captioned reaction images, satirical edits) require explicit creator opt-in.
>
> Sub-licensing, resale, multi-account use under a single licence, and inclusion in media libraries or template packs are prohibited.
>
> Price is set as 0.20× the corresponding `editorial.news` mid-publication editorial licence price for the same Asset, floored at €10.

---

## 10. Outstanding corrections from Claude audit

| ID | Status | Description |
|---|---|---|
| C1 | ✓ Resolved | Cannibalization risk — solved by founder's "one account per licence" refinement (§2.3) |
| C2 | ✓ Resolved | Pricing reference ambiguity — locked to `0.20 × P_editorial.news_at_(format, intrusion, mid_pub)` (§7.1) |
| C3 | ✓ Resolved | Platform-format ambiguity — long-form content (≥4 min videos, ≥800 word articles) excluded (§2.1a) |
| C4 | ✓ Resolved | Derivative-format risk — opt-in via asset-level setting (§4.1) |
| C5 | ✓ Resolved | Political-use overbreadth — narrowed to *promotional* political use (§5.3) |

All five corrections folded back into this draft. Ready for founder ratification.

---

## 11. Architectural placement (LOCKED at this draft)

**Decision:** `editorial.social` sublabel under existing Editorial class — NOT a new top-level `social` class.

**Rationale (per the founder's "very similar to editorial" + "editorial only" refinements):**

- "Editorial only" makes it editorial-class by nature
- "Very similar to editorial" makes it sibling-shaped to existing editorial sublabels
- "Channel-restricted to social" is a medium-restriction sublabel under Editorial
- Pricing rule (`0.20 × P_editorial.news`) slots into `pricing_sublabel_multipliers` cleanly

This reverses the earlier (rejected) consideration of adding a new top-level `social` class to L1 v2. The refinement made the editorial-sublabel placement structurally correct.

---

## 12. Cascade impact (L1 v2.1 amendment chain)

The amendment is light, not a full L1 v3:

| Doc | Change | Effort |
|---|---|---|
| L1 v2 brief | Add `editorial.social` to §4.2 sublabel table; amend §6.1's "no medium restriction in Editorial" rule to read "Editorial supports medium-restriction sublabels starting with `social` in v1.1" | ~15 min |
| L2 schema CHECK | Add `editorial.social` to the array (CHECK accepts 25 dotted values vs. 24) | ~5 min |
| L4a F1 | Cell count UNCHANGED (still 63); sublabel_multipliers gains 1 row → 18 multipliers total | ~10 min |
| L4b BRIEF | No change to composer (sublabel multiplier handled in standard composition) | none |
| L5 calibration | 1 new row in `sublabel_multipliers_v1.csv` (founder fills `editorial.social = 0.20`) | ~5 min |

**Total cascade composition: ~35-45 minutes.** Substantially smaller than the new-top-level-class path estimated earlier.

---

## 13. Approval gate

Founder ratifies this draft before L1 v2.1 amendment composition begins.

Approval means:
- Spec content (§1-§9) is correct
- All five C1-C5 corrections (§10) are resolved
- Architectural placement (§11) is locked at `editorial.social` sublabel
- Cascade impact (§12) is acceptable scope for next session

Founder's options:
1. **Approve** — L1 v2.1 amendment directives compose against this spec
2. **Approve with corrections** — name section(s) needing change; revise; re-approve
3. **Revise** — substantive concerns; redraft
4. **Reject** — abandon the social licence concept for v1; revert to "editorial + CC only"

---

## 14. References

- L1 v2 brief: `docs/licence/LICENCE-TAXONOMY-BRIEF.md` (target of v2.1 amendment)
- L2 directive: `docs/licence/L2-DIRECTIVE.md` (target of CHECK constraint extension)
- L4a corrigenda: `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` (target of multiplier-row addition)
- L5 calibration tooling: `docs/pricing/calibration/sublabel_multipliers_v1.csv` (target of single-row addition)
- Stage B session log: `docs/pricing/calibration/STAGE-B-SESSION-LOG-2026-04-28.md`

---

End of Social Media Licence v1 spec draft (2026-04-28).
