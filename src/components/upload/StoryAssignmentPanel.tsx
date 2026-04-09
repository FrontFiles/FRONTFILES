'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UploadJob, StoryRef } from '@/lib/upload/types'

interface StoryAssignmentPanelProps {
  job: UploadJob
  stories: StoryRef[]
  onAssignStory: (story: StoryRef) => void
  onCreateStory: (title: string) => StoryRef
  onClearStory: () => void
}

export function StoryAssignmentPanel({ job, stories, onAssignStory, onCreateStory, onClearStory }: StoryAssignmentPanelProps) {
  const [newStoryTitle, setNewStoryTitle] = useState('')
  const [search, setSearch] = useState('')

  const isAssignable = job.state === 'awaiting_story_assignment' || job.state === 'awaiting_rights_configuration' || job.state === 'readiness_blocked' || job.state === 'ready_for_publish'

  // Show confirmed state
  if (job.storyAssignment && !isAssignableState(job.state)) {
    return (
      <div className="border-2 border-blue-600">
        <div className="px-6 py-3 border-b-2 border-blue-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-black flex items-center justify-center">
              <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-bold text-black uppercase tracking-wide">Story assigned</span>
          </div>
        </div>
        <div className="px-6 py-4">
          <span className="text-sm text-black font-medium">{job.storyAssignment.title}</span>
          <span className="text-[10px] text-slate-400 ml-2">{job.storyAssignment.assetCount} assets</span>
        </div>
      </div>
    )
  }

  if (!isAssignable) return null

  const filtered = stories.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  function handleCreateStory() {
    const t = newStoryTitle.trim()
    if (!t) return
    const story = onCreateStory(t)
    onAssignStory(story)
    setNewStoryTitle('')
  }

  return (
    <div className="border-2 border-black">
      <div className="px-6 py-3 bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Story assignment</span>
      </div>
      <div className="px-6 py-5 flex flex-col gap-5">
        <p className="text-xs text-slate-500">
          Every asset must belong to a Story before publication. Select an existing Story or create a new one.
        </p>

        {/* Current assignment */}
        {job.storyAssignment && (
          <div className="border-2 border-blue-600 px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-0.5">Assigned to</span>
              <span className="text-sm text-black font-medium">{job.storyAssignment.title}</span>
              {job.storyAssignment.isNew && (
                <span className="text-[9px] font-bold tracking-widest uppercase border border-blue-600 text-blue-600 px-1.5 py-0.5 ml-2">New</span>
              )}
            </div>
            <button onClick={onClearStory} className="text-xs text-slate-400 hover:text-black font-bold uppercase tracking-wide">Change</button>
          </div>
        )}

        {/* Story selection */}
        {!job.storyAssignment && (
          <>
            {/* Search existing */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Existing stories</span>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 border border-slate-300 text-sm rounded-none focus-visible:border-blue-600 focus-visible:ring-0"
                placeholder="Search stories…"
              />
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {filtered.map(story => (
                  <button
                    key={story.id}
                    onClick={() => onAssignStory(story)}
                    className="flex items-center justify-between px-3 py-2 border border-slate-200 hover:border-black transition-colors text-left"
                  >
                    <span className="text-sm text-black font-medium">{story.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{story.assetCount} assets</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <span className="text-xs text-slate-400 py-2">No stories found</span>
                )}
              </div>
            </div>

            {/* Create new */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Create new story</span>
              <div className="flex gap-2">
                <Input
                  value={newStoryTitle}
                  onChange={e => setNewStoryTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateStory())}
                  className="h-9 border-2 border-black text-sm rounded-none focus-visible:border-blue-600 focus-visible:ring-0"
                  placeholder="Story title"
                />
                <Button
                  onClick={handleCreateStory}
                  disabled={!newStoryTitle.trim()}
                  className={cn(
                    'h-9 px-4 font-bold text-xs rounded-none uppercase tracking-wide',
                    newStoryTitle.trim() ? 'bg-black text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  )}
                >
                  Create
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function isAssignableState(state: string): boolean {
  return ['awaiting_story_assignment', 'awaiting_rights_configuration', 'readiness_blocked', 'ready_for_publish'].includes(state)
}
