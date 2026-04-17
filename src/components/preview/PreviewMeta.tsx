import { cn } from '@/lib/utils'

// ══════════════════════════════════════════════
// PREVIEW META — Restrained metadata display
// ══════════════════════════════════════════════

interface PreviewMetaProps {
  items: (string | null | undefined)[]
  /** Appearance variant */
  variant?: 'light' | 'dark'
  className?: string
}

/**
 * Renders a row of metadata items separated by middots.
 * Filters out null/undefined/empty values automatically.
 */
export function PreviewMeta({ items, variant = 'dark', className }: PreviewMetaProps) {
  const visible = items.filter(Boolean) as string[]
  if (visible.length === 0) return null

  const isDark = variant === 'dark'

  return (
    <div className={cn('flex items-center gap-2 text-[9px] flex-wrap', className)}>
      {visible.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span className={isDark ? 'text-white/20' : 'text-black/20'}>&middot;</span>
          )}
          <span className={isDark ? 'text-white/40' : 'text-black/40'}>
            {item}
          </span>
        </span>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════
// FORMAT BADGE — Type + optional detail
// ══════════════════════════════════════════════

interface FormatBadgeProps {
  format: string
  detail?: string | null
  /** Appearance variant */
  variant?: 'light' | 'dark' | 'blue'
  className?: string
}

export function FormatBadge({ format, detail, variant = 'dark', className }: FormatBadgeProps) {
  const text = detail ? `${format} · ${detail}` : format

  return (
    <span
      className={cn(
        'inline-block text-[9px] font-bold uppercase tracking-widest',
        variant === 'dark' && 'text-white/40',
        variant === 'light' && 'text-black/40',
        variant === 'blue' && 'text-[#6666ff]',
        className,
      )}
    >
      {text}
    </span>
  )
}
