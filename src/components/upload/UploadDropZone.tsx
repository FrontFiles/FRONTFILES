'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ASSET_FORMAT_LABELS, FILE_CONSTRAINTS } from '@/lib/upload/types'
import { detectFormat, formatFileSize } from '@/lib/upload/validation'
import type { AssetFormat } from '@/lib/upload/types'

interface UploadDropZoneProps {
  onFilesSelected: (files: { files: File[]; format: AssetFormat }[]) => void
  disabled?: boolean
}

export function UploadDropZone({ onFilesSelected, disabled }: UploadDropZoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<AssetFormat>('photo')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    processFiles(files)
  }, [disabled, selectedFormat])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    processFiles(files)
    if (inputRef.current) inputRef.current.value = ''
  }, [disabled, selectedFormat])

  function processFiles(files: File[]) {
    // Group files by detected or declared format
    const grouped: { files: File[]; format: AssetFormat }[] = []
    for (const file of files) {
      const detected = detectFormat(file) ?? selectedFormat
      const existing = grouped.find(g => g.format === detected)
      if (existing) {
        existing.files.push(file)
      } else {
        grouped.push({ files: [file], format: detected })
      }
    }
    onFilesSelected(grouped)
  }

  const constraint = FILE_CONSTRAINTS.find(c => c.format === selectedFormat)

  return (
    <div className="flex flex-col gap-4">
      {/* Format selector */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
          Content format
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(ASSET_FORMAT_LABELS) as [AssetFormat, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedFormat(key)}
              className={cn(
                'px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                selectedFormat === key
                  ? 'bg-black text-white'
                  : 'border border-slate-300 text-slate-500 hover:border-black hover:text-black'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed px-8 py-12 flex flex-col items-center justify-center cursor-pointer transition-colors',
          dragActive && !disabled && 'border-blue-600 bg-blue-50',
          !dragActive && !disabled && 'border-black hover:bg-slate-50',
          disabled && 'border-slate-300 cursor-not-allowed opacity-50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleChange}
          className="hidden"
          accept={constraint?.acceptedMimeTypes.join(',')}
          disabled={disabled}
        />

        {/* Upload icon */}
        <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10 text-black mb-4">
          <path d="M16 4v20M8 12l8-8 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 24v4h24v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <p className="text-sm font-bold text-black mb-1">
          Drop files here or click to select
        </p>
        <p className="text-xs text-slate-400">
          {ASSET_FORMAT_LABELS[selectedFormat]} — max {constraint?.maxSizeLabel ?? '—'} per file. Bulk upload supported.
        </p>
      </div>

      {/* Size reference */}
      <div className="border border-slate-200 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">
          Format size limits
        </span>
        <div className="grid grid-cols-4 gap-2">
          {FILE_CONSTRAINTS.map(c => (
            <div key={c.format} className="flex items-baseline gap-1">
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                c.format === selectedFormat ? 'text-black' : 'text-slate-400'
              )}>
                {ASSET_FORMAT_LABELS[c.format]}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{c.maxSizeLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
