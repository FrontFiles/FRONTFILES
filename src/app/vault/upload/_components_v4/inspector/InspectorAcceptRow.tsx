/**
 * Frontfiles Upload V4 — Inspector AcceptRow (D2.4 §1.1, IPD4-10 = a)
 *
 * Spec: UX-SPEC-V4 §11.2 (per-field ✓ + ↻ live ONLY in the inspector).
 *
 * Extracted helper for the (✓, ↻) button pair shown beside any editable
 * field that has a non-accepted AI suggestion. Same shape as C2.6's
 * AcceptRow inside the dormant SideDetailPanel; copied forward per
 * IPD4-1 = (a) (no cross-import from dormant code).
 *
 * Per UX-SPEC-V4 §11.1: high-confidence proposals auto-accepted at
 * hydration time (D2.1 sweep). This row only renders for low-confidence
 * fields where the user still needs to decide.
 */

'use client'

interface Props {
  onAccept: () => void
  onRegen: () => void
  regenerating: boolean
  acceptTitle: string
}

export default function InspectorAcceptRow({
  onAccept,
  onRegen,
  regenerating,
  acceptTitle,
}: Props) {
  return (
    <div className="flex flex-row gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={onAccept}
        title={acceptTitle}
        className="border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-black hover:bg-black hover:text-white transition-colors"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onRegen}
        disabled={regenerating}
        title="Regenerate AI suggestion"
        className={`border border-black px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-200 transition-colors ${
          regenerating ? 'opacity-60 cursor-wait' : ''
        }`}
      >
        {regenerating ? '⟳' : '↻'}
      </button>
    </div>
  )
}
