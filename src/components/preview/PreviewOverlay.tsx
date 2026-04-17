import { cn } from '@/lib/utils'

// ══════════════════════════════════════════════
// PREVIEW OVERLAY — Hover overlay with gradient
//
// Extracted from the duplicated hover overlay pattern in
// AssetCard, StoryCard, and ArticleCard.
// ══════════════════════════════════════════════

interface PreviewOverlayProps {
  /** Controls visibility — typically group-hover driven */
  visible?: boolean
  /** Gradient variant */
  gradient?: 'standard' | 'deep' | 'none'
  /** Additional class names */
  className?: string
  children: React.ReactNode
}

const GRADIENTS = {
  standard: 'bg-gradient-to-t from-black/90 via-black/40 to-transparent',
  deep: 'bg-gradient-to-t from-black/95 via-black/50 to-black/30',
  none: '',
}

export function PreviewOverlay({
  visible,
  gradient = 'standard',
  className,
  children,
}: PreviewOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-20 transition-opacity duration-200 flex flex-col',
        visible === undefined
          ? 'opacity-0 group-hover:opacity-100'
          : visible
            ? 'opacity-100'
            : 'opacity-0',
        className,
      )}
    >
      <div className={cn('absolute inset-0', GRADIENTS[gradient])} />
      {children}
    </div>
  )
}

/**
 * Spacer that pushes content to the bottom of the overlay.
 * Use between top content and bottom content.
 */
export function OverlaySpacer() {
  return <div className="flex-1" />
}
