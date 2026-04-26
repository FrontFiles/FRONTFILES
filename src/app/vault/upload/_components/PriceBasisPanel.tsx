/**
 * Frontfiles Upload V3 — Price Basis Panel (C2.5 §1.1, IPV-4)
 *
 * Spec: UX-SPEC-V3.md §9.3 ("Why this price?" inline expansion).
 * Pricing brief: PRICE-ENGINE-BRIEF.md v3 §11.x (factor model).
 *
 * Renders inline below the price field in two surfaces:
 *   1. AssetRow (Linear)         — when state.ui.priceBasisOpenAssetId === asset.id
 *   2. SideDetailPanel           — under the AI Proposal Detail "Price basis" expand row
 *
 * Consumes asset.proposal.priceSuggestion. Single component, two mount
 * points (per IPV-4 default = 'both').
 *
 * Renders: amount + confidence + basis + ordered list of contributing
 * factors (label, effect arrow ↑/↓/—, weight as a thin bar).
 *
 * Out of scope per directive §1.2: comparables drill-down (= v2 of the
 * price engine; explicitly deferred per PRICE-ENGINE-BRIEF.md v3).
 */

'use client'

import type { V2Asset, V2PriceFactor } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
  /** Compact rendering for use inside the side panel's tighter column. */
  compact?: boolean
}

export default function PriceBasisPanel({ asset, compact = false }: Props) {
  const ps = asset.proposal?.priceSuggestion
  if (!ps) return null

  const eur = `€${(ps.amount / 100).toFixed(2)}`
  const confPct = Math.round(ps.confidence * 100)

  return (
    <div
      className={`border border-black bg-slate-50 ${compact ? 'p-2' : 'p-3'} flex flex-col gap-2 min-w-0`}
      data-component="price-basis-panel"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Engine recommendation
        </div>
        <div className="font-mono text-sm text-black">{eur}</div>
      </div>

      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        Basis: <span className="font-mono normal-case text-black">{ps.basis}</span>
      </div>

      {ps.factors.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-black pt-2">
          {ps.factors.map((f, i) => (
            <FactorRow key={`${f.label}-${i}`} factor={f} />
          ))}
        </ul>
      )}

      <div className="text-[10px] uppercase tracking-widest text-slate-500 border-t border-black pt-1">
        Confidence: <span className="font-mono text-black">{confPct}%</span>
      </div>
    </div>
  )
}

function FactorRow({ factor }: { factor: V2PriceFactor }) {
  const arrow =
    factor.effect === 'increase' ? '↑' : factor.effect === 'decrease' ? '↓' : '—'
  const arrowCls =
    factor.effect === 'increase'
      ? 'text-green-700'
      : factor.effect === 'decrease'
        ? 'text-red-700'
        : 'text-slate-500'
  const weightPct = Math.round(Math.min(Math.abs(factor.weight), 1) * 100)

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs min-w-0">
      <span className={`font-bold ${arrowCls}`} aria-hidden>
        {arrow}
      </span>
      <span className="text-black truncate min-w-0" title={factor.label}>
        {factor.label}
      </span>
      <span className="flex items-center gap-1 flex-shrink-0">
        <span className="border border-black w-16 h-1.5 bg-white relative overflow-hidden">
          <span
            className={`absolute inset-y-0 left-0 ${
              factor.effect === 'increase'
                ? 'bg-green-700'
                : factor.effect === 'decrease'
                  ? 'bg-red-700'
                  : 'bg-slate-400'
            }`}
            style={{ width: `${weightPct}%` }}
          />
        </span>
        <span className="font-mono text-[10px] text-slate-600 w-8 text-right">
          {weightPct}%
        </span>
      </span>
    </li>
  )
}
