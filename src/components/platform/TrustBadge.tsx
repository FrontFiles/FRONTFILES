import { cn } from '@/lib/utils'
import type { TrustTier, TrustBadge as TrustBadgeType } from '@/lib/types'

interface TrustBadgeProps {
  tier: TrustTier
  badge: TrustBadgeType
  size?: 'sm' | 'md'
  className?: string
}

const BADGE_LABELS: Record<TrustTier, Record<TrustBadgeType, string>> = {
  standard: {
    verified: 'Verified Creator',
    trusted: 'Trusted Creator',
  },
  protected_source: {
    verified: 'Verified Protected Source',
    trusted: 'Trusted Protected Source',
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
