'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UploadJob, MetadataProposal, ProposalField } from '@/lib/upload/types'

interface MetadataCompletionPanelProps {
  job: UploadJob
  onConfirm: (title: string, description: string, tags: string[], geographicTags: string[]) => void
}

export function MetadataCompletionPanel({ job, onConfirm }: MetadataCompletionPanelProps) {
  const proposal = job.metadataProposal
  const confirmed = job.confirmedMetadata

  const [title, setTitle] = useState(confirmed?.title ?? proposal?.title.value ?? '')
  const [description, setDescription] = useState(confirmed?.description ?? proposal?.description.value ?? '')
  const [tagsInput, setTagsInput] = useState('')
  const [tags, setTags] = useState<string[]>(confirmed?.tags ?? proposal?.tags.value ?? [])
  const [geoTags, setGeoTags] = useState<string[]>(confirmed?.geographicTags ?? proposal?.geographicTags.value ?? [])
  const [geoInput, setGeoInput] = useState('')

  // Reset fields when proposal changes
  useEffect(() => {
    if (proposal && !confirmed) {
      setTitle(proposal.title.value)
      setDescription(proposal.description.value)
      setTags(proposal.tags.value)
      setGeoTags(proposal.geographicTags.value)
    }
  }, [proposal?.title.value])

  function handleAddTag() {
    const t = tagsInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagsInput('')
    }
  }

  function handleAddGeoTag() {
    const t = geoInput.trim()
    if (t && !geoTags.includes(t)) {
      setGeoTags([...geoTags, t])
      setGeoInput('')
    }
  }

  const canConfirm = title.trim().length > 0 && description.trim().length > 0

  if (job.state !== 'awaiting_creator_confirmation' && job.state !== 'ready_for_completion') {
    if (confirmed) {
      return (
        <div className="border-2 border-blue-600">
          <div className="px-6 py-3 border-b-2 border-blue-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-black flex items-center justify-center">
                <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm font-bold text-black uppercase tracking-wide">Metadata confirmed</span>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col gap-2">
            <MetaDisplay label="Title" value={confirmed.title} />
            <MetaDisplay label="Description" value={confirmed.description} />
            <MetaDisplay label="Tags" value={confirmed.tags.join(', ') || '—'} />
            <MetaDisplay label="Geographic tags" value={confirmed.geographicTags.join(', ') || '—'} />
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="border-2 border-black">
      <div className="px-6 py-3 bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Creator confirmation required</span>
      </div>
      <div className="px-6 py-5 flex flex-col gap-5">
        <p className="text-xs text-slate-500">
          Review and confirm the metadata below. AI-proposed values are suggestions — edit freely before confirming.
        </p>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Title</span>
            {proposal && <SourceBadge field={proposal.title} />}
          </div>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-9 border-2 border-black text-sm text-black rounded-none focus-visible:border-blue-600 focus-visible:ring-0"
            placeholder="Asset title"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</span>
            {proposal && <SourceBadge field={proposal.description} />}
          </div>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="border-2 border-black text-sm text-black rounded-none focus-visible:border-blue-600 focus-visible:ring-0 min-h-20 resize-none"
            placeholder="Describe this content"
          />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tags</span>
            {proposal && <SourceBadge field={proposal.tags} />}
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-6">
            {tags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 text-black text-xs px-2 py-0.5">
                {tag}
                <button
                  onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-black text-[10px]"
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              className="h-8 border border-slate-300 text-sm rounded-none focus-visible:border-blue-600 focus-visible:ring-0"
              placeholder="Add a tag…"
            />
            <Button onClick={handleAddTag} disabled={!tagsInput.trim()} variant="outline" className="h-8 px-3 border-2 border-black text-xs rounded-none font-bold uppercase tracking-wide">Add</Button>
          </div>
        </div>

        {/* Geographic tags */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Geographic tags</span>
            {proposal && <SourceBadge field={proposal.geographicTags} />}
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-6">
            {geoTags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 text-black text-xs px-2 py-0.5">
                {tag}
                <button
                  onClick={() => setGeoTags(geoTags.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-black text-[10px]"
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={geoInput}
              onChange={e => setGeoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddGeoTag())}
              className="h-8 border border-slate-300 text-sm rounded-none focus-visible:border-blue-600 focus-visible:ring-0"
              placeholder="Add a location…"
            />
            <Button onClick={handleAddGeoTag} disabled={!geoInput.trim()} variant="outline" className="h-8 px-3 border-2 border-black text-xs rounded-none font-bold uppercase tracking-wide">Add</Button>
          </div>
        </div>

        {/* Confirm button */}
        <Button
          onClick={() => onConfirm(title, description, tags, geoTags)}
          disabled={!canConfirm}
          className={cn(
            'h-11 px-8 font-bold text-sm rounded-none uppercase tracking-wide w-fit',
            canConfirm ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          Confirm metadata
        </Button>
      </div>
    </div>
  )
}

function SourceBadge({ field }: { field: ProposalField<unknown> }) {
  if (field.source === 'ai') {
    return (
      <span className="text-[9px] font-bold tracking-widest uppercase border border-black text-black px-1.5 py-0.5">
        AI {field.confidence !== null ? `${Math.round(field.confidence * 100)}%` : ''}
      </span>
    )
  }
  if (field.source === 'extracted') {
    return (
      <span className="text-[9px] font-bold tracking-widest uppercase border border-blue-600 text-blue-600 px-1.5 py-0.5">
        Extracted
      </span>
    )
  }
  return null
}

function MetaDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-sm text-black">{value}</span>
    </div>
  )
}
