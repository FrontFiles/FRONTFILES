'use client'

import { cn } from '@/lib/utils'
import type { PriceRecommendation } from '@/lib/upload/batch-types'

interface RecommendationBadgeProps {
  recommendation: PriceRecommendation
  compact?: boolean
}

export function RecommendationBadge({ recommendation, compact = false }: RecommendationBadgeProps) {
  const price = (recommendation.amount / 100).toFixed(0)
  const pct = Math.round(recommendation.confidence * 100)

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono">
        <span className="font-bold">&euro;{price}</span>
        <span className="text-slate-400">{pct}%</span>
      </span>
    )
  }

  return (
    <div className="border border-black p-2 space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">RECOMMENDED</span>
        <span className="text-[10px] font-mono text-slate-400">{pct}% confidence</span>
      </div>
      <div className="text-lg font-bold font-mono">&euro;{price}</div>
      <div className="text-[10px] font-mono text-slate-500">{recommendation.basis}</div>
      {recommendation.factors.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {recommendation.factors.map((f, i) => (
            <span
              key={i}
              className={cn(
                'text-[9px] font-mono px-1 py-0.5 border',
                f.effect === 'increase' && 'border-[#0000ff] text-[#0000ff]',
                f.effect === 'decrease' && 'border-slate-400 text-slate-400',
                f.effect === 'neutral' && 'border-slate-300 text-slate-400',
              )}
            >
              {f.effect === 'increase' && '+'}{f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
