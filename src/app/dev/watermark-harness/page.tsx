'use client'

import { useState } from 'react'
import { WatermarkOverlay } from '@/components/watermark'
import type { WatermarkIntensity, WatermarkOrientation, WatermarkMode, WatermarkContext } from '@/lib/watermark/types'
import { resolveWatermarkConfig, ALL_MODES, getWatermarkModeLabel } from '@/lib/watermark/policy'

const INTENSITIES: WatermarkIntensity[] = ['standard', 'elevated', 'invasive']

// Covers all degradation tiers: canonical(800), reduced(500), corner(250), brand-only(120), ff-collapse(75), f-micro(50), none(30)
const SIZE_PRESETS = [
  { label: 'Detail (800x600)', w: 800, h: 600 },
  { label: 'Portrait (600x900)', w: 600, h: 900 },
  { label: 'Square (700x700)', w: 700, h: 700 },
  { label: 'Reduced (500x350)', w: 500, h: 350 },
  { label: 'Corner (250x180)', w: 250, h: 180 },
  { label: 'Brand Only (120x90)', w: 120, h: 90 },
  { label: 'FF Collapse (75x60)', w: 75, h: 60 },
  { label: 'F Micro (50x40)', w: 50, h: 40 },
  { label: 'None (30x20)', w: 30, h: 20 },
] as const

