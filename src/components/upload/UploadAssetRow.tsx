'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset } from '@/lib/upload/batch-types'
import { BATCH_STATE_LABELS, ATTENTION_REASON_LABELS, ATTENTION_SEVERITY } from '@/lib/upload/batch-types'
import { formatFileSize } from '@/lib/upload/validation'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'

interface UploadAssetRowProps {
  asset: BatchAsset
  selected: boolean
  onToggleSelect: () => void
  onEdit?: () => void
}

export function UploadAssetRow({ asset, selected, onToggleSelect, onEdit }: UploadAssetRowProps) {
  const stateColor = {
    uploading: 'text-slate-500',
    processing: 'text-slate-500',
    ready: 'text-[#0000ff]',
    warning: 'text-black',
    blocked: 'text-black',
    committed: 'text-[#0000ff]',
    failed: 'text-black',
  }[asset.state]

  const stateBg = {
    uploading: '',
    processing: '',
    ready: 'bg-[#0000ff]/5',
    warning: 'bg-yellow-50',
    blocked: '',
    committed: 'bg-[#0000ff]/5',
    failed: 'bg-red-50',
  }[asset.state]

  return (
    <tr
      className={cn(
        'border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors',
        selected && 'bg-[#0000ff]/5 hover:bg-[#0000ff]/5',
      )}
      onClick={onEdit}
    >
      {/* Checkbox */}
      <td className="w-8 px-2 py-2" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="w-3.5 h-3.5 accent-[#0000ff]"
        />
      </td>

      {/* Thumbnail */}
      <td className="w-12 px-1 py-1">
        <div className="w-10 h-7 bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8px] font-mono text-slate-300">
              {asset.format ? ASSET_FORMAT_LABELS[asset.format]?.slice(0, 3).toUpperCase() : '???'}
            </span>
          )}
        </div>
      </td>

      {/* Title / Filename */}
      <td className="px-2 py-2 max-w-[200px]">
        <div className="text-xs font-medium truncate">{asset.title || asset.fileName}</div>
        {asset.title && (
          <div className="text-[10px] font-mono text-slate-400 truncate">{asset.fileName}</div>
        )}
      </td>

      {/* Format */}
      <td className="px-2 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {asset.format ? ASSET_FORMAT_LABELS[asset.format] : '·'}
        </span>
      </td>

      {/* Size */}
      <td className="px-2 py-2">
        <span className="text-[10px] font-mono text-slate-400">{formatFileSize(asset.fileSize)}</span>
      </td>

      {/* Story */}
      <td className="px-2 py-2 max-w-[140px]">
        <span className="text-[10px] font-mono text-slate-500 truncate block">
          {asset.storyAssignment?.title ?? '·'}
        </span>
      </td>

      {/* Privacy */}
      <td className="px-2 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {asset.privacy ?? '·'}
        </span>
      </td>

      {/* Price */}
      <td className="px-2 py-2">
        {asset.priceAmount ? (
          <span className="text-xs font-mono font-bold">&euro;{(asset.priceAmount / 100).toFixed(0)}</span>
        ) : asset.priceRecommendation ? (
          <span className="text-[10px] font-mono text-slate-400">
            ~&euro;{(asset.priceRecommendation.amount / 100).toFixed(0)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-300">·</span>
        )}
      </td>

      {/* State */}
      <td className="px-2 py-2">
        <div className="flex flex-col items-end gap-0.5">
          {asset.state === 'uploading' ? (
            <div className="flex items-center gap-1">
              <div className="w-16 h-1 bg-slate-200">
                <div className="h-full bg-[#0000ff] transition-all" style={{ width: `${asset.uploadProgress}%` }} />
              </div>
              <span className="text-[9px] font-mono text-slate-400">{asset.uploadProgress}%</span>
            </div>
          ) : (
            <span className={cn('text-[10px] font-bold uppercase tracking-widest px-1', stateColor, stateBg)}>
              {BATCH_STATE_LABELS[asset.state]}
            </span>
          )}
          {asset.attentionReason && (
            <span className={cn(
              'text-[9px] font-mono',
              ATTENTION_SEVERITY[asset.attentionReason] === 'blocking' ? 'text-black' : 'text-slate-400'
            )}>
              {ATTENTION_REASON_LABELS[asset.attentionReason]}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
