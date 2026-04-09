'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset, AttentionReason, AttentionSeverity } from '@/lib/upload/batch-types'
import { ATTENTION_REASON_LABELS, ATTENTION_SEVERITY, BATCH_STATE_LABELS } from '@/lib/upload/batch-types'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'
import { formatFileSize } from '@/lib/upload/validation'

interface ExceptionGroupProps {
  reason: AttentionReason
  assets: BatchAsset[]
  onQuickFix?: (assetIds: string[], action: string) => void
  onBulkFix?: (assetIds: string[], action: string) => void
}

export function ExceptionGroup({ reason, assets, onQuickFix, onBulkFix }: ExceptionGroupProps) {
  const severity = ATTENTION_SEVERITY[reason]
  const label = ATTENTION_REASON_LABELS[reason]

  const quickFixAction = getQuickFixAction(reason)
  const assetIds = assets.map(a => a.id)

  return (
    <div className={cn(
      'border-2 p-3 space-y-2',
      severity === 'blocking' ? 'border-black' : severity === 'warning' ? 'border-slate-400' : 'border-slate-200'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-widest px-1 py-0.5',
            severity === 'blocking' ? 'bg-black text-white' : severity === 'warning' ? 'text-black' : 'text-slate-500'
          )}>
            {severity.toUpperCase()}
          </span>
          <span className="text-xs font-bold">{label}</span>
          <span className="text-[10px] font-mono text-slate-400">&times;{assets.length}</span>
        </div>

        <div className="flex items-center gap-1">
          {quickFixAction && (
            <button
              onClick={() => onBulkFix?.(assetIds, quickFixAction.action)}
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
            >
              {quickFixAction.label} All
            </button>
          )}
        </div>
      </div>

      {/* Asset list */}
      <div className="space-y-0.5">
        {assets.map(asset => (
          <div key={asset.id} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
            <span className="w-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {asset.format ? ASSET_FORMAT_LABELS[asset.format]?.slice(0, 5) : '???'}
            </span>
            <span className="flex-1 text-xs font-mono truncate">{asset.title || asset.fileName}</span>
            <span className="text-[10px] font-mono text-slate-400">{formatFileSize(asset.fileSize)}</span>
            {quickFixAction && (
              <button
                onClick={() => onQuickFix?.([ asset.id ], quickFixAction.action)}
                className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:underline"
              >
                {quickFixAction.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function getQuickFixAction(reason: AttentionReason): { label: string; action: string } | null {
  switch (reason) {
    case 'needs_story': return { label: 'Assign', action: 'assign_story' }
    case 'needs_privacy': return { label: 'Set', action: 'set_privacy' }
    case 'needs_price': return { label: 'Apply Rec.', action: 'apply_recommended_price' }
    case 'needs_licences': return { label: 'Set', action: 'apply_licences' }
    case 'needs_metadata': return { label: 'Edit', action: 'edit_metadata' }
    default: return null
  }
}
