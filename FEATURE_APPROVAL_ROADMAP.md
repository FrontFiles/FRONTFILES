# Frontfiles — Feature Approval Roadmap

**Status:** draft v1 · **Date:** 2026-04-18 · **Owner:** João Nuno Martins
**Scope:** governs the 11-feature approval chain → design / layout / tuning-agents pass → resumed infrastructure phase.
**Relation to other governance docs:** companion to `PLATFORM_REVIEWS.md`, `INTEGRATION_READINESS.md`, `ROADMAP.md`, `ASSIGNMENT_DISPUTE_TAXONOMY.md`, and `docs/specs/SPECIAL_OFFER_SPEC.md`.
**Does not supersede** any of the above; **reuses** their locks as gate evidence. Useful unfinished work in those docs is preserved and folded into the relevant gate below.

---

## Purpose

Lock the sequence, artifacts, and sign-off criteria for the three work phases that follow the post-KD-9 close:

- **Phase A** — confirm or define each of the 11 core product features with explicit approval gates.
- **Phase B** — apply a design / layout / tuning-agents pass across Phase-A surfaces.
- **Phase C** — resume the infrastructure and external-clock work deferred during the feature chain (Phase 1 Foundation gating, KD closures, Vercel env, micro-queue, CI hardening).

Each feature gate in Phase A produces a signed, dated decision. Each phase transition requires an explicit go signal. No work in Phase B begins until Phase A is fully signed. No work in Phase C begins until Phase B is signed, except where a Phase C item is explicitly flagged as a parallel-safe branch.

---

## Decision locks — 2026-04-18 founder session

| # | Decision | Rationale |
|---|---|---|
| D1 | **"SPECIAL OFFER" is canonical.** The prior product alias is retired. Doc artifacts (`docs/specs/SPECIAL_OFFER_SPEC.md`, `D-SO1`, any UI copy, any route handler naming) rename under A.0. | Founder brand/product canonical; retiring the alias prevents downstream drift. |
| D2 | **Track split accepted.** Phase A splits into Track 1 (approval gates on existing spec + code) and Track 2 (definition gates from partial or zero material). **FFF added as the 10th feature**, distinct from FRONTFOLIO. | Four of the original nine were spec-first, not approval-first; bundling them as a single chain would produce fake approvals. |
| D3 | **Roadmap reuses `PLATFORM_REVIEWS.md` v2 locks** and preserves useful unfinished work across all existing gov docs. | Avoid duplicate decisions; protect continuity; keep the locks already earned. |
| D4 | **FRONTFOLIO scope = BOTH the public creator page (`/u/[handle]`) AND the back-of-house composition tool.** | Single coherent scope; the UI-chrome locks in `PLATFORM_REVIEWS.md` (D-F1 / D-F2) cover one side and extend naturally to the other. |
| D5 | **COLLECTION added to Phase A as A.11 (Track 1 partial).** Live at `/collection/[id]` (`src/app/collection/[id]/page.tsx`), defined in `src/lib/types.ts:599` per Spec §6, shareable in FFF via `PostAttachmentKind: 'collection'` (`src/lib/types.ts:1143`). Scope sentence: *"A Collection is a Frontfiler-curated, ordered set of Frontfiles assets with its own privacy model, viewable at `/collection/[id]` and shareable as an FFF attachment kind."* Privacy-visibility interaction rule: **strict match at attach time** — post validator rejects attach when `Collection.privacy != PUBLIC` and `Post.visibility == 'public'`, consistent with the existing `attachment_not_public` validator pattern (`src/lib/post/types.ts:39-46`); later privacy changes fail closed via hydration placeholder. **Locked 2026-04-23 under O-A0-2; count-propagation landed in the same batch** (Line 4 "11-feature"; §Scope table row 11; §Phases-at-a-glance line for A.11; §Dependency graph node; §Parallel-safe branches; §Phase A exit criteria `G-F1 through G-F11` / "eleven gates"). | Discovered during A.5 FFF code-ground-truth audit (2026-04-23); missing from the original 10-feature enumeration. Shipping in live UI without an approval gate violates the "no approval on ambiguous identifiers" principle that motivates A.0. |

---

## Scope — 11 features in Phase A

| # | Feature | Track | Canonical status |
|---|---|---|---|
| 1 | UPLOAD | 1 — approval | Locked v2 (D-U1 / U2 / U6). Blue Protocol state drift is the single open blocker. |
| 2 | ASSIGNMENTS | 1 — approval | Locked v2 (D-A1 / A2 / A3). Dispute taxonomy v1 → v2 and G-T1…G-T4 are the open blockers. |
| 3 | SPECIAL OFFER | 1 — approval | Locked v1.0 under its prior alias — retire alias under A.0, then confirm lock. |
| 4 | FRONTFOLIO | 1 — approval | Partial — D-F1 / F2 cover UI chrome; extend to full scope (public page + composer) inside the gate. |
| 5 | FFF | 1 — approval | Scope sentence locked 2026-04-23; partial (O-FFF2 partial; O-FFF3, O-FFF5 open). |
| 6 | SHARE | 2 — definition | Four overlapping concepts (signed-URL delivery / public share / collaborator invite / share-to-feed). Disambiguate into primitives before approval. |
| 7 | COLLAB | 2 — definition | Zero code, zero spec. Needs full product definition before it can sit in a sequence. |
| 8 | HOME PAGE | 2 — definition | Surface exists but uses mock data. Needs content model, IA, ranking, real data bindings. |
| 9 | LIGHTBOX | 2 — definition | Minimal; collides with asset-viewer and preview surfaces. Disambiguate and scope. |
| 10 | COMPOSER | 2 — definition | Name collides with at least two existing composer surfaces. Disambiguate and scope. |
| 11 | COLLECTION | 1 — approval | Partial — scope sentence + privacy-visibility rule locked 2026-04-23 (D5 / O-A0-2); Spec §6 upstream, `interface Collection` in-repo, `/collection/[id]` route + FFF attachability live. |

---

## Phases at a glance

