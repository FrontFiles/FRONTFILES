import Link from 'next/link'
import type { StoryData } from '@/data'

interface AssetAppearsInProps {
  story: StoryData
}

export function AssetAppearsIn({ story }: AssetAppearsInProps) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Appears in:</span>
      <Link
        href={`/story/${story.id}`}
        className="block border-2 border-slate-200 p-4 hover:border-black transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]">Story</span>
        <p className="text-sm font-bold text-black mt-1 leading-tight">{story.title}</p>
        <p className="text-[10px] text-slate-400 mt-1">
          {story.assetIds.length} assets · {story.coverageWindow.start.slice(0, 10)} – {story.coverageWindow.end.slice(0, 10)}
        </p>
      </Link>
    </div>
  )
}
