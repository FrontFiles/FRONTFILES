/**
 * Frontfiles Upload V4 — Left Rail Header (D2.2 §1.1)
 *
 * Spec: UX-SPEC-V4 §4.1 anatomy.
 *
 * Top of the left rail. Two affordances:
 *   - "+ Add files"  — opens native file picker (D2.7 wires; no-op stub here per IPD2-11)
 *   - settings cog   — opens session defaults popover (D2.7 wires; no-op stub here per IPD2-12)
 *
 * Plus a collapse toggle that mirrors the rail-collapse state (D2.1's
 * TOGGLE_LEFT_RAIL_COLLAPSED action). When collapsed, the header
 * compresses but stays interactive.
 */

'use client'

import { useState } from 'react'
import { useUploadContext } from './UploadContext'
import { useFileIngest } from './lib/FileIngestContext'
import SessionDefaultsPopover from './SessionDefaultsPopover'

export default function LeftRailHeader() {
  const { state, dispatch } = useUploadContext()
  const { openFilePicker } = useFileIngest()
  const collapsed = state.ui.leftRailCollapsed
  // D2.7 IPD7-13 = (a): popover open state lives here, close to its trigger.
  const [defaultsOpen, setDefaultsOpen] = useState(false)

  return (
    <div className="border-b border-black px-3 py-2 flex items-center gap-2 flex-shrink-0 min-w-0 relative">
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_LEFT_RAIL_COLLAPSED' })}
        className="border border-black w-6 h-6 flex items-center justify-center text-[10px] font-bold hover:bg-black hover:text-white transition-colors flex-shrink-0"
        aria-label={collapsed ? 'Expand left rail' : 'Collapse left rail'}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? '▶' : '◀'}
      </button>

      {!collapsed && (
        <>
          {/* D2.7: + Add files button now triggers the shared file picker
              (UploadShell owns the hidden <input> ref + handler). */}
          <button
            type="button"
            onClick={openFilePicker}
            className="flex-1 border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-black bg-white hover:bg-black hover:text-white transition-colors min-w-0 truncate"
            title="Add files from your computer"
          >
            + Add files
          </button>

          {/* D2.7: cog now toggles SessionDefaultsPopover (popover state
              lives here per IPD7-13 = (a)). */}
          <button
            type="button"
            onClick={() => setDefaultsOpen(o => !o)}
            className={`border border-black w-7 h-7 flex items-center justify-center text-sm transition-colors flex-shrink-0 ${
              defaultsOpen
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
            aria-label="Session defaults"
            aria-expanded={defaultsOpen}
            title="Session defaults"
          >
            ⚙
          </button>

          {defaultsOpen && <SessionDefaultsPopover onClose={() => setDefaultsOpen(false)} />}
        </>
      )}
    </div>
  )
}
