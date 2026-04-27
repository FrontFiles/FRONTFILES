/**
 * Frontfiles Upload V4 — Empty State (D2.1 §6.2, D2.7 click-to-browse wired)
 *
 * Spec: UX-SPEC-V4 §2 (layout state = 'empty') + §12 (file ingestion).
 *
 * Renders when state.assetOrder.length === 0. Fills the entire screen
 * area below the page chrome. Brutalist dashed border + centered
 * "Drag assets here / or click to browse" + format watermark.
 *
 * D2.7 wires the click-to-browse CTA to the shared file picker via
 * useFileIngest (FileIngestContext). The whole-window drop listener
 * lives at UploadShell root and works regardless of which layout
 * state is rendered.
 */

'use client'

import { useFileIngest } from './lib/FileIngestContext'

export default function EmptyState() {
  const { openFilePicker } = useFileIngest()

  return (
    <div className="flex-1 flex items-center justify-center bg-white p-12 min-w-0">
      <button
        type="button"
        onClick={openFilePicker}
        className="border-2 border-dashed border-black p-12 max-w-2xl w-full text-center cursor-pointer hover:border-blue-600 transition-colors group"
        title="Click to browse files"
      >
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
          Vault upload
        </div>
        <div className="text-2xl font-bold text-black">Drag assets here</div>
        <div className="text-sm text-slate-600 mt-2 group-hover:text-blue-600 transition-colors">
          or click to browse
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-6">
          PHOTO · VIDEO · AUDIO · TEXT · ILLUSTRATION · INFOGRAPHIC · VECTOR
        </div>
      </button>
    </div>
  )
}
