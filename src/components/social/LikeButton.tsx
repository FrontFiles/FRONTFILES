'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface LikeButtonProps {
  initialCount: number
  initialLiked: boolean
  size?: 'sm' | 'md'
}

export function LikeButton({ initialCount, initialLiked, size = 'md' }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)

  function toggle() {
    setLiked(prev => !prev)
    setCount(prev => liked ? prev - 1 : prev + 1)
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        'inline-flex items-center gap-1.5 border transition-colors select-none',
        size === 'sm' ? 'h-6 px-2' : 'h-8 px-3',
        liked
          ? 'border-black bg-black text-white'
          : 'border-slate-200 bg-white text-slate-500 hover:border-black hover:text-black'
      )}
    >
      <svg
        viewBox="0 0 16 16"
        fill={liked ? 'currentColor' : 'none'}
        className={cn(
          'shrink-0',
          size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
        )}
      >
        <path
          d="M8 14s-5.5-3.5-5.5-7A3 3 0 0 1 8 4.5 3 3 0 0 1 13.5 7C13.5 10.5 8 14 8 14z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className={cn(
        'font-bold font-mono',
        size === 'sm' ? 'text-[9px]' : 'text-[10px]'
      )}>
        {count}
      </span>
    </button>
  )
}
