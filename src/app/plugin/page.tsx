'use client'

import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { PLATFORM_FEES } from '@/lib/types'
import type { PluginTier } from '@/lib/types'

const PLUGIN_TIERS: { tier: PluginTier; label: string; description: string; gated: boolean }[] = [
  {
    tier: 'micro',
    label: 'Plugin Micro',
    description: 'API access for small publishers. Up to 100 assets/month.',
    gated: true,
  },
  {
    tier: 'premium',
    label: 'Plugin Premium',
    description: 'Full API access with reduced platform fees (90/10 split). Unlimited assets, priority search placement, bulk licensing.',
    gated: false,
  },
  {
    tier: 'enterprise',
    label: 'Plugin Enterprise',
    description: 'Custom integration, dedicated support, SLA guarantees, custom pricing.',
    gated: true,
  },
]

export default function PluginPage() {
  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-8">
          <h1 className="text-2xl font-bold text-black tracking-tight">Plugin Access</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Plugin subscribers get API access to the Frontfiles catalogue with reduced platform fees. The Plugin channel operates at a {PLATFORM_FEES.plugin.creatorFee * 100}/{PLATFORM_FEES.plugin.buyerMarkup * 100} split compared to {PLATFORM_FEES.direct.creatorFee * 100}/{PLATFORM_FEES.direct.buyerMarkup * 100} for direct transactions.
          </p>

          <div className="flex flex-col gap-4">
            {PLUGIN_TIERS.map(({ tier, label, description, gated }) => (
              <div key={tier} className={`border-2 px-6 py-5 ${gated ? 'border-slate-200' : 'border-black'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-black">{label}</h2>
                    <p className="text-sm text-slate-600 mt-1">{description}</p>
                  </div>
                  {gated ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border border-dashed border-slate-300 px-2 py-1 shrink-0">
                      Coming soon
                    </span>
                  ) : (
                    <button className="h-10 px-4 bg-blue-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-blue-700 transition-colors shrink-0">
                      Subscribe
                    </button>
                  )}
                </div>

                {!gated && (
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Creator fee</span>
                      <span className="text-sm font-bold font-mono text-black">{PLATFORM_FEES.plugin.creatorFee * 100}%</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Buyer markup</span>
                      <span className="text-sm font-bold font-mono text-black">{PLATFORM_FEES.plugin.buyerMarkup * 100}%</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">API access</span>
                      <span className="text-sm font-bold text-black">Full catalogue</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
