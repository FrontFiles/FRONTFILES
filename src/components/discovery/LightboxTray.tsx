'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { assetMap, storyMap, articleMap } from '@/data'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'

// ── Types ──
interface LightboxSession {
  id: string
  name: string
  itemIds: string[]        // asset/story/article IDs
  createdAt: number
}

const SESSIONS_KEY = 'frontfiles_lightbox_sessions'
const ACTIVE_KEY = 'frontfiles_lightbox_active'

function loadSessions(): LightboxSession[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { return [] }
}

function saveSessions(sessions: LightboxSession[]) {
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

// ── Hook for external use ──
export function useLightboxSession() {
  const [sessions, setSessions] = useState<LightboxSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    setSessions(loadSessions())
    setActiveId(loadActiveId())
    const handler = () => setSessions(loadSessions())
    window.addEventListener('lightbox-sessions-change', handler)
    return () => window.removeEventListener('lightbox-sessions-change', handler)
  }, [])

  const active = sessions.find(s => s.id === activeId) || null
  return { sessions, active, activeId }
}

// ── Component ──

/**
 * `onHide` is OPTIONAL: only the Discovery surface uses it (where
 * the tray is mounted as an independent right rail with a collapse
 * trigger). The standalone /lightbox page omits it and the Hide
 * button is hidden — that page is the lightbox's own home and
 * doesn't need a way to dismiss it.
 */
export interface LightboxTrayProps {
  onHide?: () => void
}

