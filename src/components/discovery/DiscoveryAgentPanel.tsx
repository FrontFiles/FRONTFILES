'use client'

// ═══════════════════════════════════════════════════════════════
// Frontfiles — Discovery Agent Panel
//
// The conversational answer view for the VAULT-only Discovery
// Agent. Renders the state shape produced by `useDiscoveryAgent`
// and forwards three interaction callbacks back to the parent.
//
// IDLE STATE — Scrolling suggested prompts
//
// When no query is active, instead of a static help message the
// panel shows a horizontally scrolling marquee of contextual
// prompt suggestions. Clicking a suggestion fires `onChipRun`
// with the prompt text, which the parent routes through the
// same path as a typed query.
//
// Suggestions are derived from:
//   1. Hot subjects (editorial, hand-curated topics)
//   2. Current search session context (recent geographies, tags)
//
// READY STATE — single-line agent answer (unchanged from v2)
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect } from 'react'
import type { DiscoveryAgentState } from '@/hooks/useDiscoveryAgent'

export interface DiscoveryAgentPanelProps {
  state: DiscoveryAgentState
  hoveredResultId: string | null
  onPickHover: (id: string | null) => void
  onPickClick: (href: string) => void
  onChipRun: (nextQuery: string) => void
}

// ═══════════════════════════════════════════════════════════════

export function DiscoveryAgentPanel({
  state,
  hoveredResultId,
  onPickHover,
  onPickClick,
  onChipRun,
}: DiscoveryAgentPanelProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white whitespace-nowrap overflow-hidden h-full">
      {state.status === 'idle' && (
        <SuggestedPrompts onSelect={onChipRun} />
      )}

      {state.status === 'empty' && (
        <>
          <AgentIdentifier />
          <span className="text-[10px] text-black/50">{state.reason}</span>
        </>
      )}

      {state.status === 'ready' && (
        <>
          <AgentIdentifier />
          <ReadyLine
            state={state}
            hoveredResultId={hoveredResultId}
            onPickHover={onPickHover}
            onPickClick={onPickClick}
            onChipRun={onChipRun}
          />
        </>
      )}
    </div>
  )
}

// ─── Suggested prompts (idle state) ─────────────────────────

/**
 * Hot subjects and contextual suggestions. These are editorially
 * curated to surface the breadth of the vault: geography, format,
 * topical, and creator-centric queries.
 */
const SUGGESTED_PROMPTS = [
  'Flood displacement in southern Brazil',
  'Verified video from Porto Alegre',
  'Audio field recordings',
  'Lisbon parliament coverage',
  'Greek border documentation',
  'Aerial photography Brazil',
  'Settlement disputes',
  'Frontfilers in West Africa',
  'Text reports from conflict zones',
  'Certified editorial packages',
  'Street protest photography',
  'Infographics and data visualizations',
  'Drone footage of natural disasters',
  'Carnival coverage Rio de Janeiro',
  'Humanitarian crisis documentation',
  'Photo essays from South America',
]

function SuggestedPrompts({ onSelect }: { onSelect: (query: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let paused = false
    function step() {
      if (!paused && el) {
        el.scrollLeft += 0.5
        // Loop: when we've scrolled past halfway (the duplicate set),
        // jump back to the start seamlessly.
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0
        }
      }
      animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)

    const pause = () => { paused = true }
    const resume = () => { paused = false }
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', resume)

    return () => {
      cancelAnimationFrame(animRef.current)
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', resume)
    }
  }, [])

  // Duplicate the list for seamless looping
  const allPrompts = [...SUGGESTED_PROMPTS, ...SUGGESTED_PROMPTS]

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
      <span className="shrink-0 inline-flex items-center gap-1.5">
        <svg
          className="w-3 h-3 text-[#0000ff]"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-black/30">
          Try
        </span>
      </span>
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-hidden flex-1 scrollbar-none"
      >
        {allPrompts.map((prompt, i) => (
          <button
            key={`${prompt}-${i}`}
            type="button"
            onClick={() => onSelect(prompt)}
            className="shrink-0 text-[10px] text-black/40 hover:text-[#0000ff] transition-colors cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── AgentIdentifier ─────────────────────────────────────────

function AgentIdentifier() {
  return (
    <span className="shrink-0 inline-flex items-center gap-1.5">
      <svg
        className="w-3.5 h-3.5 text-[#0000ff]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#0000ff]">
        Vault Agent
      </span>
    </span>
  )
}

// ─── Ready (single-line render) ──────────────────────────────

function ReadyLine({
  state,
  hoveredResultId,
  onPickHover,
  onPickClick,
  onChipRun,
}: {
  state: Extract<DiscoveryAgentState, { status: 'ready' }>
  hoveredResultId: string | null
  onPickHover: (id: string | null) => void
  onPickClick: (href: string) => void
  onChipRun: (nextQuery: string) => void
}) {
  return (
    <>
      <span className="shrink-0 text-[11px] font-serif italic text-black">
        {state.title}
      </span>

      <span className="shrink-0 text-[10px] text-black/40">
        ({state.picks.length} pick{state.picks.length === 1 ? '' : 's'})
      </span>

      {state.picks.length > 0 && (
        <span className="shrink-0 inline-flex items-center gap-2">
          <span className="text-black/20">·</span>
          {state.picks.map((pick, idx) => {
            const isHovered = hoveredResultId === pick.id
            return (
              <span key={pick.id} className="inline-flex items-center gap-2">
                {idx > 0 && <span className="text-black/20">,</span>}
                <button
                  type="button"
                  onClick={() => onPickClick(pick.href)}
                  onMouseEnter={() => onPickHover(pick.id)}
                  onMouseLeave={() => {
                    if (hoveredResultId === pick.id) onPickHover(null)
                  }}
                  data-result-id={pick.id}
                  title={`${pick.badge} — ${pick.reason}`}
                  className={`text-[11px] font-bold transition-colors max-w-[180px] truncate ${
                    isHovered
                      ? 'text-[#0000ff] underline'
                      : 'text-black hover:text-[#0000ff] hover:underline'
                  }`}
                >
                  {pick.label}
                </button>
              </span>
            )
          })}
        </span>
      )}

      {state.chips.length > 0 && (
        <span className="shrink-0 inline-flex items-center gap-1 ml-auto pl-3">
          {state.chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChipRun(chip.nextQuery)}
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border border-[#0000ff]/40 text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </span>
      )}
    </>
  )
}
