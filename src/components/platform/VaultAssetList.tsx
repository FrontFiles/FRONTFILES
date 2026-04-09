'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { StateBadge } from './StateBadge'
import { EmptyPanel } from './Panel'
import type { VaultAsset } from '@/lib/types'

interface VaultAssetListProps {
  assets: VaultAsset[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function VaultAssetList({ assets, selectedId, onSelect }: VaultAssetListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = assets.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatIcon: Record<string, string> = {
    photo: 'IMG',
    video: 'VID',
    audio: 'AUD',
    text: 'TXT',
    illustration: 'ILL',
    infographic: 'INF',
    vector: 'VEC',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="relative flex-1">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search assets…"
            className="w-full h-9 border border-slate-300 bg-white text-sm text-black pl-8 pr-3 placeholder:text-slate-300 focus:outline-none focus:border-blue-600"
          />
        </div>
        <select className="h-9 border border-slate-300 bg-white text-xs text-black px-2 font-bold uppercase tracking-wide">
          <option>Most recent</option>
          <option>Oldest first</option>
          <option>A–Z</option>
        </select>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {selectedIds.size} selected
            </span>
            <button className="h-8 px-3 text-xs border border-black text-black font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors">
              Publish
            </button>
            <button className="h-8 px-3 text-xs border border-black text-black font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors">
              Set privacy
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header row */}
          <div className="grid grid-cols-[2rem_1fr_4rem_5.5rem_5.5rem_5.5rem_5.5rem] gap-2 px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest sticky top-0 z-10">
            <span />
            <span>Title</span>
            <span>Type</span>
            <span>Privacy</span>
            <span>Declaration</span>
            <span>Status</span>
            <span>Uploaded</span>
          </div>

          {/* Rows */}
          {filtered.map(asset => (
            <div
              key={asset.id}
              onClick={() => onSelect(asset.id)}
              className={cn(
                'grid grid-cols-[2rem_1fr_4rem_5.5rem_5.5rem_5.5rem_5.5rem] gap-2 px-4 py-3 border-b border-slate-200 cursor-pointer transition-colors items-center',
                selectedId === asset.id && 'bg-blue-50 border-l-2 border-l-blue-600',
                selectedId !== asset.id && 'hover:bg-slate-50',
                selectedIds.has(asset.id) && 'bg-blue-50'
              )}
            >
              {/* Checkbox */}
              <div
                onClick={e => toggleSelect(asset.id, e)}
                className={cn(
                  'w-4 h-4 border flex items-center justify-center cursor-pointer',
                  selectedIds.has(asset.id)
                    ? 'bg-black border-black'
                    : 'border-slate-300 hover:border-black'
                )}
              >
                {selectedIds.has(asset.id) && (
                  <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Title */}
              <span className="text-sm text-black font-medium truncate">{asset.title}</span>

              {/* Format */}
              <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">{formatIcon[asset.format]}</span>

              {/* Privacy */}
              <StateBadge variant={asset.privacy.toLowerCase() as 'public' | 'private' | 'restricted'} />

              {/* Declaration */}
              {asset.declarationState ? (
                <StateBadge variant={asset.declarationState} />
              ) : (
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">·</span>
              )}

              {/* Publication */}
              <StateBadge variant={asset.publication.toLowerCase() as 'published' | 'draft'} />

              {/* Upload date */}
              <span className="font-mono text-[10px] text-slate-400">
                {new Date(asset.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyPanel
            message={searchQuery ? 'No assets match your search' : 'Your Vault is empty'}
            detail={searchQuery ? undefined : 'Upload your first file to get started'}
          />
        </div>
      )}
    </div>
  )
}
