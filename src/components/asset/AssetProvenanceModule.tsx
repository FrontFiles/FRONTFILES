import Link from 'next/link'
import type { AssetData } from '@/data'
import type { StoryData } from '@/data'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'

interface AssetProvenanceModuleProps {
  asset: AssetData
  story?: StoryData
}

export function AssetProvenanceModule({ asset, story }: AssetProvenanceModuleProps) {
  return (
    <div>
      {/* Provenance & Metadata */}
      <div className="border-t border-slate-200 pt-4 mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Provenance & Metadata</h2>
        <div className="space-y-2">
          <MetaRow label="Format" value={asset.mediaTypeDisplay} />
          <MetaRow label="Location" value={asset.locationLabel} />
          <MetaRow label="Captured" value={asset.captureDate} />
          <MetaRow label="Ratio" value={asset.aspectRatio} />
          {asset.durationSeconds != null && (
            <MetaRow
              label="Duration"
              value={`${Math.floor(asset.durationSeconds / 60)}:${String(asset.durationSeconds % 60).padStart(2, '0')}`}
            />
          )}
          {asset.wordCount != null && (
            <MetaRow label="Words" value={`${asset.wordCount}`} />
          )}
          <MetaRow label="Published" value={asset.publishedAt?.slice(0, 10) ?? '—'} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Declaration</span>
            <ValidationBadge state={asset.validationDeclaration} />
          </div>
        </div>
      </div>

      {/* Appears in */}
      {story && (
        <div className="mb-4">
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
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-[10px] text-black font-mono truncate ml-2">{value}</span>
    </div>
  )
}
