import { cn } from '@/lib/utils'
import type { TrustTier, TrustBadge as TrustBadgeType } from '@/lib/types'

interface TrustBadgeProps {
  tier: TrustTier
  badge: TrustBadgeType
  size?: 'sm' | 'md'
  className?: string
}

// LABEL POLICY (BP-D7-IMPL, 2026-04-26):
// Labels deliberately omit "Verified" / "Trusted" prefixes.
//
// IMPORTANT — semantic compression vs data model:
// The data layer STILL CARRIES both `verified` and `trusted` badge
// states on CreatorProfileRow. This LabelMap intentionally renders
// both states identically because no earning logic exists yet — every
// creator defaults to `trust_badge: 'verified'` per identity/store.ts:546.
// Showing "Verified" or "Trusted" without an earning gate behind them
// would overclaim per CLAUDE.md item 9.
//
// This is a USER-FACING DEFENSIVE COMPRESSION, not a model change.
// Future contributors: do NOT assume the verified/trusted distinction
// has been removed from data. It hasn't. The compression lives ONLY
// in this LabelMap and is reversed when BP-D5 ships proper earning
// logic with a real default state (likely an `unverified` /
// `pending_verification` state added to the enum, with the existing
// `verified` and `trusted` becoming earned).
//
// See:
//   docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md §C-2
//   docs/audits/BLUE-PROTOCOL-TRUST-BADGE-VERIFICATION-2026-04-26.md
//   docs/audits/BLUE-PROTOCOL-WATERMARK-DIRECTIVES-2026-04-26.md (BP-D5)
const BADGE_LABELS: Record<TrustTier, Record<TrustBadgeType, string>> = {
  standard: {
    verified: 'Frontfiles Creator',
    trusted: 'Frontfiles Creator',
  },
  protected_source: {
    verified: 'Protected Source',
    trusted: 'Protected Source',
  },
}

export function TrustBadge({ tier, badge, size = 'md', className }: TrustBadgeProps) {
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'
  const iconDim = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('bg-[#0000ff] flex items-center justify-center shrink-0', dim)}>
        <svg viewBox="0 0 24 24" fill="none" className={cn('text-white', iconDim)}>
          <path
            d="M12 2L4 5.5v6c0 5.25 3.4 10.2 8 12 4.6-1.8 8-6.75 8-12v-6L12 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M8 12l3 3 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-black">
        {BADGE_LABELS[tier][badge]}
      </span>
    </div>
  )
}