```
Phase A — Feature chain (serial within-track; A.0 first, blocks all others)
  A.0  Terminology lock                                        [founder + docs]
  ── Track 1 (approval gates — confirm + close open items) ──
  A.1  UPLOAD                                                  [engineering]
  A.2  ASSIGNMENTS                                             [engineering + legal]
  A.3  SPECIAL OFFER                                           [engineering]
  A.4  FRONTFOLIO                                              [engineering + design]
  A.5  FFF                                                     [engineering + design]
  A.11 COLLECTION                                              [engineering]
  ── Track 2 (definition gates — write the spec, then approve) ──
  A.6  SHARE                                                   [product + engineering]
  A.7  COLLAB                                                  [product]
  A.8  HOME PAGE                                               [product + design]
  A.9  LIGHTBOX                                                [product]
  A.10 COMPOSER                                                [product]

Phase B — Design / Layout / Tuning Agents (serial within phase)
  B.1  Design system application pass across Phase-A surfaces  [design]
  B.2  Layout / IA consistency pass                            [design + product]
  B.3  Tuning agents — scope, then build                       [engineering + product]

Phase C — Infrastructure resume (parallel-safe after B signed)
  C.1  KD closures (KD-10 open-or-close, KD-11..KD-14)         [engineering]
  C.2  Vercel env hardening                                    [engineering]
  C.3  Micro-queue build                                       [engineering]
  C.4  CI hardening follow-through                             [engineering]
  C.5  Phase 1 Foundation gating (G2 → G3 → G4 → G5 → G6)      [founder + legal + engineering]
```

---

## Phase A — detail

### A.0 — Terminology lock *(blocks A.1 through A.11)*

**Estimated sessions:** 4–6 (P0–P6).

**Purpose.** Before any feature gate runs, canonical names must be locked across the doc set to prevent approval on ambiguous identifiers.

**Work:**

1. Land the canonical name across docs: spec file → `docs/specs/SPECIAL_OFFER_SPEC.md`; decision code → `D-SO1` in `PLATFORM_REVIEWS.md`; all UI copy, route handler names, API path comments.
2. Confirm "FRONTFOLIO" scope sentence: *"The creator's identity surface on Frontfiles — both the public page at `/u/[handle]` and the back-of-house composition tool used to assemble it."*
3. Confirm "FFF" scope sentence — **LOCKED 2026-04-23** per §A.5 scope sentence (O-A0-1 resolved; see open items below for the follow-on O-A0-2…O-A0-5 items surfaced during the code-ground-truth audit).
4. Agree naming rule for ambiguous Track-2 features: "SHARE", "LIGHTBOX", "COMPOSER" may each resolve to multiple named primitives in their definition gates, not a single feature.

**Artifacts produced:**

- `TERMINOLOGY_LOCK.md` — canonical name registry; one row per product concept; versioned.
- Rename commits across the doc set (one commit per file, single logical pass).

**Sign-off:** founder signature on `TERMINOLOGY_LOCK.md` v1.

**Open items:**

- **O-A0-1 [RESOLVED 2026-04-23]** — FFF scope sentence locked; see §A.5 scope sentence. Anchored to code ground-truth (`src/lib/types.ts:1139-1161`, `src/lib/post/types.ts`, `src/components/discovery/DiscoveryNav.tsx:104-170`).
- **O-A0-2 [RESOLVED 2026-04-23]** — Collection 4-part lock landed per D5: **(a) Slot** = new A.11 slot (Track 1); **(b) Track** = Track 1 partial (Spec §6 + working route + FFF integration present); **(c) Scope sentence** = *"A Collection is a Frontfiler-curated, ordered set of Frontfiles assets with its own privacy model, viewable at `/collection/[id]` and shareable as an FFF attachment kind."*; **(d) Privacy-visibility rule** = strict match at attach time (post rejects attach when `Collection.privacy != PUBLIC` and `Post.visibility == 'public'`, per `attachment_not_public` validator pattern in `post/types.ts:39-46`). Full A.11 section added below. Count-propagation landed in same batch (scope table, phases-at-a-glance, dependency graph, exit criteria).
- **O-A0-3 [RESOLVED 2026-04-23]** — A.6 SHARE Problem statement expanded from 3 to 4 primitives: (a) signed-URL delivery (`/api/media/[id]`), (b) public share link (`/share/[token]`), (c) collaborator invite (no live code yet), **(d) share-to-feed** — top-nav "Share" button (`DiscoveryNav.tsx:160-170`) creators-only, gated by `isFffSharingEnabled()`, fires `useDraftStore().openComposer()` → `GlobalShareComposer` → creates FFF post. O-SH1 naming choice now spans 4 options. A.5 O-FFF5 remains a deferred-or-reorder question at A.5 sign-off time.
- **O-A0-4 [RESOLVED 2026-04-23]** — "Explore" wins (locked at doc level). Top-nav label unchanged (`DiscoveryNav.tsx:135`); `FeedLeftRail.tsx:191` "Discover" label to be renamed to "Explore" in a one-line code edit (queued outside this amendment). Rationale: "Explore" fits Frontfiles' editorial-curatorial positioning; "Discover" has social-media-algorithm connotations that clash with the brutalist-editorial discipline locked in `PLATFORM_BUILD.md` Design Canon.
- **O-A0-5** — "certified" terminology sweep. 40+ hits across `src/data/` (creators bios 18+ standardized template, spotlight 5, social 5, posts 4, users bio, `certifiedAssets` identifier in `index.ts:126`), `src/components/onboarding/` (PhaseLaunch 2, PhaseReaderMinimal 2, PhaseRolePicker 1), and `src/components/feed/FeedLeftRail.tsx:216` (the live feed footer copy visible in founder 2026-04-23 screenshot). Violates `ECONOMIC_FLOW_v1.md` §9 banned-terms list. **Handled as a separate directive outside this amendment** — composes after batch applies. Replacement vocabulary per `CLAUDE.md` §9 + Economic Flow §9: `verifiable`, `provenance-aware`, `independently reviewable`, `tamper-evident`.

**P1 status (2026-04-18, this commit):** docs-layer rename landed. Spec filename, in-doc references, and decision code now read `Special Offer` / `D-SO1`. Code (`src/app/api/direct-offer/*`, `src/lib/direct-offer/*`, `DirectOffer*` identifiers) and DB (`direct_offer` table + columns) keep legacy names until P2–P5 of A.0 lands the code + schema rename. Legacy-name references in source and migrations therefore remain accurate to current implementation; doc-layer references describe the intended canonical state.

