# Frontfiles Platform Build — Internal Traceability Document

**Build date**: 2026-04-02
**Stack**: Next.js 16.2.2, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, vitest 4.1.2, bun
**Authority order**: Rebuild Charter > Strategy Master > Architecture Doc > Canonical Spec > Backlog > Mockup Brief > Design Canon

---

## Design System Lock

- **Colors**: Black (#000), Blue-600 (`oklch(0.546 0.213 264.376)`), White (#fff) — no fourth color
- **Destructive**: Maps to black (not red)
- **Radius**: 0 (`--radius: 0rem`)
- **Typography**: Neue Haas Grotesk Display/Text, SF Mono
- **Labels**: 10px bold uppercase tracking-widest slate-400

---

## Route Map (22 routes)

| Route | Surface | Phase |
|---|---|---|
| `/` | Landing | Pre-existing |
| `/onboarding` | 3-phase creator onboarding (Verify → Build → Launch) | Pre-existing (repaired) |
| `/[username]` | Creator profile (public) | Pre-existing (repaired) |
| `/[username]/frontfolio` | Frontfolio (public portfolio) | Pre-existing (repaired) |
| `/vault` | Vault (private asset management) | Pre-existing (repaired) |
| `/vault/upload` | Upload workflow | Pre-existing |
| `/vault/pricing` | Creator pricing & licence config | Phase 3 |
| `/vault/settlements` | Settlement history & earnings | Phase 3 |
| `/vault/offers` | Direct offer management | Phase 4 |
| `/vault/assignments` | Assignment management | Phase 4 |
| `/vault/disputes` | Dispute resolution | Phase 4 |
| `/vault/composer` | Article composer (FCS L4) | Phase 5 |
| `/search` | FrontSearch (discovery) | Phase 2 |
| `/asset/[id]` | Asset detail (public) | Phase 2 |
| `/story/[id]` | Story detail (public) | Phase 2 |
| `/article/[id]` | Article detail (public) | Phase 5 |
| `/lightbox` | Buyer lightbox | Phase 2 |
| `/checkout/[assetId]` | 5-step checkout | Phase 2 |
| `/account` | Buyer/Reader account | Phase 2 |
| `/plugin` | Plugin Premium subscription | Phase 6 |
| `/staff` | Staff operational dashboard | Phase 6 |
| `/_not-found` | 404 | Auto |

---

## Username (Spec §5.1)

Every user has exactly one **username** — the human-readable public identifier.

| Property | Rule |
|---|---|
| Format | 3–30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen |
| Uniqueness | Globally unique, enforced at database level (UNIQUE constraint) |
| URL | Root-level: `frontfiles.com/{username}` |
| Immutability | Changeable during 30-day grace period after creation; permanent after |
| Relation to Vault ID | Independent. Vault ID (`vault-XXXXXXXX`) is the system identifier. Username is the human-readable identity. Both are permanent. Neither replaces the other. |
| Reserved words | All platform routes + reserved terms (see `RESERVED_USERNAMES` in `types.ts`) |
| Validation | `USERNAME_PATTERN` regex + reserved word check via `isValidUsername()` in `types.ts` |

---

## Type System (`src/lib/types.ts`)

### State Machines (all deterministic)

| Domain | States | Source |
|---|---|---|
| Asset Format | 7: photo, video, audio, text, illustration, infographic, vector | Spec S6.4 |
| Privacy | 3: PUBLIC, PRIVATE, RESTRICTED | Spec S6.5 |
| Validation Declaration | 7: fully_validated, provenance_pending, manifest_invalid, corroborated, under_review, disputed, invalidated | Spec S7.4-7.5 |
| Publication | 3: PUBLISHED, DRAFT, UNPUBLISHED | Spec S6 |
| Offer | 6: pending, countered, accepted, rejected, expired, cancelled | Spec S10.4 |
| Assignment | 7: brief_issued, escrow_captured, in_progress, delivered, confirmed, disputed, cancelled | Spec S10.7-10.9 |
| Dispute | 5: filed, under_review, upheld, not_upheld, escalated_external | Spec S13 |
| Payout | 4: queued, processing, settled, failed | Spec S8.8 |
| Article Publish | 5: draft, pending_review, published, publishing_hold, removed | Spec S11 |
| Checkout | 5: licence_selection, declaration_review, confirm_before_signing, price_confirmation, payment_capture | Spec S9.6 |
| Trust Badge | 2: verified, trusted | Spec S7.9-7.11 |
| Exclusive | 3: 30_day (3x), 1_year (5x), perpetual (10x) | Spec S10.5 |

### Transaction Economics

| Channel | Creator Fee | Buyer Markup |
|---|---|---|
| Direct | 20% | 20% |
| Plugin | 10% | 10% |
| Commissioned | — | 10% |
| Bulk | — | 0% |

---

## Phase 0 — Normalize

- [x] Removed 4 duplicate files (ProposedFieldEditor 2, MultiValueEditor 2, Step5 2, Step6 2)
- [x] Fixed primary blue from purple-shifted `oklch(0.546 0.245 262.881)` to canonical `oklch(0.546 0.213 264.376)`
- [x] Removed destructive red — changed to black `oklch(0.145 0 0)`
- [x] Rewrote `src/lib/types.ts` — all 12 state machines, 20+ interfaces
- [x] Rewrote `src/lib/mock-data.ts` — 10 assets (all 7 formats), stories, articles, collections, buyer, lightbox, transactions, settlements
- [x] Fixed 7 components for new type shapes (VaultStatusPanel, VaultDetailDrawer, VaultAssetList, FrontfolioContent, vault/page, StateBadge, ProfileContent)
- [x] Fixed onboarding step labels: Credibility Cross-Check, Profile Pre-fill, Creator Validation, Vault Creation

## Phase 1 — Repair Existing

- [x] StateBadge: Replaced certified/pending/flagged with 7 declaration state variants
- [x] TrustBadge: Added `badge` prop (verified/trusted) alongside `tier`
- [x] ProfileLeftRail: Added Founding Member badge, fixed TrustBadge props
- [x] FrontfolioContent: Renamed Photos tab to Assets, added format icons to AssetCard, fixed contentMix to canonical 7-field shape
- [x] Fixed all `asset.type` -> `asset.format`, `asset.certification` -> `asset.declarationState`
- [x] Fixed Article filter from `publication` to `publishState`

## Phase 2 — Discovery & Transaction

- [x] FrontSearch (`/search`) — query, format filter, tabs (assets/stories/creators)
- [x] Asset detail (`/asset/[id]`) — metadata, provenance, licensing sidebar, CEL
- [x] Story detail (`/story/[id]`) — story header, content mix, linked assets
- [x] Lightbox (`/lightbox`) — asset list with pricing, licence actions
- [x] 5-step Checkout (`/checkout/[assetId]`) — useReducer state machine, licence selection -> declaration review -> confirm -> price -> payment, Certified Package confirmation
- [x] Buyer account (`/account`) — overview, transactions, lightboxes, settings tabs

## Phase 3 — Creator Economics

- [x] Pricing (`/vault/pricing`) — priced/unpriced asset lists, exclusive tier reference
- [x] Settlements (`/vault/settlements`) — earnings summary, fee structure, settlement history

## Phase 4 — Advanced Transactions

- [x] Direct Offers (`/vault/offers`) — pending/resolved, accept/counter/reject actions, 3-round max
- [x] Assignments (`/vault/assignments`) — active/completed, brief/deliverables/deadline/escrow, state machine badges
- [x] Disputes (`/vault/disputes`) — dispute resolution UI, 3 dispute types, state badges

## Phase 5 — Editorial

- [x] Composer (`/vault/composer`) — useReducer, title/body editor, source asset selection (FCS L4), word count, draft/submit
- [x] Article detail (`/article/[id]`) — assembly verification panel, source assets, certification hash

## Phase 6 — Platform Operations

- [x] Plugin (`/plugin`) — 3 tiers (micro/premium/enterprise), fee comparison, gated stubs
- [x] Staff (`/staff`) — 8 operational modules (onboarding queue, disputes, reverification, moderation, settlements, trust management, analytics, article review)

## Phase 7 — Gated/Deferred

- [x] Plugin Micro & Enterprise marked "Coming soon" in Plugin page
- [x] Tier 2 (Protected Source) noted as deferred in types.ts
- [x] Staff modules with count=0 serve as stubs for future implementation
- [x] Capture integration (camera) — no surface needed (device-side)
- [x] AI Data licensing — deferred per spec

---

## Compliance Gate

- [x] Build: `bun run build` — 22 routes, 0 type errors
- [x] Tests: `bun x vitest run` — 37 tests, 2 suites, all passing
- [x] Design canon: 3 colors only, zero radius, NHG font stack
- [x] State machines: All 12 canonical state machines in types.ts
- [x] Terminology: All canonical terms enforced (Validation Declaration, Frontfolio, FCS, etc.)
- [x] All 7 asset formats supported across all surfaces
- [x] 5-step checkout implemented as deterministic state machine
- [x] FCS L4 Assembly Verification in Composer and Article detail
- [x] CEL (Certification Event Log) displayed in Asset detail and Vault drawer
- [x] Transaction economics: Direct 80/20, Plugin 90/10, Commissioned 10% markup, Bulk 0%
- [x] Exclusive licence multipliers: 3x/5x/10x
