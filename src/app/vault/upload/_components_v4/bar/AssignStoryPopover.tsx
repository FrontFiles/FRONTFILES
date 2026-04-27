/**
 * Frontfiles Upload V4 — Assign Story popover (D2.5 §6.3)
 *
 * Spec: UX-SPEC-V4 §9.4 + D2.5-DIRECTIVE §6.3.
 *
 * Anchored popover. Two sections:
 *
 *   1. List of existing stories (state.storyGroupOrder.map). Click → loop
 *      MOVE_ASSET_TO_CLUSTER per selected asset.
 *
 *   2. + New story affordance: inline name input + "Create & assign" button.
 *      Per IPD5-1 = (d) ratified: dispatches the composite
 *      CREATE_STORY_GROUP_AND_MOVE { name, assetIds } in ONE action so the
 *      reducer atomically creates the story AND moves the selected assets
 *      into it (no need for the UI to learn the freshly-generated id).
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useUploadContext } from '../../_components/UploadContext'

const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-black'
const SUBLABEL = 'text-[9px] font-bold uppercase tracking-widest text-slate-500'
const INPUT = 'border border-black px-2 py-1 text-sm text-black bg-white'
const ROW_BTN =
  'w-full text-left border border-black px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-black bg-white hover:bg-black hover:text-white transition-colors min-w-0 truncate'
const BTN =
  'border border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black'

export default function AssignStoryPopover({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useUploadContext()
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selectedIds = state.ui.selectedAssetIds

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function assignToExisting(storyId: string) {
    for (const assetId of selectedIds) {
      dispatch({ type: 'MOVE_ASSET_TO_CLUSTER', assetId, clusterId: storyId })
    }
    onClose()
  }

  function createAndAssign() {
    const name = newName.trim()
    if (!name) return
    // Composite action per IPD5-1 = (d). Single dispatch.
    dispatch({ type: 'CREATE_STORY_GROUP_AND_MOVE', name, assetIds: selectedIds })
    setNewName('')
    onClose()
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Assign story to selected assets"
      className="absolute bottom-full left-0 mb-2 z-40 border-2 border-black bg-white p-3 flex flex-col gap-2 shadow-lg min-w-[280px] max-w-[360px] max-h-[400px] overflow-y-auto"
    >
      <span className={LABEL}>Assign {selectedIds.length} selected to:</span>

      {/* Existing stories */}
      {state.storyGroupOrder.length > 0 ? (
        <div className="flex flex-col gap-1">
          {state.storyGroupOrder.map(id => {
            const story = state.storyGroupsById[id]
            if (!story) return null
            return (
              <button
                key={id}
                type="button"
                onClick={() => assignToExisting(id)}
                className={ROW_BTN}
                title={story.name}
              >
                {story.name}
              </button>
            )
          })}
        </div>
      ) : (
        <span className={SUBLABEL}>No stories yet</span>
      )}

      {/* Divider */}
      <div className="border-t border-black my-1" />

      {/* New story */}
      <span className={SUBLABEL}>Or create new:</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') createAndAssign()
          }}
          placeholder="Story name"
          autoFocus
          className={`${INPUT} flex-1 min-w-0`}
        />
        <button
          type="button"
          onClick={createAndAssign}
          disabled={newName.trim() === ''}
          className={BTN}
        >
          + New
        </button>
      </div>
    </div>
  )
}