**P2 status (landed 2026-04-18):**
- Code module renamed: `src/lib/direct-offer/` → `src/lib/special-offer/` (git mv, history preserved).
- Module-owned TS identifiers renamed: `DirectOfferEngineState`, `DirectOfferAction`, `DirectOfferError`, `initialDirectOfferState`, `directOfferReducer` → `SpecialOffer*` equivalents.
- Imports updated across 7 files: 4 route files (12 external-path import lines in `src/app/api/direct-offer/{,[id]/accept,[id]/counter,[id]/decline}/route.ts`) and 3 intra-module import lines (`reducer.ts`, `api-helpers.ts`, `__tests__/services.test.ts`) whose identifier names changed.
- Stale doc refs to the old module path updated in `PLATFORM_REVIEWS.md` and `docs/specs/SPECIAL_OFFER_SPEC.md` as part of this commit.
- Still pending under A.0: route paths `/api/direct-offer/*` (P3), shared types in `src/lib/types.ts` + `src/lib/schema.ts` (`DirectOfferThread`, `DirectOfferEvent`, `DirectOfferStatus`, `DIRECT_OFFER_MAX_ROUNDS`, etc.) (P4), DB schema `direct_offer_*` (P5), canonical terminology registry `TERMINOLOGY_LOCK.md` (P6).
- In-module docstrings (`Direct Offer Engine — ...` headers) deferred to P2.x sweep.
- Commit SHA: see `git log --grep="P2 rename"` (self-referential fill deferred — amending the commit to inject its own SHA changes the SHA, making the doc lie; kept as a git-log pointer instead).

