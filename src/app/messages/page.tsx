'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  mockConversations,
  mockMessages,
  socialAuthors,
} from '@/lib/mock-data'
import type { Conversation, DirectMessage, CommentAuthor } from '@/lib/types'

export default function MessagesPage() {
  const [activeConvId, setActiveConvId] = useState<string | null>(mockConversations[0]?.id ?? null)
  const [composerText, setComposerText] = useState('')

  const activeConv = mockConversations.find(c => c.id === activeConvId)
  const activeMessages = mockMessages.filter(m => m.conversationId === activeConvId)
  const currentUser = socialAuthors.sarahchen

  // Get the other participant (not the current user)
  function otherParticipant(conv: Conversation): CommentAuthor {
    return conv.participants.find(p => p.username !== currentUser.username) ?? conv.participants[0]
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!composerText.trim()) return
    // In a real app this would dispatch. For mock, just clear.
    setComposerText('')
  }

  const totalUnread = mockConversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list */}
        <div className="w-80 border-r-2 border-black flex flex-col shrink-0">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h1 className="text-sm font-bold uppercase tracking-wide text-black">Messages</h1>
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-black text-white text-[9px] font-bold font-mono">
                {totalUnread}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {mockConversations.map(conv => {
              const other = otherParticipant(conv)
              const isActive = conv.id === activeConvId
              const lastDate = new Date(conv.lastMessage.createdAt)

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    'w-full text-left px-6 py-4 transition-colors',
                    isActive ? 'bg-slate-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 flex items-center justify-center shrink-0 border',
                      conv.unreadCount > 0 ? 'border-black bg-slate-100' : 'border-slate-200 bg-slate-50'
                    )}>
                      <span className="text-[9px] font-bold text-slate-400">
                        {other.displayName.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'text-xs truncate',
                          conv.unreadCount > 0 ? 'font-bold text-black' : 'font-medium text-slate-600'
                        )}>
                          {other.displayName}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 shrink-0">
                          {lastDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <p className={cn(
                        'text-[10px] mt-0.5 truncate',
                        conv.unreadCount > 0 ? 'text-black' : 'text-slate-400'
                      )}>
                        {conv.lastMessage.sender.username === currentUser.username ? 'You: ' : ''}
                        {conv.lastMessage.body}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="w-2 h-2 bg-[#0000ff] shrink-0" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* New conversation button */}
          <div className="px-6 py-3 border-t border-slate-200">
            <button className="w-full h-9 border-2 border-black text-black text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors">
              New message
            </button>
          </div>
        </div>

        {/* Thread view */}
        {activeConv ? (
          <div className="flex-1 flex flex-col">
            {/* Thread header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-4">
              <div className="w-8 h-8 border border-black bg-slate-100 flex items-center justify-center">
                <span className="text-[9px] font-bold text-slate-400">
                  {otherParticipant(activeConv).displayName.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <div className="text-sm font-bold text-black">
                  {otherParticipant(activeConv).displayName}
                </div>
                <div className="text-[10px] text-slate-500">
                  {otherParticipant(activeConv).professionalTitle}
                </div>
              </div>
              {otherParticipant(activeConv).trustBadge && (
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-[#0000ff]">
                  <path d="M8 1L3 3.5v4c0 3.5 2.1 6.8 5 7.5 2.9-.7 5-4 5-7.5v-4L8 1z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" />
                  <path d="M5.5 8l2 2L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
              {activeMessages.map(msg => {
                const isOwn = msg.sender.username === currentUser.username
                const time = new Date(msg.createdAt)

                return (
                  <div
                    key={msg.id}
                    className={cn('flex gap-3 max-w-[75%]', isOwn && 'ml-auto flex-row-reverse')}
                  >
                    <div className={cn(
                      'w-6 h-6 flex items-center justify-center shrink-0',
                      isOwn ? 'bg-[#0000ff]' : 'bg-slate-100 border border-slate-200'
                    )}>
                      <span className={cn(
                        'text-[8px] font-bold',
                        isOwn ? 'text-white' : 'text-slate-400'
                      )}>
                        {msg.sender.displayName.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className={cn(
                      'flex flex-col gap-1',
                      isOwn ? 'items-end' : 'items-start'
                    )}>
                      <div className={cn(
                        'px-4 py-2.5 text-xs leading-relaxed',
                        isOwn
                          ? 'bg-black text-white'
                          : 'bg-slate-100 text-black border border-slate-200'
                      )}>
                        {msg.body}
                      </div>
                      <span className="font-mono text-[9px] text-slate-400">
                        {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Composer */}
            <form onSubmit={handleSend} className="px-6 py-4 border-t-2 border-black flex gap-3">
              <input
                type="text"
                value={composerText}
                onChange={e => setComposerText(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 h-10 border-2 border-black bg-white text-xs text-black px-4 placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
              />
              <button
                type="submit"
                disabled={!composerText.trim()}
                className={cn(
                  'h-10 px-6 text-xs font-bold uppercase tracking-wide transition-colors',
                  composerText.trim()
                    ? 'bg-black text-white hover:bg-slate-800'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                )}
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-slate-400">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}
