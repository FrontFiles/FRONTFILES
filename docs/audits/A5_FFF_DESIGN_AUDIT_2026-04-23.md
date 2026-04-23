# A.5 FFF — Design Audit

**Feature:** A.5 FFF (Frontfiles Feed)
**Gate:** G-F5 (Track 1 — approval)
**Surface in scope:** `/feed`, `/post/[id]`, and the global share composer surfaces that feed into them.
**Dispatch type:** Audit-only (no code changes, no prototype, no implementation plan).
**Date:** 2026-04-23.
**Session governance:** bootstrap per `docs/audits/DESIGN_LAYOUT_SESSION_PROMPT.md`, scope block completed in-session.
**Authority for scope sentence:** `FEATURE_APPROVAL_ROADMAP.md:237` (scope locked 2026-04-23).

Authoring conventions:

- Every claim about code cites `file:line`.
- Every claim about governing docs cites `<DOC>.md §<section>` or a file:line when the doc is machine-extractable.
- "Spec" refers to the in-repo governing documents (Design Canon in `PLATFORM_BUILD.md`, Phase-A chain in `FEATURE_APPROVAL_ROADMAP.md`, terminology in `docs/audits/CERTIFIED_SWEEP_DIRECTIVE.md` and the bootstrap prompt).

---

## §0 — Critical drift found mid-audit

The audit surfaced one cross-cutting drift that materially affects every finding downstream. Per the dispatch constraint, it is surfaced here before proceeding into the component-level audit.

### §0.1 Token-level Design Canon drift — `--post-KIND-radius` scope override

**Canon (bootstrap §4.3 / `AGENTS.md` UI/design gate):** `--radius: 0rem` everywhere. No `rounded-*` utilities. No pill shapes. No chips-with-curves.

**Code:** [src/app/globals.css:131-138](src/app/globals.css:131)

```
/* ── Radii — scoped, does NOT touch global --radius: 0rem ── */
--post-card-radius: 14px;
--post-nested-radius: 10px;
--post-embed-radius: 12px;
--post-thumb-radius: 10px;
--post-thumb-radius-compact: 8px;
--post-chip-radius: 9999px;               /* pill */
--post-avatar-radius: 0px;                /* square — matches Frontfiles profile chrome */
```

The comment explicitly states the override is scoped (does not touch global `--radius`), but the Design Canon does not distinguish between "global" and "FFF-scoped" — it says *everywhere*. Six of the seven post-level radius tokens evaluate to non-zero, and `--post-chip-radius: 9999px` is an explicit pill — Canon §4.3 specifically forbids "No pill shapes. No chips-with-curves."

This token-layer drift cascades into every class string declared in [src/lib/post/styles.ts](src/lib/post/styles.ts), which is consumed by every in-scope feed component. Examples of the cascade:

- Card shell rounding — [styles.ts:38](src/lib/post/styles.ts:38) `rounded-[var(--post-card-radius)]`
- Nested card shell — [styles.ts:62-70](src/lib/post/styles.ts:62) `rounded-[var(--post-nested-radius)]`
- Embed shell — [styles.ts:187](src/lib/post/styles.ts:187), [styles.ts:198](src/lib/post/styles.ts:198) `rounded-[var(--post-embed-radius)]`
- Thumbnails — [styles.ts:214](src/lib/post/styles.ts:214), [styles.ts:220](src/lib/post/styles.ts:220) `rounded-[var(--post-thumb-radius)]`
- Attribution pill — [styles.ts:264](src/lib/post/styles.ts:264), [styles.ts:274](src/lib/post/styles.ts:274) `rounded-[var(--post-chip-radius)]` (pill)
- Composer entry button/action — [styles.ts:498](src/lib/post/styles.ts:498), [styles.ts:510](src/lib/post/styles.ts:510) (pill)
- Rail nav items — [styles.ts:530](src/lib/post/styles.ts:530) (pill)
- View-post chip, follow chip, discovery chip — pill shapes.

**Why surface in §0:** the dispatch scope forbids code changes in this session, so this finding is not a fix-in-place item — it is a Canon/spec contradiction that must be resolved before any design recommendation can land. Any future design work that claims Canon compliance for `/feed` is unsupported while the token-layer override stands.

**Decision required (founder):** either (a) ratify the `--post-KIND-radius` override as an explicitly-scoped Canon exception for FFF (and document it in `PLATFORM_BUILD.md`), or (b) require the token overrides to be zeroed and propagate the change through styles.ts. Do not infer either choice from this audit.

### §0.2 One non-token Design Canon violation (direct hit)

Unrelated to the token drift: [src/lib/post/styles.ts:257](src/lib/post/styles.ts:257) `embedFormatPill` uses the Tailwind utility `rounded-sm` directly, not via a `--post-*` token. This is a direct Canon §4.3 violation ("No rounded-* utilities") regardless of how §0.1 is resolved.

---

## §1 — Component inventory

Every visible component on the in-scope surfaces, with file:line and state-machine / primitive mapping. Presentation order follows the user's reading order (top → bottom, left → right).

### §1.1 `/feed` page chrome

