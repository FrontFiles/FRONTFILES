'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Comment } from '@/lib/types'
import { useUser } from '@/lib/user-context'

interface CommentSectionProps {
  comments: Comment[]
  targetType: 'asset' | 'story' | 'article'
  targetId: string
}

export function CommentSection({ comments, targetType, targetId }: CommentSectionProps) {
  const { sessionUser } = useUser()
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState('')
  const [localComments, setLocalComments] = useState(comments)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return

    const newComment: Comment = {
      id: `cmt-local-${Date.now()}`,
      targetType,
      targetId,
      author: {
        username: sessionUser.username,
        displayName: sessionUser.displayName,
        professionalTitle: '',
        trustBadge: 'verified',
      },
      body: body.trim(),
      createdAt: new Date().toISOString(),
      parentId: null,
    }
    setLocalComments(prev => [...prev, newComment])
    setBody('')
  }

  const topLevel = localComments.filter(c => !c.parentId)
  const replies = localComments.filter(c => c.parentId)

  return (
    <div>
      {/* Add context button — always visible, blue when expanded */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`flex items-center gap-2 border-2 border-[#0000ff] px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors w-full justify-center ${
          expanded ? 'bg-[#0000ff] text-white' : 'bg-white text-[#0000ff]'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Add context
        {localComments.length > 0 && (
          <span className={`text-[9px] font-mono ml-1 ${expanded ? 'text-white/60' : 'text-slate-400'}`}>({localComments.length})</span>
        )}
      </button>

      {/* Expanded: composer + comments */}
      {expanded && (
        <div className="border-2 border-t-0 border-[#0000ff]">
          {/* Composer */}
          <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-b border-slate-200">
            <div className="w-7 h-7 bg-[#0000ff] flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-white">{sessionUser.displayName.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Add context, corrections, or sources..."
                className="flex-1 h-8 border border-slate-200 bg-white text-xs text-black px-3 placeholder:text-slate-300 focus:outline-none focus:border-black"
                autoFocus
              />
              <button
                type="submit"
                disabled={!body.trim()}
                className={cn(
                  'h-8 px-4 text-[10px] font-bold uppercase tracking-wide transition-colors',
                  body.trim()
                    ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                )}
              >
                Post
              </button>
            </div>
          </form>

          {/* Comment list */}
          <div className="px-4">
            {topLevel.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {topLevel.map(comment => (
                  <div key={comment.id}>
                    <CommentRow comment={comment} />
                    {replies
                      .filter(r => r.parentId === comment.id)
                      .map(reply => (
                        <div key={reply.id} className="ml-6 border-l-2 border-slate-200">
                          <CommentRow comment={reply} />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-400">No context added yet. Be the first.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CommentRow({ comment }: { comment: Comment }) {
  const date = new Date(comment.createdAt)
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  return (
    <div className="py-3 flex gap-3">
      <div className="w-6 h-6 bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
        <span className="text-[8px] font-bold text-slate-400">
          {comment.author.displayName.split(' ').map(n => n[0]).join('')}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-black">{comment.author.displayName}</span>
          {comment.author.trustBadge && (
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-[#0000ff] shrink-0">
              <path d="M8 1L3 3.5v4c0 3.5 2.1 6.8 5 7.5 2.9-.7 5-4 5-7.5v-4L8 1z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" />
              <path d="M5.5 8l2 2L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className="font-mono text-[9px] text-slate-400">{dateStr}</span>
        </div>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{comment.body}</p>
      </div>
    </div>
  )
}

/** Compact counter for content cards */
export function CommentCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
      <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
        <path d="M2 3h12v8H5l-3 3V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
      {count}
    </span>
  )
}
