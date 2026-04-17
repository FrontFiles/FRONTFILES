'use client'

import { Button } from '@/components/ui/button'
import { StateBadge } from './StateBadge'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import type { VaultAsset } from '@/lib/types'

interface VaultDetailDrawerProps {
  asset: VaultAsset
  onClose: () => void
}

export function VaultDetailDrawer({ asset, onClose }: VaultDetailDrawerProps) {
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
    <aside className="w-96 border-l-2 border-black bg-white shrink-0 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset detail</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-black transition-colors"
        >
          <span className="text-lg">×</span>
        </button>
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col gap-5">
        {/* Preview */}
        <div className="aspect-video bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
          {asset.id ? (
            <img src={resolveProtectedUrl(asset.id, 'thumbnail')} alt={asset.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold font-mono text-slate-300">{formatIcon[asset.format]}</span>
          )}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-base font-bold text-black">{asset.title}</h2>
          <p className="text-sm text-slate-600 mt-1">{asset.description}</p>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetaField label="Format" value={asset.format} />
          <MetaField label="File size" value={asset.fileSize} />
          <MetaField label="Uploaded" value={new Date(asset.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <MetaField label="Certified" value={asset.certifiedAt ? new Date(asset.certifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '·'} />
        </div>

        {/* State badges */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
          <div className="flex flex-wrap gap-2">
            <StateBadge variant={asset.privacy.toLowerCase() as 'public' | 'private' | 'restricted'} />
            {asset.declarationState && (
              <StateBadge variant={asset.declarationState} />
            )}
            <StateBadge variant={asset.publication.toLowerCase() as 'published' | 'draft'} />
          </div>
        </div>

        {/* Certification hash */}
        {asset.certificationHash && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Certification hash</span>
            <span className="font-mono text-xs text-slate-500 break-all">{asset.certificationHash}</span>
          </div>
        )}

        {/* Provenance */}
        <div className="border border-slate-200 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Provenance status</span>
          <span className="text-xs text-slate-500">
            {asset.declarationState === 'fully_validated' ? 'Full chain available' : 'Pending certification'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
          <Button className="h-9 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-xs rounded-none uppercase tracking-wide w-full">
            Publish to Frontfolio
          </Button>
          <Button variant="outline" className="h-9 border-2 border-black text-black hover:bg-black hover:text-white font-bold text-xs rounded-none uppercase tracking-wide w-full">
            Change privacy
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="h-9 text-slate-400 hover:text-black hover:bg-slate-50 text-xs rounded-none flex-1">
              Add to Story
            </Button>
            <Button variant="ghost" className="h-9 text-slate-400 hover:text-black hover:bg-slate-50 text-xs rounded-none flex-1">
              Download
            </Button>
          </div>
        </div>

        {/* CEL excerpt */}
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Certification Event Log</span>
          <div className="border border-slate-200 divide-y divide-slate-200">
            <CelRow event="Uploaded" timestamp={asset.uploadedAt} />
            {asset.certifiedAt && <CelRow event="Certified" timestamp={asset.certifiedAt} />}
            {asset.publication === 'PUBLISHED' && asset.certifiedAt && (
              <CelRow event="Published to Frontfolio" timestamp={asset.certifiedAt} />
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-sm text-black font-medium capitalize">{value}</span>
    </div>
  )
}

function CelRow({ event, timestamp }: { event: string; timestamp: string }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between">
      <span className="text-xs text-black">{event}</span>
      <span className="font-mono text-[10px] text-slate-400">
        {new Date(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </span>
    </div>
  )
}
