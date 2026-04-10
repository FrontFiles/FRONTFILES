'use client'

import { cn } from '@/lib/utils'
import { ASSET_FORMAT_LABELS, FAILURE_REASON_LABELS } from '@/lib/upload/types'
import { formatFileSize } from '@/lib/upload/validation'
import type { UploadJob } from '@/lib/upload/types'

interface UploadJobListProps {
  jobs: UploadJob[]
  activeJobId: string | null
  onSelectJob: (jobId: string) => void
  onRemoveJob: (jobId: string) => void
}

const STATE_LABELS: Record<string, string> = {
  selecting: 'Validating',
  validating: 'Validating',
  rejected: 'Rejected',
  ingesting: 'Uploading',
  uploaded: 'Uploaded',
  analysing: 'Analysing',
  flagged: 'Flagged',
  manifest_invalid: 'Manifest Invalid',
  ready_for_completion: 'Ready for completion',
  awaiting_creator_confirmation: 'Awaiting confirmation',
  awaiting_story_assignment: 'Story assignment required',
  awaiting_rights_configuration: 'Rights configuration',
  readiness_blocked: 'Publish blocked',
  ready_for_publish: 'Ready to publish',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
}

export function UploadJobList({ jobs, activeJobId, onSelectJob, onRemoveJob }: UploadJobListProps) {
  if (jobs.length === 0) return null

  return (
    <div className="border-2 border-black">
      {/* Header */}
      <div className="grid grid-cols-[1fr_5rem_6rem_6rem_2rem] gap-2 px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest">
        <span>File</span>
        <span>Format</span>
        <span>Size</span>
        <span>Status</span>
        <span />
      </div>

      {/* Rows */}
      {jobs.map(job => (
        <div
          key={job.id}
          onClick={() => onSelectJob(job.id)}
          className={cn(
            'grid grid-cols-[1fr_5rem_6rem_6rem_2rem] gap-2 px-4 py-3 border-b border-slate-200 cursor-pointer transition-colors items-center',
            activeJobId === job.id && 'bg-[#0000ff]/5 border-l-2 border-l-[#0000ff]',
            activeJobId !== job.id && 'hover:bg-slate-50'
          )}
        >
          {/* File name */}
          <div className="min-w-0">
            <span className="text-sm text-black font-medium truncate block">{job.fileName}</span>
            {job.state === 'ingesting' && (
              <div className="mt-1 h-1 bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0000ff] transition-all duration-300"
                  style={{ width: `${job.uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Format */}
          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">
            {job.format ? ASSET_FORMAT_LABELS[job.format] : '—'}
          </span>

          {/* Size */}
          <span className="text-[10px] font-mono text-slate-400">
            {formatFileSize(job.fileSize)}
          </span>

          {/* Status */}
          <JobStateBadge state={job.state} failureReason={job.failureReason} />

          {/* Remove */}
          {(job.state === 'rejected' || job.state === 'failed' || job.state === 'published') && (
            <button
              onClick={e => { e.stopPropagation(); onRemoveJob(job.id) }}
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-black transition-colors"
            >
              <span className="text-sm">×</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function JobStateBadge({ state, failureReason }: { state: string; failureReason: string | null }) {
  const isError = state === 'rejected' || state === 'failed' || state === 'manifest_invalid'
  const isActive = state === 'ingesting' || state === 'analysing' || state === 'publishing'
  const isSuccess = state === 'published'
  const isAction = state === 'awaiting_creator_confirmation' || state === 'awaiting_story_assignment' || state === 'awaiting_rights_configuration' || state === 'readiness_blocked'
  const isReady = state === 'ready_for_publish'

  return (
    <div className="flex flex-col">
      <span
        className={cn(
          'text-[9px] font-bold uppercase tracking-widest',
          isError && 'text-black',
          isActive && 'text-[#0000ff]',
          isSuccess && 'text-black',
          isAction && 'text-black',
          isReady && 'text-[#0000ff]',
          !isError && !isActive && !isSuccess && !isAction && !isReady && 'text-slate-400'
        )}
      >
        {STATE_LABELS[state] ?? state}
      </span>
      {isError && failureReason && (
        <span className="text-[9px] text-slate-400 truncate">
          {FAILURE_REASON_LABELS[failureReason as keyof typeof FAILURE_REASON_LABELS] ?? failureReason}
        </span>
      )}
    </div>
  )
}
