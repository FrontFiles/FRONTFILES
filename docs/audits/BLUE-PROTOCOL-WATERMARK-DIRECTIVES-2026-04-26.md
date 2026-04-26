# Blue Protocol + Watermark — Directive List

**Date:** 2026-04-26
**Derived from:** `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` (the IP tables)
**Purpose:** Translate the audit's interface points into discrete, executable directives that can be dropped into the directive index without entangling the upload rebuild (Phase B/C/D/E/F) workstreams.
**Two parallel tracks:**
- **BP-D series** — Blue Protocol drift resolution (independent of upload rebuild)
- **WM-D series** — Watermark System B retirement + System A activation gate work

Each entry: ID + name | purpose (1 line) | owner | predecessor | output | approval gate.

---

## BP track — Blue Protocol drift resolution

Independent workstream. Does not block upload rebuild. Has its own agent (`frontfiles-blue-protocol`) ready to drive composition.

| ID | Name | Purpose | Owner | Predecessor | Output | Approval gate |
|---|---|---|---|---|---|---|
| **BP-D1** | Land `CANONICAL_SPEC.md` | Pull `PLATFORM_BUILD.md` Spec S7.4-7.11 into a versioned, diffable, single-source repo doc at `docs/canonical-spec/CANONICAL_SPEC.md`. Source of truth must precede any code change to the validation ladder. | Founder (content) + Claude (composition) | None | `docs/canonical-spec/CANONICAL_SPEC.md` containing the 7-state ValidationDeclaration model, Trust Badge spec, FCS L1-L4 spec, CEL spec, dispute-outcome coupling | Founder ratifies the spec before BP-D2 |
| **BP-D2** | Founder decision: expand vs contract | Lock the resolution direction for the 5-vs-7 drift. Audit recommends Option A (expand code to 7 states). | Founder | BP-D1 | One-line decision recorded in `CANONICAL_SPEC.md` header + this directive list | Founder decision; no separate gate |
| **BP-D2.5** | Build `asset_certification_events` CEL partition | New from BP-D4 verification: agent doc's "every validation state transition writes a CEL event" rule has no target table today. Create new migration adding `asset_certification_events` table (`asset_id, prior_state, new_state, trigger, actor_id, timestamp, evidence_refs[]`) with append-only RLS posture matching `assignment_events`. Add `src/lib/cel/asset-events.ts` helper module with `emit()` function. NO UI surface in this directive — that comes when BP-D3 wires the first transitions. | Claude (composition) | BP-D2 (founder choice locked) | New migration `<next-ts>_asset_certification_events.sql` + `src/lib/cel/asset-events.ts` + tests | Founder ratifies migration shape before code |
| **BP-D3** | Expand code to 7 states + wire dispute outcomes | Add `manifest_invalid` and `invalidated` to the `ValidationDeclaration` enum in `src/data/assets.ts`. Add corresponding migration for `vault_assets.declaration_state` enum. Update `ValidationBadge` component for new state visuals. Wire `ASSIGNMENT_DISPUTE_TAXONOMY.md` Type 1 (Fraud) and Type 5 (Rights Violation) outcomes to transition assets to `invalidated`. Each transition writes to `asset_certification_events` via the helper from BP-D2.5. | Claude (composition + audit-first read of `ValidationBadge.tsx` and dispute resolution flow) | BP-D2.5 (CEL partition built) | New migration; updated `assets.ts` enum + `types.ts`; updated `ValidationBadge.tsx`; transition logging via `asset_certification_events`; tests | Founder ratifies BP-D3 plan before code work composes |
| **BP-D4** ✅ | Verification audits — CEL, Trust Badge, FCS L1-L4 (DONE 2026-04-26) | Three small audits run; findings published. Surfaced 4 new directives (BP-D2.5, BP-D5, BP-D6, BP-D7) and 2 urgent live-exposure findings (Trust Badge default = `verified`, composer "FCS Layer 4" label). | Claude (completed) | — | ✅ `BLUE-PROTOCOL-CEL-VERIFICATION-2026-04-26.md` + `BLUE-PROTOCOL-TRUST-BADGE-VERIFICATION-2026-04-26.md` + `BLUE-PROTOCOL-FCS-VERIFICATION-2026-04-26.md` | — (complete) |
| **BP-D5** | Trust Badge default state + earning logic | New from BP-D4 Trust Badge audit: resolve two drifts. (a) Decide whether `protected_source` tier belongs alongside `standard` (4 displayed values) or should be folded (2 displayed values matching agent doc). (b) Decide whether default `trust_badge: 'verified'` is correct (likely add `unverified` or `pending_verification` state, gate `verified` on completed onboarding evidence, gate `trusted` on track-record signal yet to define). Update `TrustBadge.tsx` labels accordingly. Add migration if new enum value introduced. Update `CANONICAL_SPEC.md` §Trust Badge. | Claude (composition + audit-first read of every Trust Badge consumer surface) after founder decision | BP-D1 (canonical spec ratified) | Updated `TrustBadge.tsx`; possible migration; possible new identity store rules; updated `CANONICAL_SPEC.md` §Trust Badge | Founder ratifies the two decisions before code |
| **BP-D6** | FCS specification + minimal implementation | New from BP-D4 FCS audit (largest BP directive). Two phases: **(a) Spec** — articulate L1-L4 in `CANONICAL_SPEC.md` (evidence requirements per level, gating rules, coupling with ValidationDeclaration, fate of existing `assemblyVerified` boolean). Founder ratification. **(b) Implementation** — enum, schema (likely `fcs_level` column on `vault_assets`), transition logic, evidence-gathering hooks, audit logging via `asset_certification_events` (BP-D2.5). UI: badges per level, progression indicator on asset detail. | Claude (composition; multi-pass) after founder decision | BP-D1 (spec) + BP-D2.5 (CEL partition) + BP-D5 (Trust Badge resolved, since both touch trust UI) | Spec; migration; `src/lib/fcs/` module; UI; tests; copy audit | Two-step — founder ratifies spec before implementation; founder ratifies implementation plan before code |
| **BP-D7** ✅ | FCS / Trust Badge user-facing copy audit (DONE 2026-04-26) | Audited every user-facing page, email, and marketing surface that uses "FCS," "Frontfiles Certification," "Layer 4," "Verified Creator," "Trusted Creator," or similar trust-language. Identified 2 critical + 3 high + 2 medium + N low findings. | Claude (completed) | — | ✅ `BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` | — (complete) |
| **BP-D7-IMPL** ✅ | Apply BP-D7 high-severity copy corrections (DONE 2026-04-26) | Shipped 5 high-severity corrections (C-1 + C-2 + H-1 + H-2 + H-3) across 7 files. M-1 + M-2 + LOW deferred. Marketing site, email templates, legal pages, and event type identifiers flagged for follow-up. | Claude (completed) | BP-D7 audit | ✅ Code changes in checkout, composer, mock-data, recommendations, spotlight, TrustBadge, ProfileLeftRail, frontfolio | Founder review of diff |
| **BP-D7.1** | Extended copy audit (deferred) | Audit marketing site, email templates, legal pages, vault drawer, asset detail provenance panels — surfaces flagged in BP-D7 §"Follow-up" but out of in-session scope. ~2-4 hours. | Claude (audit + proposals) | None (parallel-able) | New audit doc + proposed copy changes | Founder reviews before edits ship |

