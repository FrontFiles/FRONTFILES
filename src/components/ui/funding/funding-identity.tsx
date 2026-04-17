'use client'

import type { FundingCase } from '@/lib/funding/types'
import { FUNDING_CASE_TYPE_LABELS, FUNDING_LIFECYCLE_LABELS } from '@/lib/funding/types'
import { creatorMap } from '@/data'
import { getAvatarCrop } from '@/lib/avatar-crop'

interface FundingIdentityProps {
  fundingCase: FundingCase
}

export function FundingIdentity({ fundingCase }: FundingIdentityProps) {
  const creator = creatorMap[fundingCase.creatorId]
  const typeLabel = FUNDING_CASE_TYPE_LABELS[fundingCase.type]
  const lifecycleLabel = FUNDING_LIFECYCLE_LABELS[fundingCase.lifecycle]

  return (
    <div className="border-2 border-black">
      {/* Hero video / image */}
      {fundingCase.heroVideoRef ? (
        <div className="aspect-[21/9] bg-black overflow-hidden">
          <video
            src={fundingCase.heroVideoRef}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-80"
          />
        </div>
      ) : fundingCase.heroImageRef ? (
        <div className="aspect-[21/9] bg-black overflow-hidden">
          <img
            src={fundingCase.heroImageRef}
            alt={fundingCase.title}
            className="w-full h-full object-cover opacity-80"
          />
        </div>
      ) : (
        <div className="aspect-[21/9] bg-black flex items-center justify-center">
          <span className="text-xs font-bold uppercase tracking-widest text-white/20">{typeLabel}</span>
        </div>
      )}

      <div className="px-6 py-5">
        {/* Type + lifecycle badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]">{typeLabel}</span>
          <span className="text-[10px] text-black/20">&middot;</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            fundingCase.lifecycle === 'active' || fundingCase.lifecycle === 'open' ? 'text-emerald-600' :
            fundingCase.lifecycle === 'completed' ? 'text-black/40' :
            fundingCase.lifecycle === 'failed' || fundingCase.lifecycle === 'cancelled' ? 'text-red-600' :
            'text-black/40'
          }`}>{lifecycleLabel}</span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-black leading-tight tracking-tight">{fundingCase.title}</h2>

        {/* Description */}
        <p className="mt-2 text-sm text-black/60 leading-relaxed">{fundingCase.description}</p>

        {/* Creator */}
        {creator && (
          <div className="mt-4 flex items-center gap-3 pt-4 border-t border-black/10">
            {creator.avatarRef ? (
              <img src={creator.avatarRef} alt={creator.name} className="w-8 h-8 object-cover" style={{ objectPosition: getAvatarCrop(creator.slug) }} />
            ) : (
              <div className="w-8 h-8 bg-black flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{creator.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <span className="text-sm font-bold text-black block leading-tight">{creator.name}</span>
              <span className="text-[11px] text-black/40">{creator.locationBase}</span>
            </div>
          </div>
        )}

        {/* Deadline */}
        {fundingCase.deadlineAt && (
          <div className="mt-3 pt-3 border-t border-black/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">Deadline</span>
            <span className="block text-sm font-mono text-black mt-0.5">
              {new Date(fundingCase.deadlineAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
