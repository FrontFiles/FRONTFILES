'use client'

import { useState, useCallback } from 'react'
import { useLightbox } from '@/hooks/useLightbox'
import type { SocialCounts } from '@/lib/types'

interface AssetActionBarProps {
  assetId: string
  assetTitle: string
  socialCounts: SocialCounts
}

export function AssetActionBar({ assetId, assetTitle, socialCounts }: AssetActionBarProps) {
  const { saved, toggle: toggleLightbox } = useLightbox(assetId)
  const [liked, setLiked] = useState(socialCounts.userLiked)
  const [likeCount, setLikeCount] = useState(socialCounts.likes)
  const [shareCopied, setShareCopied] = useState(false)

  const handleLike = () => {
    setLiked(prev => !prev)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
  }

  const handleShare = useCallback(async () => {
    const url = window.location.origin + `/asset/${assetId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: assetTitle, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 1500)
      }
    } catch { /* cancelled */ }
  }, [assetId, assetTitle])

  return (
    <div className="flex items-center border-2 border-black border-t-0">
      {/* Lightbox */}
      <button
        onClick={toggleLightbox}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-bold uppercase tracking-widest border-r border-black/10 transition-colors ${
          saved ? 'bg-[#0000ff] text-white' : 'text-black hover:bg-slate-50'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
        {saved ? 'Saved' : 'Lightbox'}
      </button>

      {/* Like */}
      <button
        onClick={handleLike}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-bold uppercase tracking-widest border-r border-black/10 transition-colors ${
          liked ? 'bg-black text-white' : 'text-black hover:bg-slate-50'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {likeCount}
      </button>

      {/* Comment */}
      <button
        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-bold uppercase tracking-widest border-r border-black/10 text-black hover:bg-slate-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {socialCounts.comments}
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${
          shareCopied ? 'bg-[#0000ff] text-white' : 'text-black hover:bg-slate-50'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {shareCopied ? 'Copied' : 'Share'}
      </button>
    </div>
  )
}
