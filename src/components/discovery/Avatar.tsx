'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getAvatarCrop } from '@/lib/avatar-crop'

interface AvatarProps {
  src: string | null | undefined
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  slug?: string
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[7px]',
  sm: 'w-7 h-7 text-[8px]',
  md: 'w-9 h-9 text-[10px]',
  lg: 'w-12 h-12 text-xs',
  xl: 'w-[100px] h-[100px] text-2xl',
  '2xl': 'w-32 h-32 text-3xl',
} as const

/** Tiny neutral gradient SVG — stretched and blurred as placeholder. */
export const BLUR_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop offset=%220%25%22 stop-color=%22%23b0b0b0%22/%3E%3Cstop offset=%22100%25%22 stop-color=%22%23787878%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%224%22 height=%224%22 fill=%22url(%23g)%22/%3E%3C/svg%3E'

export function Avatar({ src, name, size = 'sm', className, slug }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const sizeClass = SIZE_MAP[size]
  const showImage = src && !failed

  return (
    <div
      className={cn(sizeClass, 'shrink-0 relative group/avatar', className)}
      aria-label={name}
      role="img"
    >
      <div className="w-full h-full overflow-hidden border border-black/15 bg-slate-100">
        <img
          src={showImage ? src : BLUR_PLACEHOLDER}
          alt=""
          className={cn('w-full h-full object-cover', !showImage && 'blur-sm scale-110')}
          style={showImage && slug ? { objectPosition: getAvatarCrop(slug) } : undefined}
          aria-hidden="true"
          onError={() => setFailed(true)}
        />
      </div>
      {/* Validated user triangle badge */}
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[14px] border-t-[#0000ff] border-l-[14px] border-l-transparent pointer-events-auto cursor-default" />
      <div className="absolute top-[-2px] right-[-2px] opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="absolute top-3 right-0 whitespace-nowrap bg-black text-white text-[7px] font-bold uppercase tracking-wider px-2 py-1 leading-tight">
          Validated user. ID and personal data confirmed.
        </div>
      </div>
    </div>
  )
}
