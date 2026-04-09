'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import { getAssets } from '@/lib/upload/v2-state'
import { SCENARIOS, SCENARIO_LIST, type ScenarioId } from '@/lib/upload/v2-mock-scenarios'
import type { PrivacyState, LicenceType } from '@/lib/upload/types'
import { ASSET_FORMAT_LABELS } from '@/lib/upload/types'

const PRIVACY_OPTIONS: PrivacyState[] = ['PUBLIC', 'PRIVATE', 'RESTRICTED']
const LICENCE_OPTIONS: LicenceType[] = ['editorial', 'commercial', 'broadcast', 'print', 'digital', 'web', 'merchandise']

export function AddFilesScreen() {
  const { state, dispatch, startAnalysis } = useUploadV2()
  const assets = getAssets(state)
  const [showDefaults, setShowDefaults] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('messy_multi_story')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLoadScenario = useCallback(() => {
    const scenario = SCENARIOS[selectedScenario]
    dispatch({
      type: 'ADD_FILES',
      files: scenario.assets.map(a => ({
        filename: a.filename,
        fileSize: a.fileSize,
        format: a.format,
        file: null,
        thumbnailRef: a.thumbnailRef ?? null,
      })),
    })
  }, [selectedScenario, dispatch])

  const handleBeginUpload = useCallback(() => {
    const scenario = SCENARIOS[selectedScenario]
    const assetIds = getAssets({ ...state, assetOrder: state.assetOrder }).map(a => a.id)
    // Use the latest asset ids after ADD_FILES
    startAnalysis(scenario, assetIds)
  }, [selectedScenario, state, startAnalysis])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      dispatch({
        type: 'ADD_FILES',
        files: files.map(f => ({
          filename: f.name,
          fileSize: f.size,
          format: null, // would detect from MIME type in real impl
          file: f,
        })),
      })
    }
  }, [dispatch])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) {
      dispatch({
        type: 'ADD_FILES',
        files: files.map(f => ({
          filename: f.name,
          fileSize: f.size,
          format: null,
          file: f,
        })),
      })
    }
  }, [dispatch])

  const formatSize = (bytes: number) => {
    if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
    if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
    return `${(bytes / 1_000).toFixed(1)} KB`
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Drop zone */}
        <div
          className={cn(
            'border-2 border-dashed p-12 text-center transition-colors cursor-pointer',
            isDragOver ? 'border-blue-600 bg-blue-50' : 'border-black hover:bg-slate-50',
          )}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="text-sm font-bold uppercase tracking-wide">Drop files or click to add</p>
          <p className="text-xs text-slate-400 mt-1">Photos, videos, audio, text, illustrations, infographics, vectors</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Demo scenario loader */}
        <div className="border-2 border-black p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Load demo batch</p>
          <div className="flex gap-2">
            <select
              value={selectedScenario}
              onChange={e => setSelectedScenario(e.target.value as ScenarioId)}
              className="flex-1 border-2 border-black px-3 py-2 text-sm font-mono bg-white"
            >
              {SCENARIO_LIST.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={handleLoadScenario}
              className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
            >
              Load
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">{SCENARIOS[selectedScenario].description}</p>
        </div>

        {/* File list */}
        {assets.length > 0 && (
          <div className="border-2 border-black">
            <div className="border-b border-black px-4 py-2 flex items-center justify-between bg-slate-50">
              <span className="text-[10px] font-bold uppercase tracking-widest">{assets.length} files added</span>
              <span className="text-[10px] font-mono text-slate-400">
                {formatSize(assets.reduce((sum, a) => sum + a.fileSize, 0))} total
              </span>
            </div>
            <div className="max-h-64 overflow-auto divide-y divide-slate-100">
              {assets.map(asset => (
                <div key={asset.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <span className="flex-1 font-mono text-xs truncate">{asset.filename}</span>
                  {asset.format && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {ASSET_FORMAT_LABELS[asset.format]}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-300">{formatSize(asset.fileSize)}</span>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_FILE', assetId: asset.id })}
                    className="p-1 hover:bg-slate-100 transition-colors"
                  >
                    <X size={12} className="text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defaults (collapsible, no default Story) */}
        <div className="border-2 border-black">
          <button
            onClick={() => setShowDefaults(!showDefaults)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest">Defaults for this upload</span>
            {showDefaults ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDefaults && (
            <div className="border-t border-black p-4 space-y-4">
              {/* Privacy */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Default privacy</label>
                <div className="flex gap-2">
                  {PRIVACY_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => dispatch({ type: 'SET_DEFAULTS', defaults: { privacy: state.defaults.privacy === p ? null : p } })}
                      className={cn(
                        'px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-2 transition-colors',
                        state.defaults.privacy === p
                          ? 'border-black bg-black text-white'
                          : 'border-black text-black hover:bg-slate-50',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {/* Licences */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Default licences</label>
                <div className="flex flex-wrap gap-2">
                  {LICENCE_OPTIONS.map(l => {
                    const isActive = state.defaults.licences.includes(l)
                    return (
                      <button
                        key={l}
                        onClick={() => {
                          const next = isActive
                            ? state.defaults.licences.filter(x => x !== l)
                            : [...state.defaults.licences, l]
                          dispatch({ type: 'SET_DEFAULTS', defaults: { licences: next } })
                        }}
                        className={cn(
                          'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide border transition-colors',
                          isActive
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 text-slate-500 hover:border-black hover:text-black',
                        )}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Begin upload */}
        {assets.length > 0 && (
          <button
            onClick={handleBeginUpload}
            className="w-full py-3 bg-black text-white text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
          >
            Begin upload / {assets.length} files
          </button>
        )}
      </div>
    </div>
  )
}
