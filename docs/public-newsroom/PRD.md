# Frontfiles Public Newsroom Distribution — Product Requirements Document v1

**Status:** Build-governing
**Version:** 1.0
**Date:** 2026-04-24
**Author:** João Nuno Martins (product architecture)
**Audience:** Engineering, Design, Legal, Executive

---

## Reading this document

The PRD is structured in seven parts. Part 1 establishes the product and the 14 locked decisions. Parts 2 and 3 are the formal specification (licences, object model, state machine). Parts 4 and 5 are the full surface inventory (hierarchical ToC, 31 page/component specs). Part 6 captures cross-cutting rules that span multiple surfaces. Part 7 is the release plan. Appendices carry glossary, terminology rules, and open items.

Exact field names, enum values, state transitions, and copy are load-bearing. Do not paraphrase in implementation.

## Executive summary

Frontfiles Public Newsroom Distribution is a distribution system for publicly-authorised source material (press releases, press kits, brand and product promotion, artist and sports media, institutional announcements) published by verified organisations and consumed by working journalists, editors, and publishers. It is distinct from Frontfiles' paid editorial platform — different supply, different demand, same rails, distinct URL namespace.

**v1 ships three surfaces**: the distributor product (organisation accounts, verification, Pack authoring, embargo, analytics, claims response); the consumer product (newsroom directory, organisation pages, public Pack pages, pre-lift preview, download, embed, subscriptions, export history); and the admin console (verification review, scan-flag review, claims review, takedown actions, key management, audit log, organisation administration).

**Core primitives**: five enumerated licence classes with deterministic permission flags; Organisation verification via DNS TXT + domain email; Pack as the primary unit (title, credit_line, licence_class, embargo, assets); first-class embargo workflow with approved-recipient access log; signed download receipts (Ed25519) with public keyset; opt-in C2PA manifests; W3C TDMRep AI training opt-out; first-class claims and takedown with public tombstone.

**v1 does not include**: individual Creator surfaces (deferred surfaces A and C), asset-level licence override, coordinated multi-org embargoes, video transcoding, public API, webhooks, topic taxonomy for subscriptions, third-party receipt verification UI, organisation rebrand or transfer, paid billing. Schema hooks are in place for each so v1.1 lands without breaking changes.

---

# Part 1 — Foundational decisions

## 1.1 Product definition

**Purpose.** A press / newsroom distribution system — distinct from paid editorial supply — that lets verified organisations publish authorised source material to working journalists and publishers with embargoes, controlled licensing, attribution enforcement, and provenance primitives.

**Position vs. paid Frontfiles.** Paid Frontfiles is produced editorial content and licensed originals. Public Newsroom is source material from the subject of coverage. Different supply, different demand, same platform rails, distinct URL namespace (`newsroom.frontfiles.com`), distinct page chrome. Paid inventory never appears in public distribution unless explicitly released as free public.

**v1 scope.** Surface B (press/brand distribution) only. Out of scope for v1: surface A (individual creator CC commons), surface C (Frontfiles free tier).

**Personas.**
- **Distributor** — a member of an Organisation (brand comms, PR agency, federation press office, label PR, sports team comms) who authors and publishes Packs.
- **Consumer** — working journalists, editors, publishers. May be anonymous or account-authenticated.
- **Admin** — Frontfiles ops staff in one of four roles (`viewer`, `reviewer`, `operator`, `security`).

**Success metrics for v1.** Verified Organisations onboarded; Packs published; downloads; outlet breadth (distinct outlet domains with any activity); embargo compliance rate; verification retention.

**Non-goals (v1).** Rights marketplace; paid licensing; inbound press-query matching; creator profiles; music or video transcoding services; coordinated multi-org embargoes; third-party receipt verification UI; public API and webhooks.

**Business-model posture (v1).** Free to verified Organisations; free to consumers. Value thesis: distribution scale and trust infrastructure. Paid tiers revisited after distributor count and feature demand justify.

## 1.2 Locked decisions

Fourteen decisions locked before v1 drafting. The rest of the PRD assumes these.

1. Product is a press/newsroom distribution system, not a Creative Commons commons.
2. Three surfaces are kept distinct in the model: A (Creator CC commons), B (press/brand distribution — primary), C (Frontfiles free tier). v1 ships only surface B.
3. Primary object is the Pack, not the Asset. A Pack belongs to one Organisation, has one embargo policy, one credit line, one licence class, a canonical URL, and contains one or more Assets.
4. Object roster: Organization, Creator (deferred), Pack, Asset, Licence Class, Recipient, Distribution Event. Status × visibility state machine at Pack level.
5. Uploader model is organisation-first. Organisations are source-verified (DNS TXT + domain email; higher tiers add authorised-signatory attestation). Badge wording: "Verified source" / "Verified publisher". Never "certified".
6. Licence field is an enumerated Licence Class with deterministic permission flags. Uploader picks a use case; system suggests a default licence class.
7. Attribution uses a human-readable `credit_line` set by the uploader (e.g. "Photo: Nike"). `licence_code` and `licence_uri` are secondary machine-readable metadata.
8. Embargo is a full workflow, not a flag: TZ-aware `lift_at`, `policy_text`, approved-recipient list, per-recipient access log, automatic lift, notification to subscribers on lift.
9. Provenance posture: opt-in C2PA manifest embedded on export in v1; signed download receipt in v1; third-party verification UI in v1.1. No overclaiming.
10. Primary download action is "Download pack (zip)" or "Download asset". Embed is secondary. Publishers self-host.
11. Distributor-side analytics are part of core value: downloads over time, by asset, by outlet domain; embargo-window engagement; outbound mention detection in v1.1.
12. Journalist/publisher side is first-class: outlet verification (v1.1), beat subscriptions (thin v1), saved searches (v1.1), export history.
13. Strategic separation from paid Frontfiles: distinct URL namespace, chrome, analytics, identity.
14. Terminology rules: "verified source", "verified publisher", "verified outlet" — not "official" unqualified, never "certified". "Licence class" (enumerated), not "licence type" (free text). "Provenance-aware", "tamper-evident", "independently verifiable". "Claims & takedown" as first-class workflow.

## 1.3 Terminology and constraints

**Controlled vocabulary.**
- "Verified source" / "Verified publisher" — verification tier badges
- "Licence class" — always the enumerated field; never free text
- "Provenance-aware", "tamper-evident", "independently verifiable" — for trust-surfacing language

**Forbidden terms.**
- "Certified" — never used anywhere in product, legal, or marketing surfaces
- "Official" — never unqualified
- "Blocked" — never used of AI training (use "not permitted")

**UI vs. schema labels.**
- DB object `Recipient` is surfaced to users as "Journalist" on the newsroom side and as "Press contact" on the distributor side.
- DB object `Organization` is surfaced as "Newsroom" on the consumer side and "Organisation" on the distributor side.
- DB field `credit_line` is surfaced consistently as "Credit line".

---

# Part 2 — Licence classes

Five enumerated licence classes. One class per Pack. Five deterministic permission flags per class. Attribution is primary, via `credit_line`. Machine-readable metadata (`licence_code`, `licence_uri`) is secondary and used for embed snippets, sidecar files, C2PA manifests, and download receipts.

## 2.1 Enumeration and flags

| licence_class | can_modify | requires_attribution | use_context | ai_training_permitted | redistribution_permitted |
|---|---|---|---|---|---|
| `press_release_verbatim` | false | true | editorial | false | true |
| `editorial_use_only` | false | true | editorial | false | true |
| `promotional_use` | false | true | any | false | true |
| `cc_attribution` | true | true | any | true | true |
| `cc_public_domain` | true | false | any | true | true |

## 2.2 Flag semantics

- `can_modify` — whether the asset itself may be altered (crop, colour, text edit, derivative). Standard editorial treatment (minor crop, tone correction) is customary practice and out of scope of this flag.
- `requires_attribution` — whether the Pack's `credit_line` must be displayed where the asset appears.
- `use_context` — `editorial` (news reporting, commentary, review) / `promotional` (marketing, advertising, partner materials) / `any`.
- `ai_training_permitted` — whether the asset may be ingested into AI model training datasets.
- `redistribution_permitted` — whether the recipient may re-host or re-publish the asset beyond the publication context for which it was licensed.

## 2.3 Blurbs

These blurbs render verbatim on the Pack page, in the embed snippet attribution, in the download receipt terms summary, and in the licence terms page.

- **press_release_verbatim** — "Published for reporting. Reproduce the text without modification. Excerpting is permitted when quoted accurately for news reporting or commentary. Translation is permitted when faithful and marked as a translation. Credit the source as shown."
- **editorial_use_only** — "Use in news reporting, commentary, or review. Credit the source. Do not alter the asset. Not for advertising, sponsored content, native advertising, advertorial, or branded content."
- **promotional_use** — "Use in editorial or promotional contexts. Credit the source. Do not alter the asset."
- **cc_attribution** (CC BY 4.0) — "Use, adapt, and redistribute for any purpose, including commercial. Credit the creator as shown. Full terms: creativecommons.org/licenses/by/4.0/"
- **cc_public_domain** (CC0 1.0) — "No rights reserved. Use, adapt, and redistribute freely. Attribution appreciated, not required. Full terms: creativecommons.org/publicdomain/zero/1.0/"

## 2.4 Machine-readable metadata