**P3 status (landed 2026-04-18):**
- Route folder renamed: `src/app/api/direct-offer/` → `src/app/api/special-offer/` (4 routes: index, [id]/accept, [id]/counter, [id]/decline) via `git mv`.
- Route-file internal refs updated: 7 path mentions across the 4 route files (JSDoc route headers + 1 `parseBody` error label `'POST /api/direct-offer'` in `route.ts:56`) swapped to `/api/special-offer`.
- Client callers updated: 1 file (`src/app/vault/offers/page.tsx`) — 3 `fetch()` sites (accept/counter/decline endpoints on lines 333, 385, 446).
- Integration/e2e tests updated: 0 (no `__tests__` exist for these routes; no Playwright/Cypress config in repo).
- Middleware/config: none — no `middleware.ts`; `next.config.ts` is empty `{}` with no rewrites/redirects/matchers; typed routes not enabled.
- Stale doc refs updated: `PLATFORM_REVIEWS.md` (2 refs, lines 293 + 313), `docs/specs/SPECIAL_OFFER_SPEC.md` (6 refs — API surface table lines 569–573 + closing note line 646), `INTEGRATION_READINESS.md` (1 ref, line 59, KD-8 closure note — path updated to post-P3 location; trade: retains grep cleanliness at minor cost to historical specificity about where the zod-import file lived at fix time).
- Next.js 16.2.2 convention check: folder-rename of route segments + `route.ts` filename confirmed idiomatic per `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — no deprecations.
- Deferred (out of P3 scope): `actionType: 'direct-offer.create'` in `route.ts:65` (rate-limit namespace key, not a path — deferred to cross-cutting consistency pass); in-route comment `route.ts:24` mentions "D-DO lock decisions" (stale code comment, not identifier/path); `CreateDirectOfferBody` Zod schema identifier in `route.ts:40` (route-local, not path).
- Still pending under A.0: shared types in `src/lib/types.ts` + `src/lib/schema.ts` (`DirectOfferThread`, `DirectOfferEvent`, `DirectOfferStatus`, `DIRECT_OFFER_MAX_ROUNDS`, etc.) (P4), DB schema `direct_offer_*` (P5), canonical terminology registry `TERMINOLOGY_LOCK.md` (P6).
- Commit SHA: see `git log --grep="P3 rename"` (self-referential fill deferred per P2 convention).

**P4 status (landed 2026-04-18):**
- Shared types renamed in `src/lib/types.ts` (10): `DirectOfferStatus`, `DirectOfferThread`, `DirectOfferEvent`, `DirectOfferEventType`, `DirectOfferAutoCancelReason`, `DIRECT_OFFER_STATUS_LABELS`, `DIRECT_OFFER_MAX_ROUNDS`, `DIRECT_OFFER_DEFAULT_RESPONSE_MINUTES`, `DIRECT_OFFER_MIN_RESPONSE_MINUTES`, `DIRECT_OFFER_MAX_RESPONSE_MINUTES` → `SpecialOffer*` / `SPECIAL_OFFER_*` equivalents.
- Shared schemas renamed in `src/lib/db/schema.ts` (2): `DirectOfferThreadRow`, `DirectOfferEventRow` → `SpecialOffer*Row` equivalents.
- Route-local Zod schemas renamed (1): `CreateDirectOfferBody` → `CreateSpecialOfferBody` in `src/app/api/special-offer/route.ts`.
- User-visible UI copy updated: 2 strings across 2 files — `<h1>Direct Offers</h1>` in `src/app/vault/offers/page.tsx:178`; `'Direct Offers are only available for PUBLIC assets.'` error `reason` in `src/lib/special-offer/guards.ts:28` (flows to API response body via `errorResponse`).
- Test files updated: 2 (`__tests__/services.test.ts`, `__tests__/helpers.ts`) — identifier imports follow P4 rename; no copy-string assertions required.
- Consumers updated across `src/**`: 12 files — the 2 source-of-truth files (`types.ts`, `db/schema.ts`) + `route.ts` + `page.tsx` + all 8 files under `src/lib/special-offer/`.
- Stale doc refs updated (4): `docs/specs/SPECIAL_OFFER_SPEC.md` lines 301 (`DIRECT_OFFER_STATUS_LABELS`), 623 (`DirectOfferThread` data-model name), 625 (`DirectOfferEvent` data-model name); `CLAUDE_CODE_PROMPT_SEQUENCE.md` line 636 (`DirectOfferMade` email-template name).
- Type-annotation comments and section headers that reference the renamed identifier travel with the identifier rename (P4 scope). Narrative comments (behavior descriptions, rationale) remain deferred to P6 sweep.
- Deferred to P5 (DB rename): DB identifier literals `direct_offer`, `direct_offer_*` in code (4 hits — `db/schema.ts:415-416` `TABLES` keys+values, `types.ts:1002` union-member string, `entitlement/__tests__/helpers.ts:45` test data), plus snake_case property names on `SpecialOfferThreadRow`/`SpecialOfferEventRow` interfaces (they mirror DB columns).
- Deferred to P6 consolidated sweep: developer-facing prose strings (~14 — JSDoc file headers in `src/lib/special-offer/*.ts` (7 files), inline/JSX comments in `src/app/checkout/[assetId]/page.tsx`), `'direct-offer.create'` rate-limit namespace key in `route.ts:65`, stale `D-DO lock decisions` code comment in `route.ts:24`.
- Still pending under A.0: DB schema rename (P5), canonical terminology registry `TERMINOLOGY_LOCK.md` + consolidated pre-P6 prose/string-literal sweep + post-rename checkpoint tag (P6).
- Commit SHA: see `git log --grep="P4 rename"` (self-referential fill deferred per P2 convention).

**P5 scope lock (2026-04-18, pre-resume):**
P5 is now defined as "DB rename + code-DB seam flip, atomic." The migration file and the code-side legacy-name flip land in the same commit and deploy together. Code-side hit list:
- `src/lib/db/schema.ts` lines 415-416 — `TABLES` map values `direct_offer_threads` / `direct_offer_events` flip to `special_offer_threads` / `special_offer_events`.
- `src/lib/types.ts` line 1002 — union member `'direct_offer'` flips to `'special_offer'`.
- `src/lib/entitlement/__tests__/helpers.ts` line 45 — test fixture string flips.
Rationale: migration applied without the code flip would leave the running app pointing at tables that no longer exist.

**P6 decomposition (2026-04-18, pre-resume):**
P6 breaks into four sub-phases, sequenced:
- P6.1 — Developer-facing prose sweep (~14 strings: JSDoc file headers in `src/lib/special-offer/*.ts`, inline/JSX comments in `src/app/checkout/[assetId]/page.tsx`, stale "D-DO lock decisions" code comment in `src/app/api/special-offer/route.ts:24`).
- P6.2 — Rate-limit namespace key rename: `actionType` `'direct-offer.create'` at `src/app/api/special-offer/route.ts:65` flips to `'special-offer.create'`. Operational note: rename resets any rate-limit counters keyed under the old namespace. Acceptable pre-launch; must be logged in the deploy changelog.
- P6.3 — Produce `TERMINOLOGY_LOCK.md` v1 (canonical name registry, one row per renamed concept, versioned).
- P6.4 — Checkpoint git tag `checkpoint/terminology-lock-A.0` on the final commit; add `ROADMAP.md` Changes-this-update row.

---

### Track 1 — approval gates

Each Track-1 gate runs the same five-step template:

1. **Scope sentence** — one line, canonical.
2. **Evidence pack** — existing spec docs + locked decisions + code surface references.
3. **Open items** — the remaining unresolved questions that block sign-off.
4. **Decision** — confirm or revise; capture any revisions inline.
5. **Sign-off** — founder signature, dated; produces a `G-*` gate marker.

#### A.1 — UPLOAD

- **Scope sentence.** *Creator uploads media into Frontfiles, attaches provenance + rights declarations, and moves the asset through the Blue Protocol validation ladder into the vault.*
- **Evidence pack.** `PLATFORM_REVIEWS.md` §Upload (D-U1 / D-U2 / D-U6); `PLATFORM_BUILD.md` §state machines (upload); `src/app/upload/*`, `src/lib/upload/*`, `src/lib/media-processing/*`, `src/lib/watermark/*`; Blue Protocol validation ladder.
- **Open items.**
  - **O-U1 — Blue Protocol 5-vs-7 state drift.** Reconcile the two state-count variants to a single canonical list. No feature ships on a non-canonical state machine.
  - **O-U2 — `validationDeclaration` transition semantics** for the `disputed → invalidated` path once dispute taxonomy v2 lands *(coupled to A.2)*.
- **Sign-off gate.** `G-F1` (Feature gate 1 — UPLOAD).
- **Dependencies.** A.0; partial dependency on A.2 for O-U2 resolution.
- **Estimated sessions.** 1–2.

#### A.2 — ASSIGNMENTS

- **Scope sentence.** *Buyer posts a brief, funds it, creator delivers, buyer confirms; the licence grant is minted and the payout is released. Disputes follow the taxonomy.*
- **Evidence pack.** `PLATFORM_REVIEWS.md` §Assignment (D-A1 / D-A2 / D-A3); `ASSIGNMENT_DISPUTE_TAXONOMY.md` v1 draft; `PLATFORM_BUILD.md` §state machines (assignment); `src/app/assignments/*` (and parallel lib/API surface); Stripe Connect flows in `INTEGRATION_READINESS.md` Phase 5.C.
- **Open items.**
  - **O-A1 — Dispute taxonomy v1 → v2.** Resolve T1–T4 from `ASSIGNMENT_DISPUTE_TAXONOMY.md`:
    - T1 — delivery-reliability flag visibility (public vs aggregate score)
    - T2 — quality-reduction percentage table (25/50/75 sub-tiers or flat 50)
    - T3 — right of recovery clause in Creator Agreement (rights-violation settlement costs)
    - T4 — external-mediator fee split for non-agreeing scope disputes (default 50/50)
  - **O-A2 — Sign-off gates G-T1…G-T4.**
    - G-T1 Legal review of rights-violation liability clause
    - G-T2 External mediator contracted
    - G-T3 Schema migration + dispute console UI + API endpoints built
    - G-T4 Staff playbook written for each of the five types
  - **O-A3 — Phase 5.C coupling.** Cannot ship Stripe refund flows until A.2 sign-off.
- **Sign-off gate.** `G-F2`.
- **Dependencies.** A.0; unblocks A.1 O-U2; unblocks `INTEGRATION_READINESS.md` Phase 5.C.
- **Estimated sessions.** 3–5 (legal + external-mediator contracting dominate wall-clock).

#### A.3 — SPECIAL OFFER

- **Scope sentence.** *Buyer proposes a below-list price to a creator for a vault asset; up to three rounds of counter; accepted offer routes to checkout and mints a licence grant.*
- **Evidence pack.** `docs/specs/SPECIAL_OFFER_SPEC.md` v1.0 *(post-A.0 rename)*; `PLATFORM_REVIEWS.md` §D-SO1 *(post-A.0 rename)*; API routes `/api/special-offer/*` *(post-A.0 rename)*; state machine: `buyer_offer_pending_creator → creator_counter_pending_buyer → buyer_counter_pending_creator → accepted_pending_checkout → completed` + terminals (`declined`, `expired`, `auto_cancelled`).
- **Open items.**
  - **O-SO1 — Confirm v1.0 still current.** No silent drift since v1.0 lock.
  - **O-SO2 — Expiry windows.** Confirm the per-round expiry constants locked in v1.0 still hold.
  - **O-SO3 — Interaction with vault-asset listing state.** Is an asset with an open Special Offer round still purchasable at list price by a third party? Confirm or revise.
- **Sign-off gate.** `G-F3`.
- **Dependencies.** A.0 (rename pass).
- **Estimated sessions.** 1.

#### A.4 — FRONTFOLIO

- **Scope sentence.** *The creator's identity surface on Frontfiles — both the public page at `/u/[handle]` (discovery + reputation + asset grid) and the back-of-house composition tool used to assemble and publish it.*
- **Evidence pack.** `PLATFORM_REVIEWS.md` §FFF UI (D-F1 / D-F2 — partial, UI chrome only); `src/app/u/[handle]/*`; any partial composer components.
- **Open items.**
  - **O-FR1 — Content model for the public page.** Lock the rows/slots/sections the public page can display (asset grid, bio, coverage stats, trust signals, etc.).
  - **O-FR2 — Composition-tool scope.** Locked set of editing actions; publish vs draft model; preview flow.
  - **O-FR3 — Identity integrity.** What content moves on claim-transfer, suspension, or account deletion.
  - **O-FR4 — Reputation signals.** Which signals surface publicly (assignment counts, dispute-upheld count visibility, verification tier).
- **Sign-off gate.** `G-F4`.
- **Dependencies.** A.0; partial dependency on A.2 (reputation signals surface dispute state).
- **Estimated sessions.** 2–3.

#### A.5 — FFF

- **Scope sentence.** *"FFF (Frontfiles Feed) is the feed surface where Frontfilers share Frontfiles work — assets, Stories, Articles, and Collections — to a public or connections-only audience via Following / Relevant / For You views; posts are attribution-preserving wrappers carrying optional body commentary and quote-repost chains, with no licence, rights, or transaction semantics."* **Locked 2026-04-23** per code ground-truth audit. Every clause sourced: attachment kinds (`src/lib/types.ts:1139-1143`), visibility model (`types.ts:1161`, `db/schema.ts:451`), feed views (`/feed` UI), attribution preservation (`types.ts:1149` comment), repost chain (`types.ts:1160`), no transaction semantics (no licence/rights/price fields on `Post`; attachment gated by `attachment_not_public` / `attachment_not_published` validators per `src/lib/post/types.ts:39-46`). "Frontfiler" per canonical term definition in `.claude/agents/frontfiles-context.md:104`.
- **Evidence pack.** `PLATFORM_REVIEWS.md` §FFF UI (D-F1 broadcast-v1/social-v2; D-F2 quote-repost-only); `src/lib/types.ts` §Post (`PostAttachmentKind`, `PostAttachmentRef`, `Post` interface with `visibility: 'public' | 'connections'` + `repostOfPostId`); `src/lib/db/schema.ts:451` (`PostVisibility` canonical enum); `src/lib/post/` module (store, validator, hydrator, feed-ranking, draft-store, styles); `src/lib/flags.ts` `isFffSharingEnabled()` build-time constant; `/feed`, `/post/[id]`, `/creator/[handle]/posts` routes; `GlobalShareComposer.tsx` + `ShareComposer.tsx` + `ShareComposerSearch.tsx`; `DiscoveryNav.tsx` FFF nav button wiring (lines 142-170).
- **Open items.**
  - **O-FFF1 [RESOLVED 2026-04-23]** — scope sentence above.
  - **O-FFF2 — Relationship to FRONTFOLIO.** *Partially resolved.* Code ground-truth: Frontfolio (`/creator/[handle]/frontfolio`) and Posts (`/creator/[handle]/posts`) already exist as **sibling creator-page subroutes**, so FFF posts do not surface inside the Frontfolio asset grid. Frontfolio = identity + reputation + asset-portfolio IA; FFF = feed IA + share-graph; posts reference underlying Frontfiles objects via `PostAttachmentRef` with `creatorUserId` denormalized at post-time so attribution survives source removal (`types.ts:1149` comment). **Still open:** does `/creator/[handle]/frontfolio` reference posts at all (recent-posts strip? "also shares" teaser? none?), or is the boundary strictly "frontfolio = assets-only; posts = separate sibling subroute"? Resolve in A.4 FRONTFOLIO gate.
  - **O-FFF3 — Relationship to HOME PAGE** *(if any; resolved alongside A.8)*. Still open — awaits A.8 scope lock. Code signal: HOME PAGE is `/` (per `PLATFORM_BUILD.md` route map), currently on mock data per Area 8 roadmap note.
  - **O-FFF4 [RESOLVED 2026-04-23]** — minimal state model, code-anchored: posts carry `visibility: 'public' | 'connections'` plus implicit exists/deleted. No draft/published/archived lifecycle. Posts are thin wrappers; state weight lives on the underlying attachment.
  - **O-FFF5 (new) — Dependency on A.6 SHARE.** The "Share" nav label assignment is governed by A.6's primitive enumeration (per O-A0-3); A.5 cannot sign off until A.6 resolves which primitive owns the "Share" top-nav label (currently wired to fire `openComposer()` per `DiscoveryNav.tsx:160-170`, i.e. the FFF share-to-feed primitive). Roadmap sequencing has A.5 (Track 1) before A.6 (Track 2); this dependency either reorders A.6 ahead of A.5 or accepts O-FFF5 as a deferred open item on A.5's gate. Founder to pick at A.5 sign-off time.
- **Sign-off gate.** `G-F5`.
- **Dependencies.** A.0 (name + scope sentence); may require coordination with A.4 (FRONTFOLIO) and A.8 (HOME PAGE) if boundaries overlap.
- **Estimated sessions.** 1–2 (ramps up if scope sentence opens new product surface).

#### A.11 — COLLECTION

- **Scope sentence.** *"A Collection is a Frontfiler-curated, ordered set of Frontfiles assets with its own privacy model, viewable at `/collection/[id]` and shareable as an FFF attachment kind."* **Locked 2026-04-23** per code ground-truth audit. Every clause sourced: `interface Collection` declaration (`src/lib/types.ts:599`), curator/contributor model (`src/app/collection/[id]/page.tsx:36-38` — `curatorId + creatorIds[] + assetIds[]`), privacy field (`types.ts:603` — `PrivacyState: PUBLIC | PRIVATE | RESTRICTED`), FFF attachability (`PostAttachmentKind: 'collection'` at `types.ts:1143`).
- **Evidence pack.** `src/lib/types.ts:599` (Spec §6 `Collection` interface — upstream Canonical Spec section number cited in comment); `src/app/collection/[id]/page.tsx` (viewer + curator reorder via localStorage `collection-order-${id}`); `collectionMap` in `src/data/` (mock fixtures); `PostAttachmentKind: 'collection'` wiring through FFF validator + hydrator; upstream Canonical Spec §6 (Notion, per authority chain in `.claude/agents/frontfiles-context.md:25`).
- **Open items.**
  - **O-COL1 — Upstream Spec §6 in-repo.** Canonical Spec §6 lives upstream in Notion; in-repo `interface Collection` is the operational truth but lacks full spec clauses. Either (a) land Spec §6 in-repo as part of the gate, or (b) accept upstream-authority reference with inline interface citation.
  - **O-COL2 — Contributor model.** Code shows `curatorId` (single) + `creatorIds[]` (multi) + `assetIds[]`. How are contributor permissions defined — can they modify the collection, or just contribute assets? Does contributor consent exist as a workflow?
  - **O-COL3 — Reorder persistence.** Current code persists ordering to `localStorage` (`collection-order-${id}`), client-only. Decide: per-viewer view-state (stays local), or per-collection canonical ordering (persisted server-side, curator-owned)?
  - **O-COL4 — Cross-creator rights aggregation.** Collections can span creators (unlike Special Offers which enforce same-creator-only via DB trigger). Does Collection need a cross-creator rights-aggregation rule, or is it purely presentational (each asset retains its own licence terms; collection just groups them)?
  - **O-COL5 [RESOLVED 2026-04-23]** — Privacy × FFF visibility interaction: **strict match at attach time.** Post validator rejects attach when `Collection.privacy != PUBLIC` and `Post.visibility == 'public'`, consistent with existing `attachment_not_public` validator (`post/types.ts:39-46`). Later privacy changes fail closed via hydration placeholder (`post/types.ts:82-98`).
- **Sign-off gate.** `G-F11` (Feature gate 11 — COLLECTION).
- **Dependencies.** A.0; partial on A.1 (asset primitives); partial on A.5 (FFF attach semantics).
- **Estimated sessions.** 2–3.

---

### Track 2 — definition gates

Each Track-2 gate runs a different six-step template — the spec is written *during* the gate:

1. **Problem statement** — what this feature exists to solve, in one paragraph.
2. **Entity disambiguation** — for names that currently collide, enumerate the distinct primitives.
3. **Scope sentence** — one line, canonical, post-disambiguation.
4. **Spec draft** — written against the standard Frontfiles spec template.
5. **Decision + revisions** — founder pass.
6. **Sign-off** — founder signature; produces a `G-F*` gate marker.

#### A.6 — SHARE

- **Problem statement.** "Share" currently denotes at least four different primitives (enumeration locked 2026-04-23 per O-A0-3): (a) signed-URL delivery of licensed assets (the `/api/media/[id]` entitlement path), (b) a public share link for a vault asset or frontfolio (`/share/[token]` signed-token external delivery), (c) a collaborator invite surface (no live code yet), (d) share-to-feed — creates an FFF post wrapping a Frontfiles object (top-nav "Share" button, creators-only, fires `GlobalShareComposer`). Merging them produces unusable UX and ambiguous rights semantics.
- **Disambiguation required.** Enumerate the four (or more) primitives; decide whether the product keeps them as distinct named features or unifies them behind a single model with flags.
- **Spec output.** `SHARE_PRIMITIVES_SPEC.md` — one doc, one row per primitive, each with scope sentence, state machine (if any), rights/licence semantics, expiry model.
- **Open items.**
  - **O-SH1 — Naming.** Retain "Share" as umbrella or retire it in favour of three separate names.
  - **O-SH2 — Rights leakage.** Confirm no primitive can grant rights beyond the licence grant's terms.
  - **O-SH3 — Expiry + revocation.** Unified or per-primitive.
- **Sign-off gate.** `G-F6`.
- **Dependencies.** A.0; partial dependency on A.2 (licence-grant revocation paths).
- **Estimated sessions.** 2.

#### A.7 — COLLAB

- **Problem statement.** New feature. Zero code, zero prior spec. Product definition required before sequencing.
- **Disambiguation required.** Founder answers the existence question: what is Collab, who uses it, what does it let them do that Assignments + Share don't already cover.
- **Spec output.** `COLLAB_SPEC.md` v1.0.
- **Open items.**
  - **O-C1 — Founder one-pager.** Problem, user, differentiator from Assignments.
  - **O-C2 — State machine.** Does Collab carry its own lifecycle, or is it a mode on an existing entity (e.g. a multi-creator Assignment variant)?
  - **O-C3 — Rights model.** Multi-creator rights split, attribution, payout.
  - **O-C4 — Discovery surface.** Where does Collab live on the home / frontfolio / feed?
- **Sign-off gate.** `G-F7`.
- **Dependencies.** A.0; high coordination with A.2 (Assignments) depending on O-C2.
- **Estimated sessions.** 3–4 (ramps up; this is scope-definition from zero).

#### A.8 — HOME PAGE

- **Problem statement.** Home page exists as a mock-data surface. No content model, IA, or ranking logic. Cannot ship production-ready without a spec.
- **Disambiguation required.** Distinguish "Home" from "Feed" from "FFF" — all three currently overlap conceptually.
- **Spec output.** `HOME_PAGE_SPEC.md` v1.0 covering: content types surfaced, section composition rules, ranking inputs, personalization model (logged-out / logged-in), editorial curation surface, refresh cadence.
- **Open items.**
  - **O-H1 — Logged-out IA.** First-run experience content model.
  - **O-H2 — Logged-in personalization.** Signals; cold-start handling.
  - **O-H3 — Editorial curation lever.** Staff-pinned content model.
  - **O-H4 — Relationship to FFF.** Paired with O-FFF3.
- **Sign-off gate.** `G-F8`.
- **Dependencies.** A.0, A.5 (FFF scope sentence).
- **Estimated sessions.** 2–3.

#### A.9 — LIGHTBOX

- **Problem statement.** "Lightbox" currently denotes an undefined viewer/preview surface. Collides with asset-viewer, vault preview, frontfolio asset zoom.
- **Disambiguation required.** Enumerate every surface where an asset opens for focused view; decide whether Lightbox is one shared component or several.
- **Spec output.** `LIGHTBOX_SPEC.md` v1.0.
- **Open items.**
  - **O-L1 — Single vs multi.** One shared Lightbox primitive or per-context variants.
  - **O-L2 — Rights-aware rendering.** Unlicensed preview constraints (watermark tier, resolution cap, download block).
  - **O-L3 — Keyboard / gesture model.** Standard pattern across all contexts.
- **Sign-off gate.** `G-F9`.
- **Dependencies.** A.0; partial on A.1 (watermark profile) and A.6 (signed-URL primitive from SHARE).
- **Estimated sessions.** 1–2.

#### A.10 — COMPOSER

- **Problem statement.** "Composer" currently denotes multiple partial composers (post, brief, frontfolio). Single approval gate on one name produces a fake approval.
- **Disambiguation required.** Enumerate the composers; decide whether Composer is an umbrella pattern (shared toolbar + canvas contract) or several named surfaces.
- **Spec output.** `COMPOSER_SPEC.md` v1.0 covering: composer inventory, shared contract (if any), per-composer scope, draft-autosave model, publishing model, attachment model.
- **Open items.**
  - **O-CO1 — Umbrella or many.**
  - **O-CO2 — Draft / publish model.** Shared across composers or per-composer.
  - **O-CO3 — Attachment / media handling.** Reuse Upload primitive or diverge.
  - **O-CO4 — Collaborative editing.** In-scope for v1 or deferred.
- **Sign-off gate.** `G-F10`.
- **Dependencies.** A.0, A.1 (UPLOAD for attachments), A.4 (FRONTFOLIO composer is one instance), A.2 (brief composer is one instance).
- **Estimated sessions.** 2–3.

---

## Phase B — Design / Layout / Tuning Agents

Runs only after `G-F1…G-F11` all signed.

### B.1 — Design system application pass

- **Purpose.** Apply the locked design language (black / blue-600 `oklch(0.546 0.213 264.376)` / white, zero radius, NHG typography) consistently across every Phase-A surface.
- **Work.** Component-by-component audit; visual diff against design lock; fix drift.
- **Artifact.** `DESIGN_APPLICATION_AUDIT.md` — one row per surface; drift flagged; remediation landed.
- **Sign-off.** `G-B1`.

### B.2 — Layout / IA consistency pass

- **Purpose.** Ensure hierarchy, spacing, navigation, and information density are consistent across the eleven Phase-A surfaces. No surface has an outlier IA.
- **Work.** IA diagram per surface; cross-surface consistency review; layout corrections.
- **Artifact.** `LAYOUT_IA_CONSISTENCY_REVIEW.md`.
- **Sign-off.** `G-B2`.

### B.3 — Tuning agents — scope, then build

- **Problem statement.** "Tuning agents" is currently a bucket term. Before any agent is built or tuned, scope the term concretely.
- **Disambiguation required.** Decide whether "tuning agents" means:
  - (a) LLM pipelines for content ranking, moderation, provenance analysis, dispute classification
  - (b) Claude Code sub-agent playbooks (already partly covered in `PLATFORM_REVIEWS.md` §6, D-6.1 / D-6.2 / D-6.3)
  - (c) both, distinguished by workstream
- **Spec output.** `TUNING_AGENTS_SPEC.md` v1.0 — scope, agent inventory, per-agent responsibility + inputs + outputs + evaluation metric.
- **Build work.** Sequenced per the spec; one agent at a time; each with an eval harness before going to production.
- **Sign-off.** `G-B3`.

**Phase B exit criterion.** `G-B1`, `G-B2`, `G-B3` all signed.

---

## Phase C — Infrastructure resume

Runs after `G-B3` signed. Items C.1 through C.4 are parallel-safe relative to each other; C.5 is serial within itself (G2 → G3 → G4 → G5 → G6).

### C.1 — KD closures

- **KD-10 — scope and open, or formally close.** Currently reserved. If closed, document the rationale in `ROADMAP.md` §Changes-this-update.
- **KD-11..KD-14 — P3 / P4 follow-through.** Each closes with its own checkpoint tag, green test run, and roadmap changelog row.
- **Sign-off.** `G-C1`.

### C.2 — Vercel env hardening

- Environment variable audit (preview / production parity, secrets rotation, scoping).
- Build-time / runtime split discipline.
- **Sign-off.** `G-C2`.

### C.3 — Micro-queue build

- Implement the deferred micro-queue infrastructure per prior notes.
- **Sign-off.** `G-C3`.

### C.4 — CI hardening follow-through

- Any remaining CI hardening work post-KD-9 closure.
- **Sign-off.** `G-C4`.

### C.5 — Phase 1 Foundation gating (serial)

Reactivates the external-clock sequence paused for the feature chain.

| Gate | Requires |
|---|---|
| G2 | Phase 1 Foundation green — all A / B gates signed; migrations clean; tests green |
| G3 | Legal + Google verification complete |
| G4 | Stripe Connect live — **requires A.2 (`G-F2`) signed and Phase 5.C built** |
| G5 | Waterdog audit complete |
| G6 | Dry-run rehearsal complete |

**Phase C exit criterion.** `G-C1…G-C4` signed and `G2 → G6` fully walked.

---

## Per-gate artifact checklist

Every feature gate produces, at minimum:

| Artifact | Track 1 | Track 2 |
|---|---|---|
| Scope sentence (canonical, one line) | ✓ | ✓ |
| Evidence pack reference | ✓ | ✓ |
| Open-items ledger (resolved or accepted-as-deferred) | ✓ | ✓ |
| Spec doc | reuse existing | new doc produced inside the gate |
| Sign-off marker (`G-F*`) | ✓ | ✓ |
| Changelog row in `ROADMAP.md` §Changes-this-update | ✓ | ✓ |
| Checkpoint tag if code changes landed | as needed | as needed |

---

## Dependency graph

```
A.0 ────────────────────────────────────────────────────── blocks all A.*
  │
  ├── A.1 UPLOAD ──┬── A.2 open item O-U2 depends on A.2
  │                └── A.10 (COMPOSER attachments) depends on A.1
  │
  ├── A.2 ASSIGNMENTS ──┬── unblocks INTEGRATION_READINESS Phase 5.C
  │                     ├── A.4 reputation signals
  │                     ├── A.7 state-machine decision (O-C2)
  │                     └── A.10 brief composer
  │
  ├── A.3 SPECIAL OFFER (rename only, low coupling)
  │
  ├── A.4 FRONTFOLIO ──── A.10 frontfolio composer
  │
  ├── A.5 FFF ──┬── A.8 HOME PAGE relationship (O-FFF3 / O-H4)
  │            └── A.11 COLLECTION (FFF attach semantics; O-FFF5 reorder dep on A.6)
  │
  ├── A.6 SHARE ──── A.9 signed-URL primitive
  │
  ├── A.7 COLLAB (high coupling with A.2 depending on scope)
  │
  ├── A.8 HOME PAGE (requires A.5 scope sentence first)
  │
  ├── A.9 LIGHTBOX (low coupling once A.1 watermark + A.6 signed-URL resolved)
  │
  ├── A.10 COMPOSER (multi-coupling; runs late)
  │
  └── A.11 COLLECTION (Track 1 partial; cross-creator rights aggregation open — O-COL4)

Phase B waits on all of Phase A.
Phase C waits on Phase B; C.4 serial; C.1–C.3 parallel-safe.
```

---

## Parallel-safe branches (Phase A)

Within Track 1 and Track 2, the following pairs can proceed in parallel once A.0 is signed, because they have no cross-dependency:

- A.3 (SPECIAL OFFER rename) ‖ A.1 (UPLOAD)
- A.5 (FFF) ‖ A.4 (FRONTFOLIO) — once scope sentences are locked
- A.6 (SHARE) ‖ A.9 (LIGHTBOX) — coordinate on signed-URL primitive
- A.11 (COLLECTION) ‖ A.3 (SPECIAL OFFER) — low coupling; both Track-1 partial-to-approval
- A.7 (COLLAB) is **not** parallel-safe; its coupling to A.2 is high

Default assumption: **serial execution.** Parallel only if two workstreams (founder + engineering) are actually active and the coordination cost is lower than the coupling cost. Serial is the safe default given the current single-founder cadence.

---

## Open items — founder input required before A.1 starts

| # | Open item | Blocks |
|---|---|---|
| O-A0-1 | ~~FFF scope sentence~~ **RESOLVED 2026-04-23** — see §A.5 | — |
| O-A0-2 | ~~Collection 4-part lock~~ **RESOLVED 2026-04-23** — A.11 / Track 1 / scope sentence / strict privacy rule | — |
| O-A0-3 | ~~"Share" primitive enumeration (3 → 4)~~ **RESOLVED 2026-04-23** — A.6 Problem statement updated | — |
| O-A0-4 | ~~"Explore" vs "Discover" label~~ **RESOLVED 2026-04-23** — "Explore" locked; one-line code rename queued | — |
| O-A0-5 | "certified" terminology sweep (40+ hits, separate directive) | Phase A readiness (spec §9 compliance) |
| O-U1 | Blue Protocol 5-vs-7 state drift resolution path | A.1 |
| O-A1 | Dispute taxonomy T1–T4 (4 decisions) | A.2 |
| O-A2 | Dispute taxonomy G-T1…G-T4 (4 sign-off gates) | A.2 |
| O-C1 | COLLAB one-pager — problem, user, differentiator | A.7 |
| O-B3-1 | "Tuning agents" — (a) / (b) / (c) scope decision | B.3 |

**Gating order:** O-U1 is the last remaining A.1 blocker (O-A0-2 / O-A0-3 / O-A0-4 all resolved 2026-04-23). O-A0-5 is parallel-safe (separate "certified" sweep directive — doesn't block A.1 start). O-A1 / O-A2 block `A.2`. O-C1 blocks `A.7`.

---

## Exit criteria per phase

- **Phase A exits when:** `G-F1` through `G-F11` are signed; `ROADMAP.md` changelog reflects all eleven gates; all Track-2 spec docs exist.
- **Phase B exits when:** `G-B1`, `G-B2`, `G-B3` signed; `TUNING_AGENTS_SPEC.md` locked; the first agent (if any) passes its eval harness.
- **Phase C exits when:** `G-C1` through `G-C4` signed and `G2 → G6` fully walked.

---

## Approval gate for this roadmap itself

This doc itself requires founder sign-off before execution begins.

- **To approve as-is:** reply `ROADMAP-APPROVED`. I move to `A.0` immediately and land the terminology rename pass.
- **To approve with corrections:** reply `ROADMAP-APPROVE-WITH-CORRECTIONS` and the specific corrections.
- **To revise before approval:** reply `ROADMAP-REVISE` with the sections to revise.
- **To reject:** reply `ROADMAP-REJECT` with the reason.

Sign-off on this doc produces gate marker `G-FAR0` (Feature Approval Roadmap, gate 0) and unblocks the whole chain.

---

*End of document — v1 draft. Locks at v2 on founder sign-off.*
