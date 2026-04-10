import { cn } from '@/lib/utils'

type BadgeVariant =
  // Privacy states
  | 'public'
  | 'private'
  | 'restricted'
  // Validation Declaration states (FCS)
  | 'fully_validated'
  | 'provenance_pending'
  | 'manifest_invalid'
  | 'corroborated'
  | 'under_review'
  | 'disputed'
  | 'invalidated'
  // Publication states
  | 'published'
  | 'draft'
  // Other
  | 'buyers-only'
  | 'assembly-verified'

interface StateBadgeProps {
  variant: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  // Privacy
  public: 'border border-black text-black',
  private: 'border border-slate-300 text-slate-400',
  restricted: 'border border-dashed border-slate-400 text-slate-400',
  // Declaration — positive
  fully_validated: 'border border-[#0000ff] text-[#0000ff]',
  corroborated: 'border border-[#0000ff] text-[#0000ff]',
  // Declaration — pending
  provenance_pending: 'border border-dashed border-slate-300 text-slate-400',
  under_review: 'border border-dashed border-slate-300 text-slate-400',
  // Declaration — negative
  manifest_invalid: 'border-2 border-dashed border-black text-black',
  disputed: 'border-2 border-dashed border-black text-black',
  invalidated: 'border-2 border-black text-black',
  // Publication
  published: 'bg-black text-white',
  draft: 'text-slate-400',
  // Other
  'buyers-only': 'border border-black text-black',
  'assembly-verified': 'border border-[#0000ff] text-[#0000ff]',
}

const variantLabels: Record<BadgeVariant, string> = {
  public: 'Public',
  private: 'Private',
  restricted: 'Restricted',
  fully_validated: 'Fully Validated',
  provenance_pending: 'Provenance Pending',
  manifest_invalid: 'Manifest Invalid',
  corroborated: 'Corroborated',
  under_review: 'Under Review',
  disputed: 'Disputed',
  invalidated: 'Invalidated',
  published: 'Published',
  draft: 'Draft',
  'buyers-only': 'Buyers only',
  'assembly-verified': 'Assembly Verified',
}

export function StateBadge({ variant, className }: StateBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5',
        variantStyles[variant],
        className
      )}
    >
      {variantLabels[variant]}
    </span>
  )
}
