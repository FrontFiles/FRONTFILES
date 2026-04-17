'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  conversations as mockConversations,
  messages as mockMessages,
  socialAuthors,
} from '@/data'
import { creatorBySlug } from '@/data/creators'
import { getAvatarCrop } from '@/lib/avatar-crop'
import type { Conversation, DirectMessage, CommentAuthor } from '@/lib/types'

// ── Avatar: creator photo if available, else initials tile ──────
function Avatar({
  author,
  size = 'md',
  isOwn = false,
}: {
  author: CommentAuthor
  size?: 'sm' | 'md' | 'lg'
  isOwn?: boolean
}) {
  const creator = creatorBySlug[author.username]
  const initials = author.displayName.split(' ').map(n => n[0]).join('')
  const dim = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-8 h-8' : 'w-7 h-7'
  const textSize = size === 'sm' ? 'text-[7px]' : 'text-[9px]'

  return (
    <div className={cn(dim, 'shrink-0 overflow-hidden')}>
      {creator?.avatarRef ? (
        <img
          src={creator.avatarRef}
          alt={author.displayName}
          className="w-full h-full object-cover"
          style={{ objectPosition: getAvatarCrop(author.username) }}
        />
      ) : (
        <div className={cn(
          'w-full h-full flex items-center justify-center font-bold',
          textSize,
          isOwn ? 'bg-[#0000ff] text-white' : 'bg-slate-100 text-slate-500'
        )}>
          {initials}
        </div>
      )}
    </div>
  )
}

// ── Trust badge icon ─────────────────────────────────────────────
function TrustBadge({ badge }: { badge: CommentAuthor['trustBadge'] }) {
  if (!badge) return null
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-[#0000ff] shrink-0">
      <path d="M8 1L3 3.5v4c0 3.5 2.1 6.8 5 7.5 2.9-.7 5-4 5-7.5v-4L8 1z"
        stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.12" />
      <path d="M5.5 8l2 2L10.5 6" stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Timestamp helpers ────────────────────────────────────────────
function formatInboxTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatThreadTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Message group: consecutive messages from the same sender ─────
interface MessageGroup {
  sender: CommentAuthor
  isOwn: boolean
  messages: DirectMessage[]
}

function groupMessages(msgs: DirectMessage[], currentUsername: string): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const msg of msgs) {
    const isOwn = msg.sender.username === currentUsername
    const last = groups[groups.length - 1]
    if (last && last.sender.username === msg.sender.username) {
      last.messages.push(msg)
    } else {
      groups.push({ sender: msg.sender, isOwn, messages: [msg] })
    }
  }
  return groups
}

export default function MessagesPage() {
  const [activeConvId, setActiveConvId] = useState<string | null>(mockConversations[0]?.id ?? null)
  const [composerText, setComposerText] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)

  const activeConv = mockConversations.find(c => c.id === activeConvId)
  const activeMessages = mockMessages.filter(m => m.conversationId === activeConvId)
  const currentUser = socialAuthors.sarahchen

  const messageGroups = groupMessages(activeMessages, currentUser.username)

  function otherParticipant(conv: Conversation): CommentAuthor {
    return conv.participants.find(p => p.username !== currentUser.username) ?? conv.participants[0]
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!composerText.trim()) return
    setComposerText('')
  }

  // Scroll to bottom when conversation changes
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId])

  const totalUnread = mockConversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="flex-1 flex overflow-hidden bg-white">

      {/* ── Inbox ─────────────────────────────────────────────── */}
      <div className="w-[260px] border-r border-slate-100 flex flex-col shrink-0">

        {/* Inbox header */}
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-black">
            Messages
          </span>
          {totalUnread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[#0000ff] text-white text-[9px] font-bold font-mono">
              {totalUnread}
            </span>
          )}
        </div>

        {/* Conversation rows */}
        <div className="flex-1 overflow-y-auto">
          {mockConversations.map(conv => {
            const other = otherParticipant(conv)
            const isActive = conv.id === activeConvId
            const isUnread = conv.unreadCount > 0

            return (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  'w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2.5',
                  'border-l-2',
                  isActive
                    ? 'bg-slate-50 border-[#0000ff]'
                    : 'border-transparent hover:bg-slate-50/60'
                )}
              >
                {/* Identity tile */}
                <Avatar author={other} size="md" />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <span className={cn(
                      'text-[12px] truncate leading-none',
                      isUnread ? 'font-bold text-black' : 'font-medium text-slate-600'
                    )}>
                      {other.displayName}
                    </span>
                    <span className="font-mono text-[9px] text-slate-300 shrink-0">
                      {formatInboxTime(conv.lastMessage.createdAt)}
                    </span>
                  </div>
                  <p className={cn(
                    'text-[11px] truncate',
                    isUnread ? 'text-black' : 'text-slate-400'
                  )}>
                    {conv.lastMessage.sender.username === currentUser.username ? 'You · ' : ''}
                    {conv.lastMessage.body}
                  </p>
                </div>

                {/* Unread indicator */}
                {isUnread && (
                  <div className="w-1.5 h-1.5 bg-[#0000ff] shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* New message */}
        <div className="px-4 py-3 border-t border-slate-100">
          <button className="w-full h-8 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 border border-slate-200 hover:border-black hover:text-black transition-colors">
            New message
          </button>
        </div>
      </div>

      {/* ── Thread ─────────────────────────────────────────────── */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Thread header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
            <Avatar author={otherParticipant(activeConv)} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-black truncate">
                  {otherParticipant(activeConv).displayName}
                </span>
                <TrustBadge badge={otherParticipant(activeConv).trustBadge} />
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {otherParticipant(activeConv).professionalTitle}
              </p>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3">
            {messageGroups.map((group, gi) => (
              <div
                key={gi}
                className={cn(
                  'flex gap-2 max-w-[72%]',
                  group.isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
                {/* Avatar — only once per group, aligned to bottom */}
                <div className="flex flex-col justify-end shrink-0">
                  <Avatar author={group.sender} size="sm" isOwn={group.isOwn} />
                </div>

                {/* Bubbles */}
                <div className={cn(
                  'flex flex-col gap-0.5',
                  group.isOwn ? 'items-end' : 'items-start'
                )}>
                  {group.messages.map((msg, mi) => {
                    const isLast = mi === group.messages.length - 1
                    return (
                      <div key={msg.id}>
                        <div className={cn(
                          'px-3 py-2 text-[13px] leading-relaxed',
                          group.isOwn
                            ? 'bg-[#0000ff] text-white'
                            : 'bg-slate-100 text-black'
                        )}>
                          {msg.body}
                        </div>
                        {isLast && (
                          <p className={cn(
                            'font-mono text-[9px] text-slate-300 mt-1',
                            group.isOwn ? 'text-right' : 'text-left'
                          )}>
                            {formatThreadTime(msg.createdAt)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="px-4 py-3 border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={composerText}
              onChange={e => setComposerText(e.target.value)}
              placeholder="Message…"
              className="flex-1 h-9 border border-slate-200 bg-white text-[13px] text-black px-3 placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff] transition-colors"
            />
            <button
              type="submit"
              disabled={!composerText.trim()}
              className={cn(
                'h-9 px-4 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors shrink-0',
                composerText.trim()
                  ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              )}
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-slate-300 uppercase tracking-[0.1em]">Select a conversation</p>
        </div>
      )}
    </div>
  )
}
