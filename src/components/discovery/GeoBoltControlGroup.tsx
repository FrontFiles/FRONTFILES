'use client'

import { forwardRef } from 'react'

/**
 * Frontfiles — Geo / Context Source paired contextual control group
 *
 * Slim vertical rail with two toggle buttons.
 * Compact, elegant, icon-forward with small labels.
 */

export type ContextualPanel = 'geo' | 'bolt' | null

export interface GeoBoltControlGroupProps {
  activePanel: ContextualPanel
  onSelectPanel: (next: ContextualPanel) => void
}

export const GeoBoltControlGroup = forwardRef<
  HTMLButtonElement,
  GeoBoltControlGroupProps
>(function GeoBoltControlGroup(
  { activePanel, onSelectPanel },
  boltButtonRef,
) {
  const toggle = (id: Exclude<ContextualPanel, null>) => {
    onSelectPanel(activePanel === id ? null : id)
  }

  return (
    <div
      role="group"
      aria-label="Contextual panels"
      className="shrink-0 w-9 flex flex-col border-r border-black/10 bg-black/[0.02]"
    >
      {/* Geo */}
      <button
        type="button"
        onClick={() => toggle('geo')}
        aria-label="Toggle geo panel"
        aria-pressed={activePanel === 'geo'}
        title={activePanel === 'geo' ? 'Close geo' : 'Open geo'}
        className={`flex flex-col items-center justify-center py-3 gap-1.5 transition-colors ${
          activePanel === 'geo'
            ? 'bg-[#0000ff] text-white'
            : 'text-[#0000ff]/60 hover:text-[#0000ff] hover:bg-[#0000ff]/5'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
        </svg>
        <span className="text-[7px] font-bold uppercase tracking-widest leading-none">Geo</span>
      </button>

      {/* Context Source */}
      <button
        ref={boltButtonRef}
        type="button"
        onClick={() => toggle('bolt')}
        aria-label="Toggle Context Source panel"
        aria-pressed={activePanel === 'bolt'}
        title={activePanel === 'bolt' ? 'Close Context Source' : 'Open Context Source'}
        className={`flex flex-col items-center justify-center py-3 gap-1.5 border-t border-black/8 transition-colors ${
          activePanel === 'bolt'
            ? 'bg-[#0000ff] text-white'
            : 'text-[#0000ff]/60 hover:text-[#0000ff] hover:bg-[#0000ff]/5'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="text-[7px] font-bold uppercase tracking-widest leading-none">Ctx</span>
      </button>
    </div>
  )
})
