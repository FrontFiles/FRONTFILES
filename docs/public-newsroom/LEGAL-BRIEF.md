# Legal Brief — Frontfiles Public Newsroom Distribution (v1)

**Status:** Draft for external counsel review
**Date:** 2026-04-24
**From:** João Nuno Martins, Frontfiles
**Subject:** Licensing, terms, and policy pages for v1 launch

---

## 1. Purpose of this brief

This brief gives external counsel what they need to draft the legal and policy pages for the v1 launch of Frontfiles' Public Newsroom Distribution product. It contains the full licence semantics, rendering surface area, AI training posture, content standards outline, and resolved interpretive questions — in the form they will be implemented in product.

Counsel is not asked to opine on product architecture. Counsel is asked to produce enforceable terms and policy pages that faithfully express the product decisions below, and to answer seven specific legal questions listed in §10.

## 2. Product in one page

Frontfiles Public Newsroom is a distribution system for publicly-authorised source material — press releases, press kits, campaign assets, artist and sports media — published by organisations (brands, labels, teams, federations, agencies, publicists) and consumed by working journalists, editors, and publishers.

- **Primary object**: a Pack (press kit) containing one or more Assets. One Pack = one licence class, one credit line, one embargo policy.
- **Uploader**: an Organisation, verified via DNS TXT + domain email (`verified_source`) or with an added authorised signatory (`verified_publisher`, v1.1).
- **URL**: `newsroom.frontfiles.com/{org-slug}/{pack-slug}`. Distinct from paid Frontfiles.
- **Primary action**: download pack (zip) or download individual asset. Embed is a secondary affordance. Publishers self-host.
- **Embargo**: full workflow with approved-recipient list, per-recipient access log, automatic lift, subscriber notification.
- **Provenance**: signed download receipts (Ed25519), opt-in C2PA manifests, AI training opt-out via W3C TDMRep + contractual terms.
- **Claims & takedown**: first-class workflow with public intake, DMCA-compliant counter-notice process, controlled-list tombstone.

## 3. Licence classes — the core

Five enumerated licence classes. One per Pack. Five deterministic permission flags per class.

### 3.1 Enumeration and flags

| licence_class | can_modify | requires_attribution | use_context | ai_training_permitted | redistribution_permitted |
|---|---|---|---|---|---|
| `press_release_verbatim` | false | true | editorial | false | true |
| `editorial_use_only` | false | true | editorial | false | true |
| `promotional_use` | false | true | any | false | true |
| `cc_attribution` | true | true | any | true | true |
| `cc_public_domain` | true | false | any | true | true |

### 3.2 Flag semantics

- `can_modify` — whether the asset itself may be altered (crop, colour, text edit, derivative). Standard editorial treatment (minor crop, tone correction) is customary practice and out of scope of this flag.
- `requires_attribution` — whether the Pack's `credit_line` must be displayed where the asset appears.
- `use_context` — `editorial` (news reporting, commentary, review) / `promotional` (marketing, advertising, partner materials) / `any`.
- `ai_training_permitted` — whether the asset may be ingested into AI model training datasets.
- `redistribution_permitted` — whether the recipient may re-host or re-publish the asset beyond the publication context for which it was licensed.

### 3.3 Plain-English blurbs (basis of Legal-signed copy)

These blurbs render verbatim on the Pack page, in the embed snippet attribution, in the download receipt terms summary, and in the licence terms page. Counsel is asked to ratify these blurbs or propose minimal edits that preserve the same meaning.

- **press_release_verbatim** — "Published for reporting. Reproduce the text without modification. Excerpting is permitted when quoted accurately for news reporting or commentary. Translation is permitted when faithful and marked as a translation. Credit the source as shown."
- **editorial_use_only** — "Use in news reporting, commentary, or review. Credit the source. Do not alter the asset. Not for advertising, sponsored content, native advertising, advertorial, or branded content."
- **promotional_use** — "Use in editorial or promotional contexts. Credit the source. Do not alter the asset."
- **cc_attribution** (CC BY 4.0) — "Use, adapt, and redistribute for any purpose, including commercial. Credit the creator as shown. Full terms: creativecommons.org/licenses/by/4.0/"
- **cc_public_domain** (CC0 1.0) — "No rights reserved. Use, adapt, and redistribute freely. Attribution appreciated, not required. Full terms: creativecommons.org/publicdomain/zero/1.0/"