**BP track total: 10 directives** (3 done ✅, 6 future, 1 deferred-extended-scope).
- **Sequential chain:** BP-D1 → BP-D2 → BP-D2.5 → BP-D3
- **Parallel-able after BP-D1:** BP-D5, BP-D6 (D6 also depends on D5 + D2.5)
- **Done:** BP-D4 ✅, BP-D7 ✅, BP-D7-IMPL ✅
- **Deferred (out of immediate scope):** BP-D7.1 (extended copy audit — marketing/email/legal pages)

---

## WM track — Watermark System B retirement + System A activation

Bridges into Phase D of the upload rebuild. Has dependencies on Phase B/C/E/F.

| ID | Name | Purpose | Owner | Predecessor | Output | Approval gate |
|---|---|---|---|---|---|---|
| **WM-D1** | Founder approves at least 1 watermark profile per (intrusion_level × template_family) pair | Use the existing `/dev/watermark-approval` page to visually review each of the 6 seed profiles and approve at least one per (light/standard/heavy × portrait/landscape) pair. Without this, PR 4 worker stays-pending on watermarked roles indefinitely. | Founder (visual review + approval) | None | At least 6 `watermark_profiles` rows with `approval_status = 'approved'` (one per pair, more allowed). Approval timestamps recorded. | Founder action only; no Claude gate |
| **WM-D2** | Brief sync — apply audit recommendations to UX-BRIEF v3 + PRICE-ENGINE-BRIEF v3 | Apply audit §7 edits: add D1.5 (System B retirement) to `UX-BRIEF.md` v3 §6 Phase D sequencing between D1 and D2; add System B vocabulary don't-do to `PRICE-ENGINE-BRIEF.md` v3 §11. Both briefs already in v3; this is small targeted edits, not version bumps. | Claude (edits) | This audit ratified | Updated `UX-BRIEF.md` v3 (with D1.5 inserted) + updated `PRICE-ENGINE-BRIEF.md` v3 (with new don't-do entry) | Founder ratifies brief-sync edits before any directive consumes them |
| **WM-D3** | Founder decision — `none → ?` mapping | Per `ARCHITECTURE-BRIEF.md` §6.4 + §7.1 open decision: legacy `watermark_mode='none'` assets must map to either `intrusion_level='light'` or `intrusion_level='standard'` during data migration. Audit recommends light (least intrusive, respects creator intent). | Founder (decision) | None (parallel-able with everything else) | One-line decision recorded in `ARCHITECTURE-BRIEF.md` §7.1 | Founder decision only |
| **WM-D4** | Compose D1.5 directive plan (System B retirement PR plan) | Audit-first read of every consumer of System B's `WatermarkOverlay`, `useWatermark` hook, and `WatermarkMode` import. Compose `docs/upload/D1.5-PLAN.md` specifying exact files to delete, consumer migration steps, data-layer migration of `src/data/assets.ts` from `WatermarkMode` to `intrusionLevel`, and the regression test surface. | Claude (audit-first composition) | WM-D2 (brief synced) + WM-D1 (profiles approved, so System A can actually replace) + Phase D D1 (PR 5 live and stable per the triple-gate pre-condition) | `docs/upload/D1.5-PLAN.md` ready for founder ratification | Founder ratifies D1.5 plan before code composes |
| **WM-D5** | Ship D1.5 (System B retirement) | Execute D1.5 plan from WM-D4. Delete System B code. Migrate consumers. Migrate data layer. **Rollout is feature-flagged**: ship behind a flag (`FFF_DISABLE_CLIENT_WATERMARK_OVERLAY` or equivalent), enable in staging first, then for a single internal org for one full creator session, then platform-wide. Avoids any window where production users see no watermark at all if a regression slips through. Flag itself is removed in a small follow-up after one stable week. | Claude (code) | WM-D4 ratified + triple-gate pre-condition met | New PR; deletes `src/lib/watermark/`, `src/components/watermark/`, `src/hooks/useWatermark.ts`; migrates `src/data/assets.ts`; updates ~10-20 consumer files; new feature flag with staged rollout; passes regression | Standard PR review + staged rollout sign-off before flag flip in production |

