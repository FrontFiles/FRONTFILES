/**
 * Frontfiles Upload V4 — Page Surface (D2.1; dev-only fixture loader carried over from C2.2)
 *
 * Spec: UX-SPEC-V4.md §2 + D2.1-DIRECTIVE §6.1.
 *
 * Server component shell. Generates batch id server-side and hands it
 * to the client shell. Wraps in CreatorGate (preserves auth-gating).
 *
 * DEV-ONLY FIXTURE LOADER (C2.2 follow-up):
 *   In development, accepts `?scenario=<scenarioId>` query param to
 *   hydrate a known mock scenario (e.g. archive_150_mixed). Validates
 *   against SCENARIO_IDS; invalid IDs silently fall through to empty
 *   batch. Production builds ignore the param entirely.
 *
 * Why this is dev-only: the production upload flow always starts from
 * an empty batch (real assets come from drag-drop). The fixture loader
 * exists for C2.2-C2.5 visual verification — see all 4 density modes,
 * accordion behavior, filter bar, bulk ops bar in action.
 */

import { CreatorGate } from '@/components/platform/CreatorGate'
// D2.1: imports the V4 shell from ./_components/UploadShell. The C2 V3
// shell that previously lived at this path was REPLACED (not moved aside)
// per D2.1 §8 dormant-flag pass — see UploadShell.tsx line 7. To revert to
// the C2 V3 implementation, check out the pre-D2.1 git history of
// ./_components/UploadShell.tsx.
import UploadShell from './_components/UploadShell'
import { SCENARIO_IDS, type ScenarioId } from '@/lib/upload/v2-scenario-registry'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  scenario?: string | string[]
  simulateFailure?: string | string[]
  seedBanners?: string | string[]
}>

export default async function UploadPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const batchId = `batch_${Date.now().toString(36)}`

  // Dev-only scenario param. Production ignores it.
  let devScenarioId: ScenarioId | null = null
  if (process.env.NODE_ENV === 'development') {
    const raw = typeof params.scenario === 'string' ? params.scenario : null
    if (raw && (SCENARIO_IDS as readonly string[]).includes(raw)) {
      devScenarioId = raw as ScenarioId
    }
  }

  // Dev-only commit-failure injection per C2.4 IPIV-5. Honored only when
  // NODE_ENV === 'development' AND the param parses to a positive integer.
  // Used for visual QA of CommitErrorPanel without a real network failure.
  let devSimulateFailure: number | null = null
  if (process.env.NODE_ENV === 'development') {
    const raw = typeof params.simulateFailure === 'string' ? params.simulateFailure : null
    if (raw) {
      const n = parseInt(raw, 10)
      if (Number.isFinite(n) && n > 0) devSimulateFailure = n
    }
  }

  // Dev-only AI cluster banner seeding per C2.5 IPV-5. Honored only when
  // NODE_ENV === 'development' AND `?seedBanners=1` is present. Used for
  // visual QA of AIProposalBanner without a real AI pipeline.
  let devSeedBanners = false
  if (process.env.NODE_ENV === 'development') {
    const raw = typeof params.seedBanners === 'string' ? params.seedBanners : null
    if (raw === '1' || raw === 'true') devSeedBanners = true
  }

  return (
    <CreatorGate tool="Upload">
      {/* D2.5b: min-h-0 is REQUIRED. Without it, this flex-1 child of body
          (flex flex-col) gets min-height: auto = its content size, which
          lets descendants grow beyond viewport bounds and breaks the
          right-rail inspector's overflow-y-auto scroll chain. */}
      <div className="flex-1 bg-white flex flex-col min-h-0">
        <UploadShell
          batchId={batchId}
          devScenarioId={devScenarioId}
          devSimulateFailure={devSimulateFailure}
          devSeedBanners={devSeedBanners}
        />
      </div>
    </CreatorGate>
  )
}
