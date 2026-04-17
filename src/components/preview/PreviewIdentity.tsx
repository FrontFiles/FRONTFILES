import { cn } from '@/lib/utils'
import { Avatar } from '@/components/discovery/Avatar'

// ══════════════════════════════════════════════
// PREVIEW IDENTITY — Creator identity zone
// ══════════════════════════════════════════════

interface PreviewIdentityProps {
  name: string
  avatarSrc?: string | null
  avatarSlug?: string
  location?: string | null
  /** Appearance variant */
  variant?: 'light' | 'dark'
  /** Avatar size */
  avatarSize?: 'xs' | 'sm' | 'md'
  className?: string
}

export function PreviewIdentity({
  name,
  avatarSrc,
  avatarSlug,
  location,
  variant = 'light',
  avatarSize = 'xs',
  className,
}: PreviewIdentityProps) {
  const isDark = variant === 'dark'

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <Avatar
        src={avatarSrc}
        name={name}
        size={avatarSize}
        slug={avatarSlug}
      />
      <div className="min-w-0">
        <span
          className={cn(
            'text-[11px] font-bold block leading-tight truncate',
            isDark ? 'text-white' : 'text-black',
          )}
        >
          {name}
        </span>
        {location && (
          <span
            className={cn(
              'text-[9px] block leading-tight truncate',
              isDark ? 'text-white/50' : 'text-black/40',
            )}
          >
            {location}
          </span>
        )}
      </div>
    </div>
  )
}