| # | Component | File:line | Role | Primitive / state mapped |
|---|---|---|---|---|
| 1 | `FeedPage` (route component) | [src/app/feed/page.tsx:42](src/app/feed/page.tsx:42) | Route shell; feature-flag gate; orchestrates tabs + pool reads. | `isFffSharingEnabled()` feature flag (build-time) [flag check at src/app/feed/page.tsx:47](src/app/feed/page.tsx:47) |
| 2 | `feedShell` / `feedColumns` | [src/lib/post/styles.ts:440](src/lib/post/styles.ts:440), [styles.ts:443](src/lib/post/styles.ts:443) | 3-column layout shell (lg breakpoint) | Responsive breakpoints (≥lg left rail, ≥xl right rail) |
| 3 | `FeedLeftRail` | [src/components/feed/FeedLeftRail.tsx:27](src/components/feed/FeedLeftRail.tsx:27) | Identity strip + tab nav + workspace nav + footer disclaimer | Active `FeedTabKey` (driven from parent) |
| 4 | `FeedComposerCTA` | [src/components/feed/FeedComposerCTA.tsx:24](src/components/feed/FeedComposerCTA.tsx:24) | Top-of-column composer trigger | Calls `openComposer()` from draft store [feed/page.tsx:150](src/app/feed/page.tsx:150) |
| 5 | `FeedTabBar` | [src/components/feed/FeedTabBar.tsx:33](src/components/feed/FeedTabBar.tsx:33) | 3-tab segmented control | `FeedTabKey = 'following' \| 'relevant' \| 'foryou'` [FeedTabBar.tsx:17](src/components/feed/FeedTabBar.tsx:17) — drives `rankFollowingFeed` / `rankRelevantFeed` / `rankForYouFeed` per tab |
| 6 | `FeedLoadingState` | [src/components/feed/FeedLoadingState.tsx:12](src/components/feed/FeedLoadingState.tsx:12) | Cold-load skeleton | Draft-store `loading` + `unifiedRows.length === 0` branch [feed/page.tsx:163](src/app/feed/page.tsx:163) |
| 7 | `FeedErrorState` | [src/components/feed/FeedLoadingState.tsx:23](src/components/feed/FeedLoadingState.tsx:23) | Cold-load failure w/ retry | `loadError` + empty pool [feed/page.tsx:165](src/app/feed/page.tsx:165) |
| 8 | `FeedEmptyState` | [src/components/feed/FeedEmptyState.tsx:18](src/components/feed/FeedEmptyState.tsx:18) | Per-tab empty copy + compose CTA | Tab `FeedTabKey`, `activeResults.length === 0` branch [feed/page.tsx:170](src/app/feed/page.tsx:170) |
| 9 | `PostCard` (out-of-scope module, consumed here) | [src/app/feed/page.tsx:179](src/app/feed/page.tsx:179) | Filled-state post rendering | Hydrated `PostCard` from `HydratedPostResult.ok === true` [hydrate.ts:226-239](src/lib/post/hydrate.ts:226) |
| 10 | `PostCardUnavailable` (out-of-scope module) | [src/app/feed/page.tsx:190](src/app/feed/page.tsx:190) | Partial-hydration placeholder | `HydratedPostResult.ok === false` w/ `reason: 'author_missing' \| 'attachment_missing' \| 'attachment_not_public'` [types.ts:82-98](src/lib/post/types.ts:82) |
| 11 | `FeedRightRail` | [src/components/feed/FeedRightRail.tsx:35](src/components/feed/FeedRightRail.tsx:35) | Discovery + signals + ranking note | Trust-badge primitive (verified/trusted) from `Creator` [feed/page.tsx:93](src/app/feed/page.tsx:93); aggregate signals (`verifiedCreators`, `certifiedAssets`, `repostsLast24h`) |
| 12 | `SuggestedCreator` (internal) | [FeedRightRail.tsx:89](src/components/feed/FeedRightRail.tsx:89) | Single suggestion row | Trust-badge ordering, follow-toggle (local `useState`) |
| 13 | `SignalRow` (internal) | [FeedRightRail.tsx:136](src/components/feed/FeedRightRail.tsx:136) | One-line signal label+value | — |

**Out-of-scope but referenced:** `PostCard` and `PostCardUnavailable` live in `src/components/post/` (not in the scope block). They are the primary filled / placeholder renderings of every hydrated row on `/feed` and `/post/[id]`, and any design recommendation for `/feed` layout or variants depends on them. **Flagged** for inclusion in the next dispatch's scope (see §7).

### §1.2 Global share composer surfaces

| # | Component | File:line | Role | Primitive / state mapped |
|---|---|---|---|---|
| 14 | `GlobalShareComposer` | [src/components/composer-share/GlobalShareComposer.tsx:21](src/components/composer-share/GlobalShareComposer.tsx:21) | App-level mount; reads draft-store composer state; flag-gated | `composerOpen`, `composerRepostOf` from `useDraftStore()`; `isFffSharingEnabled()` |
| 15 | `ShareComposer` (modal) | [src/components/composer-share/ShareComposer.tsx:88](src/components/composer-share/ShareComposer.tsx:88) | 3-region modal (search / editor / live preview) | `PostAttachmentType` (4 kinds) + optional `initialRepostOf` (repost chain start); `PostValidationError[]` state for inline errors |
| 16 | Composer header | [ShareComposer.tsx:188-205](src/components/composer-share/ShareComposer.tsx:188) | Mode label ("Share to Frontfiles" vs "Repost with context") + cancel | Renders from `initialRepostOf` truthy/falsy |
| 17 | `ShareComposerSearch` | [src/components/composer-share/ShareComposerSearch.tsx:53](src/components/composer-share/ShareComposerSearch.tsx:53) | Left-rail picker (scope + kind filters, substring search) | `ScopeFilter = 'mine' \| 'all'`, `KindFilter = 'all' \| 'asset' \| 'story' \| 'article' \| 'collection'` (maps to `PostAttachmentKind`) |
| 18 | Editor region | [ShareComposer.tsx:218-282](src/components/composer-share/ShareComposer.tsx:218) | Repost breadcrumb, body textarea, char counter, inline error bag, provenance reminder | `POST_BODY_MAX = 600` hard cap [validation.ts:29](src/lib/post/validation.ts:29); `body_too_long` validator code |
| 19 | Editor footer | [ShareComposer.tsx:284-304](src/components/composer-share/ShareComposer.tsx:284) | Visibility label + publish button | Hard-coded `Visibility · Public` label — post `visibility` state machine has 2 values (`public`, `connections`) but composer currently has no selector; all composed posts publish as `public` via [draft-store.tsx:251-260](src/lib/post/draft-store.tsx:251) → [store.ts:379](src/lib/post/store.ts:379). **Gap flagged in §4.** |
| 20 | Live preview | [ShareComposer.tsx:307-329](src/components/composer-share/ShareComposer.tsx:307) | Renders the exact `PostCard` the feed will show | Uses `hydratePost(row)` on a throwaway row stamped with composer state |

### §1.3 Post detail — `/post/[id]`

