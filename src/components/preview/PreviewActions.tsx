'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ActionId } from '@/lib/preview/types'
import { useLightbox } from '@/hooks/useLightbox'

// ══════════════════════════════════════════════
// PREVIEW ACTIONS — Canonical action bar
//
// Extracted from the identical action bars in AssetCard,
// StoryCard, and ArticleCard.
// ══════════════════════════════════════════════

// SVG icon paths — shared across all preview families
const ICONS: Record<string, { viewBox: string; d: string; fill?: boolean }> = {
  lightbox: {
    viewBox: '0 0 24 24',
    d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z',
  },
  like: {
    viewBox: '0 0 24 24',
    d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  },
  comment: {
    viewBox: '0 0 24 24',
    d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  },
  follow: {
    viewBox: '0 0 24 24',
    d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6',
  },
  message: {
    viewBox: '0 0 24 24',
    d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  },
}

// Share icon is multi-element, handled separately
function ShareIcon() {
  return (
    <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function ActionIcon({ id, active }: { id: ActionId; active?: boolean }) {
  if (id === 'share') return <ShareIcon />
  const icon = ICONS[id]
  if (!icon) return null
  return (
    <svg
      className="w-2.5 h-2.5 shrink-0"
      viewBox={icon.viewBox}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icon.d} />
    </svg>
  )
}

const LABELS: Record<ActionId, { default: string; active?: string }> = {
  lightbox: { default: 'Lightbox', active: 'Added' },
  like: { default: 'Like', active: 'Liked' },
  comment: { default: 'Comment' },
  share: { default: 'Share', active: 'Copied' },
  follow: { default: 'Follow', active: 'Following' },
  message: { default: 'Message' },
  preview: { default: 'Preview' },
  overflow: { default: 'More' },
}

interface PreviewActionsProps {
  /** Which actions to render, in order */
  actions: ActionId[]
  /** Entity ID for lightbox toggle */
  entityId: string
  /** Entity title for share */
  entityTitle: string
  /** Route path for share URL (e.g. '/asset/asset-001') */
  sharePath: string
  className?: string
}

export function PreviewActions({
  actions,
  entityId,
  entityTitle,
  sharePath,
  className,
}: PreviewActionsProps) {
  const { saved, toggle: toggleLightbox } = useLightbox(entityId)
  const [shareCopied, setShareCopied] = useState(false)

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = window.location.origin + sharePath
    try {
      if (navigator.share) {
        await navigator.share({ title: entityTitle, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 1500)
      }
    } catch { /* user cancelled share dialog */ }
  }, [entityTitle, sharePath])

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }

  return (
    <div className={cn('relative flex items-center bg-black/60', className)}>
      {actions.map((actionId, i) => {
        const isLast = i === actions.length - 1
        const isLightbox = actionId === 'lightbox'
        const isShare = actionId === 'share'
        const isActive = (isLightbox && saved) || (isShare && shareCopied)
        const label = LABELS[actionId]

        const handleClick = (e: React.MouseEvent) => {
          stop(e)
          if (isLightbox) toggleLightbox()
        }

        return (
          <button
            key={actionId}
            onClick={isShare ? handleShare : handleClick}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold uppercase tracking-wider transition-colors',
              !isLast && 'border-r border-white/10',
              isActive
                ? 'bg-[#0000ff] text-white'
                : isLightbox
                  ? 'bg-white text-[#0000ff] hover:bg-blue-50'
                  : 'text-white/60 hover:bg-white/10',
            )}
            title={label.default}
          >
            <ActionIcon id={actionId} active={isActive} />
            <span className="hidden sm:inline">
              {isActive && label.active ? label.active : label.default}
            </span>
          </button>
        )
      })}
    </div>
  )
}