**WM track total: 5 directives.** WM-D1 + WM-D2 + WM-D3 are independent (parallel-able). WM-D4 depends on WM-D1 + WM-D2 + Phase D D1 (PR 5 live). WM-D5 depends on WM-D4 + triple-gate.

---

## Cross-track sequencing

```
Day 0 (now)
├── BP-D1  Land CANONICAL_SPEC.md           [founder + Claude]
├── BP-D4  Verify CEL/TrustBadge/FCS        [Claude] ✅ DONE
├── BP-D7  FCS/TrustBadge copy audit        [Claude] ⚠️ URGENT
├── WM-D1  Approve watermark profiles        [founder, can do today]
├── WM-D2  Brief sync edits                  [Claude] ✅ DONE
└── WM-D3  none→? mapping decision           [founder, can do today]

After BP-D1 ratified
├── BP-D2   Decide expand vs contract        [founder]
├── BP-D5   Trust Badge defaults + earning   [founder + Claude]  (parallel-able)
└── BP-D6 (a) FCS spec articulation          [founder]           (parallel-able)

After BP-D2
└── BP-D2.5 Build asset_certification_events [Claude]

After BP-D2.5
└── BP-D3   Expand code to 7 states          [Claude]

After BP-D5 + BP-D6(a) + BP-D2.5
└── BP-D6 (b) FCS implementation             [Claude]

After WM-D1 + WM-D2 + Phase D D1 (PR 5 live, stable, real-creator-tested)
└── WM-D4   Compose D1.5 plan                [Claude]

After WM-D4 ratified + triple-gate met
└── WM-D5   Ship D1.5 (System B retirement)  [Claude]
```

