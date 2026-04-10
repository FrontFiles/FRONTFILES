'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { BatchDefaults, BatchAsset } from '@/lib/upload/batch-types'
import type { AssetFormat, PrivacyState, LicenceType, StoryRef } from '@/lib/upload/types'
import { ASSET_FORMAT_LABELS, LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import { detectFormat, formatFileSize } from '@/lib/upload/validation'
import { MOCK_STORIES } from '@/lib/upload/batch-mock-data'
import type { BatchAction } from '@/lib/upload/batch-state'

interface IntakeScreenProps {
  assets: BatchAsset[]
  defaults: BatchDefaults
  dispatch: (action: BatchAction) => void
}

export function IntakeScreen({ assets, defaults, dispatch }: IntakeScreenProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const formats = new Map<string, AssetFormat>()
    fileArray.forEach(f => {
      const detected = detectFormat(f)
      if (detected) formats.set(f.name, detected)
    })
    dispatch({ type: 'ADD_FILES', files: fileArray, formats })
  }, [dispatch])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const canStart = assets.length > 0

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed cursor-pointer transition-colors p-8 flex flex-col items-center justify-center min-h-[200px]',
          isDragging ? 'border-[#0000ff] bg-[#0000ff]/5' : 'border-black hover:border-[#0000ff]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
        <svg className="w-8 h-8 mb-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="square" d="M12 4v12m0 0l-4-4m4 4l4-4" />
          <path strokeLinecap="square" d="M4 17v2h16v-2" />
        </svg>
        <span className="text-sm font-bold uppercase tracking-widest">Drop files or click to browse</span>
        <span className="text-[10px] font-mono text-slate-400 mt-1">Photo, Video, Audio, Text, Illustration, Infographic, Vector</span>
      </div>

      {/* Demo loader */}
      {assets.length === 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      )}
      {assets.length === 0 && (
        <button
          onClick={() => {
            const DEMO_FILES: Array<{ name: string; type: string; size: number }> = [
              { name: 'IMG_HK_protest_01.jpg', type: 'image/jpeg', size: 4_200_000 },
              { name: 'IMG_HK_protest_02.jpg', type: 'image/jpeg', size: 3_800_000 },
              { name: 'IMG_HK_protest_03.jpg', type: 'image/jpeg', size: 5_100_000 },
              { name: 'VID_myanmar_border.mp4', type: 'video/mp4', size: 142_000_000 },
              { name: 'VID_climate_coast.mp4', type: 'video/mp4', size: 98_000_000 },
              { name: 'AUD_interview_activist.wav', type: 'audio/wav', size: 22_000_000 },
              { name: 'TXT_field_notes_manila.txt', type: 'text/plain', size: 42_000 },
              { name: 'ILL_infra_damage_map.svg', type: 'image/svg+xml', size: 280_000 },
              { name: 'IMG_cebu_flood_aerial.jpg', type: 'image/jpeg', size: 6_400_000 },
              { name: 'IMG_SP_march_wide.jpg', type: 'image/jpeg', size: 3_900_000 },
              { name: 'VID_beirut_aftermath.mp4', type: 'video/mp4', size: 210_000_000 },
              { name: 'AUD_ambient_nairobi.mp3', type: 'audio/mpeg', size: 8_200_000 },
            ]
            const mockFiles = DEMO_FILES.map(({ name, type, size }) => {
              const buf = new ArrayBuffer(Math.min(size, 1024))
              return new File([buf], name, { type })
            })
            handleFiles(mockFiles)
          }}
          className="w-full py-2.5 border-2 border-dashed border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:border-[#0000ff] hover:text-[#0000ff] transition-colors"
        >
          Load 12 sample assets (demo)
        </button>
      )}

      {/* File Summary */}
      {assets.length > 0 && (
        <div className="border-2 border-black p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest">
              {assets.length} FILES QUEUED
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {formatFileSize(assets.reduce((sum, a) => sum + a.fileSize, 0))} total
            </span>
          </div>

          {/* Format breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              assets.reduce<Record<string, number>>((acc, a) => {
                const f = a.format ?? 'unknown'
                acc[f] = (acc[f] || 0) + 1
                return acc
              }, {})
            ).map(([format, count]) => (
              <span key={format} className="text-[10px] font-mono border border-slate-300 px-1.5 py-0.5">
                {format.toUpperCase()} &times;{count}
              </span>
            ))}
          </div>

          {/* File list (compact) */}
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-[10px] font-mono py-0.5 border-b border-slate-100">
                <span className="w-12 font-bold uppercase text-slate-500">
                  {a.format ? ASSET_FORMAT_LABELS[a.format]?.slice(0, 5) : '???'}
                </span>
                <span className="flex-1 truncate">{a.fileName}</span>
                <span className="text-slate-400">{formatFileSize(a.fileSize)}</span>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_ASSETS', assetIds: [a.id] })}
                  className="text-slate-300 hover:text-black"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Defaults */}
      <div className="border-2 border-black p-4 space-y-4">
        <div className="text-xs font-bold uppercase tracking-widest">BATCH DEFAULTS</div>
        <p className="text-[10px] font-mono text-slate-400">Apply shared settings to all files in this batch. Individual assets can be edited later.</p>

        {/* Default Story */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">DEFAULT STORY</label>
          <select
            value={defaults.storyAssignment?.id ?? ''}
            onChange={e => {
              const story = MOCK_STORIES.find(s => s.id === e.target.value) ?? null
              dispatch({ type: 'SET_DEFAULTS', defaults: { storyAssignment: story } })
            }}
            className="w-full border border-black px-2 py-1.5 text-xs font-mono bg-white"
          >
            <option value="">No default story</option>
            {MOCK_STORIES.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        {/* Default Privacy */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">DEFAULT PRIVACY</label>
          <div className="flex gap-1">
            {(['PUBLIC', 'PRIVATE', 'RESTRICTED'] as PrivacyState[]).map(p => (
              <button
                key={p}
                onClick={() => dispatch({ type: 'SET_DEFAULTS', defaults: { privacy: defaults.privacy === p ? null : p } })}
                className={cn(
                  'flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 transition-colors',
                  defaults.privacy === p
                    ? 'border-black bg-black text-white'
                    : 'border-slate-300 text-slate-500 hover:border-black'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Default Licences */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">DEFAULT LICENCES</label>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(LICENCE_TYPE_LABELS) as [LicenceType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  const next = defaults.enabledLicences.includes(key)
                    ? defaults.enabledLicences.filter(l => l !== key)
                    : [...defaults.enabledLicences, key]
                  dispatch({ type: 'SET_DEFAULTS', defaults: { enabledLicences: next } })
                }}
                className={cn(
                  'px-2 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
                  defaults.enabledLicences.includes(key)
                    ? 'bg-black text-white border-black'
                    : 'border-slate-300 text-slate-500 hover:border-black'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Apply recommended prices toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={defaults.applyRecommendedPrice}
            onChange={e => dispatch({ type: 'SET_DEFAULTS', defaults: { applyRecommendedPrice: e.target.checked } })}
            className="w-3.5 h-3.5 accent-[#0000ff]"
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Auto-apply recommended prices after processing
          </span>
        </div>
      </div>

      {/* Start CTA */}
      <button
        onClick={() => dispatch({ type: 'START_BATCH' })}
        disabled={!canStart}
        className={cn(
          'w-full py-3 text-sm font-bold uppercase tracking-widest border-2 transition-colors',
          canStart
            ? 'border-[#0000ff] bg-[#0000ff] text-white hover:bg-[#0000cc]'
            : 'border-slate-200 text-slate-300 cursor-not-allowed'
        )}
      >
        Start Batch Upload / {assets.length} file{assets.length !== 1 ? 's' : ''}
      </button>
    </div>
  )
}