| # | Component | File:line | Role | Primitive / state mapped |
|---|---|---|---|---|
| 21 | `PostDetailPage` | [src/app/post/[id]/page.tsx:87](src/app/post/[id]/page.tsx:87) | Route shell; flag-gated; resolves single permalink | `isFffSharingEnabled()`; finds row in unified pool [post/[id]/page.tsx:111](src/app/post/[id]/page.tsx:111) |
| 22 | Breadcrumb / back | [post/[id]/page.tsx:167-175](src/app/post/[id]/page.tsx:167) | "Post · {id}" + back-to-feed | — |
| 23 | Main post render | [post/[id]/page.tsx:178-191](src/app/post/[id]/page.tsx:178) | `PostCard` or `PostCardUnavailable` | `HydratedPostResult.ok` branch; `PostMetaStrip` chips from `buildMetaChips(row)` [post/[id]/page.tsx:44](src/app/post/[id]/page.tsx:44) |
| 24 | "Reposts" rail | [post/[id]/page.tsx:194-222](src/app/post/[id]/page.tsx:194) | Every published repost of this post | Filters `status === 'published' && repost_of_post_id === id` |
| 25 | "More from {author}" rail | [post/[id]/page.tsx:225-259](src/app/post/[id]/page.tsx:225) | Up to 3 other posts by same author | Same filter + author match, slice(0,3) |
| 26 | `NotFound` | [post/[id]/page.tsx:268](src/app/post/[id]/page.tsx:268) | Unknown-id state (after pool loaded) | Pool loaded + no row found |
| 27 | `DetailLoading` | [post/[id]/page.tsx:286](src/app/post/[id]/page.tsx:286) | Cold-load skeleton | `loading && unifiedRows.length === 0` |
| 28 | `DetailError` | [post/[id]/page.tsx:299](src/app/post/[id]/page.tsx:299) | Cold-load error + retry | `loadError && unifiedRows.length === 0` |

### §1.4 `DiscoveryNav` — FFF wiring only

The full DiscoveryNav is out of the A.5 scope (it is platform chrome consumed by more than FFF), but two code paths *are* in-scope per the scope block:

| # | Component | File:line | Role | Primitive mapped |
|---|---|---|---|---|
| 29 | FFF nav button | [src/components/discovery/DiscoveryNav.tsx:143-154](src/components/discovery/DiscoveryNav.tsx:143) | Flag-gated link to `/feed` | `isFffSharingEnabled()`; pathname active-state |
| 30 | "Share" trigger | [DiscoveryNav.tsx:160-170](src/components/discovery/DiscoveryNav.tsx:160) | Creator-only button firing `openComposer()` | `isFffSharingEnabled()` + `SHOW_COMPOSER = Set(['creator'])` [DiscoveryNav.tsx:100](src/components/discovery/DiscoveryNav.tsx:100) |

### §1.5 Backing primitives consumed by the surface (reference)

- `PostAttachmentKind` — 4 values: `'asset' | 'story' | 'article' | 'collection'` ([src/lib/types.ts:1139-1143](src/lib/types.ts:1139) per roadmap citation).
- `Post.visibility` — 2 values: `'public' | 'connections'` ([src/lib/types.ts:1161](src/lib/types.ts:1161), [src/lib/db/schema.ts:451](src/lib/db/schema.ts:451) per roadmap citation).
- `PostValidationErrorCode` — 7 codes: `attachment_not_found | attachment_not_public | attachment_not_published | body_too_long | empty_original | self_repost_forbidden | duplicate_repost` ([src/lib/post/types.ts:39-46](src/lib/post/types.ts:39)).
- `HydrationFailureReason` — 3 reasons: `author_missing | attachment_missing | attachment_not_public` ([src/lib/post/types.ts:91-94](src/lib/post/types.ts:91)).
- `TrustBadge` — 2 values: `verified | trusted` (Spec §7.9–7.11 per bootstrap §6 row 11; used in [FeedRightRail.tsx:93](src/components/feed/FeedRightRail.tsx:93)).

---

## §2 — State-machine map

The 12 canonical state machines per bootstrap §6 / `PLATFORM_BUILD.md` are not all relevant to `/feed`. This section enumerates only the ones touched by the in-scope surface.

| Machine # | Name | Rendered where | Rendering contract |
|---|---|---|---|
| 1 | Asset Format (7 values) | Embed format pill on asset attachments; `FRONTFOLIO_FORMATS` mirror in search rail; meta chip on post detail | Lowercased in post display ([hydrate.ts:76](src/lib/post/hydrate.ts:76)) to match the domain type convention. |
| 2 | Privacy (3 values — PUBLIC / PRIVATE / RESTRICTED) | Referenced by attachment visibility gates | Validator rejects `attachment_not_public` when `asset.privacyLevel !== 'PUBLIC'` ([validation.ts:64](src/lib/post/validation.ts:64)). Hydrator does the same post-publish ([hydrate.ts:65](src/lib/post/hydrate.ts:65)). Stories/articles/collections do NOT currently enforce a privacy check — see validator comment [validation.ts:41-46](src/lib/post/validation.ts:41). **Drift flagged.** |
| 3 | Validation Declaration (7 values, but code has 5 — O-U1) | Post detail `buildMetaChips` renders "Fully validated" or "Corroborated" for asset attachments; FFF right-rail "Certified assets" aggregate counter counts `fully_validated + corroborated` | [post/[id]/page.tsx:53-57](src/app/post/[id]/page.tsx:53); [feed/page.tsx:115-119](src/app/feed/page.tsx:115). The other 5 declared code states (`provenance_pending`, `under_review`, `disputed`) and 2 Spec-declared-but-missing states (`manifest_invalid`, `invalidated`) have **no** UI rendering on the FFF surface. |
| 11 | Trust Badge (2 values) | FeedRightRail sort order + suggestion filter | `c.trustBadge === 'verified' \| 'trusted'` filter ([feed/page.tsx:93](src/app/feed/page.tsx:93)); sort `verified` first ([feed/page.tsx:96](src/app/feed/page.tsx:96)). Badge icon is a separate optional `authorTrustBadge` style block ([styles.ts:145](src/lib/post/styles.ts:145)) consumed by `PostCard` (out-of-scope module). |

FFF also introduces two **non-canonical states** referenced in the bootstrap §11.2:

- `Post.visibility` — 2 values: `public | connections`. Consumed by hydrator (stamped on card [hydrate.ts:233](src/lib/post/hydrate.ts:233)) but **not enforced** anywhere in `/feed` rendering or ranking. **Gap flagged in §4.6.**
- `PostAttachmentKind` — 4 values. Consumed by validator (attachment resolution), hydrator (discriminated hydration), composer search (kind filter), meta-chip builder.

Non-rendered machines on this surface (expected, not a gap): Publication, Offer, Assignment, Dispute, Payout, Article Publish (as article publication pipeline — not article-as-FFF-attachment), Checkout, Exclusive.