**Founder actions today (no Claude composition needed first):**

1. **WM-D1** — visit `/dev/watermark-approval`, approve at least one profile per (level × family). ~15 min.
2. **WM-D3** — pick `none → light` or `none → standard` for the legacy mapping. 1 minute.
3. **BP-D1 commissioning** — confirm whether to commission this now or defer; if now, point Claude at the source material for `CANONICAL_SPEC.md` (likely `PLATFORM_BUILD.md` Spec S7.4-7.11 sections).
4. **Review BP-D4 verification findings** (3 audit docs landed 2026-04-26) — confirms or adjusts the new BP-D2.5/D5/D6/D7 directives below.
5. **Review BP-D7 copy audit findings when produced** — flags the user-facing language that needs immediate correction or caveating.

**Claude actions, on founder ratification of this directive list:**

1. ✅ **WM-D2** — DONE. Brief sync edits applied to UX-BRIEF v3 + PRICE-ENGINE-BRIEF v3.
2. ✅ **BP-D4** — DONE. Three verification audits complete (CEL partial / Trust Badge implemented-with-drifts / FCS not-implemented).
3. ⚠️ **BP-D7** — IN PROGRESS / URGENT. Defensive copy audit covering live trust-language exposure.
4. **BP-D1** drafting — if commissioned, compose `CANONICAL_SPEC.md` skeleton against the source material (now expanded scope per BP-D4 findings: must spec ValidationDeclaration AND Trust Badge AND FCS AND CEL partitions).
5. **PR-1.3-PLAN.md composition** — upload-rebuild critical path; queued as next dedicated session opener (not urgent like BP-D7 but blocks Phase B B2 = PR 3).

---

## What this list does NOT include

- **Phase B/C/D/E/F directives** (upload rebuild + price engine + AI pipeline) — those are governed by `UX-BRIEF.md` v3, `PRICE-ENGINE-BRIEF.md` v3, and the upload audit's revised sequencing (PR 1.3 → PR 3 → PR 4 → PR 5 → ...). This list extracts only the BP and WM concerns surfaced by the audit.
- **A unified directive index** — there is no canonical `docs/DIRECTIVE_INDEX.md` covering all workstreams (only newsroom has one at `docs/public-newsroom/DIRECTIVE_SEQUENCE.md`). If the founder wants a unified index, that's a separate ask. This list is a focused extract.
- **Newsroom directives** — `NR-D*` series is shipped; not relevant here.

---

End of BP + WM directive list.
