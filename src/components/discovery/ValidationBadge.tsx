import type { ValidationDeclaration } from '@/data'

const labels: Record<ValidationDeclaration, string> = {
  fully_validated: 'Validated',
  provenance_pending: 'Provenance pending',
  corroborated: 'Corroborated',
  under_review: 'Under review',
  disputed: 'Disputed',
}

export function ValidationBadge({ state }: { state: ValidationDeclaration }) {
  const label = labels[state] || state
  const isDisputed = state === 'disputed'

  if (state === 'fully_validated') {
    return (
      <span className="inline-flex items-center gap-1" title="Full validation — Blue Protocol">
        <span className="w-4 h-4 bg-[#0000ff] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-white">
            <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    )
  }

  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border ${isDisputed ? 'border-black text-black bg-white' : 'border-slate-300 text-slate-500'}`}>
      {label}
    </span>
  )
}