export function LightboxTray({ onHide }: LightboxTrayProps = {}) {
  const [sessions, setSessions] = useState<LightboxSession[]>([])
  const [activeId, setActiveIdState] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const s = loadSessions()
    setSessions(s)
    const aId = loadActiveId()
    if (aId && s.find(x => x.id === aId)) {
      setActiveIdState(aId)
    } else if (s.length > 0) {
      setActiveIdState(s[0].id)
      saveActiveId(s[0].id)
    }
    const handler = () => setSessions(loadSessions())
    window.addEventListener('lightbox-sessions-change', handler)
    return () => window.removeEventListener('lightbox-sessions-change', handler)
  }, [])

  const active = sessions.find(s => s.id === activeId) || null

  const setActiveId = (id: string) => {
    setActiveIdState(id)
    saveActiveId(id)
    setSelectedItems(new Set())
  }

  const createSession = () => {
    const newSession: LightboxSession = {
      id: generateId(),
      name: `Session ${sessions.length + 1}`,
      itemIds: [],
      createdAt: Date.now(),
    }
    const updated = [...sessions, newSession]
    saveSessions(updated)
    setSessions(updated)
    setActiveId(newSession.id)
    setShowPicker(false)
  }

  const deleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id)
    saveSessions(updated)
    setSessions(updated)
    if (activeId === id) {
      const next = updated[0]?.id || null
      if (next) { setActiveIdState(next); saveActiveId(next) } else { setActiveIdState(null) }
    }
  }

  const renameSession = (name: string) => {
    if (!active) return
    const updated = sessions.map(s => s.id === active.id ? { ...s, name: name.trim() || s.name } : s)
    saveSessions(updated)
    setSessions(updated)
    setEditingName(false)
  }

  const addItem = useCallback((itemId: string) => {
    const s = loadSessions()
    const aId = loadActiveId()
    let target = s.find(x => x.id === aId)
    if (!target) {
      // Auto-create a session
      target = { id: generateId(), name: 'Session 1', itemIds: [], createdAt: Date.now() }
      s.push(target)
      saveActiveId(target.id)
      setActiveIdState(target.id)
    }
    if (!target.itemIds.includes(itemId)) {
      target.itemIds = [...target.itemIds, itemId]
      saveSessions(s)
      setSessions([...s])
    }
  }, [])

  const removeItem = useCallback((itemId: string) => {
    const s = loadSessions()
    const aId = loadActiveId()
    const target = s.find(x => x.id === aId)
    if (!target) return
    target.itemIds = target.itemIds.filter(id => id !== itemId)
    saveSessions(s)
    setSessions([...s])
    setSelectedItems(prev => { const n = new Set(prev); n.delete(itemId); return n })
  }, [])

  const toggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const n = new Set(prev)
      if (n.has(itemId)) n.delete(itemId); else n.add(itemId)
      return n
    })
  }

  // ── Drag handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const itemId = e.dataTransfer.getData('text/lightbox-item')
    if (itemId) addItem(itemId)
  }

  // Resolve items to thumbnails
  const resolveThumb = (id: string): { thumb: string | null; title: string; format: string } | null => {
    const asset = assetMap[id]
    if (asset) return { thumb: resolveProtectedUrl(asset.id, 'thumbnail'), title: asset.title, format: asset.format }
    const story = storyMap[id]
    if (story) {
      const heroAsset = assetMap[story.heroAssetId]
      return { thumb: heroAsset ? resolveProtectedUrl(heroAsset.id, 'thumbnail') : null, title: story.title, format: 'Story' }
    }
    const article = articleMap[id]
    if (article) {
      const heroAsset = assetMap[article.heroAssetId]
      return { thumb: heroAsset ? resolveProtectedUrl(heroAsset.id, 'thumbnail') : null, title: article.title, format: 'Article' }
    }
    return null
  }

  const activeItems = active?.itemIds || []

  return (
    <div
      className={`transition-colors h-full w-full flex flex-col ${
        dragOver ? 'bg-[#0000ff]/5' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center px-3 py-1.5 bg-white border-b border-black/8">
        {/* Left: lightbox link + session info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href="/lightbox" className="shrink-0 inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity">
            <svg className="w-3.5 h-3.5 text-[#0000ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
            <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[#0000ff]">Lightbox</span>
          </Link>

          {active && !editingName && (
            <button
              onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.select(), 50) }}
              className="text-[9px] font-semibold text-black/50 truncate max-w-[100px] hover:text-[#0000ff] transition-colors"
            >
              {active.name}
            </button>
          )}
          {active && editingName && (
            <input
              ref={nameInputRef}
              autoFocus
              defaultValue={active.name}
              onBlur={e => renameSession(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameSession((e.target as HTMLInputElement).value) }}
              className="text-[9px] font-semibold text-black bg-white border border-[#0000ff] px-1 py-0 outline-none w-[90px]"
            />
          )}

          {active && <span className="text-[8px] font-bold text-black/20">{activeItems.length}</span>}
        </div>

        {/* Center: session picker + new/clear */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowPicker(p => !p)}
              className="text-[8px] font-semibold uppercase tracking-wider text-black/35 hover:text-[#0000ff] px-1.5 py-0.5 h-5 flex items-center transition-colors"
            >
              {sessions.length > 0 ? `${sessions.length}` : '0'}
              <svg className="w-2.5 h-2.5 ml-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {showPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/15 shadow-md w-[180px]">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-2 py-1.5 cursor-pointer transition-colors ${
                      s.id === activeId ? 'bg-[#0000ff]/8' : 'hover:bg-black/4'
                    }`}
                  >
                    <button
                      onClick={() => { setActiveId(s.id); setShowPicker(false) }}
                      className="flex-1 text-left min-w-0"
                    >
                      <span className="text-[9px] font-semibold text-black truncate block">{s.name}</span>
                      <span className="text-[7px] text-black/25">{s.itemIds.length} items</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                      className="text-[9px] text-black/15 hover:text-red-500 ml-1 shrink-0"
                      title="Delete session"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  onClick={createSession}
                  className="w-full px-2 py-1.5 text-[8px] font-semibold uppercase tracking-wider text-[#0000ff] hover:bg-[#0000ff]/5 border-t border-black/8 transition-colors text-left"
                >
                  + New session
                </button>
              </div>
            )}
          </div>

          {!active && (
            <button
              onClick={createSession}
              className="text-[8px] font-semibold uppercase tracking-wider text-[#0000ff] hover:bg-[#0000ff]/8 px-1.5 py-0.5 h-5 flex items-center transition-colors"
            >
              + New
            </button>
          )}

          {active && activeItems.length > 0 && (
            <button
              onClick={() => {
                const s = loadSessions()
                const target = s.find(x => x.id === activeId)
                if (target) { target.itemIds = []; saveSessions(s); setSessions([...s]); setSelectedItems(new Set()) }
              }}
              className="text-[8px] font-semibold uppercase tracking-wider text-black/20 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right edge: hide arrow */}
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide lightbox"
            title="Hide lightbox"
            className="ml-2 shrink-0 text-black/20 hover:text-[#0000ff] w-5 h-5 flex items-center justify-center transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Items area — vertical-first distribution of FULL-SIZE
          previews. Items stack top-to-bottom in a single column at
          the rail's natural width and the area scrolls vertically
          when content overflows. The empty / no-session states are
          full-width rows that match the same vertical rhythm so the
          tray feels consistent across states. */}
      <div className="px-3 py-2 flex flex-col gap-2 overflow-y-auto flex-1 min-h-[120px]">
        {!active && (
          <p className="text-[9px] text-black/25 italic">Create a session to start collecting assets</p>
        )}
        {active && activeItems.length === 0 && (
          <div className="flex items-center gap-2 w-full justify-center py-3">
            <svg className="w-4 h-4 text-black/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <p className="text-[9px] text-black/25">Drag assets here to build your lightbox</p>
          </div>
        )}
        {active && activeItems.map(itemId => {
          const resolved = resolveThumb(itemId)
          if (!resolved) return null
          const isSelected = selectedItems.has(itemId)
          return (
            <div
              key={itemId}
              // shrink-0 is REQUIRED here. Without it, flex items
              // in the parent column container default to
              // flex-shrink: 1 — so when the items area's height
              // is bounded (which it is by `flex-1` inside the
              // tray's flex-col), every item gets squished from
              // its natural aspect-video height down to whatever
              // fraction fits. End result: no overflow, no scroll.
              // shrink-0 keeps each item at its natural height and
              // lets the items area actually overflow + scroll.
              className={`relative w-full aspect-video shrink-0 overflow-hidden cursor-pointer group/lb transition-all ${
                isSelected ? 'ring-2 ring-[#0000ff] ring-offset-1' : 'ring-1 ring-black/10 hover:ring-black/30'
              }`}
              onClick={() => toggleSelect(itemId)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/lightbox-remove', itemId)
              }}
              title={resolved.title}
            >
              {resolved.thumb ? (
                <img src={resolved.thumb} alt={resolved.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-black/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-black/30">{resolved.format}</span>
                </div>
              )}
              {/* Title strip — always visible at the bottom now that
                  the preview is full-size. Uses a gradient so the
                  image stays readable above the text. */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pt-3 pb-1.5">
                <p className="text-[10px] font-bold text-white leading-tight line-clamp-1">
                  {resolved.title}
                </p>
              </div>
              {/* Format badge — top-left, always visible */}
              <span className="absolute top-1 left-1 text-[8px] font-black uppercase tracking-wider text-white bg-[#0000ff] px-1 py-0.5 leading-none">
                {resolved.format}
              </span>
              {/* Remove button — top-right, hover-revealed */}
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(itemId) }}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-500 text-white text-[12px] leading-none flex items-center justify-center opacity-0 group-hover/lb:opacity-100 transition-opacity"
                aria-label={`Remove ${resolved.title}`}
              >
                &times;
              </button>
              {/* Selected indicator — left-edge bar */}
              {isSelected && (
                <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-[#0000ff]" />
              )}
            </div>
          )
        })}
      </div>

      {/* Selected context strip */}
      {active && selectedItems.size > 0 && (
        <div className="shrink-0 px-3 py-1 border-t border-black/10 bg-[#0000ff]/5 flex items-center gap-2">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#0000ff]">
            {selectedItems.size} selected
          </span>
          <span className="text-[8px] text-black/30">— assistant will reference these in your search</span>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="ml-auto text-[8px] font-bold uppercase tracking-wider text-black/30 hover:text-black transition-colors"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  )
}
