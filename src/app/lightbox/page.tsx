'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/discovery/SectionHeader'
import { AssetCard } from '@/components/discovery/AssetCard'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { StoryCard } from '@/components/discovery/StoryCard'
import { ArticleCard } from '@/components/discovery/ArticleCard'
import { ContinueSearchCard } from '@/components/discovery/ContinueSearchCard'
import {
  assetMap,
  storyMap,
  articleMap,
} from '@/data'

// ── localStorage session types ──
interface UserSession {
  id: string
  name: string
  itemIds: string[]
  createdAt: number
}

const SESSIONS_KEY = 'frontfiles_lightbox_sessions'
const ACTIVE_KEY = 'frontfiles_lightbox_active'

function loadSessions(): UserSession[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { return [] }
}

function saveSessions(sessions: UserSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  window.dispatchEvent(new Event('lightbox-sessions-change'))
}

function loadActiveId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_KEY)
}

function saveActiveId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

function generateId() {
  return 'lb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

export default function LightboxPage() {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [cartItems, setCartItems] = useState<Set<string>>(new Set())
  const [dropdownId, setDropdownId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const selectorRef = useRef<HTMLDivElement>(null)

  const switchSession = useCallback((id: string) => {
    setActiveId(id)
    saveActiveId(id)
    setSelectedAssets(new Set())
    setDropdownId(null)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('frontfiles_cart')
      if (saved) setCartItems(new Set(JSON.parse(saved)))
    } catch {}

    const s = loadSessions()
    setSessions(s)
    const savedActive = loadActiveId()

    if (savedActive && s.some(x => x.id === savedActive)) {
      setActiveId(savedActive)
    } else if (s.length > 0) {
      setActiveId(s[0].id)
      saveActiveId(s[0].id)
    }

    const handler = () => setSessions(loadSessions())
    window.addEventListener('lightbox-sessions-change', handler)
    return () => window.removeEventListener('lightbox-sessions-change', handler)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownId) return
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) setDropdownId(null)
    }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [dropdownId])

  // Focus rename input
  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.select(), 50)
  }, [renamingId])

  // Native click fallback
  useEffect(() => {
    const container = selectorRef.current
    if (!container) return
    const handleClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('[data-session-id]') as HTMLElement | null
      if (btn && !(e.target as HTMLElement).closest('[data-dropdown]')) {
        const sid = btn.getAttribute('data-session-id')
        if (sid) switchSession(sid)
      }
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [switchSession])

  function resolveItemIds(itemIds: string[]): string[] {
    const resolved: string[] = []
    const seen = new Set<string>()
    for (const id of itemIds) {
      if (assetMap[id]) {
        if (!seen.has(id)) { resolved.push(id); seen.add(id) }
      } else if (storyMap[id]) {
        for (const aid of storyMap[id].assetIds) {
          if (assetMap[aid] && !seen.has(aid)) { resolved.push(aid); seen.add(aid) }
        }
      } else if (articleMap[id]) {
        for (const aid of articleMap[id].sourceAssetIds) {
          if (assetMap[aid] && !seen.has(aid)) { resolved.push(aid); seen.add(aid) }
        }
      }
    }
    return resolved
  }

  const resolvedSessions = useMemo(() => {
    return sessions.map(s => ({
      ...s,
      assetIds: resolveItemIds(s.itemIds),
    }))
  }, [sessions])

  const session = resolvedSessions.find(s => s.id === activeId) || resolvedSessions[0]

  // ── Session actions ──
  const createSession = () => {
    const newSession: UserSession = {
      id: generateId(),
      name: `Session ${sessions.length + 1}`,
      itemIds: [],
      createdAt: Date.now(),
    }
    const updated = [...sessions, newSession]
    saveSessions(updated)
    setSessions(updated)
    switchSession(newSession.id)
  }

  const deleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id)
    saveSessions(updated)
    setSessions(updated)
    setDropdownId(null)
    if (activeId === id) {
      const next = updated[0]
      if (next) { setActiveId(next.id); saveActiveId(next.id) } else { setActiveId('') }
    }
  }

  const renameSession = (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) { setRenamingId(null); return }
    const updated = sessions.map(s => s.id === id ? { ...s, name: trimmed } : s)
    saveSessions(updated)
    setSessions(updated)
    setRenamingId(null)
  }

  const shareSession = (id: string) => {
    const s = sessions.find(x => x.id === id)
    if (!s) return
    const data = { name: s.name, items: s.itemIds }
    const encoded = btoa(JSON.stringify(data))
    const url = `${window.location.origin}/lightbox?shared=${encoded}`
    navigator.clipboard.writeText(url).catch(() => {})
    setDropdownId(null)
  }

  const saveCart = (items: Set<string>) => {
    setCartItems(items)
    localStorage.setItem('frontfiles_cart', JSON.stringify([...items]))
  }

  const addAllToCart = () => {
    if (!session) return
    const next = new Set(cartItems)
    session.assetIds.forEach(id => next.add(id))
    saveCart(next)
  }

  const addSelectedToCart = () => {
    const next = new Set(cartItems)
    selectedAssets.forEach(id => next.add(id))
    saveCart(next)
  }

  const toggleSelect = (id: string) => {
    setSelectedAssets(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const selectAll = () => {
    if (!session) return
    setSelectedAssets(new Set(session.assetIds))
  }

  const deselectAll = () => setSelectedAssets(new Set())

  if (!session) {
    return (
      <div className="flex-1 bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-sm text-slate-400">No Lightbox sessions yet.</p>
          <button
            onClick={createSession}
            className="text-[11px] font-bold uppercase tracking-wider text-white bg-[#0000ff] px-4 py-2 hover:bg-[#0000cc] transition-colors"
          >
            Create session
          </button>
          <Link href="/search" className="text-[11px] font-bold uppercase tracking-wider text-[#0000ff] border border-[#0000ff] px-4 py-2 hover:bg-[#0000ff] hover:text-white transition-colors">
            Start searching
          </Link>
        </div>
      </div>
    )
  }

  const assets = session.assetIds.map(aid => assetMap[aid]).filter(Boolean)

  // Derive stories from assets
  const derivedStories = [...new Set(assets.flatMap(a => {
    return Object.values(storyMap).filter(s => s.assetIds.includes(a.id)).map(s => s.id)
  }))].map(sid => storyMap[sid]).filter(Boolean)

  // Total price
  const totalPrice = assets.reduce((sum, a) => sum + (a.price || 0), 0)
  const selectedPrice = assets.filter(a => selectedAssets.has(a.id)).reduce((sum, a) => sum + (a.price || 0), 0)
  const inCartCount = assets.filter(a => cartItems.has(a.id)).length

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <main>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Session selector */}
          <div ref={selectorRef} className="flex items-center gap-2 mb-8 flex-wrap">
            {resolvedSessions.map(s => (
              <div key={s.id} className="relative" data-dropdown>
                {renamingId === s.id ? (
                  <input
                    ref={renameInputRef}
                    autoFocus
                    defaultValue={s.name}
                    onBlur={e => renameSession(s.id, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameSession(s.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setRenamingId(null) }}
                    className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 border-2 border-[#0000ff] outline-none bg-white w-[180px]"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <button
                    data-session-id={s.id}
                    onClick={() => switchSession(s.id)}
                    onContextMenu={(e) => { e.preventDefault(); setDropdownId(dropdownId === s.id ? null : s.id) }}
                    className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      s.id === session.id
                        ? 'bg-[#0000ff] text-white border-[#0000ff]'
                        : 'border-black/20 text-black/60 hover:border-black hover:text-black'
                    }`}
                  >
                    {s.name} ({s.assetIds.length})
                    <span
                      className={`ml-1.5 w-5 h-5 inline-flex items-center justify-center rounded-sm transition-colors ${s.id === session.id ? 'text-white hover:bg-white/20' : 'text-black/50 hover:text-black hover:bg-black/10'}`}
                      onClick={(e) => { e.stopPropagation(); setDropdownId(dropdownId === s.id ? null : s.id) }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
                    </span>
                  </button>
                )}

                {/* Dropdown */}
                {dropdownId === s.id && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white border-2 border-black shadow-lg w-[160px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setDropdownId(null) }}
                      className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-black hover:bg-black/5 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                      Rename
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); shareSession(s.id) }}
                      className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-black hover:bg-black/5 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                      Share link
                    </button>
                    <div className="border-t border-black/10" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                      className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* New session button */}
            <button
              onClick={createSession}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 border border-dashed border-black/20 text-black/40 hover:border-[#0000ff] hover:text-[#0000ff] transition-colors cursor-pointer"
            >
              + New
            </button>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Main content */}
            <div className="col-span-8">
              {/* Session header with select controls */}
              <div className="flex items-center justify-between mb-4">
                <SectionHeader label={session.name} sublabel={`${assets.length} shortlisted assets`} />
                <div className="flex items-center gap-2 shrink-0">
                  {selectedAssets.size > 0 ? (
                    <button onClick={deselectAll} className="text-[9px] font-bold uppercase tracking-wider text-black/40 hover:text-black transition-colors">
                      Deselect all
                    </button>
                  ) : (
                    <button onClick={selectAll} className="text-[9px] font-bold uppercase tracking-wider text-black/40 hover:text-black transition-colors">
                      Select all
                    </button>
                  )}
                </div>
              </div>

              {/* Assets grid */}
              {assets.length === 0 ? (
                <div className="border-2 border-dashed border-black/15 py-16 flex flex-col items-center justify-center gap-3 mb-10">
                  <p className="text-sm text-black/30">This session is empty</p>
                  <Link href="/search" className="text-[10px] font-bold uppercase tracking-wider text-[#0000ff] hover:underline">
                    Search &amp; add assets
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 mb-10">
                  {assets.map(a => (
                    <div key={a.id} className="relative">
                      <div
                        className={`cursor-pointer transition-all ${selectedAssets.has(a.id) ? 'ring-3 ring-[#0000ff] ring-offset-2' : ''}`}
                        onClick={() => toggleSelect(a.id)}
                      >
                        <AssetCard asset={a} />
                      </div>
                      <div
                        className={`absolute top-2 left-2 w-5 h-5 border-2 flex items-center justify-center cursor-pointer z-10 transition-colors ${
                          selectedAssets.has(a.id) ? 'bg-[#0000ff] border-[#0000ff]' : 'bg-white/80 border-black/30 hover:border-black'
                        }`}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(a.id) }}
                      >
                        {selectedAssets.has(a.id) && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      {cartItems.has(a.id) && (
                        <div className="absolute top-2 right-2 bg-green-600 text-white text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 z-10">
                          In cart
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Full Story surfacing */}
              {derivedStories.length > 0 && (
                <section className="mb-10">
                  <SectionHeader label="Full Stories from shortlisted assets" sublabel="View the complete coverage" />
                  <div className="grid grid-cols-2 gap-4">
                    {derivedStories.map(s => (
                      <StoryCard key={s.id} story={s} reason="Same Story" />
                    ))}
                  </div>
                </section>
              )}

              {/* Continue */}
              <ContinueSearchCard label="Continue building this Lightbox" />
            </div>

            {/* Right rail */}
            <div className="col-span-4">
              {/* Summary */}
              <div className="border-2 border-black p-4 mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-4">Lightbox summary</h3>
                <MetaRow label="Assets" value={String(assets.length)} />
                <MetaRow label="Stories" value={String(derivedStories.length)} />
                <MetaRow label="Estimated total" value={`\u20AC${totalPrice}`} />
                {inCartCount > 0 && (
                  <MetaRow label="In cart" value={`${inCartCount} of ${assets.length}`} />
                )}

                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={addAllToCart}
                    className="w-full bg-[#0000ff] text-white text-[11px] font-bold uppercase tracking-wider py-3 hover:bg-[#0000cc] transition-colors"
                  >
                    Add all to cart ({assets.length}) &middot; &euro;{totalPrice}
                  </button>
                  {selectedAssets.size > 0 && (
                    <button
                      onClick={addSelectedToCart}
                      className="w-full bg-white text-[#0000ff] border-2 border-[#0000ff] text-[11px] font-bold uppercase tracking-wider py-3 hover:bg-[#0000ff]/5 transition-colors"
                    >
                      Add selected to cart ({selectedAssets.size}) &middot; &euro;{selectedPrice}
                    </button>
                  )}
                  {cartItems.size > 0 && (
                    <Link
                      href="/cart"
                      className="w-full bg-black text-white text-[11px] font-bold uppercase tracking-wider py-3 hover:bg-black/80 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      Go to cart ({cartItems.size})
                    </Link>
                  )}
                </div>
              </div>

              {/* Selection info */}
              {selectedAssets.size > 0 && (
                <div className="border-2 border-[#0000ff] p-4 mb-4 bg-[#0000ff]/5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] mb-2">
                    {selectedAssets.size} selected
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {[...selectedAssets].map(id => {
                      const a = assetMap[id]
                      if (!a) return null
                      return (
                        <div key={id} className="w-10 h-7 overflow-hidden border border-[#0000ff]/30">
                          {a.id ? (
                            <img src={resolveProtectedUrl(a.id, 'thumbnail')} alt={a.title} className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                              <span className="text-[5px] font-bold text-black/30">{a.format}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={deselectAll}
                    className="text-[8px] font-bold uppercase tracking-wider text-[#0000ff] mt-2 hover:underline"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-bold text-black">{value}</span>
    </div>
  )
}
