'use client'

import { useState } from 'react'
import type { FollowState } from '@/lib/types'
import { FollowButton } from './FollowButton'

interface FollowStatsProps {
  initialState: FollowState
}

export function FollowStats({ initialState }: FollowStatsProps) {
  const [state, setState] = useState(initialState)

  function handleToggle(following: boolean) {
    setState(prev => ({
      ...prev,
      followers: following ? prev.followers + 1 : prev.followers - 1,
      userFollows: following,
    }))
  }

  return (
    <div className="flex flex-col gap-3">
      <FollowButton initialFollowing={state.userFollows} onToggle={handleToggle} />
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-black font-mono">{state.followers}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Followers</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-black font-mono">{state.following}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Following</span>
        </div>
      </div>
    </div>
  )
}
