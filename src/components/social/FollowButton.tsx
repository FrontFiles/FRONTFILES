'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface FollowButtonProps {
  initialFollowing: boolean
  onToggle?: (following: boolean) => void
}

export function FollowButton({ initialFollowing, onToggle }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)

  function toggle() {
    const next = !following
    setFollowing(next)
    onToggle?.(next)
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        'h-9 px-5 text-xs font-bold uppercase tracking-wide transition-colors',
        following
          ? 'border-2 border-slate-300 bg-white text-slate-500 hover:border-black hover:text-black'
          : 'border-2 border-black bg-black text-white hover:bg-white hover:text-black'
      )}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
