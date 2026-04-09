import Link from 'next/link'
import type { StoryData } from '@/data'
import { creatorMap, assetMap } from '@/data'

interface StoryCardProps {
  story: StoryData
  size?: 'default' | 'large' | 'compact'
  reason?: string
}

export function StoryCard({ story, size = 'default', reason }: StoryCardProps) {
  const creator = creatorMap[story.creatorId]
  const heroAsset = assetMap[story.heroAssetId]
  const isLarge = size === 'large'

  return (
    <Link href={`/story/${story.id}`} className="group block border border-slate-200 hover:border-black transition-colors bg-white">
      {/* Hero image */}
      {heroAsset && (
        <div className="relative overflow-hidden bg-slate-100 aspect-video">
          <img
            src={heroAsset.thumbnailRef}
            alt={story.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-blue-600 text-white px-2 py-0.5">
            Story &middot; {story.assetIds.length} assets
          </span>
        </div>
      )}
      <div className={isLarge ? 'p-4' : 'p-3'}>
        {reason && (
          <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">{reason}</span>
        )}
        <h3 className={`font-bold text-black leading-tight ${isLarge ? 'text-base' : 'text-sm'}`}>
          {story.title}
        </h3>
        <p className={`mt-1 text-slate-500 leading-snug line-clamp-2 ${isLarge ? 'text-sm' : 'text-xs'}`}>
          {story.dek}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
          {creator && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 border border-black/15 overflow-hidden bg-slate-100 shrink-0 inline-block">
                <img src={creator.avatarRef} alt={creator.name} className="w-full h-full object-cover" />
              </span>
              <span>{creator.name}</span>
            </span>
          )}
          <span>&middot;</span>
          <span>{story.coverageWindow.start.slice(0, 7)}</span>
          {story.topicTags.slice(0, 2).map(t => (
            <span key={t} className="border border-slate-200 px-1.5 py-0 uppercase tracking-wider font-bold text-slate-400">{t}</span>
          ))}
        </div>
      </div>
    </Link>
  )
}
