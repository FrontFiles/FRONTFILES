/**
 * Frontfiles Upload V3 — Page Surface (C2.1)
 *
 * Spec: UX-SPEC-V3.md §2 + C2.1-DIRECTIVE §3.2.
 *
 * Server component shell. Generates batch id server-side and hands it to
 * the client shell. The client shell computes V3 initial state via
 * useReducer's initializer — keeps non-serializable fields (e.g.
 * V2Asset.file: File | null) out of the server→client boundary.
 *
 * Wraps in CreatorGate (preserves auth-gating from the previous
 * UploadShellV2 production routing).
 *
 * No new feature flag at this surface — upload is on the standard
 * production path. PR 5 introduces the real `FFF_REAL_UPLOAD` cutover
 * gating for the network calls, not the page surface.
 */

import { CreatorGate } from '@/components/platform/CreatorGate'
import UploadShell from './_components/UploadShell'

export const dynamic = 'force-dynamic'

export default function UploadPage() {
  // C2.1: empty batch with a fresh id. PR 5 wires real batch loading.
  const batchId = `batch_${Date.now().toString(36)}`
  return (
    <CreatorGate tool="Upload">
      <div className="flex-1 bg-white flex flex-col">
        <UploadShell batchId={batchId} />
      </div>
    </CreatorGate>
  )
}