### 3.4 Machine-readable metadata

| licence_class | licence_code | licence_uri |
|---|---|---|
| press_release_verbatim | `FF-PRV-1.0` | https://frontfiles.com/licences/press-release-verbatim/1.0 |
| editorial_use_only | `FF-EDU-1.0` | https://frontfiles.com/licences/editorial-use-only/1.0 |
| promotional_use | `FF-PROMO-1.0` | https://frontfiles.com/licences/promotional-use/1.0 |
| cc_attribution | `CC-BY-4.0` | https://creativecommons.org/licenses/by/4.0/ |
| cc_public_domain | `CC0-1.0` | https://creativecommons.org/publicdomain/zero/1.0/ |

## 4. What Legal is asked to produce

Nine deliverables, in priority order.

### 4.1 FF-* licence terms pages

Three public pages at the URIs above. Each page contains:

- Page title with plain-English class name and version
- The short blurb from §3.3 above the fold
- Full terms: "You may…", "You may not…", "Attribution requirements", "Disclaimers", "Governing law", "Version and updates"
- A `#tdm` anchor section linking to §6 below
- Versioning: v1.0 is the first published version; future versions increment without breaking existing Pack references (existing Packs remain bound to the version they were published under)

### 4.2 Content standards policy

Single public page at `frontfiles.com/policies/content-standards`. See §7 for the scope outline.

### 4.3 AI training rights-reservation page

Single public page at `frontfiles.com/policies/ai-training`. See §6.

### 4.4 Claims and takedown policy

Single page at `frontfiles.com/policies/claims`. Must cover:

- Who may submit a claim and on what grounds
- Reason categories: trademark infringement, copyright, defamation, privacy, embargo breach, other
- Required claimant information, including the DMCA 512(c)(3) sworn statement for copyright
- Review timeline and outcomes
- **Counter-notice process** — full DMCA 512(g)-compliant procedure for the affected distributor; product default window 10 business days
- Appeal mechanics
- Jurisdictional notes

### 4.5 Distributor Terms of Service

Terms governing Organisation accounts. Must include:

- Verification obligations and accuracy
- Permitted uses of the platform
- Rights-warranty obligations per §5 below (subject releases, third-party content clearance, music clearance)
- Indemnification — distributor indemnifies Frontfiles for third-party claims arising from their Packs
- Embargo commitments
- Liability allocation
- Governing law, dispute resolution, termination

### 4.6 Consumer Terms of Use

Terms governing journalist/consumer accounts and anonymous access. Must include:

- Licence acceptance on download
- Embargo obligations for pre-lift recipients
- Prohibition on circumventing licence, credit, or TDM restrictions
- Account responsibilities

### 4.7 Privacy policy

Global privacy policy. Must cover:

- GDPR and UK GDPR compliance
- CCPA/CPRA for California users
- Data categories: account data, download events, preview accesses, IP, user-agent
- Retention: Pack bytes indefinite unless taken down; taken-down bytes deleted within 30 days; tombstone metadata and DownloadReceipts retained 7 years; Recipient personal data deletable on DSR request; DistributionEvent rows aggregated to outlet-domain after 24 months with PII stripped
- Data-subject rights and request mechanism

### 4.8 DPA template

Template Data Processing Agreement for EU-subject data. Distributors may execute as part of signup or on request.

### 4.9 Brand / verification policy page

Public page at `frontfiles.com/policies/verification`. Explains what "verified source" and "verified publisher" mean, how verification is obtained, how it can be revoked, and what representations Frontfiles does and does not make.

**Mandatory terminology constraints** for this page and any legal/policy surface:
- Do not use "certified" anywhere.
- Do not use "official" unqualified.
- Use "verifiable", "tamper-evident", "independently verifiable", "provenance-aware" where the meaning is technical.

## 5. Rights warranty primitive

