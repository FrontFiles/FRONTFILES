'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DECLARATION_STATE_LABELS } from '@/lib/upload/types'
import { checkPublishReadiness } from '@/lib/upload/reducer'
import type { UploadJob } from '@/lib/upload/types'

interface PublishReadinessGateProps {
  job: UploadJob
  onPublish: () => void
}

export function PublishReadinessGate({ job, onPublish }: PublishReadinessGateProps) {
  const canShow = ['awaiting_rights_configuration', 'readiness_blocked', 'ready_for_publish', 'publishing', 'published'].includes(job.state)

  if (!canShow) return null

  if (job.state === 'publishing') {
    return (
      <div className="border-2 border-[#0000ff]">
        <div className="px-6 py-3 bg-[#0000ff]">
          <span className="text-sm font-bold text-white uppercase tracking-wide">Publishing to Vault</span>
        </div>
        <div className="px-6 py-5 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-[#0000ff]/30 border-t-[#0000ff] animate-spin" />
          <span className="text-sm text-black font-bold">Committing asset to Vault…</span>
        </div>
      </div>
    )
  }

  if (job.state === 'published') {
    return (
      <div className="border-2 border-[#0000ff]">
        <div className="px-6 py-3 bg-[#0000ff]">
          <span className="text-sm font-bold text-white uppercase tracking-wide">Published</span>
        </div>
        <div className="px-6 py-5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#0000ff] flex items-center justify-center">
              <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-bold text-black">Asset committed to Vault</span>
          </div>
          {job.publishedAt && (
            <span className="text-xs text-slate-400">
              {new Date(job.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    )
  }

  const readiness = checkPublishReadiness(job)

  return (
    <div className={cn(
      'border-2',
      readiness.allRequirementsMet ? 'border-[#0000ff]' : 'border-black'
    )}>
      <div className={cn(
        'px-6 py-3',
        readiness.allRequirementsMet ? 'bg-[#0000ff]' : 'bg-black'
      )}>
        <span className="text-sm font-bold text-white uppercase tracking-wide">Publish readiness</span>
      </div>
      <div className="px-6 py-5 flex flex-col gap-4">
        {/* Checklist */}
        <div className="flex flex-col gap-2">
          <ReadinessItem label="Metadata confirmed" met={readiness.metadataComplete} />
          <ReadinessItem label="Story assigned" met={readiness.storyAssigned} />
          <ReadinessItem label="Privacy state selected" met={readiness.privacySelected} />
          <ReadinessItem label="Pricing set" met={readiness.pricingSet} detail={job.privacy === 'PRIVATE' ? 'Not required for private assets' : undefined} />
          <ReadinessItem label="Validation Declaration transactable" met={readiness.declarationTransactable} detail={job.declarationState ? DECLARATION_STATE_LABELS[job.declarationState] : undefined} />
          <ReadinessItem label="No manifest review hold" met={readiness.noManifestInvalid} />
        </div>

        {/* Blockers */}
        {readiness.blockers.length > 0 && (
          <div className="border border-dashed border-black px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black block mb-1">Blockers</span>
            <ul className="flex flex-col gap-1">
              {readiness.blockers.map((b, i) => (
                <li key={i} className="text-xs text-slate-600">— {b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Publish button */}
        <Button
          onClick={onPublish}
          disabled={!readiness.allRequirementsMet}
          className={cn(
            'h-11 px-8 font-bold text-sm rounded-none uppercase tracking-wide w-fit',
            readiness.allRequirementsMet
              ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          Publish to Vault
        </Button>
      </div>
    </div>
  )
}

function ReadinessItem({ label, met, detail }: { label: string; met: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      {met ? (
        <div className="w-4 h-4 bg-black flex items-center justify-center shrink-0">
          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div className="w-4 h-4 border border-slate-300 shrink-0" />
      )}
      <div className="flex items-baseline gap-2">
        <span className={cn('text-xs font-bold', met ? 'text-black' : 'text-slate-400')}>{label}</span>
        {detail && <span className="text-[10px] text-slate-400">{detail}</span>}
      </div>
    </div>
  )
}
