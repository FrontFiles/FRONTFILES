# E6 — UI Integration (V4 Hydration + API + Audit Wire-Up)

**Status:** DRAFT — awaiting founder ratification before implementation begins
**Date:** 2026-04-28
**Predecessor gates:** E1 v2 ✓ + E1.5 ✓ + E2 directive ✓ + E3 directive ✓ + E4 directive ✓ + E5 directive ✓ (E5 ratification pending PR #18 review). E2 + E3 + E4 + E5 implementations must ship before E6 implementation begins. UI-side, also depends on V4 redesign shipped via PR #15 (already on main).
**Governing documents:**
- `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1) §6 — surfaces; §7 — trust + governance
- `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md` (E1.5) §5 — confidence floors; §4.4 — caption length
- `src/lib/processing/E2-DIRECTIVE.md` — schema (`asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings`)
- `src/lib/processing/E3-DIRECTIVE.md` — engine + cache + cost + region routing
- `src/lib/processing/E4-DIRECTIVE.md` — worker integration (per-asset dispatch)
- `src/lib/processing/E5-DIRECTIVE.md` — clustering + cluster naming + batch trigger
- `docs/upload/UX-SPEC-V4.md` — Founder Lock + §11 AI proposal surfacing + §9 contextual action bar (✓ AI bulk button) + IPV4-5 (auto-accept threshold = 0.85)
- `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` — language discipline for proposal copy
- `src/lib/upload/v3-types.ts` — V4 component data contract (`V2Asset`, `AssetProposal`, `AIClusterProposal`, `V3State`)
- `src/lib/upload/v2-simulation-engine.ts` — current bunk-data source for `asset.proposal` (E6 deprecates the simulation as a hydration source for production; mock retained for tests)

**Objective:** Replace the V4 UI's simulation-derived `asset.proposal` data with real backend data from E2/E3/E5 pipelines, wire creator actions (accept / dismiss / regenerate / re-analyze) to API routes that mutate `asset_proposals` + `asset_proposal_clusters` + `vault_assets` and write to `asset_proposal_audit_log`, and reconcile two load-bearing data-shape mismatches between V4 and the AI-pipeline schema. UI shipping behavior (auto-accept at 0.85; subtle inspector surfacing; ✓ AI bulk button; cluster banner) is preserved verbatim — E6 does NOT redesign anything.

**Mechanical compared to E1-E5 in spirit, but** the data-shape reconciliation in §6 is load-bearing — V4's `AssetProposal` aggregates outputs from four distinct pillars (AI pipeline + price engine + clustering + privacy/licence inference), and E6 must decompose that aggregation cleanly without breaking the V4 visual contract.

---

## 1. What E6 is

E6 stands up the production UI integration. After E6:

- The right-rail inspector's `InspectorAIProposalDetail` reads from real `asset_proposals` rows (caption / keywords / tags + per-field confidences), not from the simulation
- The contact sheet's status dot, contextual action bar's "✓ AI" button, per-field ↻ regenerate, and inspector ✓ accept all dispatch real API calls that mutate the canonical `vault_assets` row + write `asset_proposal_audit_log` events
- The `AIProposalBanner` reads from real `asset_proposal_clusters` rows; accept creates a Story group; dismiss soft-deletes the cluster
- A new "Re-analyze this session" affordance in the inspector overflow menu (or batch settings) triggers `dispatchBatchClusteringForProcessing`
- Per-creator opt-out toggle persists to `users.ai_suggestions_opt_out` (new column, additive migration)
- Auto-accept-at-0.85 (per UX-SPEC-V4 §11.1 + IPV4-5) wires to the per-field `caption_confidence` from the schema, NOT to a fabricated overall confidence
- All proposal mutations write to `asset_proposal_audit_log` with the surface (`upload`, `vault_edit`, `bulk_action`) recorded
- Legal/trust language in all proposal copy aligns to BP-D7 audit (allowed: "AI suggestion," "AI-flagged"; forbidden: "AI-verified," "AI-certified")

E6 ships behind `FFF_AI_REAL_PIPELINE=false` (mock retained for tests + the dev-mode workflow). Production cutover is the SAME flag flip that lights up E3/E4/E5 — they're all on the same gate. No new flag introduced.

E6 does NOT:
- Redesign any V4 component (visuals locked by UX-SPEC-V4 + the Founder Lock)
- Touch the price engine (separate pillar; `priceSuggestion` source migration is F-track work)
- Touch privacy / licence inference (separate concerns; their sources migrate when each pillar lands real data)
- Schedule any worker (PR 5 cutover territory)

---

## 2. Audit findings (current-state read)

| Surface | Current state | E6 implication |
|---|---|---|
| `src/app/vault/upload/_components/inspector/InspectorAIProposalDetail.tsx` | Reads `asset.proposal.confidence` (single number); `asset.proposal.rationale` (string field; not in AI schema); `asset.proposal.priceSuggestion` (mixed-pillar field); `asset.proposal.tags` (string[]) | E6 reconciles: per-field confidences (caption/keywords/tags) replace the single overall; `rationale` either dropped from UI or sourced from `audit_log.metadata` retroactively; `priceSuggestion` continues to come from the price engine (F-track) and is NOT touched here. |
| `src/app/vault/upload/_components/AIProposalBanner.tsx` | Reads `state.aiClusterProposals[]` with shape `{ proposalId, clusterName, proposedAssetIds, rationale, confidence }` | Maps to `asset_proposal_clusters` rows: `proposalId` ↔ `id`, `clusterName` ↔ `proposed_name`, `proposedAssetIds` ↔ `SELECT asset_id FROM asset_proposals WHERE cluster_id = ?`, `confidence` ↔ `silhouette_score`. **`rationale` does not exist in the schema** — E6 generates a synthesized rationale string from cluster metadata (member count + date range) OR drops the field. Founder picks at §6.4. |
| `src/app/vault/upload/_components/lib/computeAcceptAIDispatches.ts` | Sequences `BULK_ACCEPT_PROPOSALS_FOR_SELECTION` + per-asset `UPDATE_ASSET_FIELD` writes for `description` / `tags` / `geography`. Reads `asset.proposal.description`, `proposal.tags`, `proposal.geography`. | `description` is what the schema calls `caption`. `tags` maps 1:1. **`geography` does not exist in `asset_proposals` schema** — separate signal (likely from EXIF GPS via the existing extraction layer, NOT AI). E6 confirms `geography` source stays as it currently is (from `extracted_metadata.gps`); the ✓ AI button stops touching geography because the pipeline doesn't propose it. UX-SPEC-V4 §9.4 says "caption + tags + geography" — the geography part is per-pillar drift between spec and schema; surface in §6.5. |
| `src/lib/upload/v2-simulation-engine.ts` `AssetProposal` shape | `{ title, description, tags, geography, priceSuggestion, privacySuggestion, licenceSuggestions, confidence (overall), rationale, storyCandidates }` | This is a **multi-pillar aggregation**. E6 decomposes: AI pipeline owns `description`/`caption` + `keywords` (NEW) + `tags` + per-field confidences. Price engine owns `priceSuggestion` (F-track). Privacy / licence inference is a separate (currently simulated) signal that lives in its own pillar. Cluster signal (`storyCandidates`) comes from `asset_proposal_clusters` + `asset_proposals.cluster_id`. `title` — currently bunk-from-simulation; the AI schema doesn't generate titles (caption ≠ title); E6 drops `title` as an AI field and either keeps it as a creator-authored field or removes it. §6.6. |
| `src/lib/upload/v3-types.ts` `V2Asset.proposal: AssetProposal \| null` | The proposal field assumes a single combined object | E6 either widens `AssetProposal` (keep aggregator shape; add `keywords` + per-field confidences) OR splits into nested sources (`asset.proposal.aiSuggestion`, `asset.proposal.priceSuggestion`, etc.). §6.6 picks the shape. Recommended: widen with optional fields + per-field confidences; minimize V4 component churn. |
| `UX-SPEC-V4 §11.1 + IPV4-5` auto-accept gate | `asset.proposal.confidence >= 0.85` triggers hydration-time auto-accept of caption/tags/geography into editable fields | The schema has per-field confidences (`caption_confidence`, `keywords_confidence`, `tags_confidence`). E6 reconciles: auto-accept only the fields whose individual confidence ≥ 0.85, evaluated per-field. NOT a single overall threshold. UX-SPEC-V4 IPV4-5 lock allows tuning the threshold; E6 reads it from `ai_pipeline_settings.auto_accept_threshold` (new field, default 0.85). §9. |
| `UX-SPEC-V4 §11.4` cluster banner | Renders for `aiClusterProposals[].status === 'pending'` | Production hydration: `aiClusterProposals` populated from `asset_proposal_clusters WHERE accepted_at IS NULL AND dismissed_at IS NULL`. Accept maps to a Story group creation (E6 must wire to the existing Story-group creation reducer action OR the Story-group creation API; depends on whether Story groups are local-state or server-persisted). §7.4. |
| `state.aiClusterProposals` (V4 reducer) | Loaded into V3State from… simulation, currently. After E6 hydration changes, loaded from API on session bootstrap | E6 adds an API route `GET /api/v2/upload-batches/[id]/ai-proposals` that returns `{ proposals: ProposalRecord[], clusters: ClusterRecord[] }` for a batch. Hydration happens at session bootstrap or on session restore. §8. |
| `state.assetsById[id].proposal` initial value | Currently null until simulation populates it | After E6: hydrated from server on bootstrap; populated incrementally as worker processes assets (`pending → ready` per E4). E6 adds a poll/subscription mechanism to refresh proposals as they complete. §8.3 — design choice between polling, server-sent events, or on-demand-refresh-on-tab-focus. |
| Per-creator opt-out | Does not exist | E6 adds `users.ai_suggestions_opt_out BOOLEAN NOT NULL DEFAULT FALSE` migration + a settings UI surface. When `true`, the worker still runs (per E1 v2 §7.3 — preserves data for analytics), but the UI hides all proposal affordances. §12. |
| Trust language | Existing V4 components use "AI Proposal Detail," "AI suggestion," "ghost text" — all aligned to BP-D7 | E6's new copy (regenerate confirmation, dismiss tooltip, "Re-analyze" button label) must follow the same discipline. §13. |
| FFF_AI_REAL_PIPELINE flag | Default false; set by E3 | E6 reuses. When false, the simulation continues to power the UI (preserving the existing dev workflow). When true, real backend hydration is the source. §15.3. |

---

## 3. Hard prerequisites

| Prerequisite | Source | E6 handling |
|---|---|---|
| E2 implementation shipped | `asset_proposals`, `asset_proposal_clusters`, `asset_proposal_audit_log`, `ai_pipeline_settings` | E6 reads + writes these tables |
| E3 implementation shipped | engine writes ready rows; `cache.ts`, `cost.ts`, `models.ts`, `quota.ts`, `circuit-breaker.ts` exist; `users.ai_region` populated | E6's regenerate API route invokes the engine through E3's path |
| E4 implementation shipped | dispatcher + reaper + commit-service hook | E6's commit-time hydration depends on E4 having enqueued the proposal rows |
| E5 implementation shipped | clustering engine + `asset_proposal_clusters` populated; `dispatchBatchClusteringForProcessing` callable | E6's "Re-analyze" button calls into E5's dispatcher |
| V4 redesign on main | PR #15 merged | E6 reuses V4 components verbatim; only data sources change |
| `vault_assets.story_group_id` exists OR creator-side Story-group state model | TBD — depends on whether Story groups are local-only or server-persisted at PR 5 | E6 verifies before implementation; if Story groups are local-only at E6 ship, cluster acceptance creates a `V2StoryGroup` in the V3 state; if server-persisted, it writes to `vault_assets.story_group_id` (whatever that table is named — verify at implementation) |
| BP-D7 audit posture is locked | `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` | E6's new copy passes a BP-aligned review at PR open |

---

## 4. Scope boundary

E6 **does**:
- Add `src/lib/ai-suggestions/hydration.ts` — server-side function `hydrateBatchAiProposals(batchId)` returning `{ proposals: ProposalView[], clusters: ClusterView[] }` shaped for the V4 store
- Add API routes:
  - `GET  /api/v2/batch/[id]/ai-proposals` — bootstrap hydration
  - `POST /api/v2/asset/[id]/proposal/accept` — accept one or more fields (caption/keywords/tags); writes audit + canonical metadata
  - `POST /api/v2/asset/[id]/proposal/dismiss` — dismiss; writes audit
  - `POST /api/v2/asset/[id]/proposal/override` — explicit creator override; writes audit with before/after values
  - `POST /api/v2/asset/[id]/proposal/regenerate` — re-runs the engine for one asset; writes a new `proposal_generated` audit on completion
  - `POST /api/v2/cluster/[id]/accept` — accept a cluster; creates / writes Story group; sets `accepted_at` + `accepted_as_story_group_id`
  - `POST /api/v2/cluster/[id]/dismiss` — sets `dismissed_at`
  - `POST /api/v2/batch/[id]/reanalyze` — calls `dispatchBatchClusteringForProcessing` after preserving accepted clusters per E5 §6.3
- Add migration for `users.ai_suggestions_opt_out` (default false)
- Add migration for `ai_pipeline_settings.auto_accept_threshold` (default 0.85; per UX-SPEC-V4 IPV4-5)
- Extend `src/lib/ai-suggestions/settings.ts` to surface `auto_accept_threshold`
- Extend `src/lib/upload/v3-types.ts` `AssetProposal` to add per-field confidences + `keywords`; mark `priceSuggestion`, `privacySuggestion`, `licenceSuggestions` as **optional** + sourced-from-other-pillars (typed comment); mark `title` for removal in a follow-on
- Update `src/lib/upload/v2-simulation-engine.ts` to populate the new shape (mock-mode parity)
- Update `src/app/vault/upload/_components/inspector/InspectorAIProposalDetail.tsx` to read per-field confidences (display three rows instead of one overall)
- Update `src/app/vault/upload/_components/lib/computeAcceptAIDispatches.ts` to evaluate per-field 0.85 thresholds individually + drop `geography` (not from AI pipeline) AND add `keywords`
- Update `src/app/vault/upload/_components/AIProposalBanner.tsx` to consume `proposed_name` + synthesized rationale string
- Update `src/lib/upload/v2-simulation-engine.ts` to remove `title` from generated proposals
- Add poll-based proposal-refresh mechanism (or subscribe — design choice in §8.3)
- Add settings UI surface for `users.ai_suggestions_opt_out` (existing cog popover per UX-SPEC-V4 §13)
- Tests for each new module + integration tests for the full hydrate → display → mutate → audit flow

E6 **does not**:
- Redesign any V4 component (UX-SPEC-V4 visuals locked)
- Migrate `priceSuggestion` away from price engine simulation (F-track)
- Touch privacy / licence inference (separate pillar)
- Add a new realtime-pubsub infrastructure beyond what supabase-js already provides
- Activate `FFF_AI_REAL_PIPELINE` in any env (separate flag flip)
- Touch the V3 reducer parity contract (76 fixture-driven cases must stay green)
- Add new V3 actions (existing actions handle the mutations: `UPDATE_ASSET_FIELD`, `ACCEPT_AI_CLUSTER_PROPOSAL`, etc.) — E6 only changes how those actions translate to API calls in side-effects layer
- Schedule the existing `scripts/process-derivatives.ts` in production cron (PR 5)

---

## 5. Files added / touched / not touched

**Added:**

```
supabase/migrations/<TIMESTAMP>_users_ai_suggestions_opt_out.sql
supabase/migrations/<TIMESTAMP>_ai_pipeline_settings_auto_accept_threshold.sql
supabase/migrations/_rollbacks/<TIMESTAMP>_users_ai_suggestions_opt_out.DOWN.sql
supabase/migrations/_rollbacks/<TIMESTAMP>_ai_pipeline_settings_auto_accept_threshold.DOWN.sql

src/lib/ai-suggestions/
├── hydration.ts                       # server-side: hydrateBatchAiProposals(batchId)
├── proposal-mutations.ts              # writes for accept/override/dismiss + canonical metadata + audit
├── cluster-mutations.ts               # accept (creates Story group) + dismiss
└── __tests__/
    ├── hydration.test.ts
    ├── proposal-mutations.test.ts
    └── cluster-mutations.test.ts

src/app/api/v2/
├── batch/[id]/ai-proposals/route.ts          # GET — bootstrap hydration
├── batch/[id]/reanalyze/route.ts             # POST — kicks off Re-analyze
├── asset/[id]/proposal/accept/route.ts       # POST
├── asset/[id]/proposal/dismiss/route.ts      # POST
├── asset/[id]/proposal/override/route.ts     # POST
├── asset/[id]/proposal/regenerate/route.ts   # POST
├── cluster/[id]/accept/route.ts              # POST
└── cluster/[id]/dismiss/route.ts             # POST

src/app/api/v2/__tests__/
└── ai-proposal-routes.test.ts                # integration-shape tests for the 8 routes

src/app/vault/upload/_components/lib/
├── proposalApiClient.ts                      # client-side wrapper for the 8 API routes
└── __tests__/
    └── proposalApiClient.test.ts
```

**Touched:**

```
src/lib/ai-suggestions/settings.ts              # surface auto_accept_threshold from new column
src/lib/ai-suggestions/__tests__/settings.test.ts  # extend
src/lib/upload/v3-types.ts                      # widen AssetProposal (add per-field confidences + keywords; mark price/privacy/licence as optional + cross-pillar; deprecate title)
src/lib/upload/v3-state.ts                      # if any reducer logic depends on AssetProposal shape (audit at implementation; minimal change expected)
src/lib/upload/__tests__/v3-state.test.ts       # extend if reducer touched
src/lib/upload/v2-simulation-engine.ts          # populate new fields in mock mode; remove title generation
src/lib/upload/v2-simulation.ts                 # parallel sim source; same shape change
src/lib/upload/v2-mock-scenarios.ts             # update fixtures to new shape
src/app/vault/upload/_components/inspector/InspectorAIProposalDetail.tsx   # display per-field confidences
src/app/vault/upload/_components/AIProposalBanner.tsx                      # consume real cluster shape (proposed_name + synthesized rationale)
src/app/vault/upload/_components/lib/computeAcceptAIDispatches.ts          # per-field 0.85 evaluation; drop geography; add keywords
src/app/vault/upload/_components/lib/__tests__/computeAcceptAIDispatches.test.ts  # extend
src/app/vault/upload/_components/UploadShell.tsx                           # bootstrap hydration call on mount when FFF_AI_REAL_PIPELINE=true
src/app/vault/upload/_components/RightRailInspector.tsx                    # add Re-analyze affordance to overflow menu
docs/upload/UX-SPEC-V4.md                                                  # add IPV4-5 supplement: per-field thresholds (corrigendum + lock); §11.1 wording update for per-field gate
```

**Not touched:**

```
src/lib/ai-suggestions/engine.ts          # E3 owns
src/lib/ai-suggestions/cache.ts           # E3 owns
src/lib/ai-suggestions/clustering.ts      # E5 owns
src/lib/ai-suggestions/cluster-naming.ts  # E5 owns
src/lib/ai-suggestions/circuit-breaker.ts # E3 owns
src/lib/ai-suggestions/quota.ts           # E3 owns
src/lib/ai-suggestions/audit.ts           # E2 owns; E6 calls writeAuditEvent
src/lib/processing/dispatcher.ts          # E4 owns
src/lib/processing/proposal-dispatcher.ts # E4 owns
src/lib/processing/reaper.ts              # E4/E5 own
src/lib/processing/batch-clustering-dispatcher.ts # E5 owns
scripts/process-derivatives.ts            # E4/E5 own
src/lib/upload/commit-service.ts          # E4 owns the proposal-enqueue hook
src/lib/upload/batch-service.ts           # E5 owns the clustering-dispatch hook
src/lib/env.ts                            # no new flags
The 76 V3 reducer parity tests must stay green; reducer surface unchanged
```

---

## 6. Data shape reconciliation — locked

Two distinct mismatches between V4's `AssetProposal` and the AI-pipeline schema. E6 locks the resolution for each.

### 6.1 The four pillars feeding `V2Asset.proposal`

| Field on V4 `AssetProposal` | Source pillar | Status of source at E6 ship |
|---|---|---|
| `description` (caption) | AI pipeline (`asset_proposals.caption`) | E2/E3 shipped → real |
| `tags` | AI pipeline (`asset_proposals.tags`) | E2/E3 shipped → real |
| `priceSuggestion` | Price engine (Phase F) | F-track; possibly still simulation at E6 ship |
| `privacySuggestion` | Privacy inference (separate pillar; currently simulation) | Separate pillar; possibly still simulation at E6 ship |
| `licenceSuggestions` | Licence inference (separate pillar; currently simulation) | Separate pillar; possibly still simulation at E6 ship |
| `geography` | EXIF GPS extraction (existing; sits in `extracted_metadata.gps`) | Already real |
| `confidence` (overall) | **DOES NOT MAP CLEANLY** — schema has per-field confidences | §6.2 |
| `rationale` | **DOES NOT EXIST in AI schema** | §6.3 |
| `storyCandidates` | AI clustering (`asset_proposals.cluster_id` + `asset_proposal_clusters`) | E5 shipped → real |
| `title` | **DOES NOT EXIST in AI schema** (creator-authored or removed) | §6.6 |

### 6.2 Lock — per-field confidences replace single overall

`AssetProposal` widens to add three fields:

```typescript
// src/lib/upload/v3-types.ts (E6 extension)

export interface AssetProposal {
  // AI pipeline — per-field
  description: string | null
  description_confidence: number | null      // NEW — 0..1; from asset_proposals.caption_confidence
  keywords: string[]                          // NEW — from asset_proposals.keywords
  keywords_confidence: number | null          // NEW
  tags: string[]
  tags_confidence: number | null              // NEW

  // AI pipeline — cluster
  cluster_id: string | null                   // NEW — from asset_proposals.cluster_id
  cluster_confidence: number | null           // NEW — silhouette score from cluster
  storyCandidates: StoryCandidate[]           // existing — derived from cluster_id

  // Cross-pillar (optional; sources migrate independently)
  priceSuggestion?: PriceSuggestion           // OPTIONAL; from price engine; keep simulation until F-track lands
  privacySuggestion?: PrivacySuggestion       // OPTIONAL; separate pillar
  licenceSuggestions?: LicenceSuggestion[]    // OPTIONAL; separate pillar
  geography?: string[]                        // OPTIONAL; from extracted_metadata.gps; NOT AI

  // Display / synthesized
  rationale: string | null                    // synthesized at hydration (§6.3)

  // DEPRECATED for AI track; retained as nullable for V4 visual contract — fed by null when no creator title
  title?: string | null

  // OBSOLETE — single overall confidence; retained for backward-compat during migration; populated as MAX(per-field) for V4 components that haven't yet been updated
  /** @deprecated use per-field confidences */
  confidence: number
}
```

V4 components that currently read `proposal.confidence` (single number) continue to work — `confidence` is populated as `Math.max(description_confidence ?? 0, tags_confidence ?? 0)` during hydration. E6 updates `InspectorAIProposalDetail.tsx` to surface the three-row per-field display per UX-SPEC-V4 §11 reading. Other consumers of `confidence` are updated in the same PR or marked for follow-on.

### 6.3 Lock — `rationale` is synthesized

The AI schema doesn't store a rationale. The simulation generated rich rationales as bunk for storytelling. Production E6 synthesizes a short rationale at hydration time:

For per-asset proposals:
```typescript
// hydration.ts — synthesized per-asset rationale
function synthesizeAssetRationale(proposal: ProposalRecord): string | null {
  if (proposal.generation_status !== 'ready') return null
  const lowConfFields: string[] = []
  if ((proposal.caption_confidence ?? 1) < 0.5) lowConfFields.push('caption')
  if ((proposal.keywords_confidence ?? 1) < 0.5) lowConfFields.push('keywords')
  if ((proposal.tags_confidence ?? 1) < 0.5) lowConfFields.push('tags')
  if (lowConfFields.length === 0) {
    return null  // high confidence — no caveat needed
  }
  return `Lower confidence on: ${lowConfFields.join(', ')}.`
}
```

For clusters:
```typescript
// hydration.ts — synthesized cluster rationale
function synthesizeClusterRationale(cluster: ClusterRecord, dateRangeText: string): string {
  return `${cluster.asset_count} assets, ${dateRangeText}. Silhouette ${(cluster.silhouette_score ?? 0).toFixed(2)}.`
}
```

Neither generates new prose — both are deterministic factual summaries from existing schema columns. **No "AI thinks this is..." language; no rationalization. Aligns with BP-D7 + E1 v2 §7.1.**

### 6.4 Lock — cluster banner consumes real shape

`state.aiClusterProposals` shape stays the same to preserve V4 component contract. Hydration fills it from `asset_proposal_clusters`:

```typescript
// hydration.ts
async function hydrateClusters(batchId: string): Promise<AIClusterProposal[]> {
  const { data: clusters } = await supabase
    .from('asset_proposal_clusters')
    .select(`
      id, proposed_name, asset_count, silhouette_score, region, generated_at,
      asset_proposals!inner(asset_id, caption, vault_assets!inner(captured_at))
    `)
    .eq('batch_id', batchId)
    .is('accepted_at', null)
    .is('dismissed_at', null)

  return clusters.map(c => {
    const memberAssetIds = c.asset_proposals.map(ap => ap.asset_id)
    const dates = c.asset_proposals.map(ap => ap.vault_assets?.captured_at).filter(Boolean)
    const dateRangeText = formatDateRange(dates)
    return {
      proposalId: c.id,
      clusterName: c.proposed_name ?? dateRangeText,
      proposedAssetIds: memberAssetIds,
      rationale: synthesizeClusterRationale(c, dateRangeText),
      confidence: c.silhouette_score ?? 0,
      status: 'pending' as const,
    }
  })
}
```

`proposalId` becomes the cluster UUID; `clusterName` falls back to `dateRangeText` if `proposed_name` is null (e.g., naming failed); `rationale` is the synthesized factual summary.

### 6.5 Lock — `geography` removed from ✓ AI bulk dispatch

`computeAcceptAIDispatches.ts` currently writes `geography` from `proposal.geography`. Per the audit, geography comes from EXIF GPS extraction, NOT the AI pipeline. The ✓ AI bulk button intent (per UX-SPEC-V4 §9.4) is "accept AI suggestions" — geography from EXIF isn't an AI suggestion; it's already-extracted metadata.

E6 removes `geography` from `computeAcceptAIDispatches`. Geography continues to be applied via the existing extraction-time hydration path (the field just appears pre-filled because EXIF GPS was extracted at upload).

UX-SPEC-V4 §9.4 lists "caption + tags + geography" — this gets a small corrigendum: ✓ AI sequences `caption + keywords + tags`. Geography stays, but is not part of ✓ AI.

### 6.6 Lock — `title` deprecated as AI field

`title` doesn't appear in the AI schema and isn't generated by Vertex Vision (caption is the closest equivalent). The simulation generated titles as bunk. E6 stops populating `title` from the proposal layer; the field remains as a creator-authored optional metadata column on `vault_assets` (separate column; E6 doesn't touch it).

`AssetProposal.title` becomes `string | null` and is populated as `null` from real hydration. The mock simulation can keep generating bunk titles for parity — but the type indicates it's not AI-derived.

UX-SPEC-V4 doesn't mention proposal-derived titles; this is not a spec drift, just a simulation-specific bunk field that production hydration drops.

---

## 7. API routes

All routes server-side, service-role-only at the DB layer; the route handlers wrap with creator session validation (existing `x-creator-id` header per the v2 batch route precedent).

### 7.1 `GET /api/v2/batch/[id]/ai-proposals`

Returns `{ proposals: ProposalView[], clusters: ClusterView[] }` for the named batch. Validates the requesting creator owns the batch.

```typescript
export interface ProposalView {
  asset_id: string
  generation_status: 'pending' | 'processing' | 'ready' | 'failed' | 'not_applicable'
  caption: string | null
  caption_confidence: number | null
  keywords: string[] | null
  keywords_confidence: number | null
  tags: string[] | null
  tags_confidence: number | null
  cluster_id: string | null
  cluster_confidence: number | null
  rationale: string | null
}

export interface ClusterView {
  id: string
  proposed_name: string | null
  asset_count: number
  silhouette_score: number | null
  member_asset_ids: string[]
  rationale: string
}
```

Response is a snapshot at request time. The UI re-fetches on focus (or polls; see §8.3).

### 7.2 `POST /api/v2/asset/[id]/proposal/accept`

Body: `{ fields: ('caption' | 'keywords' | 'tags')[], surface: 'upload' | 'vault_edit' | 'bulk_action' }`

Per accepted field:
- Read current `asset_proposals` row → get the proposed value
- Read current `vault_assets` row → get the existing canonical value (for the `before_value` of the audit)
- UPDATE `vault_assets` SET that field = the proposed value
- Write `asset_proposal_audit_log` event_type='proposal_accepted' with `field_name`, `before_value` (the prior canonical), `after_value` (the new canonical), `surface`

If `fields` is empty, returns 400. If asset not found or not owned by creator, returns 404 / 403.

### 7.3 `POST /api/v2/asset/[id]/proposal/override`

Body: `{ field: 'caption' | 'keywords' | 'tags', value: string | string[], surface, override_reason?: string }`

The creator typed something different from the proposal. Writes:
- UPDATE `vault_assets` SET that field = the new value
- Write `asset_proposal_audit_log` event_type='proposal_overridden' with `field_name`, `before_value` (the proposed value), `after_value` (the typed value), `surface`, `override_reason`

### 7.4 `POST /api/v2/asset/[id]/proposal/dismiss`

Body: `{ field?: 'caption' | 'keywords' | 'tags', surface }` — if `field` omitted, dismisses all unaccepted fields for the asset.

Writes:
- UPDATE `asset_proposals` set… (no — dismiss is logged in audit only; the proposal row stays. UI hides dismissed fields by checking the audit log on hydration. Or, alternatively, an explicit `dismissed_fields TEXT[]` column on `asset_proposals` — §6 follow-on if simpler.)
- Write `asset_proposal_audit_log` event_type='proposal_dismissed' with `field_name`, `surface`, `before_value` = the proposed value (so the UI can reconstruct what was dismissed)

(E6 implementation picks the storage approach at implementation; the directive notes both options. Prefer audit-log-only because the proposal row is then idempotent / not creator-mutable.)

### 7.5 `POST /api/v2/asset/[id]/proposal/regenerate`

Body: `{ surface }`

Writes the `asset_proposals` row back to `generation_status='pending'`, `retry_count=0`, fields cleared. Calls `dispatchAssetProposalForProcessing(assetId, storage)` fire-and-forget. Returns 202 with the asset_id.

The UI polls (or refetches on focus) and the new proposal appears once the worker completes.

Also writes `audit_log.event_type='ai.gemini.regenerate_requested'` with the surface.

### 7.6 `POST /api/v2/cluster/[id]/accept`

Body: `{ surface }`

Per E5 §6.3: creates a Story group. Implementation depends on Story-group state model:
- If Story groups are server-persisted (table exists): INSERT a row; UPDATE `asset_proposal_clusters` SET `accepted_at = now()`, `accepted_as_story_group_id = ...`; UPDATE member `vault_assets` SET `story_group_id = ...`
- If Story groups are local-state only at E6 ship: only UPDATE `asset_proposal_clusters` SET `accepted_at = now()`; the V3 reducer creates the local Story group; `accepted_as_story_group_id` is left NULL until the Story-group server model lands

Both paths write `asset_proposal_audit_log` event_type='cluster_accepted' for each member asset.

### 7.7 `POST /api/v2/cluster/[id]/dismiss`

Body: `{ surface }`

UPDATE `asset_proposal_clusters` SET `dismissed_at = now()`. UPDATE all member `asset_proposals` SET `cluster_id = NULL` (ON DELETE SET NULL handles this if the row is deleted; soft-dismiss preserves the row for audit). Write audit events for each member.

### 7.8 `POST /api/v2/batch/[id]/reanalyze`

Body: `{}` (just the batch ID in path)

Per E5 §6.3:
- DELETE pending (un-accepted, un-dismissed) clusters for the batch
- UPDATE `upload_batches` SET `clustering_started_at = NULL` (reset claim per E5 §10.2)
- Call `dispatchBatchClusteringForProcessing(batchId, storage)` fire-and-forget
- Return 202

Member-level: assets in the deleted pending clusters get `cluster_id = NULL`. Accepted clusters preserved.

---

## 8. Hydration

### 8.1 Server-side: `hydrateBatchAiProposals(batchId)`

Single function, two queries:
1. `SELECT * FROM asset_proposals WHERE asset_id IN (SELECT id FROM vault_assets WHERE batch_id = $1)` — returns one row per asset
2. The cluster query from §6.4 — returns clusters + member IDs

Combines into the `{ proposals: ProposalView[], clusters: ClusterView[] }` shape.

### 8.2 Client-side bootstrap

`UploadShell.tsx` on mount:
- If `flags.aiRealPipeline === true` → fetch `/api/v2/batch/[id]/ai-proposals`; merge into V3 state via existing actions (`HYDRATE_ASSETS`, `HYDRATE_CLUSTER_PROPOSALS` — verify against current reducer; add if missing)
- If false → simulation path runs as today (preserves dev workflow)

### 8.3 Refresh strategy — pick one at implementation

| Approach | Pro | Con | Recommendation |
|---|---|---|---|
| Polling every 5s while batch has `pending` or `processing` proposals | Simple; no infrastructure; predictable | Bandwidth; latency up to 5s | ✓ Default |
| Refetch on tab focus | Cheap; refresh when user re-engages | No live progress while user watches | Combined with polling |
| Supabase realtime subscription on `asset_proposals` filtered by batch's asset IDs | Live; idiomatic Supabase | RLS interaction with realtime is fragile (service-role only); requires subscription teardown | Only if polling proves expensive |
| Server-Sent Events from a custom endpoint | Live; controlled | Custom infra | Avoid for v1 |

Recommendation: polling (5s while any pending/processing proposals exist; stop when all ready/failed/not_applicable) + refetch on tab focus. Combined latency ~5s worst case; bandwidth is a tiny JSON per poll.

### 8.4 Empty + error states

- Batch has zero ready proposals (all pending) → UI surfaces a small "AI suggestions are still being generated…" affordance in the inspector + status dot stays muted
- Hydration request fails (network) → V4 falls back to "no proposal data" shape; the UI degrades gracefully (no proposals shown)
- Single asset proposal failed (`generation_status='failed'`) → the inspector shows a "Generate AI suggestions" affordance instead of proposal data; click → calls regenerate API
- Asset is non-image (`generation_status='not_applicable'`) → no affordance; AI proposal section is absent from the inspector for this asset

---

## 9. Auto-accept threshold — per-field

UX-SPEC-V4 §11.1 + IPV4-5 lock the auto-accept threshold at 0.85 against a single overall confidence. E6 reconciles to per-field per the schema:

```typescript
// src/app/vault/upload/_components/UploadShell.tsx (or wherever hydrateV3FromV2State runs)

function autoAcceptHighConfidence(asset: V2Asset, settings: { auto_accept_threshold: number }) {
  if (!asset.proposal) return asset
  const t = settings.auto_accept_threshold

  const updates: Partial<V2Asset['editable']> = {}
  if (asset.proposal.description_confidence != null && asset.proposal.description_confidence >= t) {
    if (asset.proposal.description != null) updates.description = asset.proposal.description
  }
  if (asset.proposal.keywords_confidence != null && asset.proposal.keywords_confidence >= t) {
    if (asset.proposal.keywords != null) updates.keywords = asset.proposal.keywords
  }
  if (asset.proposal.tags_confidence != null && asset.proposal.tags_confidence >= t) {
    updates.tags = asset.proposal.tags
  }
  return { ...asset, editable: { ...asset.editable, ...updates } }
}
```

`auto_accept_threshold` lives in `ai_pipeline_settings` (new column; default 0.85; founder-tunable). Surfaced through `getEffectiveSettings()` (E2's reader, extended).

**No threshold for clusters in v1.** Cluster surfacing uses `silhouette_score >= confidence_floor_silhouette` (E5 §5.1) which is the 0.30 floor; auto-acceptance of a cluster (creating a Story group without creator action) is **not** a v1 behavior — clusters always require explicit creator accept (per E1 v2 §4.6 + §7.1).

UX-SPEC-V4 §11.1 + IPV4-5 wording gets a small corrigendum: "auto-accept where field-level confidence ≥ 0.85" instead of "where overall confidence ≥ 0.85." E6 ships this corrigendum inline.

---

## 10. Audit log writes — exhaustive

Every UI mutation writes to `asset_proposal_audit_log` (per E2 §4 schema). The `surface` field captures where the action originated:

| Action | event_type | field_name | surface |
|---|---|---|---|
| Hydration auto-accept (per-field ≥ threshold) | `proposal_accepted` | the field | `'system'` |
| Inspector ✓ click on a field | `proposal_accepted` | the field | `'upload'` or `'vault_edit'` |
| Inspector creator types over a proposed value | `proposal_overridden` | the field | `'upload'` or `'vault_edit'` |
| Inspector dismiss-field (or section-level dismiss) | `proposal_dismissed` | the field (or null) | `'upload'` or `'vault_edit'` |
| Contextual action bar ✓ AI button (multi-select bulk accept) | `proposal_accepted` | each field per asset | `'bulk_action'` |
| Cluster banner Accept | `cluster_accepted` | null | `'upload'` |
| Cluster banner Dismiss | `cluster_dismissed` | null | `'upload'` |
| Inspector "Regenerate" per field | `proposal_dismissed` (the prior) + audit_log `ai.gemini.regenerate_requested` | the field | `'upload'` or `'vault_edit'` |
| "Re-analyze this session" | (cluster-level effects logged as `cluster_dismissed` for pending clusters) + audit_log `ai.clustering.batch_reanalyze_requested` | null | `'upload'` |

System-grain events (`ai.gemini.regenerate_requested`, `ai.clustering.batch_reanalyze_requested`) go to `audit_log` (the shipped general-purpose table), not `asset_proposal_audit_log` (the field-grain table).

The audit log is append-only at the application layer; no DELETE or UPDATE on these rows. A creator who dismisses then re-accepts produces two rows, in time order.

---

## 11. "Re-analyze this session" surface

UX-SPEC-V4 §11.4 mentions the cluster banner but doesn't pin the Re-analyze surface. E6 picks: a small affordance in the right-rail inspector's overflow menu (or a button in the session-defaults popover per UX-SPEC-V4 §13). At implementation time, the placement is verified against the V4 spec — if neither lands cleanly, a small UX-SPEC-V4 supplement is composed.

Action wires to `POST /api/v2/batch/[id]/reanalyze`.

UI feedback: the banner re-renders within ~5s as polling picks up the new clusters. A toast `"Re-analyzing this session…"` is shown at click time.

---

## 12. Per-creator opt-out

### 12.1 Migration

```sql
-- supabase/migrations/<TIMESTAMP>_users_ai_suggestions_opt_out.sql

ALTER TABLE users
  ADD COLUMN ai_suggestions_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.ai_suggestions_opt_out IS
  'E6: when TRUE, AI proposal UI surfaces are hidden for this creator. The worker still runs (per E1 v2 §7.3 — preserves data for analytics), but no proposal affordances appear in the upload UI. Default FALSE.';
```

### 12.2 UI surface

The session-defaults popover (UX-SPEC-V4 §13) gains a checkbox: "Show AI suggestions during upload." Default checked. Persists to `users.ai_suggestions_opt_out` via a new endpoint or the existing user-prefs endpoint (verify at implementation).

### 12.3 Hydration interaction

When `users.ai_suggestions_opt_out = TRUE` for the requesting creator, `hydrateBatchAiProposals(batchId)` returns:
```typescript
{ proposals: [], clusters: [] }
```

Empty arrays. The V4 components render their empty/none paths. The pipeline still runs; the data exists in the DB; the UI just doesn't show it. Re-enabling is instant — next hydration call returns full data.

---

## 13. Trust + language discipline

All new copy in E6 must align with BP-D7 audit + E1 v2 §7.1. Specifically:

| Allowed | Forbidden |
|---|---|
| "AI suggestion" | "AI-verified" |
| "AI thinks this is..." | "AI-validated" |
| "AI-flagged for review" | "AI-certified" |
| "Suggested caption" | "Confirmed by AI" |
| "Review AI suggestion" | "AI-approved" |
| "Re-analyze this session" | "Re-validate" |

The synthesized rationale strings (§6.3) are deliberately **factual** ("Lower confidence on: caption, tags." / "5 assets, Mar 14–16, 2026. Silhouette 0.34.") — no editorialising, no certification language.

The regenerate confirmation: "Regenerate AI suggestions for this asset?" (allowed). NOT "Re-validate AI suggestions" (forbidden).

The cluster-accept confirmation: "Accept these 5 assets as a Story group called 'Spring Festival'?" (allowed). NOT "Confirm AI-detected story" (forbidden).

A pre-merge BP-D7-aligned copy review is the §15 approval gate.

---

## 14. Tests

### 14.1 Coverage matrix

| File | Coverage |
|---|---|
| `hydration.test.ts` | Empty batch returns empty arrays; ready proposals shape correctly; pending proposals included with null content; clusters with members; opt-out returns empty; orphan proposals (cluster deleted but cluster_id stale) handled |
| `proposal-mutations.test.ts` | accept writes vault_assets + audit; override writes audit with before/after; dismiss writes audit only; regenerate resets row + fires dispatch; per-field validation; opt-out check; non-owning creator → 403 |
| `cluster-mutations.test.ts` | accept writes cluster + member assets; dismiss soft-deletes; non-owning creator → 403 |
| `ai-proposal-routes.test.ts` | All 8 routes: 200 happy paths; 400 missing/invalid body; 403 wrong creator; 404 missing resource; 503 when FFF_AI_REAL_PIPELINE=false |
| `proposalApiClient.test.ts` | Each client wrapper: builds correct request; surfaces errors typed |
| `computeAcceptAIDispatches.test.ts` (extend) | per-field 0.85 evaluation: only fields ≥ threshold included; geography removed; keywords added |
| `InspectorAIProposalDetail.test.tsx` (new) | Renders three confidence rows when proposal ready; renders "still generating" when pending; renders "Generate AI suggestions" when failed |
| `AIProposalBanner.test.tsx` (extend) | Synthesized rationale displays; member count + date range render; accept dispatch fires API call |
| `UploadShell.test.tsx` (extend) | Bootstrap hydration on mount when FFF_AI_REAL_PIPELINE=true; simulation path when false; auto-accept per-field threshold runs |
| `v3-state.test.ts` (76 parity cases) | Stay green; widening AssetProposal must not break parity |
| `settings.test.ts` (extend) | auto_accept_threshold surfaced; default 0.85 in fresh DB |

### 14.2 Test infrastructure

- API route tests use the existing v2 batch route test pattern (`req.headers.get('x-creator-id')` mock; service-role supabase client mock)
- Client wrapper tests mock `fetch`
- Component tests use the existing V4 testing setup (vitest + React Testing Library if present; otherwise pure renderer-shape tests)
- Auto-accept threshold tests use `scopeEnvVars` for `FFF_AI_REAL_PIPELINE`

### 14.3 Test count target

10-12 new test files; ~80-100 cases total. Bounded.

### 14.4 Reducer parity

The 76 V3 fixture-driven parity tests in `v3-state.test.ts` MUST stay green. Widening `AssetProposal` is additive (new optional fields + new fields with `| null`). No existing fixture should break. **If any do, that's a parity regression and the directive's data-shape change needs revision.**

---

## 15. Verification gates

Before merge:

```bash
# 1. tsc clean
npx tsc --noEmit 2>&1 | grep -cE "error TS"
# Expected: 0 (post PR #16 baseline)

# 2. vitest green (including 76 V3 parity tests)
bun run test 2>&1 | tail -10
# Expected: previous baseline + ~80-100 new cases all passing

# 3. Migrations apply cleanly
supabase db reset
supabase db push
psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='users' AND column_name='ai_suggestions_opt_out';
"
# Expected: 1 row

psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_pipeline_settings' AND column_name='auto_accept_threshold';
"
# Expected: 1 row

# 4. Build green; new API routes registered
bun run build 2>&1 | tail -20
# Expected: 8 new /api/v2/* routes appear in the build output

# 5. Hydration smoke (engineer-local, not CI)
FFF_AI_REAL_PIPELINE=true \
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json \
GOOGLE_CLOUD_PROJECT_ID=frontfiles-prod \
bun run dev
# Open /vault/upload, create a batch with image assets, commit, observe:
# - asset_proposals rows fill in (E4 worker)
# - asset_proposal_clusters rows appear after batch commit (E5 worker)
# - inspector shows real per-field confidences
# - cluster banner shows real cluster name + synthesized rationale
# - ✓ AI bulk button updates vault_assets + writes asset_proposal_audit_log
# - ↻ regenerate triggers re-run + UI refresh

# 6. BP-D7 copy review
# Manual: walk through every new copy string + prompt and confirm
# none uses "AI-verified" / "validated" / "certified" / "approved" / "confirmed by AI"

# 7. Reducer parity
bun run test src/lib/upload/__tests__/v3-state.test.ts 2>&1 | tail -3
# Expected: 76/76 pass (no regression from AssetProposal widening)

# 8. Rollback works (both new migrations)
psql "$DATABASE_URL" -f supabase/migrations/_rollbacks/<TIMESTAMP>_users_ai_suggestions_opt_out.DOWN.sql
psql "$DATABASE_URL" -c "\d users" | grep -c ai_suggestions_opt_out
# Expected: 0
# Then re-apply forward
```

---

## 16. Approval gate

Founder reviews PR before merge. Specifically verify:

| Item | Approved means |
|---|---|
| E2 + E3 + E4 + E5 implementations are merged | E6 hard-prerequisites met |
| `AssetProposal` widening doesn't break the 76 V3 parity tests | Reducer parity preserved |
| All 8 API routes have integration-shape tests | Coverage matrix §14.1 honored |
| Per-field auto-accept (NOT single overall confidence) | §9 lock |
| Geography removed from ✓ AI bulk dispatch | §6.5 lock |
| `title` not populated by hydration | §6.6 lock |
| Synthesized rationales are factual (§6.3 examples) | No "AI thinks this is..." in production output |
| BP-D7 copy review passes | All new strings audited |
| `users.ai_suggestions_opt_out` defaults FALSE | Existing creators get suggestions until they opt out |
| `auto_accept_threshold` defaults 0.85 | Per UX-SPEC-V4 IPV4-5 |
| UX-SPEC-V4 §11.1 + §9.4 corrigendum included inline | Per-field auto-accept; ✓ AI = caption + keywords + tags (geography removed) |
| Rollback works for both migrations | Verification gate #8 |

Founder's options:
1. **Approve + merge** — AI-track architecture phase complete; production cutover is the FFF_AI_REAL_PIPELINE flag flip
2. **Approve with corrections** — name the diff
3. **Revise** — substantive concern
4. **Reject** — would mean E1 v2 / E1.5 / E2 / E3 / E4 / E5 were wrong, not E6

---

## 17. Don't-do list

1. **Don't redesign any V4 component.** UX-SPEC-V4 visuals are locked. E6 changes data sources, not visuals.
2. **Don't activate `FFF_AI_REAL_PIPELINE` in any deployed env.** Production cutover is a separate flag flip after E6 ships.
3. **Don't break the 76 V3 reducer parity tests.** Widening `AssetProposal` is additive; if any parity test fails, the data-shape change needs revision.
4. **Don't write to `vault_assets` from anywhere except the accept/override API routes.** All other reads/writes go through `asset_proposals`.
5. **Don't put `title` back as an AI field.** Per §6.6: caption ≠ title.
6. **Don't sequence `geography` in ✓ AI dispatches.** Per §6.5: geography is from EXIF, not AI.
7. **Don't introduce a single `confidence` value at hydration.** Per §6.2: per-field confidences. The deprecated `confidence` field on `AssetProposal` is populated as MAX-of-fields ONLY for backward-compat with components that haven't been updated; new code reads per-field directly.
8. **Don't use authoritative or certifying language.** Per §13 + BP-D7. Pre-merge copy review is mandatory.
9. **Don't bypass `asset_proposal_audit_log` on any UI mutation.** Per §10: every accept/override/dismiss/regenerate writes an audit row.
10. **Don't auto-accept clusters.** Per §9: clusters always require explicit creator action.
11. **Don't expose AI cost to creators.** Per E1 v2 §7.3: platform-paid in v1; cost not surfaced in any UI.
12. **Don't introduce a second proposal-storage layer.** The schema is `asset_proposals` (per-asset) + `asset_proposal_clusters` (per-cluster). UI state is a hydration of these; not a parallel store.
13. **Don't activate realtime subscriptions in this directive.** Polling is the v1 strategy per §8.3. Subscriptions are v2 enrichment if polling proves expensive.
14. **Don't merge E6 before E2 + E3 + E4 + E5 ship.** All four are hard prerequisites.
15. **Don't ship with `users.ai_suggestions_opt_out` defaulting TRUE.** Default FALSE per §12.
16. **Don't bypass the creator session check on any API route.** Every route validates `x-creator-id` matches the resource's creator.
17. **Don't migrate `priceSuggestion` here.** F-track owns the price engine; E6's `AssetProposal` shape keeps it as optional + cross-pillar.

---

## 18. Out of scope (deferred)

| Concern | Lands in |
|---|---|
| Production cutover (`FFF_AI_REAL_PIPELINE=true` in deployed env) | PR 5 / staging cutover |
| Realtime subscription replacement of polling | v2 enrichment if polling proves expensive |
| Per-creator confidence threshold customization | v2 enrichment |
| Server-persisted Story groups (vs local-state) | Story-group pillar (separate track) |
| Cost surfacing to creators | v2 enrichment per E1 v2 §7.3 (deliberately deferred) |
| `proposal_shown` view-tracking event | v2 enrichment per E1 v2 §7.2 |
| Onboarding for `users.ai_region` (set at signup) | CCP 7 / Phase 4.B onboarding (out of E6 scope) |
| Multimodal embedding migration (`multimodalembedding@001`) | v2 enrichment per E1.5 §10.5 (separate directive) |
| Per-creator-locale cluster naming | v2 enrichment per E1.5 §13 item 6 |
| Privacy / licence inference real implementation | Separate pillar per pillar; not E6 |
| Title generation by AI | Not in v1; possibly v2 (would require new prompt + new schema field) |

---

## 19. References

- E1 v2: `src/lib/processing/AI-PIPELINE-BRIEF.md`
- E1.5: `src/lib/processing/AI-PIPELINE-ARCHITECTURE.md`
- E2: `src/lib/processing/E2-DIRECTIVE.md` (schema)
- E3: `src/lib/processing/E3-DIRECTIVE.md` (engine + cost + circuit + quota)
- E4: `src/lib/processing/E4-DIRECTIVE.md` (worker integration)
- E5: `src/lib/processing/E5-DIRECTIVE.md` (clustering)
- UX-SPEC-V4: `docs/upload/UX-SPEC-V4.md` (Founder Lock + §9 contextual action bar + §11 AI proposal surfacing + §13 settings popover + IPV4-5 auto-accept threshold)
- UX-BRIEF v3: `docs/upload/UX-BRIEF.md` (§4.4 surfacing)
- BP-D7 audit: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`
- V3 reducer parity contract: `src/lib/upload/__tests__/v3-state.test.ts` (76 cases)
- V4 components: `src/app/vault/upload/_components/` (esp. AIProposalBanner, InspectorAIProposalDetail, computeAcceptAIDispatches, UploadShell, RightRailInspector)
- INTEGRATION_READINESS.md v2 — D6/D7/D8/D9
- PLATFORM_REVIEWS.md v2 — D-U2

---

End of E6 directive.