At publish time the distributor must confirm three boolean warranties in the product UI, captured in a `RightsWarranty` object attached to the Pack:

1. **Subject releases**: "All identifiable people in this pack have given required releases, or this pack contains no identifiable people."
2. **Third-party content**: "All third-party content in this pack is cleared for this use, or this pack contains no third-party content."
3. **Music**: "All music in this pack is cleared for this use, or this pack contains no music."

The warranty is required for a Pack to leave `draft`. It is immutable post-publish. Counsel is asked to (a) ratify the exact copy above as enforceable warranty language and (b) ensure the distributor ToS (§4.5) makes the indemnification teeth explicit.

## 6. AI training opt-out posture

### 6.1 Legal basis

- **EU**: Article 4 of Directive (EU) 2019/790 (DSM Directive) provides a TDM exception with an opt-out available when rights holders express a reservation via machine-readable means. AI Act Article 53(1)(c) obliges general-purpose AI providers to respect those reservations. The European Commission's consultation on standard opt-out protocols closed January 2026; canonical guidance may be published during or after v1 launch. Frontfiles adopts W3C TDMRep as its v1 machine-readable expression and will align with any subsequent Commission-blessed protocol as a minor, non-breaking change.
- **US**: contractual, via the licence terms accepted on download. No settled statutory AI training opt-out.
- **Other jurisdictions**: contractual plus declaratory.

### 6.2 Implementation

For Packs where `ai_training_permitted = false`:

- Contractual clause in the FF-* terms page: "You may not use the Work to train, fine-tune, or develop artificial intelligence models."
- W3C TDMRep meta tags in the HTML embed snippet:
  - `<meta name="tdm-reservation" content="1">`
  - `<meta name="tdm-policy" content="{licence_uri}#tdm">`
- `/.well-known/tdmrep.json` at every newsroom subdomain
- `/ai.txt` at every newsroom subdomain
- XMP/IPTC metadata in zip exports
- C2PA `training-mining` assertion set to `notAllowed` when signing is opted in
- Download receipt terms summary states the reservation
- UI language: "AI training not permitted by this source." Never "blocked" — no overclaim of enforcement capability.

Counsel is asked to:

- Draft the contractual clause for inclusion in each FF-* terms page
- Review and produce the public rights-reservation page (§4.3)
- Confirm the posture does not overstate enforcement capability

### 6.3 Voluntary AI licensing

Out of scope for v1. Frontfiles does not sign collective AI training licences on behalf of distributors in v1.

## 7. Content standards — outline for the policy page

Counsel to produce the formal policy. Scope must cover, at minimum:

- CSAM and sexualised content involving minors — prohibited; hash-matched at ingestion; statutory reporting (e.g. NCMEC) obligations where applicable.
- Non-consensual intimate imagery — prohibited.
- Promotion of terrorism or violent extremism — prohibited.
- Hate speech targeting protected classes — prohibited.
- Health disinformation during public-health emergencies — prohibited or restricted.
- Electoral and political disinformation — restricted, with additional disclosure requirements.
- Malware, exploit code, phishing — prohibited.
- Catch-all: content a reasonable verified source would not publish.

**Enforcement**:
- Pre-ingestion scanning at upload (malware + visual content moderation) generates an `AssetScanResult`.
- Flagged results route to admin review.
- Violations: asset removal, Pack takedown, or verification revocation — each an auditable admin action.
- CSAM is a hard boundary: auto-escalation, organisation freeze, immutable record, legal notification outside product boundary.

## 8. Four interpretive questions resolved during spec (for counsel review)

Counsel is asked to review and either ratify or propose minimum-change alternatives.

### Q1 — Does `press_release_verbatim` permit excerpting or translation?

**Product resolution**: yes, both, with constraints. Excerpting permitted for good-faith reporting with accurate quotation and attribution. Translation permitted when faithful, marked as a translation, source credited. Full reproduction must be unmodified.

**Rationale**: the class exists to prevent distortion of source text. Banning excerpting would make the class unusable for its primary consumer (journalists). Excerpting and translation are universal journalism practices already protected under fair use / fair dealing doctrines in most jurisdictions; the licence codifies what is already permitted and removes ambiguity.