function PreviewBox({
  w,
  h,
  intensity,
  orientation,
  label,
}: {
  w: number
  h: number
  intensity: WatermarkIntensity
  orientation?: WatermarkOrientation
  label: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
        {label} &middot; {intensity} {orientation ? `(${orientation})` : ''}
      </span>
      <div
        className="relative overflow-hidden border border-slate-200"
        style={{
          width: w,
          height: h,
          background: `
            linear-gradient(135deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(225deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(315deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(45deg, #e2e8f0 25%, transparent 25%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          backgroundColor: '#f1f5f9',
        }}
      >
        <WatermarkOverlay
          intensity={intensity}
          imageWidth={w}
          imageHeight={h}
          assetId="0492-7X"
          attribution="E. VASQUEZ"
          orientation={orientation}
        />
      </div>
    </div>
  )
}

export default function WatermarkHarnessPage() {
  const [activeIntensity, setActiveIntensity] = useState<WatermarkIntensity>('standard')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-black bg-white flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 px-2 py-1 border border-red-200">
              DEV
            </span>
            <span className="text-sm font-bold text-black uppercase tracking-wide">
              Watermark System Harness
            </span>
          </div>
          <div className="flex items-center gap-2">
            {INTENSITIES.map((i) => (
              <button
                key={i}
                onClick={() => setActiveIntensity(i)}
                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 transition-colors ${
                  activeIntensity === i
                    ? 'bg-[#0000ff] text-white border-[#0000ff]'
                    : 'bg-white text-black border-black hover:bg-black hover:text-white'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Section 1: All sizes at selected intensity */}
        <section className="mb-12">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black border-b border-slate-200 pb-2 mb-6">
            Degradation Tiers &middot; {activeIntensity}
          </h2>
          <div className="flex flex-wrap gap-8 items-end">
            {SIZE_PRESETS.map((s) => (
              <PreviewBox
                key={s.label}
                w={s.w}
                h={s.h}
                intensity={activeIntensity}
                label={s.label}
              />
            ))}
          </div>
        </section>

        {/* Section 2: Orientation matrix at canonical size */}
        <section className="mb-12">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black border-b border-slate-200 pb-2 mb-6">
            Orientation Matrix &middot; 800x600
          </h2>
          <div className="flex flex-wrap gap-8 items-end">
            {INTENSITIES.map((intensity) => (
              <div key={intensity} className="flex gap-6">
                <PreviewBox
                  w={800}
                  h={600}
                  intensity={intensity}
                  orientation="vertical"
                  label={`Vertical`}
                />
                <PreviewBox
                  w={800}
                  h={600}
                  intensity={intensity}
                  orientation="horizontal"
                  label={`Horizontal`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: All intensities side-by-side at portrait */}
        <section className="mb-12">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black border-b border-slate-200 pb-2 mb-6">
            Intensity Comparison &middot; Portrait 600x900
          </h2>
          <div className="flex gap-8 items-end">
            {INTENSITIES.map((intensity) => (
              <PreviewBox
                key={intensity}
                w={600}
                h={900}
                intensity={intensity}
                label={`Portrait`}
              />
            ))}
          </div>
        </section>

        {/* Section 4: Contrast proof — dark, bright, busy backgrounds */}
        <section className="mb-12">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black border-b border-slate-200 pb-2 mb-6">
            Contrast Proof &middot; 700x500
          </h2>
          <div className="flex flex-wrap gap-8 items-end">
            {[
              { bg: '#000000', label: 'Dark' },
              { bg: '#FFFFFF', label: 'Bright' },
              { bg: '#FF6B35', label: 'Warm' },
              { bg: '#1a5276', label: 'Cool' },
            ].map(({ bg, label }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {label} Background
                </span>
                <div
                  className="relative overflow-hidden border border-slate-200"
                  style={{ width: 700, height: 500, background: bg }}
                >
                  <WatermarkOverlay
                    intensity={activeIntensity}
                    imageWidth={700}
                    imageHeight={500}
                    assetId="0492-7X"
                    attribution="E. VASQUEZ"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Edge case — boundary S values */}
        <section className="mb-12">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black border-b border-slate-200 pb-2 mb-6">
            Boundary Edge Cases
          </h2>
          <div className="flex flex-wrap gap-6 items-end">
            {[
              { w: 600, h: 600, label: 'S=600 (canonical edge)' },
              { w: 599, h: 599, label: 'S=599 (reduced edge)' },
              { w: 380, h: 380, label: 'S=380 (reduced edge)' },
              { w: 379, h: 379, label: 'S=379 (corner edge)' },
              { w: 160, h: 160, label: 'S=160 (corner edge)' },
              { w: 159, h: 159, label: 'S=159 (brand-only edge)' },
              { w: 90, h: 90, label: 'S=90 (brand-only edge)' },
              { w: 89, h: 89, label: 'S=89 (ff-collapse edge)' },
              { w: 60, h: 60, label: 'S=60 (ff-collapse edge)' },
              { w: 59, h: 59, label: 'S=59 (f-micro edge)' },
              { w: 40, h: 40, label: 'S=40 (f-micro edge)' },
              { w: 39, h: 39, label: 'S=39 (none)' },
            ].map(({ w, h, label }) => (
              <PreviewBox
                key={label}
                w={w}
                h={h}
                intensity="standard"
                label={label}
              />
            ))}
          </div>
        </section>

        {/* Section 6: Policy Resolution — mode × context matrix */}
        <PolicyMatrix />
      </div>
    </div>
  )
}

const CONTEXTS: WatermarkContext[] = [
  'upload-default', 'asset-preview', 'detail-preview',
  'share-preview', 'promotional-preview', 'internal',
]

function PolicyMatrix() {
  return (
    <section className="mb-12">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black border-b border-slate-200 pb-2 mb-6">
        Policy Resolution Matrix
      </h2>
      <div className="overflow-x-auto">
        <table className="text-[10px] font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 border border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-500">Context</th>
              <th className="px-3 py-2 border border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-500">Default Mode</th>
              <th className="px-3 py-2 border border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-500">Intensity</th>
              <th className="px-3 py-2 border border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-500">Enabled</th>
              <th className="px-3 py-2 border border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-500">Preview</th>
            </tr>
          </thead>
          <tbody>
            {CONTEXTS.map(ctx => {
              const config = resolveWatermarkConfig(ctx)
              return (
                <tr key={ctx}>
                  <td className="px-3 py-2 border border-slate-200 font-bold">{ctx}</td>
                  <td className="px-3 py-2 border border-slate-200 text-center">{config.mode}</td>
                  <td className="px-3 py-2 border border-slate-200 text-center">{config.intensity}</td>
                  <td className="px-3 py-2 border border-slate-200 text-center">
                    <span className={config.enabled ? 'text-green-600' : 'text-red-500'}>{config.enabled ? 'YES' : 'NO'}</span>
                  </td>
                  <td className="px-3 py-1 border border-slate-200">
                    {config.enabled && (
                      <div className="relative overflow-hidden border border-slate-200" style={{ width: 200, height: 130, background: '#e2e8f0' }}>
                        <WatermarkOverlay
                          intensity={config.intensity}
                          imageWidth={200}
                          imageHeight={130}
                          assetId="0492-7X"
                          attribution="E. VASQUEZ"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Override demo */}
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-8 mb-4">Per-Asset Override Demo</h3>
      <div className="flex gap-6 items-end">
        {ALL_MODES.map(mode => {
          const config = resolveWatermarkConfig('detail-preview', { mode, overrideIntensity: null })
          return (
            <div key={mode} className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Override: {getWatermarkModeLabel(mode)}
              </span>
              <div className="relative overflow-hidden border border-slate-200" style={{ width: 280, height: 200, background: '#e2e8f0' }}>
                {config.enabled && (
                  <WatermarkOverlay
                    intensity={config.intensity}
                    imageWidth={280}
                    imageHeight={200}
                    assetId="0492-7X"
                    attribution="E. VASQUEZ"
                  />
                )}
                {!config.enabled && (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">No watermark</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
