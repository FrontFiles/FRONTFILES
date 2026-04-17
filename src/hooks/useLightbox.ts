'use client'

import { useState, useEffect, useCallback } from 'react'

const SESSIONS_KEY = 'frontfiles_lightbox_sessions'
const ACTIVE_KEY = 'frontfiles_lightbox_active'

interface LightboxSession {
  id: string
  name: string
  itemIds: string[]
  createdAt: number
}

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

function isInActiveSession(itemId: string): boolean {
  const sessions = loadSessions()
  const activeId = loadActiveId()
  const active = sessions.find(s => s.id === activeId)
  return active ? active.itemIds.includes(itemId) : false
}

function generateId() {
  return 'lb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

export function useLightbox(id: string) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(isInActiveSession(id))
    const handler = () => setSaved(isInActiveSession(id))
    window.addEventListener('lightbox-sessions-change', handler)
    return () => window.removeEventListener('lightbox-sessions-change', handler)
  }, [id])

  const toggle = useCallback((e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }

    const sessions = loadSessions()
    let activeId = loadActiveId()
    let active = sessions.find(s => s.id === activeId)

    // Auto-create a session if none exists
    if (!active) {
      active = { id: generateId(), name: 'Session 1', itemIds: [], createdAt: Date.now() }
      sessions.push(active)
      saveActiveId(active.id)
    }

    // Toggle item in session
    if (active.itemIds.includes(id)) {
      active.itemIds = active.itemIds.filter(x => x !== id)
    } else {
      active.itemIds.push(id)
    }

    saveSessions(sessions)
    setSaved(active.itemIds.includes(id))
  }, [id])

  return { saved, toggle }
}
