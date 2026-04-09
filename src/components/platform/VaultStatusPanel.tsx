'use client'

import { Panel } from './Panel'
import type { VaultAsset, Story, Article } from '@/lib/types'

interface VaultStatusPanelProps {
  assets: VaultAsset[]
  stories: Story[]
  articles: Article[]
}

export function VaultStatusPanel({ assets, stories, articles }: VaultStatusPanelProps) {
  const publicCount = assets.filter(a => a.privacy === 'PUBLIC').length
  const privateCount = assets.filter(a => a.privacy === 'PRIVATE').length
  const restrictedCount = assets.filter(a => a.privacy === 'RESTRICTED').length
  const certifiedCount = assets.filter(a => a.declarationState === 'fully_validated').length
  const pendingCount = assets.filter(a => a.declarationState === 'provenance_pending' || a.declarationState === null).length

  const lastUpload = assets.length > 0
    ? new Date(assets[assets.length - 1].uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '·'

  return (
    <Panel title="Vault status" headerStyle="black" borderStyle="emphasis">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total assets" value={assets.length} />
        <Stat label="Stories" value={stories.length} />
        <Stat label="Articles" value={articles.length} />
        <Stat label="Certified" value={certifiedCount} />
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
        <Stat label="Public" value={publicCount} />
        <Stat label="Private" value={privateCount} />
        <Stat label="Restricted" value={restrictedCount} />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pending cert.</span>
          <span className="text-sm font-bold text-black font-mono">{pendingCount}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last upload</span>
          <span className="font-mono text-xs text-slate-500">{lastUpload}</span>
        </div>
      </div>
    </Panel>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-lg font-bold text-black font-mono">{value}</span>
    </div>
  )
}
