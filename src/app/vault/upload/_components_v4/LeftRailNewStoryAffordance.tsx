/**
 * Frontfiles Upload V4 — Left Rail "+ New story" Affordance (D2.2 §1.1)
 *
 * Spec: UX-SPEC-V4 §4.4 + IPD2-4 = (a) inline input pattern.
 *
 * Bottom of left rail. Click → swap to inline `<input>` autofocused.
 * Enter creates via CREATE_STORY_GROUP and resets. Esc cancels and resets.
 * Blur with empty value cancels.
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from '../_components/UploadContext'

export default function LeftRailNewStoryAffordance() {
  const { state, dispatch } = useUploadContext()
  const collapsed = state.ui.leftRailCollapsed
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function commit() {
    const name = input.trim()
    if (name) {
      dispatch({ type: 'CREATE_STORY_GROUP', name })
    }
    setInput('')
    setEditing(false)
  }

  function cancel() {
    setInput('')
    setEditing(false)
  }

  if (collapsed) {
    // Collapsed mode shows a compact "+" icon with no text.
    return (
      <div className="border-b border-black p-2 flex justify-center flex-shrink-0">
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_LEFT_RAIL_COLLAPSED' })}
          className="border border-black w-6 h-6 flex items-center justify-center text-[10px] font-bold text-black bg-white hover:bg-black hover:text-white transition-colors"
          title="Expand to add a story"
        >
          +
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="border-b border-black p-2 flex items-center gap-1 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          onBlur={() => {
            if (!input.trim()) cancel()
          }}
          autoFocus
          placeholder="Story name…"
          className="flex-1 border border-black px-2 py-1 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-0"
        />
        <button
          type="button"
          onClick={commit}
          className="border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors flex-shrink-0"
          title="Create story"
        >
          ✓
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-black p-2 flex-shrink-0">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-black bg-white hover:bg-black hover:text-white transition-colors"
        title="Create a new story"
      >
        + New story
      </button>
    </div>
  )
}
