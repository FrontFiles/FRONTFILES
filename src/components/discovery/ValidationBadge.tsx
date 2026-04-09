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
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border ${isDisputed ? 'border-black text-black bg-white' : 'border-slate-300 text-slate-500'}`}>
      {label}
    </span>
  )
}