### Q2 — Does `editorial_use_only` include sponsored editorial, native advertising, or branded content?

**Product resolution**: excluded.

**Rationale**: industry standard (Getty Images, Adobe Stock, Reuters). If a distributor wants partners to use the asset in sponsored content, they pick `promotional_use`.

### Q3 — Is `ai_training_permitted = false` enforceable?

**Product resolution**: declaratory + contractual + machine-readable opt-out. See §6. UI language avoids overclaim.

### Q4 — FF-* licence page wording

**Product resolution**: the blurbs in §3.3 are the governing product spec. Full terms pages at the URIs in §3.4 are drafted by external counsel against these blurbs. This brief is the source material.

## 9. Jurisdictional scope for v1

- **Launch markets**: global. English-language UI in v1; other-language UI in later phases.
- **EU obligation surfaces** (TDM opt-out, GDPR, DPA) active for all users worldwide.
- **US DMCA** 512 notice + counter-notice procedure supported.
- **UK GDPR** compliance.
- **CCPA / CPRA** compliance for California users.
- **Export control / sanctions** screening at Organisation onboarding.

Counsel is asked to flag any jurisdiction where the licence posture, verification model, or content standards would create unacceptable legal risk, and to recommend geographic restrictions if so.

## 10. Seven items for legal opinion (not drafting)

1. **Right-of-publicity warranties** — the distributor confirms subject releases via `RightsWarranty` at publish time. Is this warranty plus contractual indemnification sufficient to shift risk from Frontfiles to the distributor in the key jurisdictions?
2. **Third-party music rights warranties** — same pattern. Sufficient?
3. **Verification revocation × in-flight embargoes** — product rule is to freeze access tokens on revocation and route to admin review. Any procedural risk the terms should address?
4. **Counter-notice window** — product default 10 business days. Confirm or overrule.
5. **Tombstone permanence** — taken-down Packs show a tombstone permanently at the canonical URL. Any defamation or EU/UK right-to-be-forgotten exposure?
6. **Correction mechanism** — post-publish Corrections are public and immutable by product. Any exposure from a distributor being unable to delete an issued correction?
7. **Scan-flag override chain of custody** — operators can override `flagged` to `clean` with reason. Advise on retention and disposal requirements for CSAM-adjacent false positives.

## 11. Rendering surface — where these terms appear

Every licence blurb and attribution text renders in several places. Counsel should review the full surface area, not only the licence pages, to ensure consistency.

| Surface | What renders |
|---|---|
| Pack page (customer-facing) | Full blurb, credit_line, licence code + URI, trademark notice (if any), AI-training notice (if applicable), link to the FF-* page |
| Pre-lift preview page | Same as Pack page, plus the distributor's embargo policy text |
| Embed snippet | Short attribution: `{credit_line}. Source: {org} (link to Pack). Licence: {licence_code} (link to URI).` Plus TDM meta tags when `ai_training_permitted=false`. |
| Download receipt | Licence class, credit_line snapshot, terms summary auto-generated from flags + blurb |
| Zip export sidecar | XMP/IPTC metadata with licence code, credit, TDM reservation |
| C2PA manifest (opt-in) | Licence code, credit, training-mining assertion when applicable |
| `/ai.txt` per newsroom | Org-level TDM declaration |
| `/.well-known/tdmrep.json` per newsroom | W3C TDMRep machine-readable form |

Counsel should confirm the short attribution in the embed snippet is legally sufficient and that the snippet itself cannot be easily stripped while preserving the image.

## 12. Deliverable format and handover

Counsel to deliver:

- Markdown or Word drafts of each of the nine documents in §4
- Suggested edits to the blurbs in §3.3 if any (inline, track-changes)
- A short memo answering the seven items in §10
- Any recommended changes to user-facing copy where it carries legal weight (verification policy page, claims intake form, takedown tombstone variants, pre-lift preview banners, rights-warranty confirmation copy) — each of these has exact product copy already drafted and available on request

Contact: João Nuno Martins, joao@frontfiles.news. Target for draft delivery: TBD with counsel.

---

**End of brief.**
