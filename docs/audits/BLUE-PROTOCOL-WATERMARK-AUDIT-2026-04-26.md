# Blue Protocol + Watermark Systems — Audit

**Date:** 2026-04-26
**Author:** Audit pass, founder-dispatched (alongside upload rebuild work)
**Scope:** Two aggregated trust/protection systems — (a) Blue Protocol validation/provenance/trust ladder, (b) the watermark system, which exists in two parallel implementations (rebuilt vs live)
**Out of scope:** Full deep-read of every consumer surface that calls watermark or validation code — this is an architectural audit, not a comprehensive consumer audit
**Reads underlying:** `.claude/agents/frontfiles-blue-protocol.md`, `src/data/assets.ts:1-40`, `src/lib/watermark/{policy,types,presets}.ts`, `src/components/watermark/*`, `src/lib/processing/{watermark-compositor,profiles,types}.ts`, `src/components/preview/PreviewMedia.tsx`, `src/lib/media/asset-media-repo.ts`, migrations `20260417100001-3_watermark_profile_*.sql`

---

## 1. Headline

The two systems are **architecturally distinct** but the founder's framing as "aggregated" is correct in one sense: they both speak to Frontfiles' content-protection narrative, and they both have **legal/trust language sensitivity** per CLAUDE.md item 9. They should be audited and ratified together because a weakness in either undermines the platform's overall trust posture.

**Three load-bearing findings:**

