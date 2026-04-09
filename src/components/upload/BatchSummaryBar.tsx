'use client'

import { cn } from '@/lib/utils'
import type { BatchCounters } from '@/lib/upload/batch-types'

interface BatchSummaryBarProps {
  counters: BatchCounters
  onFilterState?: (state: string) => void
  activeFilter?: string
}

const SEGMENTS: { key: keyof BatchCounters; label: string; style: string; activeStyle: string }[] = [
  { key: 'total', label: 'TOTAL', style: 'text-black', activeStyle: 'bg-black text-white' },
  { key: 'ready', label: 'READY', style: 'text-black', activeStyle: 'bg-black text-white' },
  { key: 'warning', label: 'ATTENTION', style: 'text-black', activeStyle: 'bg-black text-white' },
  { key: 'blocked', label: 'BLOCKED', style: 'text-black', activeStyle: 'bg-black text-white' },
  { key: 'uploading', label: 'UPLOADING', style: 'text-slate-500', activeStyle: 'bg-slate-500 text-white' },
  { key: 'processing', label: 'PROCESSING', style: 'text-slate-500', activeStyle: 'bg-slate-500 text-white' },
  { key: 'committed', label: 'COMMITTED', style: 'text-blue-600', activeStyle: 'bg-blue-600 text-white' },
  { key: 'failed', label: 'FAILED', style: 'text-black', activeStyle: 'bg-black text-white' },
]

export function BatchSummaryBar({ counters, onFilterState, activeFilter }: BatchSummaryBarProps) {
  return (
    <div className="flex items-center gap-1 border-2 border-black p-1">
      {SEGMENTS.map(seg => {
        const count = counters[seg.key]
        if (count === 0 && seg.key !== 'total') return null
        const isActive = activeFilter === seg.key || (activeFilter === 'all' && seg.key === 'total')
        return (
          <button
            key={seg.key}
            onClick={() => onFilterState?.(seg.key === 'total' ? 'all' : seg.key)}
            className={cn(
              'px-2 py-1 text-[10px] font-bold uppercase tracking-widest font-mono transition-colors',
              isActive ? seg.activeStyle : seg.style,
              'hover:opacity-80'
            )}
          >
            {seg.label} {count}
          </button>
        )
      })}
    </div>
  )
}
