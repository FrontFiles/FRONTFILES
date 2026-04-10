'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset } from '@/lib/upload/batch-types'
import { BATCH_STATE_LABELS, ATTENTION_REASON_LABELS, ATTENTION_SEVERITY } from '@/lib/upload/batch-types'
import { formatFileSize } from '@/lib/upload/validation'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'

interface UploadAssetCardProps {
  asset: BatchAsset
  selected: boolean
  onToggleSelect: () => void
  onEdit?: () => void
}

export function UploadAssetCard({ asset, selected, onToggleSelect, onEdit }: UploadAssetCardProps) {
  const borderColor = {
    uploading: 'border-slate-200',
    processing: 'border-slate-200',
    ready: 'border-[#0000ff]',
    warning: 'border-black',
    blocked: 'border-black',
    committed: 'border-[#0000ff]',
    failed: 'border-black',
  }[asset.state]

  return (
    <div
      className={cn(
        'border-2 cursor-pointer transition-colors group',
        borderColor,
        selected && 'ring-2 ring-[#0000ff] ring-offset-1',
      )}
      onClick={onEdit}
    >
      {/* Thumbnail area */}
      <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
        {asset.thumbnailUrl ? (
          <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-lg font-bold font-mono text-slate-300">
              {asset.format ? ASSET_FORMAT_LABELS[asset.format]?.slice(0, 3).toUpperCase() : '???'}
            </span>
          </div>
        )}

        {/* Upload progress overlay */}
        {asset.state === 'uploading' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="w-3/4 h-1 bg-white/30">
              <div className="h-full bg-[#0000ff] transition-all" style={{ width: `${asset.uploadProgress}%` }} />
            </div>
            <span className="text-[10px] font-mono text-white mt-1">{asset.uploadProgress}%</span>
          </div>
        )}

        {/* Processing overlay */}
        {asset.state === 'processing' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white animate-pulse">PROCESSING</span>
          </div>
        )}

        {/* Format badge */}
        <span className="absolute top-1 left-1 text-[9px] font-bold uppercase tracking-widest text-white bg-black/70 px-1 py-0.5">
          {asset.format ? ASSET_FORMAT_LABELS[asset.format] : '?'}
        </span>

        {/* Checkbox */}
        <div className="absolute top-1 right-1" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="w-3.5 h-3.5 accent-[#0000ff]"
          />
        </div>

        {/* State badge */}
        {asset.state !== 'uploading' && asset.state !== 'processing' && (
          <span className={cn(
            'absolute bottom-1 right-1 text-[9px] font-bold uppercase tracking-widest px-1 py-0.5',
            asset.state === 'ready' && 'bg-[#0000ff] text-white',
            asset.state === 'warning' && 'bg-white text-black border border-black',
            asset.state === 'blocked' && 'bg-black text-white',
            asset.state === 'committed' && 'bg-[#0000ff] text-white',
            asset.state === 'failed' && 'bg-black text-white',
          )}>
            {BATCH_STATE_LABELS[asset.state]}
          </span>
        )}
      </div>

      {/* Info area */}
      <div className="p-2 space-y-0.5">
        <div className="text-xs font-medium truncate">{asset.title || asset.fileName}</div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400">{formatFileSize(asset.fileSize)}</span>
          {asset.priceAmount ? (
            <span className="text-xs font-mono font-bold">&euro;{(asset.priceAmount / 100).toFixed(0)}</span>
          ) : asset.priceRecommendation ? (
            <span className="text-[10px] font-mono text-slate-400">~&euro;{(asset.priceRecommendation.amount / 100).toFixed(0)}</span>
          ) : null}
        </div>
        {asset.attentionReason && (
          <div className={cn(
            'text-[9px] font-mono truncate',
            ATTENTION_SEVERITY[asset.attentionReason] === 'blocking' ? 'text-black font-bold' : 'text-slate-400'
          )}>
            {ATTENTION_REASON_LABELS[asset.attentionReason]}
          </div>
        )}
      </div>
    </div>
  )
}
