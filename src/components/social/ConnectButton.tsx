'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// Lightning bolt icon — the Connect symbol
function LightningIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4.09 12.64a1 1 0 0 0 .78 1.63H11l-1 7.73L19.91 11.36a1 1 0 0 0-.78-1.63H13l1-7.73z" />
    </svg>
  )
}

type ConnectState = 'disconnected' | 'connected' | 'blocked'

interface ConnectButtonProps {
  initialState?: ConnectState
  onStateChange?: (state: ConnectState) => void
  size?: 'default' | 'large'
}

export function ConnectButton({ initialState = 'disconnected', onStateChange, size = 'default' }: ConnectButtonProps) {
  const [state, setState] = useState<ConnectState>(initialState)
  const [showMenu, setShowMenu] = useState(false)

  function handleClick() {
    if (state === 'disconnected') {
      const next = 'connected'
      setState(next)
      onStateChange?.(next)
    } else if (state === 'connected') {
      setShowMenu(m => !m)
    }
  }

  function handleDisconnect() {
    setState('disconnected')
    onStateChange?.('disconnected')
    setShowMenu(false)
  }

  function handleBlock() {
    setState('blocked')
    onStateChange?.('blocked')
    setShowMenu(false)
  }

  if (state === 'blocked') {
    return (
      <button
        onClick={() => { setState('disconnected'); onStateChange?.('disconnected') }}
        className={cn(
          'font-bold uppercase tracking-[0.12em] transition-colors border-2 border-black/20 bg-white text-black/30',
          size === 'large' ? 'h-11 w-full text-[10px]' : 'h-9 px-5 text-xs'
        )}
      >
        Blocked
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={cn(
          'font-bold uppercase tracking-[0.12em] transition-colors border-2 flex items-center justify-center gap-2',
          state === 'connected'
            ? 'bg-[#0000ff] text-white border-[#0000ff] hover:bg-[#0000cc]'
            : 'bg-white text-black border-black hover:bg-black hover:text-white',
          size === 'large' ? 'h-11 w-full text-[10px]' : 'h-9 px-5 text-xs'
        )}
      >
        <LightningIcon className={size === 'large' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {state === 'connected' ? 'Connected' : 'Connect'}
      </button>

      {/* Disconnect / Block menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 border-2 border-black bg-white shadow-lg">
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black hover:bg-black/5 transition-colors text-left"
            >
              Disconnect
            </button>
            <button
              onClick={handleBlock}
              className="w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-600 hover:bg-red-50 transition-colors text-left border-t border-black/10"
            >
              Block connections
            </button>
          </div>
        </>
      )}
    </div>
  )
}