| licence_class | licence_code | licence_uri |
|---|---|---|
| press_release_verbatim | `FF-PRV-1.0` | https://frontfiles.com/licences/press-release-verbatim/1.0 |
| editorial_use_only | `FF-EDU-1.0` | https://frontfiles.com/licences/editorial-use-only/1.0 |
| promotional_use | `FF-PROMO-1.0` | https://frontfiles.com/licences/promotional-use/1.0 |
| cc_attribution | `CC-BY-4.0` | https://creativecommons.org/licenses/by/4.0/ |
| cc_public_domain | `CC0-1.0` | https://creativecommons.org/publicdomain/zero/1.0/ |

`credit_line` is the primary visible attribution. `licence_code` and `licence_uri` are emitted in embed snippets, sidecar files, C2PA manifests (when opted in), and download receipts.

## 2.5 Uploader-facing selector

Single-select question on Pack creation, shown after the uploader has filled `credit_line`:

Label: "What are you releasing?"

| Choice label shown to uploader | → stored as |
|---|---|
| A press release (text, statement, announcement) | `press_release_verbatim` |
| Editorial press photos or video for journalists | `editorial_use_only` |
| Brand, product, or campaign assets for press and partners | `promotional_use` |
| Open content, credit required (CC BY 4.0) | `cc_attribution` |
| Public domain, no rights reserved (CC0) | `cc_public_domain` |

The blurb for the selected class displays verbatim beneath the selector. No free-text licence field. No "other" option. No multi-select.

## 2.6 Trademark overlay (not a class)

Asset-level boolean `is_trademark_asset` (default false). When true, a persistent notice renders on the Pack page, Asset detail, and embed snippet:

> "Trademark and brand rights retained by [credit_line]. The licence above does not grant trademark rights."

Independent of `licence_class`. Does not modify any permission flag.

## 2.7 AI training opt-out implementation

For Packs where `ai_training_permitted = false`:

