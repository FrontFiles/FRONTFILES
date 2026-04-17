'use client'

import { useState } from 'react'
import type { ConnectionState } from '@/lib/types'
import { ConnectButton } from './ConnectButton'

interface ConnectionStatsProps {
  initialState: ConnectionState
}

export function ConnectionStats({ initialState }: ConnectionStatsProps) {
  const [state, setState] = useState(initialState)

  function handleStateChange(connectState: 'disconnected' | 'connected' | 'blocked') {
    setState(prev => ({
      ...prev,
      connections: connectState === 'connected' ? prev.connections + 1 : connectState === 'disconnected' && prev.connections > 0 ? prev.connections - 1 : prev.connections,
      isConnected: connectState === 'connected',
      isBlocked: connectState === 'blocked',
    }))
  }

  return (
    <div className="flex flex-col gap-3">
      <ConnectButton
        initialState={state.isBlocked ? 'blocked' : state.isConnected ? 'connected' : 'disconnected'}
        onStateChange={handleStateChange}
        size="large"
      />
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-black font-mono">{state.connections}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Connections</span>
        </div>
      </div>
    </div>
  )
}
