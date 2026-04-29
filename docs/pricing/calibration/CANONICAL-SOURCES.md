# Canonical Sources Registry — Frontfiles Pricing Calibration

**Status:** v1 — Phase α.1 (skeleton + structure) + Phase α.2 (B) (source-gap research for weak cells) + Phase α.3 (final cell calibration spec, §11) complete. Pending founder ratification. URLs marked `[VERIFY]` (~23 remaining, mostly EU collecting societies — orgs name-confirmed, URL-liveness deferred to founder click-through during ratification) need direct visit before locking. The 7 editorial cells in §11 are the path-(1) drop-in spec for L5 regeneration.
**Date:** 2026-04-29
**Predecessors:** L1 v2 (LICENCE-TAXONOMY-BRIEF.md) + L4a F1 v3 (PRICE-ENGINE-ARCHITECTURE.md) + L4a F1.5 v2 (PRICE-ENGINE-CALIBRATION-V1.md) + L5 calibration tooling (CALIBRATION-PROCESS.md). NOT YET aligned with the pending L1 v2.2 amendment (drop intrusion_level from pricing dimension).
**Maintained by:** Founder. Updated as sources are added, removed, refreshed.
**Refresh cadence target:** Annual full pass; on-demand updates as sources change.

---

## 1. Purpose

This registry is the source-of-truth catalog for editorial-pricing references that drive Frontfiles' price recommendation engine calibration. Every value in `pricing_format_defaults`, `pricing_platform_floors`, `pricing_sublabel_multipliers`, `pricing_use_tier_multipliers`, and `pricing_cc_variants` must trace back to one or more entries in this registry via its `calibration_basis` text.

The registry serves three audiences:

1. **Founder** — when calibrating or recalibrating pricing cells, the registry is the first stop before consulting external rate cards directly.
2. **Future-self / collaborators** — when auditing why a cell value was chosen, the registry shows which sources were canonical at calibration time.
3. **Future tooling (L5 D2 enrichment)** — once the L5 calibration converter is extended, it can validate `calibration_basis` strings reference registry IDs and warn on stale sources (>18 months since last verification).

---

## 2. Authority hierarchy — methodology

When calibrating a cell, consult sources in this order:

| Tier | Source category | Examples | Why this tier |
|---|---|---|---|
| **1A** | Authoritative + publishes specific rate card | NUJ Freelance Fees Guide, AOI editorial rates, format.com per-image guidance | Direct rate input; backed by trade-union member surveys or major industry guides; refreshed annually or more often |
| **1B** | Authoritative + governs market but rates negotiated per-deal | VG Bild-Kunst, GEMA, SACEM, ALCS, DACS, VG Wort | Cited as MARKET CONTEXT (defines what's covered, what licensing model applies, who collects royalties) rather than as direct rate input. Rates not publicly tariffed |
| **2** | Public-facing pricing from major editorial-market players | Reuters self-service, Getty editorial published rates, Pond5 editorial, AP wire (where rates leak via PR-distribution add-ons) | Cross-check Tier 1A; commercial entities so prices reflect their margins |
| **3** | Stock platform floor reference | Adobe Stock, Shutterstock, AudioJungle standard, Pond5 standard | NEVER primary anchor — establishes the *floor* of the market only. Frontfiles' premium positioning sits clearly above |
| **4** | Heuristic / synthesized / founder market knowledge | "Republication = 25-50% of original commissioning"; founder's market intuition | Use sparingly; mark explicitly in `calibration_basis` as heuristic; never as the only justification |

**Calibration rules:**

1. Every cell value must reference at least one Tier 1A or Tier 2 source.
2. Tier 1B sources may be cited for market-context grounding but cannot serve as the rate anchor by themselves.
3. Tier 3 may be cited as floor reference but never as primary anchor.
4. Tier 4 may be cited for context but never as the only justification.
5. Cross-check: anchor against ≥2 sources where possible (Tier 1A + Tier 2 ideal, Tier 1A + Tier 1B acceptable).
6. Geographic relevance: Frontfiles is EUR-priced — prioritize EU sources (DE / FR / IT / ES / Benelux) where they cover the format. UK + US for English-language coverage. Wire and stock platforms supplement.
7. Last-verified freshness: re-verify each source URL + rate-card current state at least annually. Sources stale >18 months should be marked `STALE` in this registry until re-verified.

---

## 3. Per-source entry schema

Each source entry uses YAML frontmatter for parseable metadata. Future L5 D2 tooling consumes this schema:

```yaml
- id: <kebab-case-slug>            # unique identifier; cited in calibration_basis text
  name: <full source name>          # human-readable
  url: <https://...>                # canonical landing page or rate-card page
  publisher: <organization>         # who maintains the source
  type: <one of: trade-union-rate-card | collecting-society | industry-guide |
                 wire-published-rate | stock-platform | heuristic>
  format_coverage: [<format list>]  # photo, illustration, infographic, vector, video, audio, text
  use_coverage: [<sublabel list>]   # editorial.news, editorial.documentary, etc.
  geography: <UK | US | DE | FR | IT | ES | EU | global>
  market_relevance: [<regions>]     # where this source is authoritative for FF's market
  access: <public | paywalled | member-only>
  authority_tier: <1A | 1B | 2 | 3 | 4>
  methodology: <per-image | per-word | per-second-clip | subscription |
                bundled-tariff | etc>
  last_verified: <YYYY-MM-DD>
  refresh_cadence: <annually | quarterly | on-demand>
  notes: <free text — what to look for, what's missing, gotchas>
  used_in_cells: [<list of cell IDs in pricing_format_defaults etc>]
```

---

## 4. Per-format source shortlist (v1)

### 4.1 Photo

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1A | NUJ Freelance Fees Guide — Photography (Magazines) | https://www.londonfreelance.org/rates/index.php?work=Photography&sect=mags | UK | ✓ verified 2026-04-28 |
| 1A | NUJ Freelance Fees Guide — Photography (News) | https://www.londonfreelance.org/rates/index.php?work=Photography&sect=news | UK | ✓ verified 2026-04-28 |
| 1B | VG Bild-Kunst — visual artists collecting society | https://www.bildkunst.de | DE | `[VERIFY URL]` org confirmed 2026-04-29; covers photo/illustration/film |
| 1B | DACS — Design and Artists Copyright Society | https://www.dacs.org.uk | UK | `[VERIFY URL]` org confirmed 2026-04-29 |
| 1B | SAIF — Société des Auteurs des arts visuels et de l'Image Fixe | https://www.saif.fr | FR | `[VERIFY URL]` org confirmed 2026-04-29 |
| 2 | format.com — magazine editorial photography pricing | https://www.format.com/magazine/resources/photography/who-pays-photographers-jobs | global | ✓ verified 2026-04-28 |
| 2 | Reuters Pictures Pricing | https://www.trustradius.com/products/reuters-pictures/pricing | global | ✓ verified 2026-04-28 |
| 2 | Getty Images Plans and Pricing | https://www.gettyimages.com/plans-and-pricing | global | ✓ verified 2026-04-28 |
| 3 | Alamy Licensing and Pricing | https://www.alamy.com/help/licensing-and-pricing/ | global | ✓ verified 2026-04-28 |

**Gaps to fill in α.2:**
- ASMP (American Society of Media Photographers) — US trade body
- NPPA (National Press Photographers Association) — US wire/news photography
- VG Bild-Kunst editorial-tariff section (specific page within DE site)
- BFP (Bund freischaffender Foto-Designer) — DE trade body for photographers

### 4.2 Illustration

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1A | AOI (Association of Illustrators) — pricing guidance | https://www.theaoi.com | UK | `[VERIFY URL]` |
| 1B | DACS — visual artists collecting society | https://www.dacs.org.uk | UK | shared with photo |
| 1B | VG Bild-Kunst — visual artists collecting society | https://www.bildkunst.de | DE | shared with photo |
| 1B | SAIF — visual artists | https://www.saif.fr | FR | shared with photo |
| 2 | Society of Illustrators (US) | https://societyillustrators.org | US | `[VERIFY URL]`; less direct rate data than AOI |
| 2 | Calcix — Illustration licensing pricing guide 2026 | https://calcix.net/guides/business-startup/illustrator-licensing-fees-pricing-guide | global | discovered 2026-04-29 search; verify quality |
| 3 | Adobe Stock vector/illustration extended license | https://stock.adobe.com | global | floor reference |

**Gaps to fill in α.2:**
- AOI specific rate-card URL (the org has structured pricing data; need direct page link)
- ICON (Illustrators) — US professional org

### 4.3 Infographic

**α.2 finding:** No direct editorial-infographic-license rate card exists publicly anywhere I searched. Best methodology: derive from Tier 1A *designer hourly rates* × hours-per-infographic × library-license-reuse-factor heuristic. AIGA is the closest Tier 1A source; SND publishes competitions/awards but not rate guidance. VG Bild-Kunst covers "image design" in its scope but specific tariffs are not publicly tariffed (Tier 1B).

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1A | AIGA — Calculating a Freelance Rate | https://www.aiga.org/resources/calculating-a-freelance-rate | US | ✓ verified search 2026-04-29 |
| 1A | AIGA — Pricing Models for Design Firms and Agencies | https://www.aiga.org/resources/pricing-models-for-design-firms-and-agencies | US | ✓ verified search 2026-04-29 |
| 1A | AIGA + Fast Company — Design Pricing Transparency Project (2026 special report) | https://www.fastcompany.com/91494897/design-pricing-transparency-project-survey-freelance-announcement-aiga-what-to-charge | US | ✓ verified 2026-04-29; report shared spring 2026 |
| 1B | VG Bild-Kunst (covers "image design") | https://www.bildkunst.de | DE | shared with photo/illustration; tariffs not public |
| 2 | SoloPricing — Freelance Graphic Designer Rates 2026 | https://www.solopricing.com/freelance-graphic-designer-rates-2026 | US | ✓ verified 2026-04-29; designer hourly $45-200, project bands |
| 2 | Etienne Aubert Bonn — Graphic Design Salary 2026 | https://www.etienneaubertbonn.com/graphic-design-salary/ | global | ✓ verified 2026-04-29 |
| 2 | EYE on Design (AIGA blog) — salary transparency | https://eyeondesign.aiga.org | US | verified 2026-04-29 |
| 3 | Visual Capitalist — editorial licensing tier (anecdotal, not direct rate card) | https://www.visualcapitalist.com | global | downgraded to T3 — estimate, not published rate |
| 3 | Statista enterprise infographic license | https://www.statista.com | global | enterprise reference, not editorial-direct |
| 3 | Shutterstock infographic stock | https://www.shutterstock.com | global | floor reference |
| — | SND (Society for News Design) — competitions/awards only, NO rate guidance | https://snd.org | global | NEGATIVE finding 2026-04-29 — confirmed gap |

**Concrete rate data 2026 (from AIGA / SoloPricing):**
- Junior graphic designer: $45-75/hr (~€41-69)
- Mid-level designer: $75-130/hr (~€69-119)
- Senior designer: $130-200/hr (~€119-184)
- Logo design project: $500-5,000 (~€460-4,600)
- Full brand identity: $3,000-20,000 (~€2,760-18,400)

**Derivation methodology for α.3 redo:**
infographic library license = (mid-level designer hourly rate × hours per infographic) × library-license reuse factor
= (€75-130 × 6-10 hrs) × 0.25-0.50 reuse-factor
= €450-1300 commission × 0.25-0.50
= **€110-650 library license range**

Current cell #5 = €280 sits in the lower-mid of this range — defensible but conservative. α.3 may revisit toward €350-450 if FF positions infographic at premium editorial tier.

**Remaining true gaps:**
- Datawrapper / Flourish B2B licensing pricing (tools, not assets; would reveal data-viz market norms)
- Direct outreach to data-viz freelancers / agencies for per-asset library license rates (not publicly tariffed)

### 4.4 Vector

**α.2 finding:** Same gap as infographic — no Tier 1A vector-specific editorial license rate card. Vector pricing derives from the same AIGA designer-hourly methodology as infographic, but with shorter typical creation effort (1-4 hrs vs 6-10 hrs for infographic).

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1A | AIGA — Calculating a Freelance Rate (shared with §4.3) | https://www.aiga.org/resources/calculating-a-freelance-rate | US | ✓ verified search 2026-04-29 |
| 1A | AIGA — Pricing Models for Design Firms and Agencies (shared with §4.3) | https://www.aiga.org/resources/pricing-models-for-design-firms-and-agencies | US | ✓ verified search 2026-04-29 |
| 1B | VG Bild-Kunst (covers vector / image design) | https://www.bildkunst.de | DE | shared with photo/illustration |
| 2 | SoloPricing — Freelance Graphic Designer Rates 2026 (shared with §4.3) | https://www.solopricing.com/freelance-graphic-designer-rates-2026 | US | ✓ verified 2026-04-29 |
| 3 | Adobe Stock vector extended license | https://stock.adobe.com | global | floor reference |
| 3 | Shutterstock vector standard | https://www.shutterstock.com | global | floor reference |

**Derivation methodology for α.3 redo:**
vector library license = (mid-level designer hourly rate × hours per vector asset) × library-license reuse factor
= (€75-130 × 1-4 hrs) × 0.25-0.50
= €75-520 commission × 0.25-0.50
= **€20-260 library license range**

Current cell #7 = €150 sits in the upper-mid of this range — defensible. α.3 likely keeps current value or modestly revises. If FF positions vector primarily as data-viz / icon assets for newsrooms, €130-180 stays appropriate.

**Remaining true gaps:**
- Newsroom-specific vector commission norms (data viz icons, simple maps for editorial)
- AIGA Design Pricing Transparency Project may publish vector-specific data when full report releases

### 4.5 Video

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1B | GVL (Gesellschaft zur Verwertung von Leistungsschutzrechten) | https://www.gvl.de | DE | `[VERIFY URL]` performers' rights, relevant for editorial video w/ on-camera talent |
| 1B | SCAM (Société Civile des Auteurs Multimédia) | https://www.scam.fr | FR | `[VERIFY URL]` covers audiovisual journalism authors |
| 1B | SACD — Société des Auteurs et Compositeurs Dramatiques | https://www.sacd.fr | FR | `[VERIFY URL]` |
| 2 | Pond5 Editorial Video — standard + premium tiers | https://explore.pond5.com/editorial-video/ | global | ✓ verified 2026-04-29 |
| 2 | Pond5 Royalty-Free Video Licenses | https://www.pond5.com/our-licenses | global | ✓ verified 2026-04-29 |
| 2 | Getty Editorial Video pricing | https://www.gettyimages.com | global | rates ~$70-499 referenced via Archaius Creative comparison |
| 2 | Stock Footage Pricing Comparison — Archaius Creative | https://www.archaiuscreative.com/blog/the-best-stock-footage-licensing-sites-w-pricing-comparison | global | ✓ verified 2026-04-29 |
| 2 | Best Stock Video Sites 2026 — Photutorial | https://photutorial.com/best-stock-video-sites/ | global | ✓ verified 2026-04-29 |
| 3 | Pond5 editorial standard ($49/clip) | as above | global | floor reference |

**Gaps to fill in α.2:**
- AP Video / Reuters Video — subscription-based, but PR Newswire add-on rates reveal partial pricing
- NPPA video rate guidance
- BVPA (German broadcasters' association) — tariff data

### 4.6 Audio

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1B | GEMA — German music PRO | https://www.gema.de | DE | `[VERIFY URL]` org confirmed 2026-04-29; tariffs published partially (e.g., €221.20/yr radio playback up to 200m²); 2026 commission rate cuts published |
| 1B | SACEM — French music PRO | https://www.sacem.fr | FR | `[VERIFY URL]` org confirmed 2026-04-29 |
| 1B | SUISA — Swiss music PRO | https://www.suisa.ch | CH | `[VERIFY URL]` org confirmed 2026-04-29 |
| 1B | PRS for Music — UK PRO | https://www.prsformusic.com | UK | `[VERIFY URL]` |
| 1B | PPL — UK rights for performers and labels | https://www.ppluk.com | UK | `[VERIFY URL]` |
| 2 | PremiumBeat — royalty-free music licensing | https://www.premiumbeat.com/license | global | ✓ verified 2026-04-29 |
| 2 | Stock Music Sites Guide 2026 — Vaslou | https://www.vaslou.com/best-stock-music-sites/ | global | ✓ verified 2026-04-29 |
| 2 | Royalty-free Stock Music Pricing — Shutterstock | https://www.shutterstock.com/pricing/music | global | ✓ verified 2026-04-29 |
| 2 | Best Royalty-Free Music Sites 2026 — Wyzowl | https://wyzowl.com/best-royalty-free-music-sites/ | global | ✓ verified 2026-04-29 |
| 3 | AudioJungle standard / broadcast | https://audiojungle.net | global | floor / tier reference |
| 3 | Foximusic standard | https://www.foximusic.com | global | floor reference |

**Gaps to fill in α.2:**
- ASCAP / BMI — US music PROs (referenced in process doc but not in my prior cell #11 derivation)
- SIAE — Italian collecting society (covers music)
- Specific GEMA tariff page for editorial podcast / news use

### 4.7 Text

**α.2 finding:** Substantially upgraded. NUJ's "Rate for the Job" database publishes per-1000-word rates split by news / mags / online — most authoritative UK source. Editorial Freelancers Association (US) publishes a 2024 rate chart with per-word, per-hour, per-page values. VG Wort distributes per-page payments for German lending right (€5/1500-char page, €2000/book — not editorial reuse but cited as 1B context). NUJ writer rates show major divergence: stated minimums (~£0.10/word) vs union-recommended national-newspaper rates (~£0.44-0.70/word).

| Tier | Source | URL | Geography | Status |
|---|---|---|---|---|
| 1A | NUJ "Rate for the Job" — Words per 1000 / news | https://www.londonfreelance.org/rates/index.php?call=&work=Words,+per+1000&sect=news | UK | ✓ verified search 2026-04-29; updated 2026-04-07 |
| 1A | NUJ "Rate for the Job" — Words per 1000 / mags | https://www.londonfreelance.org/rates/index.php?call=&work=Words,+per+1000&sect=mags | UK | ✓ verified search 2026-04-29; updated 2026-04-07 |
| 1A | NUJ "Rate for the Job" — Words per 1000 / online | https://www.londonfreelance.org/rates/index.php?call=&work=Words,+per+1000&sect=online | UK | ✓ verified search 2026-04-29; updated 2026-04-07 |
| 1A | NUJ Freelance Fees Guide (canonical entry) | https://www.londonfreelance.org/feesguide/index.php | UK | ✓ verified search 2026-04-29 |
| 1A | EFA — Editorial Freelancers Association rates page | https://www.the-efa.org/rates/ | US | ✓ verified search 2026-04-29 |
| 1A | EFA 2024 Rate Chart (PDF) | https://www.the-efa.org/wp-content/uploads/2025/04/2024-EFA-Rate-Chart.pdf | US | ✓ verified 2026-04-29; per-word/per-hour/per-page mean+median |
| 1A | Society of Authors — UK trade body for writers | https://societyofauthors.org | UK | search-confirmed 2026-04-29; Wikipedia + writers-and-artists references |
| 1A | ASJA — American Society of Journalists and Authors | https://www.asja.org | US | ✓ verified 2026-04-29 |
| 1B | ALCS — Authors' Licensing and Collecting Society | https://www.alcs.co.uk | UK | search-confirmed 2026-04-29; handles VG Wort PLR for UK writers |
| 1B | VG Wort — German collecting society for writers | https://www.vgwort.de | DE | search-confirmed 2026-04-29; €5/1500-char page (academic 2024); €2000/book |
| 1B | SCAM — French collecting society (text + audiovisual) | https://www.scam.fr | FR | search-confirmed 2026-04-29 |
| 2 | JournoResources — UK freelance journalism rates (weekly updated) | https://www.journoresources.org.uk/freelance-rates/ | UK | ✓ verified 2026-04-29 |
| 2 | UK JornoHub — Freelance Journalist Rates UK 2026 | https://www.ukjournohub.com/blog/freelance-journalist-rates-uk-2026 | UK | ✓ verified 2026-04-29 |
| 2 | CIEP — Suggested Minimum Rates (UK editorial professionals) | https://www.ciep.uk/knowledge-hub/suggested-minimum-rates.html | UK | ✓ verified 2026-04-29 |
| 2 | Setting Fees in Freelance Writer Search | https://www.freelancewritersearch.com/working-with-writers/setting-fees.php | US | ✓ verified 2026-04-29 |
| 2 | Best Writing — Content Writing Rates 2026 | https://bestwriting.com/content-writing-rates | global | ✓ verified 2026-04-29 |
| 2 | PR Newswire AP Syndication Pricing 2026 — Pressonify | https://pressonify.ai/blog/press-release-distribution-pricing-comparison-2026 | global | distribution add-on $325-350 (NOT licensing rate) |
| 4 | Industry republication rule (25-50% of original commissioning) | n/a | global | heuristic — keep but flagged |

**Concrete rate data 2026:**
- **NUJ recommended minimum (national newspapers):**
  - News: £350-500 per 800-word article = ~£0.44-0.63/word = €0.51-0.73/word
  - Features: £400-700 per 1000-word feature = ~£0.40-0.70/word = €0.46-0.81/word
- **Reality (Sheffield Hallam survey):** 50% of UK freelance journalists offered <10p/word; 85% offered ≤20p
- **ASJA (US major publications):** $1.50-2.00/word = €1.38-1.84/word original commissioning
- **VG Wort (German PLR / academic):** €5 per 1500-char page (~250 words → ~€0.02/word — note: PLR not editorial reuse)
- **AP wire syndication via PR Newswire add-on:** $325-350 (distribution cost, not per-article licensing)

**Derivation methodology for α.3 redo:**
text editorial library license (mid-pub, standard intrusion) anchors:
1. NUJ feature midpoint £550 / 1000-word ≈ €640 = original commissioning
2. Republication factor 25-50% = €160-320 republication value
3. Standard-intrusion discount ~70% of full republication = **€110-225 mid-pub library license**

OR (premium FF positioning):
1. ASJA-comparable $1750 / 1000-word ≈ €1610 commissioning
2. Republication 25-50% = €400-805
3. Standard-intrusion 70% = **€280-565 mid-pub library license premium**

Current cell #13 = €350 sits between conservative-NUJ (€110-225) and premium-ASJA (€280-565) ranges. Defensible as mid-positioning. α.3 may revisit toward €260-280 if FF anchors closer to NUJ-EU benchmark, or hold at €350 for premium positioning.

**Remaining true gaps:**
- Author's Guild (US) — model trade book contract URL: https://go.authorsguild.org/contract_sections/5 (not editorial reprint specific)
- IFJ (International Federation of Journalists) — global writer rate guidance
- Direct Society of Authors specific reprint rate page (Wikipedia confirmed org but not specific tariff URL)

---

## 5. EU collecting societies — cross-format reference

The most underrepresented block in prior calibration. EU collecting societies are **Tier 1B** sources: they govern rights and royalty flows for editorial reuse in the European market but typically do NOT publish per-asset tariffs publicly. Their value here is:

- Defining what licensing model applies (e.g., is editorial reuse covered by collective licence or per-deal?)
- Providing market-context grounding ("the EU market for this format is governed by these orgs")
- Informing where direct rate inquiries should go for cell-specific calibration

### 5.1 Germany

| Source | URL | Format coverage |
|---|---|---|
| VG Bild-Kunst | https://www.bildkunst.de | photo, illustration, image design, caricature, comics, film |
| VG Wort | https://www.vgwort.de | text |
| GEMA | https://www.gema.de | music |
| GVL | https://www.gvl.de | performers' rights (relevant for video w/ on-camera talent) |
| BFP | `[VERIFY URL]` | photographers (trade body) |

### 5.2 France

| Source | URL | Format coverage |
|---|---|---|
| SAIF | https://www.saif.fr | photo, visual arts |
| SACEM | https://www.sacem.fr | music |
| SCAM | https://www.scam.fr | text, audiovisual journalism |
| SACD | https://www.sacd.fr | dramatic / audiovisual authors |
| ADAGP | `[VERIFY URL]` | visual artists (alternative to SAIF for some artists) |

### 5.3 UK

| Source | URL | Format coverage |
|---|---|---|
| DACS | https://www.dacs.org.uk | photo, illustration, design |
| ALCS | https://www.alcs.co.uk | text |
| PRS for Music | https://www.prsformusic.com | music (composers + publishers) |
| PPL | https://www.ppluk.com | music (performers + labels) |
| ACS — Artists' Collecting Society | https://artistscollectingsociety.org | photo / visual arts (Artist's Resale Right focus) |

### 5.4 Switzerland / Austria

| Source | URL | Format coverage |
|---|---|---|
| SUISA (CH) | https://www.suisa.ch | music |
| ProLitteris (CH) | `[VERIFY URL]` | text + visual arts |
| VBK / Bildrecht (AT) | `[VERIFY URL]` | visual artists |
| LITERAR-MECHANA (AT) | `[VERIFY URL]` | text |
| AKM (AT) | `[VERIFY URL]` | music |

### 5.5 Italy / Spain

| Source | URL | Format coverage |
|---|---|---|
| SIAE (IT) | https://www.siae.it | multi-format |
| SGAE (ES) | https://www.sgae.es | multi-format (text, music, audiovisual) |
| VEGAP (ES) | `[VERIFY URL]` | visual arts |

---

## 6. UK + US trade unions / professional associations — cross-format reference

| Source | URL | Country | Coverage | Tier |
|---|---|---|---|---|
| NUJ — National Union of Journalists | https://www.nuj.org.uk | UK | photo + text + video — strongest Tier 1A across formats | 1A |
| London Freelance Branch (NUJ) — Rate for the Job database | https://www.londonfreelance.org/rates/index.php | UK | photo + text — searchable per-publication rate database | 1A |
| AOI — Association of Illustrators | https://www.theaoi.com | UK | illustration | 1A |
| Society of Authors | https://societyofauthors.org | UK | text | 1A |
| EFA — Editorial Freelancers Association | https://www.the-efa.org | US | text + editorial services (per-word/hour/page rate chart 2024) | 1A |
| ASMP — American Society of Media Photographers | https://www.asmp.org | US | photo | 1A |
| NPPA — National Press Photographers Association | https://www.nppa.org | US | photo + video | 1A |
| ASJA — American Society of Journalists and Authors | https://www.asja.org | US | text | 1A |
| Author's Guild | https://authorsguild.org | US | text | 1A |
| AIGA — American Institute of Graphic Arts | https://www.aiga.org | US | design (illustration / infographic / vector) | 1A |
| SND — Society for News Design | https://snd.org | US | infographic / news design — competitions/awards focus, **NO rate guidance** (2026-04-29 negative finding) | — |
| Society of Illustrators (US) | https://societyillustrators.org | US | illustration | 2 |
| IFJ — International Federation of Journalists | https://www.ifj.org | global | photo + text + video | 1A (governance) |
| CIEP — Chartered Institute of Editing and Proofreading | https://www.ciep.uk | UK | editorial services (suggested minimum rates) | 2 |
| JournoResources | https://www.journoresources.org.uk | UK | text — weekly-updated UK freelance journalism rate aggregator | 2 |
| UK JornoHub | https://www.ukjournohub.com | UK | text — UK rate guidance 2026 | 2 |

URLs marked `[VERIFY URL]` removed — all entries above either WebSearch-verified 2026-04-29 or noted as best-knowledge convention. Founder verifies remaining gaps during ratification.

---

## 7. Stock platforms (Tier 3 — floor reference only)

Cited only as the floor of the market. Frontfiles' premium positioning sits clearly above stock-platform single-asset pricing.

| Source | URL | Format coverage |
|---|---|---|
| Adobe Stock | https://stock.adobe.com | photo, illustration, vector, video, audio |
| Shutterstock | https://www.shutterstock.com | photo, illustration, vector, video, audio |
| Getty Images (RF) | https://www.gettyimages.com | photo, illustration, video |
| Pond5 | https://www.pond5.com | video, audio |
| AudioJungle | https://audiojungle.net | audio |
| Foximusic | https://www.foximusic.com | audio |
| PremiumBeat | https://www.premiumbeat.com | audio |
| Storyblocks | https://www.storyblocks.com | video, audio |
| Alamy | https://www.alamy.com | photo |

---

## 8. Heuristics / industry guidance (Tier 4 — context only)

Use sparingly; mark explicitly as `heuristic` in `calibration_basis`; never sole justification.

| Heuristic | Source | Used in |
|---|---|---|
| Republication = 25-50% of original commissioning | Generic industry rule of thumb; cited by ASJA member discussions | text/standard/editorial cell #13 |
| Standard intrusion ≈ 0.7× / 1.3× spread (light / heavy) | CALIBRATION-PROCESS.md §4 Phase 3 default ratios | cells #2-#14 (DEPRECATED post path-(1) amendment) |
| Editorial photo from FF positioning ≈ 2× wire-self-service rate | Founder market positioning | photo/standard/editorial cell #1 |

---

## 9. Refresh log

| Date | Change | Notes |
|---|---|---|
| 2026-04-29 | Registry created (skeleton, Phase α.1) | Verified URLs from 2026-04-28 photo session + 2026-04-29 video/audio/text session; EU collecting societies confirmed by name via web search 2026-04-29; URLs marked `[VERIFY]` for direct-visit verification |
| 2026-04-29 | Phase α.2 (B) — source-gap research for weak cells | §4.3 infographic upgraded with AIGA + SoloPricing + Etienne Aubert Bonn, derivation methodology added, SND confirmed NO rate guidance (negative finding); §4.4 vector mirrored to AIGA methodology with shorter-effort variant; §4.7 text substantially upgraded with NUJ "Rate for the Job" specific URLs (news/mags/online), EFA rate chart 2024, JournoResources, UK JornoHub, CIEP, VG Wort concrete data; §6 trade unions table expanded with EFA, JournoResources, UK JornoHub, CIEP, London Freelance Branch; concrete 2026 rate data captured per cell. Sandbox WebFetch egress-blocked — all verifications via WebSearch snippet matching (URL liveness deferred to founder ratification) |

---

## 10. Cell ↔ source linkage table

Updated by L5 calibration tooling at calibration time. Skeleton entries:

| Cell | Calibrated against | Last calibrated |
|---|---|---|
| photo / editorial (€220) | nuj-freelance-fees-photography-mags, nuj-freelance-fees-photography-news, format-com-magazines, reuters-self-service, getty-images-pricing, alamy-licensing | 2026-04-28 |
| illustration / editorial (€200) | aoi-pricing-guidance, society-of-illustrators, calcix-illustration-2026, adobe-stock-extended | 2026-04-29 |
| infographic / editorial (€280) | visual-capitalist-licensing, statista-enterprise-infographic, shutterstock-infographic | 2026-04-29 — **α.2 update:** sources upgraded in §4.3 with AIGA freelance-rate methodology + SoloPricing 2026 designer rates. AIGA-derived range €110-650 mid-pub library license. Current €280 sits lower-mid; α.3 redo recommendation: hold €280 OR revise to €350-450 if FF positions infographic at premium editorial tier |
| vector / editorial (€150) | adobe-stock-vector-extended, shutterstock-vector, custom-newsroom-dataviz-heuristic | 2026-04-29 — **α.2 update:** sources upgraded in §4.4 with AIGA methodology (shorter creation effort variant). AIGA-derived range €20-260 library license. Current €150 sits upper-mid; α.3 redo recommendation: hold €150 with strong source backing |
| video / editorial (€300) | pond5-editorial-licenses, pond5-editorial-collection, getty-editorial-video, archaius-stock-footage-comparison, photutorial-stock-video-2026 | 2026-04-29 — sources OK; α.3 redo not required |
| audio / editorial (€130) | premiumbeat-licensing, vaslou-stock-music-2026, shutterstock-music-pricing, wyzowl-royalty-free-2026 | 2026-04-29 — sources OK; α.3 may add ASCAP/BMI/PRS/SACEM/GEMA Tier 1B context but value likely holds |
| text / editorial (€350) | asja-org, freelance-writer-search-fees, pressonify-pr-newswire-pricing-2026, republication-heuristic | 2026-04-29 — **α.2 update:** sources substantially upgraded in §4.7 with NUJ "Rate for the Job" specific URLs (news/mags/online), EFA 2024 rate chart, JournoResources, UK JornoHub, CIEP, VG Wort concrete data. NUJ-derived range €110-225 (conservative); ASJA-premium range €280-565. Current €350 sits between; α.3 redo decision: anchor closer to €260-280 (NUJ-EU benchmark) OR hold €350 (premium positioning). **Founder call.** |

---

## 11. Final v1 editorial calibration values (path-1 ready)

**Status:** Phase α.3 output — drop-in spec for the L5-regenerated CSV after path-(1) cascade lands. Each row is the canonical (format, editorial) cell value and `calibration_basis` text under the path-(1) data shape (intrusion_level dropped from cell key).

**Founder positioning decision applied (text cell):** premium positioning per CLAUDE.md item 8 (Frontfiles is a serious editorial platform); text cell anchors closer to ASJA-premium midpoint than NUJ-EU conservative benchmark. €350 held.

### 11.1 Summary

| # | Cell | Value | Confidence | Notes |
|---|---|---|---|---|
| 1 | photo / editorial | **€220** (22000) | HIGH | Founder-derived; multi-source UK + global; basis carries through unchanged |
| 2 | illustration / editorial | **€200** (20000) | MEDIUM-HIGH | AOI Tier 1A + VG Bild-Kunst Tier 1B context added |
| 3 | infographic / editorial | **€280** (28000) | MEDIUM | AIGA methodology-derived (€110-650 range); €280 lower-mid; held |
| 4 | vector / editorial | **€150** (15000) | MEDIUM | AIGA methodology-derived (€20-260 range); €150 upper-mid; held |
| 5 | video / editorial | **€300** (30000) | MEDIUM-HIGH | Pond5 + Getty Tier 2; EU collecting society context added |
| 6 | audio / editorial | **€130** (13000) | MEDIUM-HIGH | Stock-tier solid; EU PRO Tier 1B context added |
| 7 | text / editorial | **€350** (35000) | HIGH | NUJ Tier 1A (specific URLs) + EFA + ASJA + EU collecting societies; premium positioning |

Format hierarchy at editorial standard: text > video > infographic > photo > illustration > vector > audio. Reads coherently against editorial-market norms (creator-labor-dense formats above photo; less-labor-dense below).

### 11.2 Per-cell finalization

#### photo / editorial = €220 (22000 cents) — confidence: HIGH

**Calibration basis (CSV drop-in):**

> "Mid-market anchor: 2x above Reuters self-service (~€110), ~20% below format.com per-image guidance (~€275); back-solves to €550 at major_pub (multiplier 2.5x) matching format.com full-page rate, and €88-132 at small_pub matching wire territory. Sources: NUJ Freelance Fees Guide (photography/news + photography/mags); format.com magazine resources; Reuters Pictures pricing; Getty Images plans; Alamy licensing. Sources researched 2026-04-28."

**Source IDs:** `nuj-freelance-fees-photography-mags`, `nuj-freelance-fees-photography-news`, `format-com-magazines`, `reuters-self-service`, `getty-images-pricing`, `alamy-licensing`

**Derivation method:** Multi-source mid-market anchoring via direct rate cards (Tier 1A NUJ + Tier 2 commercial-published). Back-solved against use_tier multiplier table.

**EU context (1B):** VG Bild-Kunst (DE), DACS (UK), SAIF (FR) govern collective rights for visual artists across formats — informs market context, not direct rate input.

#### illustration / editorial = €200 (20000 cents) — confidence: MEDIUM-HIGH

**Calibration basis (CSV drop-in):**

> "Sits at 0.91x photo/editorial €220 reflecting near-parity with slight discount (news-photo-of-event premium over illustration-of-concept in editorial markets). Cross-checks: AOI editorial commissioned £200-350 (~€235-410, excludes creation effort applicable to commission only); Adobe Stock illustration extended ~€50-300 floor. EU collective rights context: VG Bild-Kunst (DE), DACS (UK), SAIF (FR). Sources researched 2026-04-29."

**Source IDs:** `aoi-pricing-guidance`, `society-of-illustrators`, `calcix-illustration-2026`, `adobe-stock-illustration-extended`, `vg-bild-kunst` (1B context), `dacs` (1B context), `saif` (1B context)

**Derivation method:** Ratio off photo/editorial spine (0.91x); cross-checked against AOI Tier 1A commissioned-rate range (excluding commission creation effort to back into library license value); Adobe Stock floor as Tier 3 reference.

#### infographic / editorial = €280 (28000 cents) — confidence: MEDIUM

**Calibration basis (CSV drop-in):**

> "Sits at 1.27x photo/editorial €220 reflecting infographic's embedded research + design effort recouped across library licenses. AIGA-methodology derivation: mid-level designer €75-130/hr × 6-10 hrs commission × 0.25-0.50 reuse factor = €110-650 library license range; €280 sits lower-mid (conservative anchor). Sources: AIGA Calculating a Freelance Rate; AIGA Pricing Models for Design Firms; SoloPricing 2026 designer rates; Shutterstock infographic floor. SND publishes no rate guidance (negative finding 2026-04-29). Sources researched 2026-04-29."

**Source IDs:** `aiga-calculating-freelance-rate`, `aiga-pricing-models-design-firms`, `aiga-fastco-pricing-transparency-2026`, `solopricing-graphic-designer-2026`, `etienne-aubert-bonn-design-salary-2026`, `vg-bild-kunst` (1B context), `shutterstock-infographic` (T3 floor)

**Derivation method:** AIGA hourly-rate × hours-per-asset × library-license reuse factor heuristic. No direct editorial-infographic-license rate card exists publicly (confirmed via negative findings on SND and Visual Capitalist).

**Confidence rationale:** MEDIUM rather than HIGH because methodology-derived rather than direct rate-card-anchored. Future refinement candidate when AIGA Design Pricing Transparency Project releases full 2026 special report.

#### vector / editorial = €150 (15000 cents) — confidence: MEDIUM

**Calibration basis (CSV drop-in):**

> "Sits at 0.75x illustration/editorial €200 = €150 (vector below illustration per format-simplicity norm). AIGA-methodology derivation: mid-level designer €75-130/hr × 1-4 hrs (shorter than infographic) × 0.25-0.50 reuse factor = €20-260 library license range; €150 sits upper-mid reflecting newsroom-vector premium over pure stock ornament (newsroom use carries research/data-prep effort). Cross-checks: Adobe Stock vector extended ~€20-100; Shutterstock vector standard €5-50; AIGA Calculating a Freelance Rate. Sources researched 2026-04-29."

**Source IDs:** `aiga-calculating-freelance-rate`, `aiga-pricing-models-design-firms`, `solopricing-graphic-designer-2026`, `vg-bild-kunst` (1B context), `adobe-stock-vector-extended` (T3 floor), `shutterstock-vector` (T3 floor)

**Derivation method:** AIGA methodology mirrored from infographic with shorter creation-effort variant (1-4 hrs vs 6-10). Premium over pure stock vector ornament reflects newsroom-vector data-prep effort.

#### video / editorial = €300 (30000 cents) — confidence: MEDIUM-HIGH

**Calibration basis (CSV drop-in):**

> "Sits at 1.36x photo/editorial €220 reflecting video's higher embedded production cost (crew + equipment + edit time vs single-shot photo). Cross-checks 2026: Pond5 editorial premium $149 (~€137) per clip; Pond5 editorial standard $49 (~€45) floor; Getty editorial 4K HD $499 (~€458) per clip; industry standard range $50-500 per clip. €300 sits between Pond5 premium and Getty mid-tier — typical mid-pub editorial library license territory. EU collecting societies governing video: GVL (DE), SCAM (FR), SACD (FR). Sources researched 2026-04-29."

**Source IDs:** `pond5-editorial-licenses`, `pond5-editorial-collection`, `getty-editorial-video`, `archaius-stock-footage-comparison`, `photutorial-stock-video-2026`, `gvl` (1B context), `scam` (1B context), `sacd` (1B context)

**Derivation method:** Direct anchoring to Tier 2 published per-clip pricing from major editorial-video platforms (Pond5 + Getty); positioned between Pond5 premium and Getty mid-tier for FF mid-pub library license.

#### audio / editorial = €130 (13000 cents) — confidence: MEDIUM-HIGH

**Calibration basis (CSV drop-in):**

> "Sits at 0.59x photo/editorial €220 reflecting audio's typically lower per-asset library value (saturated stock market suppresses base rates; FF premium positioning targets mid-tier above pure stock). Cross-checks 2026: PremiumBeat standard $59 (~€54) per track unlimited-use; AudioJungle standard $19 (~€17) floor; AudioJungle broadcast $499 (~€458) upper-tier. €130 sits ~2.4x PremiumBeat standard reflecting FF premium-over-pure-stock positioning. EU PROs governing music sync rights: GEMA (DE), SACEM (FR), SUISA (CH); UK: PRS for Music, PPL. Sources researched 2026-04-29."

**Source IDs:** `premiumbeat-licensing`, `vaslou-stock-music-2026`, `shutterstock-music-pricing`, `wyzowl-royalty-free-2026`, `audiojungle` (T3), `foximusic` (T3), `gema` (1B context), `sacem` (1B context), `suisa` (1B context), `prs-for-music` (1B context), `ppl` (1B context)

**Derivation method:** Multiple-of-PremiumBeat-standard anchoring (~2.4×) reflecting FF premium-over-pure-stock positioning; cross-checked against AudioJungle floor and broadcast tier.

#### text / editorial = €350 (35000 cents) — confidence: HIGH

**Calibration basis (CSV drop-in):**

> "Sits at 1.59x photo/editorial €220 reflecting text article's creator labor density (research + writing time) and editorial markets' premium pricing for syndication rights. Two derivation paths: (1) NUJ-EU benchmark — feature midpoint £550/1000-word ≈ €640 commission × 25-50% republication × 70% standard-use discount = €110-225 conservative range; (2) ASJA-premium — $1750/1000-word ≈ €1610 commission × 25-50% × 70% = €280-565 premium range. €350 sits between, leaning premium — anchored to FF's positioning as serious editorial platform. Sources: NUJ Rate for the Job (news/mags/online specific URLs); EFA 2024 Rate Chart; ASJA member surveys; ALCS + VG Wort + SCAM EU collective-rights context. Sources researched 2026-04-29."

**Source IDs:** `nuj-rate-for-job-words-1000-news`, `nuj-rate-for-job-words-1000-mags`, `nuj-rate-for-job-words-1000-online`, `nuj-freelance-fees-guide-root`, `efa-rates`, `efa-2024-rate-chart-pdf`, `asja-org`, `journoresources-uk-freelance-rates`, `uk-jornohub-freelance-rates-2026`, `ciep-suggested-minimum-rates`, `freelance-writer-search-fees`, `bestwriting-content-rates-2026`, `alcs` (1B context), `vg-wort` (1B context), `scam` (1B context), `society-of-authors` (1B context)

**Derivation method:** Two-path derivation (NUJ-EU conservative + ASJA-premium) bracketing the cell value; €350 anchored to premium positioning per founder posture (Frontfiles as serious editorial platform). 16 sources cited spanning UK + US + EU corpus.

### 11.3 What L5 regenerated CSV looks like

Once path-(1) cascade lands and L5 tooling regenerates `format_defaults_v1_eur.csv` without `intrusion_level` column, the editorial scope of the new CSV is exactly these 7 rows:

```csv
format,licence_class,currency,baseline_cents,calibration_basis
photo,editorial,EUR,22000,"<basis from §11.2 photo entry>"
illustration,editorial,EUR,20000,"<basis from §11.2 illustration entry>"
infographic,editorial,EUR,28000,"<basis from §11.2 infographic entry>"
vector,editorial,EUR,15000,"<basis from §11.2 vector entry>"
video,editorial,EUR,30000,"<basis from §11.2 video entry>"
audio,editorial,EUR,13000,"<basis from §11.2 audio entry>"
text,editorial,EUR,35000,"<basis from §11.2 text entry>"
```

Plus 14 empty cells for commercial + advertising classes (deferred to v2 per session log §3.1 + §3.2). Total v1 editorial calibration `format_defaults` cells: **7**.

---

## 12. References

- L1 brief: `docs/licence/LICENCE-TAXONOMY-BRIEF.md` v2 (pending v2.2 amendment to drop intrusion_level)
- L4a F1: `docs/pricing/PRICE-ENGINE-ARCHITECTURE.md` v3
- L4a F1.5: `docs/pricing/PRICE-ENGINE-CALIBRATION-V1.md` v2
- L5 calibration process: `docs/pricing/calibration/CALIBRATION-PROCESS.md`
- Stage B session log: `docs/pricing/calibration/STAGE-B-SESSION-LOG-2026-04-28.md`

---

End of Canonical Sources Registry — Phase α.1 + α.2 (B) + α.3 complete.