| Surface | Mechanism |
|---|---|
| Embed snippet (HTML) | `<meta name="tdm-reservation" content="1">` and `<meta name="tdm-policy" content="{licence_uri}#tdm">` per [W3C TDMRep](https://www.w3.org/community/tdmrep/) |
| Organisation press room | `/.well-known/tdmrep.json` at `newsroom.frontfiles.com/{org-slug}` |
| Sidecar metadata (zip export) | IPTC `AI Generated Content` + XMP `tdm:Reservation=1` |
| C2PA manifest (when uploader opts in) | `c2pa.training-mining` assertion set to `notAllowed` |
| Licence page | Contractual clause: "You may not use the Work to train, fine-tune, or develop AI models." |
| Download receipt | Terms summary includes the reservation |
| `/ai.txt` at each newsroom subdomain | Org-level TDM declaration |

UI language: "AI training not permitted by this source." Never "blocked".

## 2.8 Four interpretive decisions (log)

- **Excerpting and translation under `press_release_verbatim`**: permitted, with constraints. Blurb above reflects this.
- **Sponsored editorial / native advertising under `editorial_use_only`**: excluded. Blurb above reflects this.
- **AI training enforceability**: declaratory + contractual + machine-readable. Legally effective under EU Article 4 + AI Act 53(1)(c); contractual elsewhere.
- **FF-* licence page wording**: blurbs in §2.3 are the governing spec. External counsel drafts the full terms pages against the blurbs (see `docs/public-newsroom/LEGAL-BRIEF.md`).

---

# Part 3 — Object model and state machine

Standard audit fields (`created_at`, `updated_at`, `created_by`) are implicit on every row. All IDs are `uuid`. All timestamps are TZ-aware unless noted.

## 3.1 Object roster

| Object | Role |
|---|---|
| Organization | Uploader entity. Brand, label, team, federation, agency, publicist. |
| VerificationRecord | Source-verification artefacts (DNS TXT, domain email, authorised signatory). |
| User | A human. |
| OrganizationMembership | User's role inside an Organisation. |
| Pack | Primary distributable unit. Holds licence, embargo, credit_line, state. |
| Asset | Individual file in a Pack. Inherits licence from Pack. |
| AssetScanResult | Abuse / malware scan result per Asset. |
| AssetRendition | Sized derivatives of an Asset. |
| RightsWarranty | Three-boolean warranty attached to a Pack at publish time. |
| Correction | Lightweight post-publish amendment attached to a Pack. |
| Embargo | First-class workflow attached to a Pack. |
| EmbargoRecipient | Approved pre-lift viewer with per-recipient access log. |
| Recipient | Identified consumer (journalist). |
| Outlet | Recipient's publication. Auto-created from email domain in v1. |
| DistributionEvent | Event log entry: view, download, embed render, preview access. |
| DownloadReceipt | Signed tamper-evident record emitted on download. |
| SigningKey | Ed25519 signing key used for DownloadReceipts. |
| Claim | First-class claims intake. |
| AdminAuditEvent | Immutable append-only log of admin actions. |
| AdminUser | Separate admin identity with role-based access. |
| BeatSubscription | Journalist-side notification subscription (thin v1). |

## 3.2 Schemas

### Organization

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| slug | string, unique | URL segment: `newsroom.frontfiles.com/{slug}` |
| name | string | Display name |
| legal_name | string | On legal notices |
| country_iso | char(2) | For jurisdictional rules |
| primary_domain | string | e.g. `nike.com` |
| verification_tier | enum | `unverified`, `verified_source`, `verified_publisher` |
| verified_at | timestamp, nullable | |
| logo_asset_id | uuid, nullable | FK → Asset |
| suspended | bool | Admin flag blocking new Pack creation |

Badge copy:
- `verified_source` → "Verified source"
- `verified_publisher` → "Verified publisher"
- `unverified` → no badge

### VerificationRecord

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| organization_id | uuid | FK |
| method | enum | `dns_txt`, `domain_email`, `authorized_signatory` |
| value_checked | string | DNS record value or email verified |
| verified_at | timestamp | |
| expires_at | timestamp, nullable | For re-verification cycles |

Tier rule (v1):
- `verified_source` = at least one active `dns_txt` + one active `domain_email`
- `verified_publisher` = above + one active `authorized_signatory` (schema present in v1; UI flagged off)

### User / OrganizationMembership

| Field (User) | Type |
|---|---|
| id | uuid |
| email | string, unique |
| name | string |

| Field (OrganizationMembership) | Type | Notes |
|---|---|---|
| id | uuid | |
| organization_id | uuid | FK |
| user_id | uuid | FK |
| role | enum | `owner`, `editor`, `uploader`, `viewer` |

Role rules: `owner` (billing, verification, deletion); `editor` (publish, member mgmt); `uploader` (create/edit drafts; v1 can publish; editor sign-off in v1.1); `viewer` (read-only).

### Pack

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| organization_id | uuid | FK |
| slug | string | Unique within org |
| title | string | |
| subtitle | string, nullable | |
| description | text | |
| credit_line | string, required | Primary visible attribution |
| licence_class | enum | From Part 2. Immutable after first publish. |
| publish_at | timestamp, nullable | When status flips to `published` |
| embargo_id | uuid, nullable | FK → Embargo |
| rights_warranty_id | uuid, nullable | FK → RightsWarranty. Required non-null to leave `draft`. |
| status | enum | `draft`, `scheduled`, `published`, `archived`, `takedown` |
| visibility | enum | `private`, `restricted`, `public`, `tombstone` (derived, materialised) |
| published_at | timestamp, nullable | Set on first `status=published` |
| archived_at | timestamp, nullable | |
| takedown_at | timestamp, nullable | |
| takedown_reason | text, nullable | Shown on tombstone |
| canonical_url | string, computed | Stable across state changes |
| c2pa_signing_enabled | bool | Opt-in |

Invariants:
- `licence_class` and `credit_line` immutable after first `published`; corrections require `Correction`.
- `status = takedown` is terminal.
- If `embargo_id` is set, `publish_at` must equal `embargo.lift_at`.
- `canonical_url` stable across all status transitions including tombstone.

### Asset

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| pack_id | uuid | FK |
| kind | enum | `image`, `video`, `audio`, `document`, `text` |
| mime_type | string | |
| original_filename | string | |
| storage_url | string | Canonical stored file |
| file_size_bytes | int | |
| width / height / duration_seconds | int, nullable | |
| checksum_sha256 | string | Used in DownloadReceipt |
| caption | text, nullable | |
| alt_text | text, nullable | Accessibility (required for `image`) |
| is_trademark_asset | bool | Triggers standing trademark notice |
| c2pa_manifest_stored | bool | Set true when manifest exists |

No `licence_class` on Asset. Licence inherited from Pack.

### AssetScanResult

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| asset_id | uuid | FK, 1:1 |
| scanner_suite | string | e.g. `clamav+gcv_safesearch_v1` |
| scanner_version | string | |
| result | enum | `pending`, `clean`, `flagged`, `error` |
| flagged_categories | text[] | e.g. `["malware"]`, `["adult","violence"]`, `["csam"]` |
| scanned_at | timestamp | |
| last_error | text, nullable | |

Pack cannot leave `draft` until every Asset has `result=clean`. `csam` auto-escalates, freezes Org, bypasses in-browser preview.

### AssetRendition

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| asset_id | uuid | FK |
| kind | enum | `thumbnail`, `web`, `print`, `social` |
| storage_url | string | |
| width | int | |
| height | int | |
| format | enum | `jpeg`, `webp`, `png`, `mp4`, `gif` |
| file_size_bytes | int | |
| generated_at | timestamp | |

v1 rendition spec:

| Asset kind | Renditions |
|---|---|
| image | thumbnail (400px longest edge, webp); web (1600px, webp+jpeg); print (3000px, jpeg or original if smaller); social (1200×630, jpeg) |
| video | original only in v1 |
| audio | original only in v1 |
| document | first-page thumbnail (400px, jpeg) |
| text | none (served directly) |

### RightsWarranty

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| pack_id | uuid | FK, 1:1 |
| subject_releases_confirmed | bool | |
| third_party_content_cleared | bool | |
| music_cleared | bool | |
| narrative_text | text, nullable | |
| confirmed_by_user_id | uuid | FK User |
| confirmed_at | timestamp | |

UI copy:
- `subject_releases_confirmed` → "All identifiable people in this pack have given required releases, or this pack contains no identifiable people."
- `third_party_content_cleared` → "All third-party content in this pack is cleared for this use, or this pack contains no third-party content."
- `music_cleared` → "All music in this pack is cleared for this use, or this pack contains no music."

All three must be `true` to leave `draft`. Warranty is immutable post-publish.

### Correction

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| pack_id | uuid | FK (many-to-one) |
| correction_text | text | |
| issued_at | timestamp | |
| issued_by_user_id | uuid | FK User |

Public and permanent. Does not modify any receipted field. Surfaces on Pack page (reverse-chronological), and in embed snippet attribution as "Last corrected: {date}".

### Embargo

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| pack_id | uuid | FK, 1:1 |
| lift_at | timestamp_tz, required | |
| policy_text | text | |
| state | enum | `active`, `lifted`, `cancelled` |
| lifted_at | timestamp, nullable | |
| cancelled_at | timestamp, nullable | |
| notify_on_lift | bool, default true | |

Automatic lift: scheduler worker transitions `active → lifted` at `lift_at`, then Pack `scheduled → published`.

### EmbargoRecipient

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| embargo_id | uuid | FK |
| recipient_id | uuid | FK |
| access_token | string, unique | Unguessable link token |
| invited_at | timestamp | |
| first_accessed_at | timestamp, nullable | |
| last_accessed_at | timestamp, nullable | |
| access_count | int, default 0 | |

Every preview access increments `access_count`, updates `last_accessed_at`, and emits a `DistributionEvent(preview_access)`.

### Recipient / Outlet

| Field (Recipient) | Type | Notes |
|---|---|---|
| id | uuid | |
| email | string, unique | |
| name | string, nullable | |
| outlet_id | uuid, nullable | FK |
| verified | bool, default false | v1.1 |

| Field (Outlet) | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | |
| domain | string, unique | |
| verified | bool, default false | v1.1 |

### DistributionEvent

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| pack_id | uuid | FK |
| asset_id | uuid, nullable | Null for pack-level events |
| recipient_id | uuid, nullable | Null if anonymous |
| anon_session_id | string, nullable | For anonymous traffic |
| event_type | enum | `pack_view`, `asset_view`, `asset_download`, `pack_zip_download`, `embed_render`, `preview_access` |
| source | enum | `web`, `embed`, `api`, `email_link` |
| outlet_domain | string, nullable | From recipient.outlet.domain or referrer |
| user_agent | string | |
| ip_country | char(2), nullable | |
| occurred_at | timestamp | |
| metadata | jsonb | |

### DownloadReceipt

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| distribution_event_id | uuid | FK, 1:1 with the download event |
| pack_id | uuid | Snapshot |
| asset_id | uuid, nullable | Snapshot |
| recipient_id | uuid, nullable | Snapshot |
| licence_class | enum | Snapshot at download |
| credit_line | string | Snapshot |
| terms_summary | text | Generated from licence_class + flags |
| content_hash_sha256 | string | Hash of bytes served |
| signing_key_kid | string | Reference to SigningKey.kid |
| signed_at | timestamp | |
| signature | string | Ed25519 signature over receipt body |
| receipt_url | string | Public retrievable receipt |

### SigningKey

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| kid | string, unique | Emitted in receipt headers |
| algorithm | enum | `ed25519` (v1 fixed) |
| public_key_pem | text | |
| private_key_ref | string | KMS reference, never the bytes |
| status | enum | `active`, `rotated`, `revoked` |
| created_at | timestamp | |
| rotated_at | timestamp, nullable | |
| revoked_at | timestamp, nullable | |

At most one `active` key at a time. `rotated` keys remain valid for verifying prior receipts. `revoked` invalidates prior receipts signed by that key (compromise response only). Public keyset endpoint: `frontfiles.com/.well-known/receipt-keys`.

### Claim

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| pack_id | uuid | FK |
| asset_id | uuid, nullable | Optional specificity |
| reporter_email | string | |
| reporter_name | string, nullable | |
| reason_category | enum | `trademark_infringement`, `copyright`, `defamation`, `privacy`, `embargo_breach`, `other` |
| reason_text | text | |
| status | enum | `submitted`, `reviewing`, `upheld`, `dismissed`, `withdrawn` |
| submitted_at | timestamp | |
| resolved_at | timestamp, nullable | |
| resolution_note | text, nullable | |

Upheld claim triggers Pack takedown via the shared A6 flow.

### AdminUser / AdminAuditEvent

| Field (AdminUser) | Type | Notes |
|---|---|---|
| id | uuid | |
| email | string, unique | |
| name | string | |
| role | enum | `viewer`, `reviewer`, `operator`, `security` |
| mfa_enabled | bool, required true | |

| Field (AdminAuditEvent) | Type | Notes |
|---|---|---|
| id | uuid | |
| admin_user_id | uuid | |
| cosigner_admin_user_id | uuid, nullable | |
| action | enum | Controlled list of admin actions |
| target_type | enum | `Organization`, `Pack`, `Asset`, `VerificationRecord`, `SigningKey`, `Claim` |
| target_id | uuid | |
| reason | text | Required, min 10 chars |
| before_state | jsonb | Snapshot |
| after_state | jsonb | Snapshot |
| source_ip | string | |
| occurred_at | timestamp | |

Append-only. No edit or delete. Annotations appended as new `admin_note_added` events.

### BeatSubscription

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| recipient_id | uuid | FK |
| organization_id | uuid, nullable | v1: org-only subscriptions |
| notify_on | enum | `new_pack`, `embargo_lift`, `update` |

Topic-based subscriptions (with `topic_tag` + Tag taxonomy) deferred to v1.1.

## 3.3 Pack state machine

### Status × visibility matrix (valid cells only)

|  | private | restricted | public | tombstone |
|---|---|---|---|---|
| **draft** | ✓ | — | — | — |
| **scheduled** (no embargo) | ✓ | — | — | — |
| **scheduled** (with embargo) | — | ✓ | — | — |
| **published** | — | — | ✓ | — |
| **archived** | — | — | ✓ (URL works, unlisted) | — |
| **takedown** | — | — | — | ✓ |

`visibility` is derived from (`status`, `embargo.state`) and materialised:
- `draft` → `private`
- `scheduled` + `embargo.state=active` → `restricted`
- `scheduled` + no embargo → `private`
- `published` → `public`
- `archived` → `public` (content reachable at canonical URL; index-excluded)
- `takedown` → `tombstone`

### Status transitions

| From → To | Trigger | Preconditions | Side effects |
|---|---|---|---|
| (create) → `draft` | Uploader creates Pack | Org.verification_tier ≥ `verified_source`; Org not suspended | — |
| `draft` → `scheduled` | Uploader schedules | title, credit_line, licence_class, ≥1 Asset, every Asset scan `clean`, RightsWarranty confirmed (all 3 true), either embargo_id or publish_at set, active SigningKey exists | Embargo → `active`; pre-lift access tokens generated for EmbargoRecipients |
| `draft` → `published` | Uploader publishes now | Same as above but no embargo, no publish_at | `published_at = now()`; visibility `public`; subscribers notified |
| `scheduled` → `draft` | Uploader pulls back | Embargo cancellable (no recipient has accessed) OR uploader confirms override | Embargo → `cancelled`; preview tokens revoked |
| `scheduled` → `published` (auto) | Scheduler worker at `publish_at` | — | `published_at = publish_at`; Embargo → `lifted`; subscribers notified |
| `scheduled` → `published` (manual early lift) | Uploader forces | Uploader confirms; logged | Same as auto |
| `published` → `archived` | Uploader archives | — | `archived_at = now()`; index excluded |
| `archived` → `published` | Uploader unarchives | — | Index re-included |
| any → `takedown` | Admin action (A6) | Upheld Claim, legal order, content standards violation, verification revocation, distributor-initiated | `takedown_at = now()`; assets 410 Gone; tombstone renders |

Terminal: `takedown`. Archived is reversible; takedown is operator-reversible only via the security-role co-signed reversal that restores to `archived`, with both events preserved.

### Pack publish precondition checklist (applied in UI)

1. `title`, `credit_line`, `licence_class` set
2. ≥ 1 Asset
3. Every `Asset` image has `alt_text` non-empty
4. Every `AssetScanResult.result = clean`
5. `rights_warranty_id` not null
6. Either `publish_at` set or `embargo_id` set (for scheduled), or neither (for immediate publish)
7. At least one `SigningKey` with `status=active` exists (operational)

## 3.4 Key invariants

1. `licence_class` and `credit_line` immutable after first `published`. Corrections attach via `Correction`, never by edit.
2. An Organisation with `verification_tier = unverified` cannot create Packs.
3. `publish_at` equals `embargo.lift_at` when both exist.
4. `canonical_url` stable across all status transitions, including takedown (resolves to tombstone).
5. Every download emits a `DistributionEvent` and a `DownloadReceipt` (1:1). No silent downloads.
6. Every pre-lift access emits a `DistributionEvent(preview_access)` and increments `EmbargoRecipient.access_count`.
7. Every admin mutation emits an `AdminAuditEvent` synchronously; commit does not complete until audit row is durable.
8. Identity never rewrites history: verification-badge snapshots at time of download on the DownloadReceipt are preserved across tier changes.

---

# Part 4 — Product surface area (hierarchical ToC)

Seventeen top-level sections. Each leaf is a distinct spec unit.

## §1. Product definition

1.1 Purpose and position · 1.2 v1 scope and out-of-scope · 1.3 Personas and roles · 1.4 Success metrics · 1.5 Non-goals · 1.6 Position vs. paid Frontfiles · 1.7 Business-model posture (v1)

## §2. Terminology and constraints

2.1 Controlled vocabulary · 2.2 Forbidden terms · 2.3 Attribution model · 2.4 Licence class is always enumerated · 2.5 UI vs. schema labels

## §3. Trust and verification

3.1 Verification tiers · 3.2 Verification methods · 3.3 Verification workflow · 3.4 Revocation paths and effects (including in-flight embargo rule) · 3.5 Badge rendering rules · 3.5a Verification integrity checks (watchlist collisions) · 3.6 Signed download receipts · 3.6a Cryptographic signing infrastructure · 3.7 C2PA manifest opt-in · 3.8 Independent receipt verification UI (v1.1)

## §4. Licence classes

4.1 Enumeration and permission flags · 4.2 Per-class blurbs · 4.3 Uploader-facing selector · 4.4 FF-* licence terms pages (external counsel) · 4.5 Trademark notice · 4.6 Machine-readable metadata

## §5. Object model and state machine

5.1 Object roster · 5.2 Field-level schemas · 5.3 Pack status × visibility matrix · 5.4 Status transition table · 5.5 Key invariants · 5.6 Visibility derivation rules

## §6. Distributor workflows

6.1 Organisation onboarding · 6.2 Member management · 6.3 Pack creation — draft · 6.4 Asset upload · 6.4a Scanning pipeline · 6.4b Rendition generation · 6.5 Embargo setup · 6.5a Rights-warranty confirmation gate · 6.6 Scheduling and publishing · 6.7 Post-publish edits (immutable vs. editable) · 6.7a Corrections · 6.8 Archival · 6.9 Distributor analytics view · 6.10 Claim response

## §7. Journalist / consumer workflows

7.1 Newsroom directory and org page · 7.2 Pack page · 7.3 Pre-lift preview · 7.4 Single-asset and zip-pack download · 7.5 Download receipt retrieval · 7.6 Embed affordance · 7.7 Beat subscription (thin v1) · 7.8 Export history · 7.9 Cross-newsroom search

## §8. Claims and takedown

8.1 Claim intake form (public) · 8.2 Admin review workflow · 8.3 Resolution outcomes · 8.4 Tombstone page · 8.5 Reissue path (v1.1) · 8.6 Distributor appeal and counter-notice · 8.7 Embargo-breach response

## §9. URL namespace and routing

9.1 Canonical URL pattern · 9.2 Stability rule · 9.3 Separation from paid Frontfiles · 9.4 Newsroom index exclusion · 9.5 External search exclusion (robots/sitemap) · 9.6 Sub-resource URLs · 9.7 Short links and receipt URLs

## §10. AI training opt-out implementation

10.1 Licence-level contractual clause · 10.2 W3C TDMRep meta tags · 10.3 `/.well-known/tdmrep.json` · 10.4 Sidecar XMP/IPTC · 10.5 C2PA assertion · 10.6 `/ai.txt` · 10.7 UI language rules · 10.8 Jurisdictional notes

## §11. Analytics

11.1 Distributor dashboard · 11.2 Outlet attribution logic · 11.3 Per-Pack drill-down · 11.4 DistributionEvent schema · 11.5 Outbound mention detection (v1.1) · 11.6 Privacy/aggregation rules · 11.A Notifications (email: embargo invite, embargo lift, claim updates, subscription digests)

## §12. Integrations (thin v1)

12.1 OEmbed provider · 12.2 RSS/Atom feed per newsroom · 12.3 — reserved — · 12.4 Webhooks (v1.1) · 12.5 Public API (v1.1)

## §13. Non-functional requirements

13.1 AuthN / AuthZ · 13.2 File upload security · 13.3 Signed-receipt cryptography · 13.4 Performance targets · 13.5 Accessibility (WCAG 2.1 AA) · 13.6 Internationalisation · 13.7 Rate limiting and abuse prevention · 13.8 Privacy / GDPR / retention and deletion · 13.9 Admin audit log

## §14. Legal and policy surfaces (external counsel)

14.1 FF-PRV, FF-EDU, FF-PROMO terms pages · 14.2 Distributor Terms of Service · 14.3 Consumer Terms of Use · 14.4 Privacy policy · 14.5 DPA template · 14.6 Claims and takedown policy · 14.7 AI training rights-reservation page · 14.8 Brand / verification policy · 14.9 Content standards policy

## §15. Release plan

15.1 v1 ship scope · 15.1a Launch market stance · 15.2 v1 launch dependencies · 15.3 Launch hedge · 15.4 v1.1 deferred list · 15.5 Beyond v1.1

## §16. Glossary and forbidden-term index

16.1 Glossary · 16.2 Forbidden-term index · 16.3 Licence class plain-English reference card

## §17. Admin console

17.1 Access and roles · 17.2 Verification review queue · 17.3 Scan-flag review queue · 17.4 Claims queue · 17.5 Takedown actions · 17.6 SigningKey management · 17.7 Audit log viewer · 17.8 Organisation administration

---

# Part 5 — Pages and components

Thirty-one specs across five surface groups. Each spec is build-governing: components, states, exact copy, data bindings, interaction rules.

## 5.1 Trust and verification (customer-facing)

### P1 — Organisation signup & onboarding

**Entry.** `newsroom.frontfiles.com/start` or invite link.

**Blocks.** Account creation (User email + password) → Organisation claim (display name, legal name, primary domain, country) → Handoff to P2.

**Copy.**

| Element | Copy |
|---|---|
| Title | "Set up your newsroom" |
| Subtitle | "Your organisation becomes a verified source on Frontfiles." |
| Org name label | "Organisation name" |
| Org name helper | "As it should appear on your newsroom page" |
| Legal name label | "Registered legal name" |
| Legal name helper | "Used on licence terms and legal notices" |
| Primary domain label | "Primary domain" |
| Primary domain helper | "The domain you will verify ownership of. Example: acme.com" |
| Country label | "Country of incorporation" |
| Primary CTA | "Create newsroom" |
| Terms checkbox (required) | "I accept the Frontfiles Distributor Terms and the Content Standards." |

**Validation.** Email format + not already another Org owner; valid FQDN for primary domain; not already claimed by another verified Org (hard block); watchlist match (allowed but flagged for admin review per §3.5a).

**Post-action.** Create records; set `Organization.verification_tier=unverified`; redirect to P2. Pack creation blocked until `verified_source`.

### P2 — Verification dashboard

**Entry.** Post-signup, or top-nav "Verification" while `verification_tier < verified_publisher`.

**Blocks.** Header (current tier badge + next-tier summary), method cards, activity log.

**Tier header copy.**

| Tier | Copy |
|---|---|
| `unverified` | "Verification status: Unverified. Complete one DNS TXT check and one domain-email check to become a Verified source." |
| `verified_source` | "Verification status: Verified source. Add an authorised-signatory attestation to become a Verified publisher." (read-only "Coming soon" in v1) |
| `verified_publisher` | "Verification status: Verified publisher." |

**DNS TXT card.**

| Element | Copy |
|---|---|
| Title | "Domain ownership — DNS TXT" |
| Instruction | "Add this TXT record to your DNS for **{domain}**:" |
| Record | `frontfiles-verify={challenge_token}` |
| Subtext | "Propagation usually completes within 10 minutes." |
| CTA | "Recheck DNS" |
| Pending | "Checking… last checked {timestamp}." |
| Success | "Verified on {timestamp}." |
| Errors | "We could not find the TXT record. Wait 10 minutes after adding it and retry." / "The record value does not match." |

**Domain email card.**

| Element | Copy |
|---|---|
| Title | "Domain email" |
| Instruction | "Enter an email address at **{domain}**. We will send a one-time code." |
| Email label | "Your email at {domain}" |
| CTA | "Send code" |
| Code label | "Six-digit code" |
| Verify CTA | "Verify email" |
| Errors | "That address is not at {domain}." / "Incorrect code." / "This code has expired. Request a new one." |

**Tier transitions.** Both a `dns_txt` and a `domain_email` VerificationRecord active and unexpired → `verified_source` (automatic). Authorised-signatory stacked on top → `verified_publisher` (v1.1). Revocation of any required method drops the tier back one step; published Packs remain live; new-Pack creation blocked until re-verified.

### P3 — Verification badge (component)

Reusable component.

**Surfaces.** Newsroom organisation page; Pack page; embed snippet (text-only); download receipt (text-only); admin organisation detail.

**Variants.**

| Tier | Badge | Tooltip |
|---|---|---|
| `verified_source` | "Verified source" | "Frontfiles verified domain ownership for {domain}. Learn how verification works." |
| `verified_publisher` | "Verified publisher" | "Frontfiles verified domain ownership and authorised signatory for {legal_name}. Learn how verification works." |
| `unverified` | (not rendered) | — |

**Rules.** Never "certified". Never "official" unqualified. Text-only on embed and receipt (non-clickable). Tier revocation → badge disappears across all surfaces; receipt-at-download snapshot preserved.

### P4 — Signed receipt view

**Entry.** `DownloadReceipt.receipt_url`, e.g. `frontfiles.com/receipts/{id}`.

**Blocks.** Header "Download receipt"; facts table; verification block; linked artefacts.

**Facts shown.**

| Row | Source |
|---|---|
| Pack | `Pack.title` (link to Pack or tombstone) |
| Asset | Asset title or "Full pack (zip)" |
| Organisation | Name + verification badge at time of download (snapshot) |
| Licence class | Enum + human label |
| Credit line | Snapshot |
| Terms summary | Generated from flags + blurb |
| Content hash (SHA-256) | `content_hash_sha256` |
| Downloaded at | `signed_at` |
| Recipient | Masked email or "Anonymous download" |

**Verification block copy.**

> "This receipt is signed using Ed25519. The signing key ID is `{signing_key_kid}`. To verify independently, download the receipt body, compute the signature over `receipt body`, and check against the public key at `frontfiles.com/.well-known/receipt-keys`."

"Download receipt JSON" CTA.

**States.**

| State | Behaviour |
|---|---|
| Receipt found, Pack live | Facts + link to Pack |
| Receipt found, Pack taken down | Facts intact; Pack link replaced with "This pack was taken down on {date}. Reason: {takedown_reason}." |
| Receipt not found | 404 "No receipt found for this ID." |
| Signing key revoked | Notice: "This receipt was signed by a key that has since been revoked. The receipt content is preserved for audit." |

## 5.2 Distributor workflows

### P5 — Distributor dashboard

**Entry.** `newsroom.frontfiles.com/{org-slug}/manage` (authenticated).

**Blocks.** Header (Org name + badge + "New pack" CTA); verification banner (conditional); Pack list table; KPI strip.

**Verification banner states.**

| Condition | Copy | CTA |
|---|---|---|
| `unverified` | "Complete verification to publish your first pack." | "Go to verification" → P2 |
| VerificationRecord expiring < 30 days | "Your {method} verification expires on {date}. Recheck to keep your tier." | "Re-verify" → P2 |
| Recently revoked | "Verification revoked on {date}. New packs are blocked until re-verified." | "Go to verification" → P2 |

**Pack list columns.** Title (link); Status badge (draft/scheduled/published/archived/takedown); Visibility badge (private/restricted/public/tombstone); Licence; Embargo ("None" / "Lifts {rel}" / "Lifted"); Downloads (30d); Last edit.

**Filters.** Status, licence class, date range.

**Empty state.** "No packs yet. Create your first pack." CTA "New pack".

### P6 — Pack editor

**Entry.** "New pack" or click a `draft`/`scheduled` Pack on P5.

**Global layout.** Top bar (title breadcrumb, status badge, save indicator, primary action right); tab nav (Details | Assets | Embargo); tab content; persistent sidebar with pre-publish checklist (see P10).

**Details tab.**

| Field | Required | Copy / behaviour |
|---|---|---|
| `title` | yes | "Pack title" |
| `subtitle` | no | "Subtitle (optional)" |
| `description` | yes | "Description" — multiline |
| `credit_line` | yes | "Credit line" / helper: 'Appears wherever assets are used. Example: "Photo: Nike"' |
| Licence selector | yes | Copy from Part 2. FF-* classes show "Coming soon" inline if launch-hedge active. Blurb renders beneath on selection. |
| Pack slug | auto | Editable inline; unique-within-org validation |

Mutability: after first publish, `credit_line` and `licence_class` become read-only with lock icon; tooltip "Locked after publish. Issue a correction to add context." `description` and `subtitle` remain editable.

**Primary action states.**

| State | CTA | Behaviour |
|---|---|---|
| Preconditions not met | "Publish" (disabled) | Tooltip lists missing items |
| Met, no embargo, no publish_at | "Publish now" | Opens P9 → confirmation → publishes |
| Met, publish_at or embargo set | "Schedule" | Same flow; transitions to `scheduled` |

### P7 — Asset upload (component inside P6)

**Upload zone.**

| State | Copy |
|---|---|
| Empty | "Drop files or click to upload. Images, video, audio, PDFs, up to 500 MB each." |
| Drag over | "Drop to upload" |
| In progress | Progress bar per file |
| Failed | "Upload failed. {reason}." + Retry |

**Per-Asset row states.**

| Scan result | Indicator | Actions |
|---|---|---|
| `pending` | "Scanning…" | Remove |
| `clean` | green dot | Edit caption / alt / trademark flag; replace; remove |
| `flagged` | red dot "Flagged for review" | Remove; view reason (if admin shared); no edit; publish blocked |
| `error` | yellow dot "Scan error" | Retry scan; remove |

**Per-Asset metadata.**

| Field | Copy |
|---|---|
| Caption | "Caption (appears beside asset)" |
| Alt text | "Alt text (accessibility, required for images)" |
| `is_trademark_asset` | Checkbox: "This is a logo or trademark" / helper: "Adds a trademark notice wherever the asset appears." |
| Renditions | Read-only: "Thumbnail 400px · Web 1600px · Print 3000px · Social 1200×630" |

**Validation errors.** "Alt text is required for image assets." / "File exceeds 500 MB. Compress or split." / "File type not accepted. Accepted: {list}." / "{n} asset(s) flagged for review. Contact support if this is in error."

### P8 — Embargo configuration (component inside P6)

**Toggle.** "Release under embargo" (off = publish immediately or at `publish_at`).

**Fields (toggle on).**

| Field | Copy |
|---|---|
| Lift time | "Lift at" — datetime + timezone (default Org country canonical TZ; UTC offset always rendered) |
| Policy text | "Embargo policy" / helper: "Tell recipients what they can and cannot do before lift. Shown on the preview page and in invite emails." |
| Auto-notify on lift | Default on: "Notify subscribers when embargo lifts." |

**Approved recipients.**

| Column | Behaviour |
|---|---|
| Email | Unique within embargo; email-format validated |
| Outlet | Auto-filled from domain; editable |
| Status | `Invited` / `Accessed {rel}` / `Last accessed {rel}` |
| Access count | From `EmbargoRecipient.access_count` |
| Actions | "Resend invite" / "Revoke access" |

**Invite email.**

> Subject: "Embargoed: {Pack title} from {Organization.name}"
>
> Body: "{sender_org} has granted you embargoed access to: {Pack.title}.
>
> Lifts: {lift_at in recipient's local TZ}.
>
> Policy from {sender_org}: {policy_text}
>
> Access the pack here: {token_url}
>
> By accessing this pack before lift, you accept the embargo terms above."

**Revoke access.** `EmbargoRecipient` marked revoked; token serves 410 Gone: "Access revoked by distributor on {date}."

**Early lift.** Post-schedule, pre-lift only. Confirmation: "Lifting now will release this pack publicly immediately and notify subscribers. Continue?"

**Cancel embargo.** Permitted only while no EmbargoRecipient has accessed. Otherwise admin override.

### P9 — Rights-warranty gate (modal)

**Trigger.** Clicking "Publish" / "Schedule" when `Pack.rights_warranty_id` is null.

**Layout.** Title "Before publishing"; intro; three mandatory checkboxes; optional narrative; confirming-user footer; Cancel / Confirm and continue.

**Intro copy.** "Confirm the rights basis for this pack. These confirmations are recorded and attached to the pack."

**Checkboxes.** Exact copy from §3.2.

**Narrative label.** "Anything we should know? (optional)"

**Footer.** "Confirming as {User.name} · {User.email}"

**Validation.** All three required.

**Post-action.** Create `RightsWarranty`, set `Pack.rights_warranty_id`, proceed to publish confirmation.

**Post-publish.** Warranty immutable. If warranty was made in error, remedy is takedown and reissue, not edit.

### P10 — Publish action and pre-publish checklist

**Checklist items.**

| Item | Condition | State |
|---|---|---|
| Title and credit line | set | ✓ / ✗ |
| Licence class | set | ✓ / ✗ |
| At least one asset | ≥ 1 | ✓ / ✗ |
| All assets scanned clean | every `clean` | ✓ / "{n} scanning" / "{n} flagged" |
| Alt text on all images | every image has alt | ✓ / "Missing on {n}" |
| Rights warranty confirmed | `rights_warranty_id` not null | ✓ / "Not confirmed" |
| Embargo configured (if set) | `lift_at` future, ≥ 1 recipient, `policy_text` non-empty | ✓ / N/A / missing list |

**CTA label states.** Any ✗ → disabled "Publish". All ✓ no embargo, no `publish_at` → "Publish now". All ✓ with schedule or embargo → "Schedule".

**Publish confirmation (no embargo).**

> Title: "Publish this pack?"
>
> Body: "You are publishing **{Pack.title}** to `{canonical_url}`. It will be public immediately. Licence class ({licence_class}) and credit line ({credit_line}) will be locked after publish."
>
> Actions: "Cancel" / "Publish now"

**Schedule confirmation (with embargo).**

> Body: "This pack will lift at {lift_at} ({TZ}) and publish to `{canonical_url}`. {n} recipient(s) will be invited now with pre-lift access."

**Schedule confirmation (no embargo).**

> Body: "This pack will publish at {publish_at} ({TZ}) to `{canonical_url}`. Before then, it remains private to your newsroom."

**Post-publish toast.** "Published. **{canonical_url}** · Copy link."

### P11 — Distributor Pack view (post-draft)

**Entry.** Click a non-draft Pack on P5; or after publish from P6.

**Blocks.** Header (title, status/visibility badges, canonical URL + copy, "View as journalist"); left column (Pack content read-only with lock icons); right column (lifecycle panel); bottom mini-analytics + link to P14.

**Lifecycle panel.**

| Status | Actions |
|---|---|
| `scheduled` + embargo | "Lift embargo now"; "Cancel schedule" (if no recipient accessed); "Add recipient" |
| `scheduled` no embargo | "Publish now"; "Cancel schedule" |
| `published` | "Issue correction" (P12); "Archive" |
| `archived` | "Unarchive" |
| `takedown` | View-only. Shows `takedown_reason`, `takedown_at`. No actions. |

**Corrections display.** Newest first, with date and user, below description.

### P12 — Correction authoring (modal)

**Trigger.** "Issue correction" on P11.

**Layout.**

| Element | Copy |
|---|---|
| Title | "Issue a correction" |
| Intro | "Corrections are public and permanent. They appear on the pack page and in embed snippet attribution as 'Last corrected: {date}'." |
| Textarea | "Correction text" (required) |
| Footer | "Issuing as {User.name} · {User.email}" |
| Actions | "Cancel" / "Issue correction" |

**Confirmation.** "Issue this correction? It will be visible immediately and cannot be deleted."

**Post-action.** Create `Correction`; re-render Pack page; surface in embed attribution metadata.

### P13 — Claim response surface

**Entry.** Dashboard alert; claims list; notification email.

**List columns.** Pack (link); Reason (humanised category); Reported by (masked email); Submitted (rel); Status.

**Detail view.**

| Block | Content |
|---|---|
| Claim facts | Category, full reason text, masked reporter, authority attestation, sworn-statement state, submitted_at |
| Pack snapshot | Current Pack state; link to live Pack |
| Admin status | "Under review by Frontfiles since {date}" / "Resolved: upheld on {date} — pack taken down" / "Resolved: dismissed on {date}" / "Withdrawn on {date}" |
| Your response | Textarea "Respond to this claim (optional). Your response is visible to Frontfiles reviewers, not to the reporter." + "Submit response" |

**Counter-notice.** After `upheld`: "File counter-notice" CTA opens a structured form (DMCA 512(g) elements). Submission restarts admin review.

### P14 — Distributor analytics

**Entry.** "Analytics" in Org nav; "Analytics" link from any Pack on P11.

**Org-level view.**

Filters: date range (default 30d); Pack (multi); licence class (multi); outlet domain (multi).

KPIs: Total downloads; Unique outlet domains; Pack views; Pre-lift preview accesses.

Charts: Downloads over time (daily stack, top 8 Packs + Other); Top Packs; Top outlets; Top assets.

CSV export: "Export CSV" — exports filtered event stream (timestamp, event_type, pack, asset, outlet_domain, recipient_masked_email, source).

**Per-Pack drill-down.** Same view scoped to one Pack. Adds embargo window timeline; embargo recipient log (per-recipient access log, masked, exportable CSV); asset breakdown.

**Empty states.** "No events in this date range. Try a wider range." / "Analytics begin once this pack is published." / "No views or downloads yet."

**Privacy rule.** Recipient emails always masked to `{first_char}***@{domain}` in the distributor view. Full emails visible only to the Recipient themselves (J8) and to Frontfiles admin.

## 5.3 Journalist / consumer workflows

### J1 — Journalist account (signup, sign-in)

**Entry.** "Sign in" top nav; inline "Create account" next to subscribe / export-history features; embargo invite link.

**v1.** Email + password only. No verification gate. Outlet auto-created from email domain (v1.1 adds Outlet verification).

**States.** Create account (email, password, name, role checkbox); Sign in (email, password, forgot-password); Signed in (profile menu with Subscriptions / Export history / Sign out).

**Copy.**

| Element | Copy |
|---|---|
| Title | "Create a journalist account" |
| Subtitle | "Follow newsrooms and keep a record of your downloads." |
| Role checkbox | "I use Frontfiles for editorial research, reporting, or publishing." |
| Privacy note | "Your email domain identifies your outlet to distributors in download analytics. You can review what is visible in your export history." |
| CTA | "Create account" |

**Post-action.** Create User + Recipient; detect outlet from domain; attach or create Outlet (unverified).

**Anonymous alternative.** Downloading and browsing public Packs require no account.

### J2 — Newsroom directory (root)

**Entry.** `newsroom.frontfiles.com`.

**Blocks.** Header (wordmark, sign-in, search → J6); Recently published feed; Newsrooms grid; footer (content standards, claims, verification, AI training reservation).

**States.** Signed out (full directory); Signed in (adds "From newsrooms you follow" row at top).

**Feed row.** Org name + badge; Pack title (link to J4); Credit line; Licence class short label; Published rel time; "Corrected" pill if any.

**Empty states.** "Follow newsrooms to see their latest packs here. Browse below." / "No packs published yet."

### J3 — Organisation page (newsroom home)

**Entry.** `newsroom.frontfiles.com/{org-slug}`.

**Blocks.** Org header (logo, name, badge, domain, subscribe); meta strip (country, primary domain); Pack list (chronological, paginated, filterable); sidebar (verification policy link, contact-for-press link where enabled v1.1, AI training reservation notice).

**Subscribe CTA.**

| Signed state | Behaviour |
|---|---|
| Signed out | "Subscribe" → prompts J1 with return |
| Signed in, not subscribed | "Subscribe" → creates `BeatSubscription` (organization_id), default `new_pack` + `embargo_lift` |
| Signed in, subscribed | "Subscribed ✓" → menu (Manage → J7, Unsubscribe) |

**Rules.** Takedown Packs not listed (direct URL still resolves to C2). Archived Packs listed only if "Include archived" filter on.

### J4 — Public Pack page

**Entry.** `newsroom.frontfiles.com/{org-slug}/{pack-slug}`. Rendered when `status=published` and `visibility=public`.

**Routing.** Archived: banner "Archived on {date}" + downloads still work. Takedown: render C2 instead. Scheduled w/o token: 404 to public; authenticated Org members redirect to P11.

**Blocks.** Breadcrumb; header (Org strip + badge, title, subtitle, meta with published date / licence label / corrections pill); licence block (class label, exact blurb, credit line with copy button, trademark notice if any, AI-training notice if `ai_training_permitted=false`); primary CTA row ("Download pack (zip)" primary, "Embed" secondary); assets section; description; corrections list; footer (licence code+URI, "Report a concern" → C1, "How verification works").

**Download behaviour.**

| CTA | Signed state | Flow |
|---|---|---|
| Download pack (zip) | Anonymous | Generate zip; emit `DistributionEvent(pack_zip_download)` with `outlet_domain` from referrer; emit `DownloadReceipt` with `recipient_id=null`; serve. Receipt link in post-download toast. |
| Download pack (zip) | Signed in | Same but `recipient_id` set; `outlet_domain` from Outlet. |
| Download asset | Either | Same pattern, `event_type=asset_download`. |

**Download confirmation (first per session).** "You are about to download assets from **{Organization.name}**. Licence: **{licence class}**. Full terms apply as shown above. By downloading, you accept the licence." Checkbox "Don't show again this session" · "Cancel" / "Download".

**Embed component.** Asset selector; size selector (Thumbnail / Web / Social / Original); snippet preview; "Copy embed code"; note "The embed includes the required credit and licence link. Do not remove them."

**Embed snippet (v1).**

```html
<figure>
  <img src="{rendition_url}" alt="{alt_text}">
  <figcaption>
    {credit_line}. Source: <a href="{pack_canonical_url}">{Organization.name}</a>.
    Licence: <a href="{licence_uri}">{licence_code}</a>.
  </figcaption>
  <meta name="tdm-reservation" content="1">
  <meta name="tdm-policy" content="{licence_uri}#tdm">
</figure>
```

TDM `meta` omitted when `ai_training_permitted=true` (CC classes).

### J5 — Pre-lift preview page

**Entry.** `newsroom.frontfiles.com/{org-slug}/{pack-slug}/preview?t={access_token}`.

**Gating.**

| Condition | Outcome |
|---|---|
| Valid token, `Embargo.state=active` | Render preview |
| Expired / revoked | "Access has been revoked or expired. Contact {Organization.name} for access." |
| Embargo already lifted | Redirect to J4 |
| Pack taken down | Redirect to C2 |

**Layout delta from J4.**

1. Persistent banner (non-dismissable): "**Embargoed until {lift_at} ({TZ}) · lifts in {countdown}**. This pack is confidential until then. Publishing before lift breaches the embargo set by {Organization.name}."
2. Policy block (prominent, above licence): "Embargo policy from {Organization.name}:" + `policy_text` verbatim
3. Identity strip: "You are accessing this preview as **{Recipient.email}**{if_outlet: ` at ` + Outlet.name}. Every access is logged for {Organization.name}."
4. Otherwise identical to J4.

**Download behaviour.** Permitted pre-lift. Every download emits `DistributionEvent(… source=email_link)` and `DownloadReceipt` with `recipient_id` from `EmbargoRecipient`. Rendition/original URLs are short-lived signed URLs (TTL 15 min). Pre-lift downloads flagged in P14 analytics.

**Countdown.** Real-time ticker; page auto-reloads on lift; URL redirects to J4.

**Access logging.** Every load increments `EmbargoRecipient.access_count`, updates `last_accessed_at`, sets `first_accessed_at` if null. Emits `DistributionEvent(preview_access)`.

### J6 — Cross-newsroom search

**Entry.** Search input in top nav (J2/J3/J4); `newsroom.frontfiles.com/search?q=...`.

**Fields searched (v1).** `Pack.title`, `subtitle`, `description`, `credit_line`; `Asset.caption`; `Organization.name`.

**Filters.** Licence class (multi); Newsroom (multi, free-text); Date range (7/30/90/custom); Include archived (off default).

**Result inclusion.** Only `status=published` + `visibility=public`. Archived included only if filter on. Takedown always excluded.

**Empty state.** "No packs match **{q}**. Try a broader query or a different filter."

### J7 — Beat subscriptions management

**Entry.** Profile → Subscriptions.

**Blocks.** Header "Your subscriptions"; list (one per BeatSubscription); notification channel toggle; digest cadence (v1: immediate only).

**Row.** Newsroom (name + badge + J3 link); Notify on (checkboxes: `new_pack` default on; `embargo_lift` default on; `update` default off); "Unsubscribe".

**Empty state.** "You are not subscribed to any newsrooms yet. Browse the directory to find newsrooms to follow." → J2.

### J8 — Export history

**Entry.** Profile → Export history.

**Blocks.** Header; filters (date range, Pack search, newsroom filter); list (date, Pack link, Organisation, asset or "full pack", licence class, receipt link → P4).

**Empty state.** "Nothing here yet. Your downloads and preview accesses will appear here."

**Export.** CSV of the current filtered list.

## 5.4 Public claims and tombstone

### C1 — Public claim intake form

**Entry.** "Report a concern" link on every J4, every C2, every J3, and global footer.

**Layout.**

1. Title "Report a concern"
2. Intro: "Use this form to report a problem with content on Frontfiles. We review every report. Misuse of this form (bad-faith or abusive claims) is itself grounds for restriction."
3. Target selector (pre-filled if reached from a Pack or Asset URL; else inputs to paste a Pack URL or Organisation URL)
4. Reason category selector:

| Value | Label |
|---|---|
| `trademark_infringement` | "Trademark or brand misuse" |
| `copyright` | "Copyright infringement" |
| `defamation` | "Defamation or false statements about me or my organisation" |
| `privacy` | "Privacy violation or image-of-person without consent" |
| `embargo_breach` | "Embargo was breached" |
| `other` | "Other (explain below)" |

5. Reason text (required, min 40 chars)
6. Reporter identity: Name (required), Email (required, confirmation-verified), Organisation/role (optional), authority checkbox (required for copyright/trademark/privacy/defamation)
7. DMCA 512(c)(3) sworn-statement block (required for `copyright`)
8. Consent: "I understand my name and masked email may be shared with the distributor in the course of review." (required)
9. Actions: "Submit report" / "Cancel"

**Post-submit.** Reporter email verification (click-through); distributor notified (P13); admin queue receives; confirmation "Thank you. We will review this report and contact you if we need more information. Reference: {Claim.id}."

**Validation errors.** "Please describe the concern in at least 40 characters." / "Copyright reports require you to confirm authority and swear to the statement above." / "That link is not a Frontfiles pack or organisation URL." / "Enter a valid email address we can use to follow up."

**Abuse posture.** Rate-limit per IP and per email; admin flag for repeat submitters.

### C2 — Tombstone page

Renders at canonical Pack URL when `status=takedown`.

**Layout.**

1. Header: "This pack has been taken down."
2. Facts:

| Row | Source |
|---|---|
| Organisation | Name + badge (only if Org itself not under revocation) |
| Original title | `Pack.title` |
| Taken down on | `takedown_at` |
| Reason | `takedown_reason` |

3. Explanation: "This pack was removed following a {outcome} claim review. For questions about this decision, see our [claims and takedown policy]. If you believe this action is wrong, contact us."
4. Receipt lookup block: "If you have a download receipt from this pack, you can still retrieve and verify it at its receipt URL."
5. No navigation to assets, no thumbnails, no description.

**Variants.**

| Cause | `takedown_reason` shown |
|---|---|
| Upheld claim — rights | "Taken down following an upheld rights claim." |
| Upheld claim — content standards | "Taken down for violation of Frontfiles content standards." |
| Embargo breach by distributor | "Taken down at the distributor's request following an embargo incident." |
| Legal order | "Taken down in response to a legal order." |
| Verification revoked | "Taken down because the publishing organisation's verification was revoked." |
| Distributor-initiated | "Withdrawn by the distributor." |

Admin picks from this controlled list; internal reasoning captured in `AdminAuditEvent`, not public.

**robots/sitemap.** `noindex`; not in sitemap.

**Embed snippet behaviour on takedown.** Rendition URLs serve 410 Gone. The `<figcaption>` still states credit and links to the tombstone.

## 5.5 Admin console

### A1 — Admin shell and access

**Entry.** `admin.frontfiles.com` (separate domain; separate cookie scope).

**Access.**

| Role | Can view | Can act |
|---|---|---|
| `viewer` | All queues, audit log (read-only) | Nothing |
| `reviewer` | Verification queue, scan-flag queue, claims queue | Approve/deny verifications (not watchlist collisions), uphold/override scan flags, triage claims, request info |
| `operator` | Everything reviewers see + Org admin + takedown flow | All reviewer actions + takedowns + org tier changes (non-publisher orgs) |
| `security` | Everything + key management | Everything + key rotation + key revocation + role assignment + verified_publisher org actions (co-sign) |

**Auth.** TOTP on every sign-in; hardware key (WebAuthn) for `security` and co-sign; idle timeout 2h; absolute 12h; IP allowlist per role; device-session binding.

**Layout.** Left nav (Queues — Verification / Scans / Claims; Orgs; Keys; Audit; Settings); top bar (admin name, role badge, sign-out, persistent "Reason" hint).

**Reason-capture modal (re-usable).** `[reason textarea (required min 10 chars) + "Confirm and apply" + "Cancel"]`. Reason copied into `AdminAuditEvent.reason`.

**No dashboard in v1.** Queues are the home.

### A2 — Verification review queue

**List columns.** Organisation (name, primary_domain); Method (`dns_txt` / `domain_email` / `authorized_signatory`); State (`pending_check`, `check_failed`, `watchlist_collision`, `ready_to_approve`); Submitted (rel); Assigned to.

**States.**

| State | Admin action |
|---|---|
| `pending_check` | Wait; force-recheck if stuck |
| `check_failed` | Investigate; approve with evidence; deny |
| `watchlist_collision` | Requires `security` co-sign to approve |
| `ready_to_approve` | Approve or deny |

**Item detail.** Org facts; method facts (DNS record + raw response, or email address + code timestamps, or attestation doc v1.1); watchlist facts (matched mark, confidence, public registration link); prior audit events on this org.

**Actions.** Approve / Deny (reason) / Request info / Force recheck.

**Approval side effects.** If pair complete (`dns_txt` + `domain_email` active), `verification_tier = verified_source` auto. Org owner notified. `AdminAuditEvent` written.

**Denial side effects.** `verified_at` stays null. Org owner notified with reason. Org remains `unverified`.

### A3 — Scan-flag review queue

**List columns.** Asset (filename, thumbnail — blurred if adult/violence/csam); Pack (title, state); Organisation (+ badge); Scanner (suite + version); Flagged categories; Scanned (rel).

**Item detail.** Asset preview (blurred by default for adult/violence; CSAM never reveals in-browser); scanner raw output; Pack context; Org context (tier, past flag history).

**Actions.**

| Action | Who | Effects |
|---|---|---|
| Uphold flag | reviewer+ | `result` stays `flagged`; publish blocked |
| Override to `clean` | operator+ | `result = clean`; Asset publishable; strong audit event |
| Delete Asset | reviewer+ | Asset hard-deleted; Pack + Org notified |
| Escalate | reviewer+ | Routes to `security`; triggers external obligations outside product boundary |

**CSAM rule.** Auto-escalates; freezes Org; immutable record; legal notified outside product; no in-browser asset display.

### A4 — Claims review queue

**List columns.** Claim ID (short); Target (Pack + Org); Reason (humanised); Reporter (name, masked email); Status; Age; Assigned.

**SLA indicators.** Per-category thresholds flag overdue rows.

### A5 — Claim detail and action

**Blocks.** Header (Claim ID, target, status, age, assigned); Claim facts (full category, reason_text, reporter identity visible to admin, authority attestation, sworn-statement state); Pack snapshot; Distributor response (if any); Internal notes (admin-only); Action footer.

**Actions.**

| Action | Who | Flow |
|---|---|---|
| Assign / reassign | reviewer+ | First assign: `submitted → reviewing` |
| Request info from reporter | reviewer+ | Templated email + free text |
| Request info from distributor | reviewer+ | Templated email; P13 surfaces |
| Uphold | operator+ (security co-sign for `verified_publisher`) | → A6 flow. `Claim.status=upheld`; Pack → takedown. Reporter + distributor notified. |
| Dismiss | reviewer+ | Reason required. `Claim.status=dismissed`. Both parties notified. |
| Withdraw | reviewer+ | `Claim.status=withdrawn` |

**Counter-notice handling.** If distributor files counter-notice via P13 after an `upheld` claim, claim reopens as `reviewing` with banner. Configured window (10 business days v1 default, per policy in §14). Admin evaluates; maintain takedown, or restore (v1 simplification: operator manually restores by reversing takedown status with security co-sign).

### A6 — Takedown action (shared flow)

Not a page; modal/slide-over triggered from A3, A5, A9, or admin Pack view.

**Fields.**

| Field | Required | Notes |
|---|---|---|
| Scope | yes | `pack` or `asset` |
| Reason category | yes | Controlled list matching C2 variant copy |
| Public reason copy | auto from category; operator-editable for `legal_order` | Exactly what the tombstone shows |
| Internal reason | yes | Full reasoning; copied into audit |
| Legal basis | yes for `claim_upheld_*`, `legal_order` | Claim ID or order reference |
| Two-person co-sign | required if Org is `verified_publisher` or Pack has > 1000 downloads | Colleague signs with same fields |

**Preview block.** Live C2 tombstone rendering.

**Commit.** Persist status transition; invalidate CDN caches; serve 410 on all asset URLs; notify distributor (P11); notify reporter if origin is upheld claim; write `AdminAuditEvent` with both admin IDs if co-signed.

**Reversal.** Terminal per invariants. Manual reversal: `security` + co-sign + override reason; restores to `archived` (not `published`); original tombstone event preserved; reversal event recorded.

### A7 — Signing key management

**Access.** `security` role only.

**Blocks.** Header ("Signing keys" + status summary); list; actions; public keyset endpoint health.

**Columns.** Key ID (kid, short + copy); Algorithm; Status (`active` / `rotated` / `revoked`); Created; Rotated/Revoked; Receipts signed (count).

**Actions.**

| Action | Who | Confirmation |
|---|---|---|
| Rotate | security + co-sign | Creates new KMS key; status `active`; previous `active` → `rotated`. Reason required. Keyset endpoint updated atomically. |
| Revoke | security + co-sign | Warning: "Revoking this key invalidates every DownloadReceipt signed by it. The receipts become permanently marked as 'signed by a revoked key'. This cannot be undone." |

**Rotation ceremony (v1).** Security admin clicks Rotate → co-signer approves → server requests KMS keygen → new key `active`; old `rotated`; keyset endpoint updated; `AdminAuditEvent` with both IDs; new receipts emit new `kid`.

**Keyset endpoint health.** "Last published: {ts}"; "Keys currently published: {n}"; "Check endpoint" button fetches `frontfiles.com/.well-known/receipt-keys` and validates vs. DB.

### A8 — Audit log viewer

**Filters.** Admin user (multi); Action (multi from controlled enum); Target type; Target ID; Date range (default 30d); Co-signed only.

**Columns.** Occurred at (UTC); Admin (name + role); Action; Target (type + name/ID + link); Reason (truncated + expand); Before/after (diff indicator + expandable JSON); Co-signers.

**Per-row expand.** Full reason; full JSON diff; link to entity; permalink copy.

**Export.** CSV or NDJSON. `viewer` role: redacted (reason truncated to 80 chars; IDs masked). `security` role: full.

**Immutability.** No edit or delete in UI. Annotations appended as `admin_note_added` events.

### A9 — Organisation administration

**Blocks.** Header (name + badge + slug + primary_domain + country); facts strip (signup date, tier history, Pack counts by status, claim counts, takedown counts); verification history; recent Packs (20); recent admin activity (20); action panel.

**Actions.**

| Action | Who | Effect |
|---|---|---|
| Change tier manually | operator (unverified → verified_source); security + co-sign (any change touching `verified_publisher`) | Sets `verification_tier`; audit event |
| Suspend | operator+ | Blocks new-Pack creation; existing Packs remain live; freezes pre-lift preview tokens |
| Unsuspend | operator+ | Reverses suspend |
| Revoke verification | security + co-sign | Drops tier to `unverified`; badge disappears; published Packs remain live; receipt snapshots preserved |
| Take down organisation | security + co-sign | Bulk A6 cascade on every Pack; shared reason on tombstones |
| Initiate slug change + redirect | operator+ | Updates `Organization.slug`; adds redirect table row; canonical URLs redirect |
| Full rebrand / transfer | not available in v1 | v1.2 |

**Watchlist override pill.** Present if org was approved despite watchlist collision; link to audit event.

---

# Part 6 — Cross-cutting rules

Rules that do not live on any single surface but govern behaviour across multiple.

## 6.1 Receipt and identity integrity

1. Every download emits `DistributionEvent` + `DownloadReceipt` (1:1). No silent downloads.
2. Every pre-lift access emits `DistributionEvent(preview_access)` and updates `EmbargoRecipient` access log.
3. Receipts for downloads that happened before takedown remain verifiable indefinitely.
4. Verification badge on receipts is a snapshot at time of download; never rewritten on later tier changes.
5. Admin decisions are attributed to "Frontfiles" externally; specific admin identity is in the audit log only.

## 6.2 Identity surfacing

- Recipient email is never surfaced in full to the distributor. Distributor sees `{first}***@{outlet_domain}` everywhere.
- Recipient sees their own full email in J8 and P4.
- Anonymous downloaders are identified only by `outlet_domain` (from referrer), `user_agent`, and `ip_country`.

## 6.3 Licence display consistency

The same blurb (Part 2 §2.3) renders verbatim on J4, J5, embed snippet attribution, download receipt terms summary, and the licence page. One source of truth; no paraphrasing anywhere in the product.

## 6.4 Admin action integrity

1. Every mutation writes `AdminAuditEvent` synchronously; commit does not complete until audit row is durable.
2. Reason capture is blocking; required min 10 chars.
3. Co-signing is same-session, WebAuthn-bound, 30-min expiry, different admin required.
4. Sessions: TOTP + idle/absolute timeouts + per-role IP allowlists.

## 6.5 URL stability

Canonical Pack URL is stable across all status transitions, including takedown (resolves to C2 tombstone). Archived Packs remain at canonical URL; index-excluded.

## 6.6 Suspension × in-flight embargo

On Organisation suspension or verification revocation mid-embargo: pre-lift preview tokens freeze (serve 410 with admin-provided message); Pack is frozen at current state pending admin review; existing receipts remain valid and retrievable.

---

# Part 7 — Release plan

## 7.1 v1 ship scope

All of Parts 1–6 above at v1 depth. Thirty-one page/component specs across five surface groups.

## 7.2 v1 launch dependencies

- Legal sign-off on §14.1–14.7 (FF-* terms pages, ToS, ToU, Privacy, DPA, Claims policy, AI training page, Brand/verification page, Content standards)
- DNS verification infrastructure operational
- Ed25519 signing infrastructure operational (KMS + public keyset endpoint)
- C2PA opt-in path stubbed (full ceremony can land post-v1.0)
- Abuse scanning pipeline operational (ClamAV + Google Cloud Vision SafeSearch or AWS Rekognition)
- Launch market stance formalised: global English UI; EU obligation surfaces active; US DMCA counter-notice supported; sanctions check at onboarding

## 7.3 Launch hedge

If FF-* terms pages slip past Legal review, ship v1 with `cc_attribution` + `cc_public_domain` only. FF-* classes flagged-disabled in the uploader selector. Flag infrastructure in place from day one so fallback is costless.

## 7.4 v1.1 deferred list

- Authorised-signatory attestation (schema in v1; UI surface in v1.1)
- Outlet verification (journalist side)
- SavedSearch
- Third-party receipt verification UI
- Reissue / `supersedes_pack_id` model
- Outbound mention detection
- Webhooks
- Public API
- Video transcoding
- Topic taxonomy (`Tag`, `PackTag`) + topic-based BeatSubscription
- Coordinated / tiered embargoes
- Organisation rename / rebrand / transfer (slug change with redirect is v1)
- Admin throughput dashboards
- Daily digest cadence for subscriptions

## 7.5 Beyond v1.1

Surface A (Creator CC commons) and Surface C (Frontfiles free tier) — each requires its own spec pass and was explicitly deferred in Locked Decision #2.

---

# Appendix A — Glossary

- **Asset** — an individual file within a Pack.
- **Claim** — a public intake request alleging a problem with a Pack or Asset.
- **Credit line** — the human-readable attribution string set by the distributor.
- **Distributor** — an Organisation member publishing Packs.
- **Embargo** — a time-gated release policy attached to a Pack.
- **EmbargoRecipient** — an approved pre-lift viewer of an embargoed Pack.
- **Licence class** — one of five enumerated classes governing permission flags for a Pack.
- **Newsroom** — the consumer-facing name for an Organisation's public presence on the platform.
- **Organisation** — the verified distributor entity (brand, label, team, federation, agency, publicist).
- **Outlet** — the publication a Recipient works for, keyed by email domain.
- **Pack** — the primary distributable unit. One licence class, one credit line, one embargo, one or more Assets.
- **Rights warranty** — the three-boolean confirmation the distributor makes at publish time (subject releases, third-party content, music).
- **Recipient** — an identified consumer (journalist).
- **Signed download receipt** — tamper-evident record emitted on every download, Ed25519 signed.
- **Tombstone** — the page that replaces a Pack when it is taken down; preserves URL for citation integrity.

# Appendix B — Terminology rules

| Use | Do not use |
|---|---|
| Verified source | Certified source |
| Verified publisher | Certified publisher; Official (unqualified) |
| Licence class | Licence type |
| Provenance-aware | Authenticated (without qualifier) |
| Tamper-evident | Tamper-proof |
| Independently verifiable | Certified |
| AI training not permitted | AI training blocked |
| Credit line | Attribution, byline (inconsistently) |

# Appendix C — Open items and dependencies

## C.1 Legal (see `docs/public-newsroom/LEGAL-BRIEF.md`)

1. Right-of-publicity warranty sufficiency
2. Third-party music rights warranty sufficiency
3. Verification revocation × in-flight embargo procedural risk
4. Counter-notice window (default 10 business days — confirm)
5. Tombstone permanence (EU/UK RTBF exposure)
6. Correction mechanism exposure
7. Scan-flag override chain of custody

## C.2 Product dependencies

- KMS selection and operational runbook for SigningKey rotation
- Scanning provider selection and SLA agreement
- CDN strategy for public and signed-URL content (pre-lift preview)
- Robots/sitemap configuration for newsroom subdomain
- `/.well-known/tdmrep.json` generator implementation
- `/ai.txt` generator implementation

## C.3 Design dependencies

- Newsroom chrome design (brutalist-leaning, black/blue/white per product preference)
- Badge typography and placement across surfaces
- Embed snippet stripped-CSS fallback
- Tombstone visual treatment

---

**End of PRD.**
