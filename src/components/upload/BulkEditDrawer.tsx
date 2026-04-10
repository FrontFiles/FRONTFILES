'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BatchAsset, BulkApplyMode } from '@/lib/upload/batch-types'
import type { PrivacyState, LicenceType, StoryRef } from '@/lib/upload/types'
import { LICENCE_TYPE_LABELS } from '@/lib/upload/types'
import { MOCK_STORIES } from '@/lib/upload/batch-mock-data'
import { RecommendationBadge } from './RecommendationBadge'

interface BulkEditDrawerProps {
  open: boolean
  selectedAssets: BatchAsset[]
  onClose: () => void
  onBulkUpdate: (updates: Record<string, unknown>, mode: BulkApplyMode) => void
  onApplyRecommendedPrices: () => void
}

export function BulkEditDrawer({ open, selectedAssets, onClose, onBulkUpdate, onApplyRecommendedPrices }: BulkEditDrawerProps) {
  const [applyMode, setApplyMode] = useState<BulkApplyMode>('selected')
  const [storyId, setStoryId] = useState<string>('')
  const [privacy, setPrivacy] = useState<PrivacyState | ''>('')
  const [manualPrice, setManualPrice] = useState<string>('')
  const [selectedLicences, setSelectedLicences] = useState<LicenceType[]>([])
  const [newTags, setNewTags] = useState<string>('')

  if (!open) return null

  const hasRecommendations = selectedAssets.some(a => a.priceRecommendation)

  const handleApplyStory = () => {
    const story = MOCK_STORIES.find(s => s.id === storyId)
    if (story) {
      onBulkUpdate({ storyAssignment: story }, applyMode)
    }
  }

  const handleApplyPrivacy = () => {
    if (privacy) {
      onBulkUpdate({ privacy }, applyMode)
    }
  }

  const handleApplyPrice = () => {
    const amount = Math.round(parseFloat(manualPrice) * 100)
    if (!isNaN(amount) && amount > 0) {
      onBulkUpdate({ priceAmount: amount }, applyMode)
    }
  }

  const handleApplyLicences = () => {
    if (selectedLicences.length > 0) {
      onBulkUpdate({ enabledLicences: selectedLicences }, applyMode)
    }
  }

  const handleApplyTags = () => {
    const tags = newTags.split(',').map(t => t.trim()).filter(Boolean)
    if (tags.length > 0) {
      onBulkUpdate({ tags }, applyMode)
    }
  }

  const toggleLicence = (l: LicenceType) => {
    setSelectedLicences(prev =>
      prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
    )
  }

  return (
    <div className="w-80 border-l-2 border-black bg-white overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="border-b-2 border-black p-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest">BULK EDIT</div>
          <div className="text-[10px] font-mono text-slate-400">{selectedAssets.length} assets selected</div>
        </div>
        <button onClick={onClose} className="text-lg font-mono text-slate-400 hover:text-black">&times;</button>
      </div>

      {/* Apply Mode */}
      <div className="p-3 border-b border-slate-200">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">APPLY MODE</div>
        <div className="flex gap-1">
          {(['selected', 'fill_blanks', 'overwrite'] as BulkApplyMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setApplyMode(mode)}
              className={cn(
                'px-2 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
                applyMode === mode ? 'bg-black text-white border-black' : 'border-slate-300 text-slate-500 hover:border-black'
              )}
            >
              {mode === 'selected' ? 'Selected' : mode === 'fill_blanks' ? 'Fill Blanks' : 'Overwrite'}
            </button>
          ))}
        </div>
      </div>

      {/* Story Assignment */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">STORY</div>
        <select
          value={storyId}
          onChange={e => setStoryId(e.target.value)}
          className="w-full border border-black px-2 py-1 text-xs font-mono bg-white"
        >
          <option value="">Select story...</option>
          {MOCK_STORIES.map(s => (
            <option key={s.id} value={s.id}>{s.title} ({s.assetCount})</option>
          ))}
        </select>
        <button
          onClick={handleApplyStory}
          disabled={!storyId}
          className={cn(
            'w-full py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
            storyId ? 'border-black text-black hover:bg-black hover:text-white' : 'border-slate-200 text-slate-300'
          )}
        >
          Apply Story
        </button>
      </div>

      {/* Privacy */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PRIVACY</div>
        <div className="flex gap-1">
          {(['PUBLIC', 'PRIVATE', 'RESTRICTED'] as PrivacyState[]).map(p => (
            <button
              key={p}
              onClick={() => setPrivacy(p)}
              className={cn(
                'flex-1 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
                privacy === p ? 'bg-black text-white border-black' : 'border-slate-300 text-slate-500'
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={handleApplyPrivacy}
          disabled={!privacy}
          className={cn(
            'w-full py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
            privacy ? 'border-black text-black hover:bg-black hover:text-white' : 'border-slate-200 text-slate-300'
          )}
        >
          Apply Privacy
        </button>
      </div>

      {/* Pricing */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PRICING</div>

        {hasRecommendations && (
          <button
            onClick={onApplyRecommendedPrices}
            className="w-full py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors"
          >
            Apply Recommended Prices
          </button>
        )}

        <div className="flex items-center gap-1">
          <span className="text-xs font-mono">&euro;</span>
          <input
            type="number"
            value={manualPrice}
            onChange={e => setManualPrice(e.target.value)}
            placeholder="Manual price"
            className="flex-1 border border-black px-2 py-1 text-xs font-mono"
            step="1"
            min="0"
          />
        </div>
        <button
          onClick={handleApplyPrice}
          disabled={!manualPrice}
          className={cn(
            'w-full py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
            manualPrice ? 'border-black text-black hover:bg-black hover:text-white' : 'border-slate-200 text-slate-300'
          )}
        >
          Apply Manual Price
        </button>
      </div>

      {/* Licences */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">LICENCES</div>
        <div className="flex flex-wrap gap-1">
          {(Object.entries(LICENCE_TYPE_LABELS) as [LicenceType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleLicence(key)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border transition-colors',
                selectedLicences.includes(key)
                  ? 'bg-black text-white border-black'
                  : 'border-slate-300 text-slate-500'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleApplyLicences}
          disabled={selectedLicences.length === 0}
          className={cn(
            'w-full py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
            selectedLicences.length > 0 ? 'border-black text-black hover:bg-black hover:text-white' : 'border-slate-200 text-slate-300'
          )}
        >
          Apply Licences
        </button>
      </div>

      {/* Tags */}
      <div className="p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">TAGS</div>
        <input
          type="text"
          value={newTags}
          onChange={e => setNewTags(e.target.value)}
          placeholder="tag1, tag2, tag3"
          className="w-full border border-black px-2 py-1 text-xs font-mono"
        />
        <button
          onClick={handleApplyTags}
          disabled={!newTags.trim()}
          className={cn(
            'w-full py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors',
            newTags.trim() ? 'border-black text-black hover:bg-black hover:text-white' : 'border-slate-200 text-slate-300'
          )}
        >
          Apply Tags
        </button>
      </div>
    </div>
  )
}
