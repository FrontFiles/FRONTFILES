import Link from 'next/link'
import type { AssetData } from '@/data'
import { creatorMap } from '@/data'
import { ValidationBadge } from './ValidationBadge'

interface AssetCardProps {
  asset: AssetData
  size?: 'default' | 'large' | 'compact'
  showCreator?: boolean
  reason?: string
}

export function AssetCard({ asset, size = 'default', showCreator = true, reason }: AssetCardProps) {
  const creator = creatorMap[asset.creatorId]
  const isLarge = size === 'large'
  const isCompact = size === 'compact'

  return (
    <Link href={`/asset/${asset.id}`} className="group block border border-slate-200 hover:border-black transition-colors bg-white">
      {/* Image */}
      <div className={`relative overflow-hidden bg-slate-100 ${isCompact ? 'aspect-[4/3]' : 'aspect-video'}`}>
        <img
          src={asset.thumbnailRef}
          alt={asset.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
        {/* Format badge */}
        <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
          {asset.format}
        </span>
        {/* Duration for video/audio */}
        {asset.durationSeconds && (
          <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 font-mono">
            {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Content */}
      <div className={`${isLarge ? 'p-4' : 'p-3'}`}>
        {reason && (
          <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">{reason}</span>
        )}
        <h3 className={`font-bold text-black leading-tight ${isLarge ? 'text-sm' : 'text-xs'} ${isCompact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {asset.title}
        </h3>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {showCreator && creator && (
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-4 h-4 border border-black/15 overflow-hidden bg-slate-100 shrink-0 inline-block">
                <img src={creator.avatarRef} alt={creator.name} className="w-full h-full object-cover" />
              </span>
              {creator.name}
            </span>
          )}
          <span className="text-[10px] text-slate-400">{asset.locationLabel}</span>
        </div>
        {!isCompact && (
          <div className="mt-2 flex items-center gap-2">
            <ValidationBadge state={asset.validationDeclaration} />
            {asset.price && (
              <span className="text-[10px] font-bold text-black font-mono">&euro;{asset.price}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