---

## §3 — Terminology hits (certified* sweep)

Classifier per `CERTIFIED_SWEEP_DIRECTIVE.md` §6 decision tree, as embedded in bootstrap §5.3. All hits in the in-scope file tree.

**Total hits: 9.** All are Class B. **Zero Class A hits in this tree** — FFF/feed code does not name `CertifiedPackage`, assign `certifiedAt`/`certificationHash`/`certifiedPackageId`, or reference Spec §10.2.

| # | File:line | Raw token | Classifier trigger | Class | Replacement (per bootstrap §5.4) |
|---|---|---|---|---|---|
| 1 | [src/app/feed/page.tsx:115](src/app/feed/page.tsx:115) | `const certifiedAssets = publicAssets.filter(...)` | Aggregator/counter identifier for assets with `validationDeclaration ∈ {fully_validated, corroborated}` | B — rename | `verifiedAssets` or `fullyValidatedAssets` |
| 2 | [src/app/feed/page.tsx:131](src/app/feed/page.tsx:131) | `return { verifiedCreators, certifiedAssets, repostsLast24h }` | Same counter, re-exported | B — rename | Same as #1 |
| 3 | [src/components/feed/FeedRightRail.tsx:8](src/components/feed/FeedRightRail.tsx:8) | Comment: `number of certified assets they have on the platform.` | Narrative in file header comment | B — replace | "number of verifiable assets..." or "number of fully-validated assets..." |
| 4 | [src/components/feed/FeedRightRail.tsx:10](src/components/feed/FeedRightRail.tsx:10) | Comment: `(verified creators, certified assets, reposts today).` | Same header comment | B — replace | "verified creators, verifiable assets, reposts today" |
| 5 | [FeedRightRail.tsx:30](src/components/feed/FeedRightRail.tsx:30) | `certifiedAssets: number` (prop name in `FeedRightRailProps.signals`) | Aggregator/counter identifier at interface boundary | B — rename | `verifiableAssets` or `fullyValidatedAssets` |
| 6 | [FeedRightRail.tsx:60](src/components/feed/FeedRightRail.tsx:60) | `label="Certified assets"` | **User-facing UI label** claiming assets are "certified" | B — replace (highest severity because it ships to users) | `"Verified assets"` or `"Fully-validated assets"` |
| 7 | [FeedRightRail.tsx:61](src/components/feed/FeedRightRail.tsx:61) | `value={signals.certifiedAssets.toLocaleString('en-US')}` | Reference to renamed field | B — rename (follows #5) | Renamed access: `signals.verifiableAssets` |
| 8 | [src/components/feed/FeedEmptyState.tsx:58](src/components/feed/FeedEmptyState.tsx:58) | `'Be the first to share a certified asset, Story, Article, or Collection.'` | **User-facing UI copy** on For-you empty state | B — replace | `'Be the first to share a verifiable asset, Story, Article, or Collection.'` or `'Be the first to share a fully-validated asset, Story, Article, or Collection.'` |
| 9 | [src/components/feed/FeedLeftRail.tsx:216](src/components/feed/FeedLeftRail.tsx:216) | `'The feed surfaces certified Frontfiles work. Provenance and attribution are preserved at every level.'` | **User-facing UI copy** in the left-rail footer disclaimer | B — replace | `'The feed surfaces verifiable Frontfiles work. Provenance and attribution are preserved at every level.'` or `'...provenance-aware Frontfiles work...'` |

**Ambiguity checks performed:** all 9 hits were run through the §6 decision tree. None names `CertifiedPackage` (Spec §10.2), none assigns to `certifiedAt` / `certificationHash` / `certifiedPackageId`, none is UI copy that names the Certified Package product directly. Therefore none is Class A.

**Scope constraint honored:** no replacements have been applied in this dispatch. The table is a recommendation map for the follow-on dispatch. The `CERTIFIED_SWEEP_DIRECTIVE.md` gate G-CS0 must close before the cross-repo sweep executes — this audit's scope is smaller (in-scope file tree only), so the finding here is compatible with either G-CS0 ordering (pre- or post-close).

---

## §4 — State-variant coverage

Per exit criterion 3 of the scope block. Each row: whether the implementation covers the state, and if not, whether the gap is material.

### §4.1 Loading

| Surface | Status | Evidence |
|---|---|---|
| `/feed` | Covered (cold-load only) | `FeedLoadingState` rendered when `loading && unifiedRows.length === 0` [feed/page.tsx:163](src/app/feed/page.tsx:163). Background refreshes intentionally do not flash a skeleton — comment [feed/page.tsx:159-162](src/app/feed/page.tsx:159) affirms this. |
| `/post/[id]` | Covered (cold-load only) | `DetailLoading` rendered at [post/[id]/page.tsx:147](src/app/post/[id]/page.tsx:147). Same cold-load-only pattern. |
| Composer | N/A | Composer doesn't fetch; it writes. Submit in-flight state handled by `submitting` boolean [ShareComposer.tsx:298](src/components/composer-share/ShareComposer.tsx:298). |

No gap.

### §4.2 Error

| Surface | Status | Evidence |
|---|---|---|
| `/feed` | Covered | `FeedErrorState` with retry button [FeedLoadingState.tsx:23-48](src/components/feed/FeedLoadingState.tsx:23). |
| `/post/[id]` | Covered | `DetailError` at [post/[id]/page.tsx:299](src/app/post/[id]/page.tsx:299), also with retry. |
| Composer — validation errors | Covered | Inline error bag at [ShareComposer.tsx:261-272](src/components/composer-share/ShareComposer.tsx:261). All 7 validator codes can surface here via `PostValidationError.message`. |
| Composer — submit failure | Covered (partial) | Draft-store translates submit failures into a generic `attachment_not_found`-coded error with an English message [draft-store.tsx:275-284](src/lib/post/draft-store.tsx:275). **Flagged**: this shape re-uses a semantically-wrong code to signal "network/unknown" failure. Not a Canon issue; noted for the next dispatch. |

### §4.3 Empty (all three tabs)

Exit-criterion-3 explicitly requires all three tabs be covered.

| Tab | Status | Evidence |
|---|---|---|
| Following | Covered | `COPY.following` label/headline/helper [FeedEmptyState.tsx:42-47](src/components/feed/FeedEmptyState.tsx:42). |
| Relevant | Covered | `COPY.relevant` [FeedEmptyState.tsx:48-53](src/components/feed/FeedEmptyState.tsx:48). |
| For you | Covered | `COPY.foryou` [FeedEmptyState.tsx:54-59](src/components/feed/FeedEmptyState.tsx:54). **Terminology hit #8 lives here — see §3.** |

Shared "Share to feed" CTA renders when `onCompose` prop is provided [FeedEmptyState.tsx:25-33](src/components/feed/FeedEmptyState.tsx:25). No tab-specific composer CTA suppression; call sites provide the handler uniformly [feed/page.tsx:172-174](src/app/feed/page.tsx:172).

### §4.4 Partial-hydration placeholder

Contract: `HydratedPostResult.ok === false` carries a `reason` (`author_missing | attachment_missing | attachment_not_public`) and a `placeholder: PostCardPlaceholder` [types.ts:82-98](src/lib/post/types.ts:82). Feed surfaces branch on the union and render `PostCardUnavailable` [feed/page.tsx:189-195](src/app/feed/page.tsx:189), [post/[id]/page.tsx:187-190](src/app/post/[id]/page.tsx:187).

| Reason | Hydrator emit site | Feed render |
|---|---|---|
| `author_missing` | [hydrate.ts:185-192](src/lib/post/hydrate.ts:185) | `PostCardUnavailable` with placeholder |
| `attachment_missing` | [hydrate.ts:64](src/lib/post/hydrate.ts:64), [hydrate.ts:85](src/lib/post/hydrate.ts:85), [hydrate.ts:103](src/lib/post/hydrate.ts:103), [hydrate.ts:121](src/lib/post/hydrate.ts:121), [hydrate.ts:142](src/lib/post/hydrate.ts:142) | Same |
| `attachment_not_public` | [hydrate.ts:66](src/lib/post/hydrate.ts:66) (asset only — stories/articles/collections do not enforce this) | Same |

**Gap #1 flagged (not fixed):** `attachment_not_public` is only emitted for `asset` attachments. Stories, articles, and collections fall through to `attachment_missing` if absent, and do **not** emit `attachment_not_public` at all. Rationale per validator comment [validation.ts:41-46](src/lib/post/validation.ts:41) — "Stories / articles / collections don't model privacy in the current seed shape." Once `Collection.privacy` lands end-to-end (bootstrap §11.3 O-COL5 says the post validator rejects non-public collection attaches at attach time), the hydrator needs a matching post-publish check. For the audit: render-time coverage of `attachment_not_public` is currently **asset-only**.

**Gap #2 flagged:** the `PostCardUnavailable` component itself lives in the out-of-scope `src/components/post/` tree, so its rendering per-reason is unverified in this audit. See §7 recommendation.

**Gap #3 flagged (low severity):** composer's live preview uses the same hydrator, so a composer-pre-publish pick of a non-public asset will preview as a placeholder (intended). However, the composer's validator pre-flight already surfaces `attachment_not_public` as an inline error [ShareComposer.tsx:261](src/components/composer-share/ShareComposer.tsx:261) — meaning the user sees **both** the inline error AND the placeholder preview. Not a correctness issue, but a double-signal in the UI. Noted for next dispatch's design review.

### §4.5 Repost-chain-removed placeholder

Additional state not named in exit criterion 3 but observable on the surface: a repost whose parent was removed renders a "quoted post removed" indicator via `card.repostOfRemoved` [hydrate.ts:208-221](src/lib/post/hydrate.ts:208). The actual inline rendering lives in `PostCard` (out-of-scope module); styles exist at [styles.ts:347-359](src/lib/post/styles.ts:347) (`removedQuote`, `removedQuoteIcon`, `removedQuoteText`). Flagged for next dispatch visibility.

### §4.6 Permission-denied (connections-only content when not connected)

Exit-criterion-3 explicitly requires this variant.

**Status: UNCOVERED. Material gap.**

Evidence:

- `Post.visibility` declares 2 states (`public`, `connections`) — bootstrap §11.2, [src/lib/types.ts:1161](src/lib/types.ts:1161) per roadmap citation.
- All three ranking functions — `rankFollowingFeed` [feed-ranking.ts:54-70](src/lib/post/feed-ranking.ts:54), `rankRelevantFeed` [feed-ranking.ts:90-151](src/lib/post/feed-ranking.ts:90), `rankForYouFeed` [feed-ranking.ts:163-166](src/lib/post/feed-ranking.ts:163) — filter by `status === 'published'` only. None checks `row.visibility`.
- The hydrator passes `row.visibility` through to `card.visibility` [hydrate.ts:233](src/lib/post/hydrate.ts:233), but no gating occurs.
- The composer has no visibility selector — it hard-codes `Visibility · Public` as a label [ShareComposer.tsx:285-287](src/components/composer-share/ShareComposer.tsx:285) and the draft-store translates every composed post to `visibility: 'public'` [store.ts:379](src/lib/post/store.ts:379).

Consequences:

1. A `connections`-scoped post created by any other path (DB direct, future admin, seed data) would render to every viewer regardless of connection status — a privacy regression, although currently impossible via UI because the composer only writes `public`.
2. There is no UI affordance (toggle, chip, segmented control) letting a creator pick `connections` as the target audience.
3. There is no permission-denied variant in `PostCardUnavailable` reasons — `HydrationFailureReason` has 3 values, none of which is `permission_denied` / `viewer_not_connection`.

**Not fixed in this dispatch** per scope constraint. Design recommendation for the variant (selector UX, ranking-time filter, placeholder copy) belongs to the next dispatch.

### §4.7 Filled (happy path)

Covered. Both feed list [feed/page.tsx:175-198](src/app/feed/page.tsx:175) and post detail [post/[id]/page.tsx:178-191](src/app/post/[id]/page.tsx:178) render `PostCard` from `HydratedPostResult.ok === true`. No gap.

### §4.8 Not-found (out-of-contract addition)

`/post/[id]` surfaces a dedicated `NotFound` variant [post/[id]/page.tsx:268](src/app/post/[id]/page.tsx:268) when the pool is loaded but the id isn't present. Not required by exit criterion 3, but worth naming for completeness.

---

## §5 — A.5 open-item reports

### §5.1 O-FFF2 — Relationship to FRONTFOLIO

**Bootstrap / roadmap state:** "Partially resolved." Still open: does `/creator/[handle]/frontfolio` reference posts at all (recent-posts strip? "also shares" teaser? none?), or is the boundary strictly "frontfolio = assets-only; posts = separate sibling subroute"?

**Audit finding:** [src/app/creator/[handle]/frontfolio/page.tsx](src/app/creator/[handle]/frontfolio/page.tsx) exercises a grep for `post`, `Post`, `FFF`, `share`, `feed` (case-insensitive) and returns **one match**, which is a newspaper display-name string (`'South China Morning Post'`) in an unrelated config table [frontfolio/page.tsx:525](src/app/creator/[handle]/frontfolio/page.tsx:525). **Zero functional references to FFF, posts, the post store, the share composer, or the feed surface.**

The sibling subroute `/creator/[handle]/posts` exists at [src/app/creator/[handle]/posts/page.tsx](src/app/creator/[handle]/posts/page.tsx). The boundary in code today is strict: frontfolio = assets/stories/collections (plus `SocialCounts` from `@/data`); posts = sibling subroute. No cross-linking beyond the DiscoveryNav.

**Recommendation (audit-level only, no design prescribed):** the next dispatch that opens A.4 FRONTFOLIO should decide whether the strict boundary is the intended end-state (preserve) or whether a "recent posts" teaser / "also shares" strip belongs on the Frontfolio (add). This audit has no mandate to decide — the Frontfolio chrome is out of A.5 scope.

### §5.2 O-FFF3 — Relationship to HOME PAGE

**Bootstrap / roadmap state:** Still open — awaits A.8 scope lock. Code signal: HOME PAGE is `/`, currently on mock data per Area 8 roadmap note.

**Audit finding:** [src/app/page.tsx](src/app/page.tsx) is a scroll-snap storyboard consisting of `Hero`, `FeaturedCoverage`, a built-for-audiences slide, `Missions`, `ActiveStories`, `NoMore`, an Audiences grid, and `Footer`. Grep of `/feed`, `FFF`, or `feed` inside that file returns exactly one match — `{/* Right: Spotlight feed */}` at [page.tsx:116](src/app/page.tsx:116) — which is a comment on a spotlight **stories** sidebar, not the FFF feed surface. **HOME PAGE currently has zero relationship to `/feed`.**

If HOME PAGE were to embed a feed slice later (e.g., a 3-card preview linking to `/feed`), the touch-points would be: a new section in `page.tsx`, a read through `useDraftStore().unifiedRows` or a new server fetch, and either `PostCard` as-is or a compact card variant. No existing code supports this — any such embedding is greenfield.

**Recommendation (audit-level only):** no design prescribed. Blocked on A.8 HOME PAGE definition gate. When A.8 decides whether / embeds a feed slice, the A.5 gate can resolve O-FFF3; until then, `/feed` stands alone.

### §5.3 O-FFF5 — Dependency on A.6 SHARE

**Bootstrap / roadmap state:** A.5 cannot sign off until A.6 resolves which primitive owns the "Share" top-nav label (currently wired to FFF share-to-feed per `DiscoveryNav.tsx:160-170`). Founder to pick at A.5 sign-off time.

**4-primitive enumeration (from `FEATURE_APPROVAL_ROADMAP.md:278`):**
- (a) signed-URL delivery of licensed assets via `/api/media/[id]` entitlement path.
- (b) public share link for a vault asset or frontfolio via `/share/[token]` signed-token external delivery.
- (c) collaborator invite surface (no live code yet).
- (d) share-to-feed — creates an FFF post wrapping a Frontfiles object (top-nav "Share" button, creators-only, fires `GlobalShareComposer`).

**In-scope feed + composer surfaces affected if A.6 reorders primitive (d)'s label:**

| # | File:line | Current copy / wiring | Risk if A.6 reassigns "Share" |
|---|---|---|---|
| 1 | [DiscoveryNav.tsx:160-170](src/components/discovery/DiscoveryNav.tsx:160) | Top-nav button with `aria-label="Share to Frontfiles feed"`, visible text `Share`, fires `openComposer()` | **Highest.** This is the exact surface O-FFF5 names. If A.6 promotes "Share" to an umbrella of 4 primitives, this button either (i) needs a new label (e.g., `Share to feed`, `Post`, `FFF → Share`), or (ii) needs to become a disambiguation menu. |
| 2 | [FeedComposerCTA.tsx:53](src/components/feed/FeedComposerCTA.tsx:53) | Placeholder copy: `Share a Frontfiles asset, Story, Article or Collection…` | Moderate. Copy uses "Share" as a verb but the attachment-kind enumeration grounds it to the feed primitive. Likely survives intact if A.6 keeps "Share" as umbrella; needs rewording if A.6 retires "Share" entirely. |
| 3 | [FeedComposerCTA.tsx:60](src/components/feed/FeedComposerCTA.tsx:60) | Action button `Share` | Same as #1 — if primitive (d) is renamed, this button follows. |
| 4 | [ShareComposer.tsx:191](src/components/composer-share/ShareComposer.tsx:191) | Header label: `Share to Frontfiles` (or `Repost with context` when repost mode) | Moderate. "Share to Frontfiles" is the canonical primitive-(d) verb; if A.6 retires that framing, the header changes too. |
| 5 | [ShareComposer.tsx:181](src/components/composer-share/ShareComposer.tsx:181) | `aria-label="Share to Frontfiles feed"` on the dialog | Follows #4. |
| 6 | [ShareComposer.tsx:298-302](src/components/composer-share/ShareComposer.tsx:298) | Publish button: `Publishing…` / `Publish repost` / `Publish to feed` | Low. "Publish" is the non-contested verb here; the "to feed" qualifier depends on whether A.5 owns the name "feed" (it does per roadmap §A.5). |
| 7 | [FeedEmptyState.tsx:32](src/components/feed/FeedEmptyState.tsx:32) | Button: `Share to feed` | Moderate. Same risk profile as #1. |
| 8 | [FeedLeftRail.tsx:213](src/components/feed/FeedLeftRail.tsx:213) | Footer disclaimer: `FFF Sharing · Private beta` | Moderate. Uses "FFF Sharing" as the branded program name — if A.6 repositions, this label needs review. |

**Not affected by A.6 (confirmed):** primitives (a) and (b) have distinct routes and are not touched by any string in the in-scope tree. Primitive (c) has no live code. The only primitive wired to feed+composer surfaces in-scope is (d).

**Recommendation (audit-level only):** if A.6 reorders before A.5 sign-off, the 8 surfaces above are the exhaustive set of copy/wiring changes; the state machine and data layer do not need to move. If A.6 accepts deferred open-item status on A.5's gate, A.5 can ship with the current strings and revisit them post-A.6.

---

## §6 — Design Canon compliance

Cross-file audit of every visible component listed in §1. Per exit criterion 5, enumerate violations with `file:line` or record "none found."

### §6.1 Colors (Canon §4.1 — exactly three: `#000`, Frontfiles blue, `#fff`)

| # | File:line | Violation | Class | Note |
|---|---|---|---|---|
| V1 | [src/components/composer-share/ShareComposer.tsx:252](src/components/composer-share/ShareComposer.tsx:252) | `text-red-500` on char-counter over-limit | **Red** | Canon §4.2: destructive maps to black, never red. "Over limit" is an error state and should route to black (or Frontfiles blue for emphasis without destructive semantics). |
| V2 | [ShareComposer.tsx:262](src/components/composer-share/ShareComposer.tsx:262) | `border-red-300 bg-red-50` on inline error bag | **Red** | Same rationale as V1. Error bag chrome should use canonical black border / default surface, matching the dashed-black pattern in `removedQuote` [styles.ts:347-353](src/lib/post/styles.ts:347). |
| V3 | [ShareComposer.tsx:266](src/components/composer-share/ShareComposer.tsx:266) | `text-red-700` on error message text | **Red** | Same rationale. |
| V4 | [src/components/discovery/DiscoveryNav.tsx:264](src/components/discovery/DiscoveryNav.tsx:264) | `bg-blue-600` on cart-count badge | **Non-canon blue** | Canon §4.1 specifies the single blue is `oklch(0.546 0.213 264.376)` / hex `#0000ff`. `bg-blue-600` is Tailwind blue-600, a different value. This is in `CartNavButton`, whose consumer scope is broader than FFF, but the file is in-scope. |

No red utilities, non-canon greens/yellows/oranges/purples, or additional blue variants appear in any other in-scope file (confirmed via Grep across the 18-file tree).

### §6.2 Radius (Canon §4.3 — `--radius: 0rem`, no `rounded-*`, no pills, no curved chips)

Entire §0.1 / §0.2 is the radius finding. Restated here for the §6 ledger:

| # | Site | Violation |
|---|---|---|
| V5 | [src/app/globals.css:132-137](src/app/globals.css:132) (token layer) | Six non-zero `--post-KIND-radius` tokens, one of which is an explicit `9999px` pill (`--post-chip-radius`). Cascades through all of `styles.ts`. **§0 drift.** |
| V6 | [src/lib/post/styles.ts:257](src/lib/post/styles.ts:257) | `embedFormatPill` uses `rounded-sm` Tailwind utility directly, bypassing even the `--post-*` token layer. Direct Canon §4.3 violation. |

### §6.3 Typography (Canon §4.4 — Neue Haas Grotesk Display/Text, SF Mono)

No direct hits in the in-scope components. Typography is applied through `post-type-*` utility classes (`post-type-author-name`, `post-type-body`, `post-type-embed-title`, `post-type-meta`, `post-type-action-label`, `post-type-chip`, `post-type-empty`, `post-type-title`, `post-type-meta-compact`) — these are declared outside the in-scope file set and are assumed Canon-compliant for this audit. `font-mono` is used for numeric columns and timestamps (e.g., [styles.ts:247](src/lib/post/styles.ts:247), [styles.ts:315](src/lib/post/styles.ts:315), [FeedRightRail.tsx:57](src/components/feed/FeedRightRail.tsx:57)), which maps to SF Mono if the global config honors the Canon — not verified in this audit.

### §6.4 Labels (Canon §4.5 — 10px bold uppercase tracking-widest slate-400)

Canon specifies the small-label pattern. The FFF `post-type-meta` / `post-type-meta-compact` utility classes are used as the operational equivalent everywhere (e.g., [styles.ts:423](src/lib/post/styles.ts:423) `emptyStateLabel`, [styles.ts:522](src/lib/post/styles.ts:522) `railSectionLabel`). The Canon says `slate-400`; the in-repo token is `text-[var(--post-text-meta)]`. Exact color-value equivalence is not verified in this audit (out-of-scope — token values live outside the file tree). **Flagged**: if the `--post-text-meta` resolves to a slate shade other than slate-400, there is a sub-token drift on top of §0.1. Next dispatch: resolve the token.

Direct `text-slate-400` / `text-slate-500` utilities: none in the in-scope tree (Grep confirmed).

### §6.5 Labels for role buttons — `DiscoveryNav`

[DiscoveryNav.tsx:124-134](src/components/discovery/DiscoveryNav.tsx:124) uses `text-[12px] font-bold uppercase tracking-wider` (not `tracking-widest`, not `text-[10px]`). This is the broader platform nav, not a Canon §4.5 small-label site per se — the Canon label pattern applies to eyebrow/section labels, not to top-nav action labels. **Not a violation**, just a style-family mismatch that future design work should consciously preserve.

### §6.6 Emoji (Canon §4.7 — forbidden in UI unless explicitly authorized)

**None found** in any in-scope component. What the surface does use:

- Typographic arrows: `→` and `←` in rail footer ("Tune your feed →" [FeedRightRail.tsx:80](src/components/feed/FeedRightRail.tsx:80)), `See all posts →` [post/[id]/page.tsx:239](src/app/post/[id]/page.tsx:239), `← Back to feed` [post/[id]/page.tsx:173](src/app/post/[id]/page.tsx:173). These are Unicode typographic arrows (U+2192, U+2190), not pictograph emoji. Not a violation.
- Middle-dot separators `·` — editorial convention, not an emoji.
- Inline SVG icons — monochromatic `currentColor` SVGs (e.g., [FeedLeftRail.tsx:75-88](src/components/feed/FeedLeftRail.tsx:75), [DiscoveryNav.tsx:16-57](src/components/discovery/DiscoveryNav.tsx:16)). These are SVGs, not emoji; they do not violate Canon §4.7.

### §6.7 Summary

**Total Canon violations in the in-scope tree: 6** (V1–V6, listed above). Of these:

- 1 is a token-layer drift (V5) that cascades through the entire FFF module — §0 issue.
- 1 is a component-layer direct Tailwind-utility violation (V6) independent of the token drift.
- 3 are red-color utilities in `ShareComposer` error-rendering chrome (V1, V2, V3).
- 1 is a non-canon blue on `DiscoveryNav`'s cart badge (V4).

Per the dispatch constraint, **none are fixed in this audit.** Each has a `file:line` citation above for the next dispatch to act on.

---

## §7 — Recommended next dispatch scope

This audit produces no design recommendations (out of scope). It identifies what the **next dispatch** must handle before any `/feed` design work can advance to implementation.

### §7.1 Blocker to escalate to the founder before any design dispatch

**B1 — Radius token drift (§0.1).** Founder must rule whether the `--post-KIND-radius` tokens are:

- (a) a ratified Canon exception scoped to FFF surfaces — in which case `PLATFORM_BUILD.md` Design Canon section must be amended to name the exception, OR
- (b) a drift to fix — in which case `globals.css` lines 131–138 must be zeroed and the `styles.ts` cascade audited for any layout that depends on non-zero radii for its visual logic.

Designing `/feed` on top of an unresolved token-layer Canon conflict produces output that cannot be validated against either state. This blocker is upstream of every other design decision.

### §7.2 Scope-block shape for the next dispatch

The recommended next dispatch is **not** a single large "design recommendation + implementation plan" — it is at least two dispatches:

**Dispatch N+1 — Corrective pass (pre-design):**

- Resolve B1 (founder ruling).
- If (b), apply the token-layer fix + styles.ts cascade validation. Apply V6 fix.
- Apply the 3 red-color fixes (V1–V3) per Canon §4.2 (destructive → black).
- Apply the non-canon blue fix (V4).
- Apply the Class B certified* renames + copy replacements (9 hits in §3).
- No new components, no new variants, no new behaviour — just canon + terminology alignment.

**Dispatch N+2 — Design recommendation pass:**

- Expand scope to include `src/components/post/PostCard.tsx` + `PostCardUnavailable` (needed to audit filled/placeholder rendering).
- Address the connections-visibility permission-denied gap (§4.6): selector in composer, ranking-time filter, render-time permission-denied variant in `PostCardUnavailable` (and a new `HydrationFailureReason` or a parallel permission check).
- Address the `attachment_not_public` coverage gap for stories/articles/collections (§4.4 Gap #1) — contingent on A.11 COLLECTION gate closing.
- Address the O-FFF5 copy impact (§5.3) — either defer to A.6, or pre-emptively swap labels if A.6's scope lock tells us the "Share" umbrella is retired.
- Leave O-FFF2 and O-FFF3 for A.4 and A.8 gates respectively (not for a design dispatch on `/feed`).

### §7.3 Exit criteria the next dispatch should draft

Per AGENTS.md UI/design gate criterion 3, each of the above dispatches needs its own testable exit criteria. This audit does not draft them (that is a founder-led step), but it records the minimum the criteria must address:

- Zero `text-red-*`, `bg-red-*`, `border-red-*` utilities remain in the in-scope tree (Dispatch N+1).
- All 9 Class B certified* hits are replaced per §3 mapping — reviewable via a pre-vs-post grep (Dispatch N+1).
- Radius audit: either `PLATFORM_BUILD.md` names the FFF exception explicitly, or every in-scope `rounded-[var(--post-KIND-radius)]` resolves to `0px` (Dispatch N+1).
- `Post.visibility === 'connections'` renders a permission-denied variant when the viewer is not a connection; the composer surfaces a visibility selector (Dispatch N+2).
- Hydrator emits `attachment_not_public` for stories, articles, and collections where the underlying entity is non-public (Dispatch N+2, contingent on A.11).

---

## §8 — Audit-level open items

Items this audit raises that were not already on the A.5 open-items registry.

- **O-FFF-A1 (new)** — Token-layer radius override vs Design Canon: ratify or revert. Owner: founder. See §0.1 / B1.
- **O-FFF-A2 (new)** — `attachment_not_public` hydration coverage for stories/articles/collections is asset-only today. Partially tracked by A.11 O-COL5 but not yet enforced at the hydrator. See §4.4 Gap #1.
- **O-FFF-A3 (new)** — Connections-visibility is declared as a 2-state primitive but has no UI affordance and no ranking/rendering enforcement. See §4.6.
- **O-FFF-A4 (new)** — `PostCardUnavailable` per-reason rendering unverified — component is in the out-of-scope `src/components/post/` tree. See §4.4 Gap #2. Recommended: bring into scope for Dispatch N+2.
- **O-FFF-A5 (new)** — Submit-failure error shape reuses `attachment_not_found` code as a generic failure code in [draft-store.tsx:282](src/lib/post/draft-store.tsx:282). Semantic mismatch; not currently user-visible because there is no code-specific UI branching. See §4.2.
- **O-FFF-A6 (new)** — `--post-text-meta` token value vs Canon §4.5 `slate-400` unverified. See §6.4.
- **O-FFF-A7 (new)** — `PostsClientError` error code `attachment_not_found` overlap with the `PostValidationErrorCode` of the same name at [client.ts:282](src/lib/post/client.ts:282) vs [types.ts:40](src/lib/post/types.ts:40). Two separate contracts sharing a code string. Low severity, flag for future de-duplication.

---

## §9 — Verification trace

Per exit criterion 6, the audit is verifiable:

- [x] Every visible component enumerated with file:line — see §1 (30 rows).
- [x] Every component mapped to state machine(s) / primitive — see §1 (primitive/state column) + §2.
- [x] All Class B certified* hits in the in-scope tree identified — see §3 (9 hits; 0 Class A).
- [x] Replacement mapping table present — see §3.
- [x] State-variant coverage for all 6 required variants (loading / error / empty × 3 tabs / partial-hydration / permission-denied / filled) — see §4.
- [x] All 3 A.5 open items touched — see §5.
- [x] O-FFF5 surface-impact list present — see §5.3.
- [x] Design Canon violations enumerated with file:line — see §6 (6 violations: V1–V6).
- [x] Zero code changes applied this dispatch.
- [x] Audit-level open items raised where this dispatch found new material — see §8.

---

*End of A.5 FFF design audit. No code changes applied in this dispatch. Follow-on dispatches required per §7 before any design work advances.*