1. **Blue Protocol has a documented but unresolved 5-vs-7 state drift** between code (5 states in `src/data/assets.ts:10-15`) and the canonical spec (7 states per the agent doc, citing `PLATFORM_BUILD.md` line 72 and Spec S7.4-7.5). `CANONICAL_SPEC.md` does not exist in the repo (Task #38 not landed). The agent doc identifies this as Blue Protocol's FIRST RESPONSIBILITY before any downstream work.

2. **Watermark exists as two parallel systems with incompatible vocabularies.** System A (rebuilt, server-side) uses `light/standard/heavy` intrusion levels and bakes watermarks INTO JPEG bytes via Sharp. System B (live, client-side) uses `none/subtle/standard/strong` modes and renders React overlays ON TOP of delivered bytes. Today's runtime uses System B. System A is dormant: 0 of 6 watermark profiles approved; pipeline never invoked.

3. **System B is wired into the canonical asset dataset, not just the UI.** `src/data/assets.ts` line 6 imports `WatermarkMode` from `src/lib/watermark/types`. This means the data layer's truth about how an asset is watermarked uses the OLD vocabulary. Any retirement of System B requires data migration, not just UI cleanup. The architecture brief's PR 8 (drop legacy `vault_assets.watermark_mode` column) addresses the column but not the dataset-level coupling.

---

## 2. Blue Protocol — current state

### 2.1 What Blue Protocol is

Per `.claude/agents/frontfiles-blue-protocol.md`:

- **Visual + semantic apex** of the validation ladder, rendered in Frontfiles blue (`#0000FF`)
- **Product-design term, NOT a legal term** — per the agent doc
- The `fully_validated` tier of the `ValidationDeclaration` enum is the apex
- Coupled with: Trust Badge (separate concept, on `users` not assets, 2 states), CEL (Certification Event Log, append-only), FCS (Frontfiles Certification System, L1-L4 levels), provenance primitives (asset hash, EXIF, creator identity, BOLT cross-ref, rights attestation)

### 2.2 The 5-vs-7 state drift (verified)

| Source | States | Evidence |
|---|---|---|
| **Code** (`src/data/assets.ts:10-15`) | 5 — `fully_validated`, `provenance_pending`, `corroborated`, `under_review`, `disputed` | Verified by direct read |
| **Canonical Spec** (per agent doc, citing `PLATFORM_BUILD.md` line 72 + Spec S7.4-7.5) | 7 — all of the above + `manifest_invalid`, `invalidated` | Per agent doc; canonical spec doc itself does not exist in repo |

**Coupling:** `ASSIGNMENT_DISPUTE_TAXONOMY.md` Rights-Violation Type 5 outcome references `invalidated` — assumes the 7-state model. Type 1 (Fraud) upheld also references `invalidated`. These references would break or silently no-op if the code stays at 5 states.

**Resolution path per agent doc (paraphrased):**

1. Land `CANONICAL_SPEC.md` in git (Task #38 — not done)
2. Founder decision: Option A (expand code to 7 states) OR Option B (contract spec to 5 states)
3. Never silently resolve (e.g., adding 2 states without updating spec)

### 2.3 Blue Protocol's relationship to the upload rebuild

Per the agent doc:

- **Owned by Blue Protocol agent:** validation-state transitions in upload commit; initial state of new assets
- **Not owned (deferred to other agents/systems):** storage/watermark mechanics; the upload commit flow itself

Upload commit currently sets `declaration_state = 'provenance_pending'` (verified in `commit-service.ts` line 199) — matches the agent's rule #3 ("`fully_validated` is earned, never defaulted").

**Implication for Phase B/C/E/F:** the upload rebuild touches Blue Protocol indirectly (initial validation state + CEL events on commit), but does not need to resolve the 5-vs-7 drift to ship. PR 1.3 / PR 3 / PR 4 / PR 5 are all compatible with either the 5 or 7 state model.

### 2.3.1 Risk if the drift is not resolved

The drift is not just a documentation tidiness problem. Concrete consequences if left open:

1. **Dispute outcomes that reference `invalidated` cannot be implemented cleanly.** `ASSIGNMENT_DISPUTE_TAXONOMY.md` Type 1 (Fraud upheld) and Type 5 (Rights Violation upheld) both prescribe transitioning the asset to `invalidated`. With only 5 states in code, that transition has no target — implementations either silently no-op (the asset stays at `disputed` or `under_review` forever, leaving rights-violating content reachable) or invent an unauthorized fallback (drift compounds). Either is a legal exposure.
2. **Any future external audit of FF's trust system finds a published taxonomy whose states do not exist in code.** This is the kind of inconsistency that erodes counsel-readability and contradicts the platform's "serious editorial" posture. A reviewer comparing `PLATFORM_BUILD.md` Spec S7.4-7.5 against the live codebase will see the gap immediately.
3. **The `manifest_invalid` state has no path to surface today.** Its absence means assets with broken provenance manifests have nowhere clean to land — they either stay at `provenance_pending` (misleading: it implies progress, not failure) or get coerced into `under_review` (misleading: implies human review is in progress).

These are not theoretical. They become live exposure the moment dispute taxonomy or provenance-validation flows ship against the current 5-state model.

### 2.4 Open Blue Protocol concerns

- **No CEL implementation surfaced in this audit.** The agent doc references CEL as critical infrastructure (every state transition writes a CEL event) but I did not find a `cel/` module or `certification_events` table in the migrations or src tree. May exist under a different name; needs separate verification.
- **FCS L1-L4 levels referenced but not located.** The agent doc says "L4 = Assembly Verification applied to Composed Articles." Composer surfaces likely have references; not audited here.
- **Trust Badge implementation status unknown.** Agent doc says Trust Badge is on `users` (2 states: `verified`, `trusted`). Did not verify presence/shape in this audit.

---

## 3. Watermark — two parallel systems

### 3.1 System A — rebuilt, server-side compositor (DORMANT)

**Module:** `src/lib/processing/`

| Component | File | Status |
|---|---|---|
| Profile loader | `profiles.ts` | Built; dual-mode (mock seed + Supabase). 6 seed profiles, all `draft`, never approved. |
| Compositor | `watermark-compositor.ts` | Built. Composites a vertical bar (FRONT/FILES brand block + asset ID + attribution) onto the JPEG via Sharp. Heavy level adds scattered FF icons. |
| Pipeline integration | `pipeline.ts` | Built. Tests pass. |
| Dispatcher | `dispatcher.ts` | Built. |
| Resize | `resize.ts` | Built. |
| Types | `types.ts` | Built. |
| Tests | `__tests__/{profiles,pipeline,types}.test.ts` | Passing. |
| Schema | migrations `20260417100001-3_watermark_profile_*.sql` | Landed: `watermark_profiles` table, enums (`watermark_intrusion_level`, `template_family`, `watermark_approval_status`), indexes |
| Dev approval surface | `src/app/dev/watermark-approval/page.tsx` + `layout.tsx` | Built. The operator surface for approving profiles before pipeline can use them. |
| PSD-derived assets | `src/lib/processing/assets/{ff-logo-watermark,ff-watermark-bar-landscape-reference,ff-watermark-bar-portrait-reference,ff-scatter-icon,ff-brand-logo}.png` | Present in repo. |

**Vocabulary:** `light | standard | heavy` intrusion levels × `portrait | landscape` template families = 6 profile slots.

**Activation gates:**

1. PR 4 worker shipped — NOT DONE
2. At least one `watermark_profiles` row per (intrusion_level, template_family) approved — NONE APPROVED (all 6 seeds are `draft`)
3. `vault_assets.intrusion_level` column populated for assets needing watermarked previews — column exists per ARCHITECTURE-BRIEF; population status not audited
4. Real upload runtime active (PR 5) — NOT DONE
5. PR 7 dropping mock fallback in delivery resolver — NOT DONE
6. **System B's runtime overlay disabled in PreviewMedia.tsx and other consumers — NOT DOCUMENTED IN ANY PR**

Item 6 is a real gap. `IMPLEMENTATION-PLAN.md` PR 7 only addresses dropping the mock fallback in `getReadyMedia`; it does not specify removing the System B overlay rendering.

### 3.2 System B — live, client-side overlay (RUNTIME)

**Module:** `src/lib/watermark/` + `src/components/watermark/` + `src/hooks/useWatermark.ts`

| Component | File | Role |
|---|---|---|
| Policy resolver | `policy.ts` | Resolves `WatermarkConfig` per usage context |
| Presets | `presets.ts` | Maps mode → intensity + tier definitions |
| Geometry | `geometry.ts` | Tier selection by image size (S ≥ 600 → canonical, S ≥ 380 → reduced, etc., down to S ≥ 40 → f-micro) |
| OG variant | `og-watermark.tsx` | OpenGraph image rendering |
| Types | `types.ts` | `WatermarkMode`, `WatermarkContext`, `WatermarkConfig`, `AssetWatermarkSettings` |
| Component tree | `src/components/watermark/{WatermarkOverlay,CornerMark,FFPatternLayer,HorizontalBar,VerticalBar,MicroGlyph}.tsx` | React components rendering the overlay layers |
| Hook | `src/hooks/useWatermark.ts` | Client hook for resolving config in components |
| Tests | `src/lib/watermark/__tests__/{policy,presets}.test.ts` | Passing |
| Dev harness | `src/app/dev/watermark-harness/page.tsx` | Visual test surface for the client overlay |

**Vocabulary:** `none | subtle | standard | strong` modes × `standard | elevated | invasive` intensities + 6 size-based tiers (canonical → f-micro).

**Runtime usage today:** verified in `PreviewMedia.tsx` lines 187-195 — `WatermarkOverlay` renders conditionally on `watermarkConfig?.enabled && cardDims && assetId`. Used across discovery cards, preview surfaces, share previews, OG images. Effectively the live watermark mechanism in production.

**Data-layer coupling:** `src/data/assets.ts` line 6 imports `WatermarkMode` from `src/lib/watermark/types`. The canonical asset dataset uses System B's vocabulary. Per `ARCHITECTURE-BRIEF.md` §3.1, `vault_assets.watermark_mode` is marked **Legacy** with "to be dropped after migration" and §6.4 documents the mapping (`subtle→light, standard→standard, strong→heavy, none→TBD founder decision`).

### 3.3 The architectural difference (and why it matters for trust)

| Property | System A | System B |
|---|---|---|
| Where watermark exists | Baked INTO the JPEG bytes server-side | Drawn ON TOP of delivered bytes by the browser |
| Underlying delivered image | Watermarked derivative | Either mock fixture or unwatermarked thumbnail |
| Right-click → "save image" outcome | Saves the watermarked JPEG | Saves the underlying (potentially unwatermarked) image |
| Browser dev tools extraction | Same — gets watermarked bytes | Trivial — overlay is a separate DOM layer; underlying image is in a `<img src=...>` tag |
| Bypassable by sophisticated user | No (watermark IS the bytes) | Yes (disable overlay CSS or extract `<img>` src) |
| Server processing cost | High (Sharp + composite) | Zero (rendered client-side) |
| Profile approval governance | DB-enforced; pipeline refuses to ship without approved profile | None — modes are constants |

**Trust posture implication:** System B alone is a visual deterrent, not a cryptographic protection. For a serious editorial platform with rights-sensitive content, System B without System A is materially weaker than the architecture brief's invariants imply. The brief's §1.6 leak-prevention claim ("Strong. No known leak paths.") rests on the assumption that `getReadyMedia` returns an actually-watermarked derivative — which today it doesn't (mock fallback returns the SAME path for all roles per ARCHITECTURE-BRIEF §1.4).

**Today's mitigation:** the runtime is mock; the underlying images are pre-placed sample fixtures, not user uploads. The leak risk in production-as-of-today is "you can extract a sample image" — not "you can extract a creator's actual original." But this mitigation evaporates the moment PR 5 cuts over to real uploads if System A isn't activated first.

---

## 4. Cross-system observations

1. **Both systems use Frontfiles blue (`#0000FF`).** Blue Protocol's badge and Watermark Compositor's `BRAND_BLUE` are identical color. Likely intentional alignment with Design Canon (per `frontfiles-blue-protocol.md` rule #7 and `WM_BLUE` constant in `watermark/types.ts`). No action needed; just note the shared visual language.

2. **Both have explicit legal-language discipline rules.** Blue Protocol agent doc rule #1 forbids casual use of "certified" outside FCS. Watermark system doesn't have an equivalent doc, but per CLAUDE.md item 9 the same posture should apply — no claims that watermarks "guarantee" anti-piracy.

3. **No cross-system documentation explains how they relate.** The asset detail page presumably surfaces both (validation badge AND watermarked preview), but there's no governing doc that says "an asset with `fully_validated` validation AND `heavy` intrusion is presented as X." This is a gap, but probably a UX-spec-level one (Phase C C1 territory), not a brief-level one.

4. **Vocabulary mismatch is wider than just watermark.** System A uses `light/standard/heavy`. System B uses `none/subtle/standard/strong`. The pricing engine brief (`PRICE-ENGINE-BRIEF.md` v3 §4.2.3) refers to `intrusion_level` (System A vocabulary) as a format_defaults dimension. So the price engine is already aligned with System A's vocabulary, not System B's. This means: if System B isn't retired before Phase F price engine surfaces ship, there will be a vocabulary mismatch between the per-asset watermark display (System B) and the pricing recommendation basis (System A).

---

## 5. Interface points (HALT)

These need founder resolution before any audit-driven action:

### Blue Protocol IPs

| IP | Question | Recommendation |
|---|---|---|
| **BP-IP-1** | 5-vs-7 state drift resolution: Option A (expand code to 7 states) or Option B (contract spec to 5 states)? | **Option A.** The 7-state model is referenced by the dispute taxonomy (`invalidated` is an outcome of upheld Type 1 Fraud and Type 5 Rights Violation). Contracting the spec means losing a documented state with downstream code dependencies. Expanding code is additive and preserves the dispute coupling. |
| **BP-IP-2** | Where does `CANONICAL_SPEC.md` live, and when does it land? | **Land in `docs/canonical-spec/CANONICAL_SPEC.md`** before any state expansion code work. Source of truth must precede implementation per CLAUDE.md item 10 (architecture before implementation). |
| **BP-IP-3** | Does Blue Protocol's "FIRST RESPONSIBILITY" (close the drift) take priority over the upload rebuild, or run in parallel? | **In parallel, lower priority.** The upload rebuild PRs (B/C/D/E/F) are compatible with either 5 or 7 states. Blue Protocol drift resolution can ship as its own track without blocking Phase B kickoff. |
| **BP-IP-4** | Does CEL exist? If not, when is it built? | **Verify existence in a follow-up audit.** Did not find a `certification_events` table or `cel/` module in this pass. If it doesn't exist, every claim about "CEL records every state transition" is aspirational, not implemented. |

### Watermark IPs

| IP | Question | Recommendation |
|---|---|---|
| **WM-IP-1** | Does System A actually replace System B, or do they coexist with different roles (server-baked + client overlay as defense-in-depth)? | **Replace, not coexist.** Coexistence introduces vocabulary mismatch, double-rendering risk, and trust-narrative confusion ("which watermark does the user see?"). Pick one as the canonical mechanism. System A is the right canonical (cryptographically stronger, founder-approval-governed). |
| **WM-IP-2** | When does System B's runtime overlay get retired from `PreviewMedia.tsx` and other consumers? | **NEW PR needed.** No existing PR (1-8) specifies this. Add a PR (call it PR 7.5 or a new Phase D directive) that removes `WatermarkOverlay` rendering from `PreviewMedia.tsx`, `AssetCard.tsx`, share OG, etc., AFTER System A is activated and proven for one full creator cycle. Sequenced AFTER PR 7 (mock fallback removal). |
| **WM-IP-3** | Vocabulary alignment: `light/standard/heavy` (System A, intrusion_level) vs `none/subtle/standard/strong` (System B, watermark_mode). Pick one across the platform? | **System A vocabulary wins** — already aligned with price engine `format_defaults` (per PRICE-ENGINE-BRIEF v3 §4.2.3) and with `vault_assets.intrusion_level` schema. PR 8 drops `watermark_mode` per the existing plan. The `none` mode in System B has no direct equivalent in System A; per ARCHITECTURE-BRIEF §6.4 §7.1, founder decision needed on `none → light` vs `none → standard` mapping. |
| **WM-IP-4** | Watermark profile approval — 0 of 6 profiles currently approved. Who approves and when? | **Founder approves, before PR 5 staging cutover.** Per ARCHITECTURE-BRIEF §7.2 + IMPLEMENTATION-PLAN §PR 4 (per-role profile rule). Without at least 1 approved profile per (intrusion_level, template_family), the worker stays-pending on watermarked roles. Use `/dev/watermark-approval` page (already built). |
| **WM-IP-5** | Data-layer coupling: `src/data/assets.ts` imports System B's `WatermarkMode`. Migration plan? | **Two-step migration:** (a) introduce `intrusionLevel` field on `AssetData` parallel to `watermarkMode`; (b) migrate consumers; (c) delete `watermarkMode` field + System B import. Sequenced alongside PR 8 (column drop). Not covered by current plan; needs adding. |
| **WM-IP-6** | OG image (share-preview) handling — `og-watermark.tsx` is System B. Does System A handle OG, or does the OG path stay client-rendered? | **System A handles OG (`og_image` is one of the 3 enqueued roles per IP-2 of the PR 3 audit).** The `og-watermark.tsx` file becomes dead code once System A activates. Retire it in the same PR as WM-IP-2. |

### Aggregated IPs

| IP | Question | Recommendation |
|---|---|---|
| **AG-IP-1** | Both systems use `#0000FF`. Should the asset detail page explicitly couple "Blue Protocol verified" + watermarked preview into a unified trust statement? | **No.** Per Blue Protocol agent rule #5: "Never bundle Trust Badge and ValidationDeclaration language. They are distinct." Same logic applies: Blue Protocol = verification trust signal; Watermark = visual deterrent. Coupling them in user-facing language would overclaim. Keep separate per the agent's existing discipline. |
| **AG-IP-2** | Should this audit produce a unified "trust system architecture brief" governing both systems together, or stay as two separate concerns? | **Two separate concerns.** Blue Protocol has its own agent; watermark has its own architecture brief sections. A unified brief would muddy the legal-language posture each maintains separately. Keep them apart, but reference each other. |

---

## 6. Recommended next step

This audit produces three follow-on workstreams, of which only one is urgent:

### Urgent (blocks Phase D / PR 5 cutover)

**WM-IP-4 (profile approval)** — needs founder action on the dev approval page before PR 5 can ship. Without approved profiles, the worker (PR 4) stays-pending on watermarked roles, which means PR 5 cutover would deliver 404s instead of watermarked previews.

**WM-IP-2 (System B retirement PR)** — needs to be added to the Phase D sequencing in `UX-BRIEF.md` v3. Otherwise PR 5 cutover ships System A active + System B still rendering = double-watermark risk.

### Important but not urgent (parallel track)

**Blue Protocol drift resolution** — BP-IP-1 through BP-IP-4. Has its own agent, its own surface, its own `CANONICAL_SPEC.md` to land. Recommendation: open as a separate workstream under a new directive series (e.g., BP-D1 = land canonical spec, BP-D2 = expand code to 7 states, BP-D3 = wire dispute outcomes). Does not block upload rebuild.

### Verification needed (small follow-up audits)

- Does CEL exist? (BP-IP-4) — 30-min verification audit
- Trust Badge implementation status — 15-min verification audit
- FCS L1-L4 implementation status — 30-min verification audit

---

## 7. Recommended additions to existing briefs

### To `UX-BRIEF.md` v3

Add to §6 Phase D sequencing:

```
D1.5 — System B watermark retirement (NEW, between D1 and D2)
       • Remove WatermarkOverlay rendering from PreviewMedia.tsx,
         AssetCard.tsx, ArticlePreview.tsx, AssetViewers.tsx,
         DiscoveryResultsGrid.tsx, share/[token]/opengraph-image.tsx,
         and any other consumer
       • Delete src/components/watermark/* (after consumer migration)
       • Delete src/lib/watermark/* (after consumer migration)
       • Delete src/hooks/useWatermark.ts
       • Migrate src/data/assets.ts to use intrusionLevel field
         (replacing WatermarkMode import)
       • Tests: regression on PreviewMedia surfaces; validate that
         delivered bytes are watermarked (System A baked-in)
       • Pre-condition (triple gate, ALL must hold before this PR
         composes — protects against premature cutover that would
         expose unwatermarked bytes):
           (a) PR 5 live and stable in production (not just staging)
           (b) Derivative pipeline has non-zero real creator usage
               (at least N real assets processed end-to-end through
               the watermarked_preview role with generation_status='ready';
               not just synthetic test assets)
           (c) At least one approved watermark profile per
               (intrusion_level, template_family) pair, AND each
               approved profile visually verified via the dev harness
               (/dev/watermark-approval) by the founder before approval
```

Sequence: D1 (PR 5 cutover) → **D1.5 (System B retirement)** → D2 (PR 6 backfill) → D3 (PR 7 mock fallback drop) → D4 (PR 8 column drop).

### To `PRICE-ENGINE-BRIEF.md` v3

§7.4 don't-do list — add:

```
N. Don't reference System B watermark vocabulary in format_defaults.
   The engine's format_defaults table is keyed on intrusion_level
   (light/standard/heavy) per System A. Do NOT key on watermark_mode
   (none/subtle/standard/strong). System B is being retired.
```

(Engine code likely doesn't have this issue today — flagging defensively for any future contributor.)

### New brief (out of this audit's scope)

`docs/blue-protocol/BLUE-PROTOCOL-BRIEF.md` — to govern the Blue Protocol drift resolution workstream. Should include:

- The 5-vs-7 state model decision (per BP-IP-1)
- CEL implementation status + spec (per BP-IP-4)
- Trust Badge spec
- FCS L1-L4 evidence model
- Coupling with dispute taxonomy
- Approval gates per state transition

This brief is separate from the upload rebuild and should be commissioned as its own workstream when the founder has bandwidth.

---

## 8. References

- Blue Protocol agent definition: `.claude/agents/frontfiles-blue-protocol.md`
- Asset dataset (5-state ValidationDeclaration enum): `src/data/assets.ts:10-15`
- System A (server-side compositor):
  - `src/lib/processing/profiles.ts` (loader; 6 seed profiles, all draft)
  - `src/lib/processing/watermark-compositor.ts` (Sharp-based bake)
  - `src/lib/processing/types.ts`
  - `src/lib/processing/__tests__/{profiles,pipeline,types}.test.ts`
  - Migrations: `20260417100001-3_watermark_profile_*.sql`
  - Dev approval surface: `src/app/dev/watermark-approval/page.tsx`
  - PSD-derived assets: `src/lib/processing/assets/*.png` (5 files)
- System B (client-side overlay):
  - `src/lib/watermark/{policy,presets,geometry,types,og-watermark}.ts`
  - `src/components/watermark/{WatermarkOverlay,CornerMark,FFPatternLayer,HorizontalBar,VerticalBar,MicroGlyph}.tsx`
  - `src/hooks/useWatermark.ts`
  - Dev harness: `src/app/dev/watermark-harness/page.tsx`
  - Coupled in: `src/data/assets.ts` (line 6 import); `src/components/preview/PreviewMedia.tsx` (lines 187-195); plus dozens of other consumer surfaces (per discovery grep)
- Architecture brief (governs derivative pipeline): `src/lib/processing/ARCHITECTURE-BRIEF.md`
- UX brief (governs upload rebuild): `docs/upload/UX-BRIEF.md` v3
- Price engine brief (already aligned with System A vocabulary): `docs/pricing/PRICE-ENGINE-BRIEF.md` v3
- Implementation plan (PR 8 drops `watermark_mode` column): `src/lib/processing/IMPLEMENTATION-PLAN.md`
- (Referenced but missing) `CANONICAL_SPEC.md` — Task #38 not landed
- (Referenced but not audited) CEL implementation, FCS L1-L4 implementation, Trust Badge implementation

---

End of Blue Protocol + Watermark audit.
