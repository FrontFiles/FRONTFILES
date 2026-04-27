/**
 * Frontfiles Upload V4 — Contact Sheet Story Header (D2.10)
 *
 * When the contact sheet is filtered to a single story, this row renders
 * just below the filter chips and above the cover slot + asset grid. It
 * surfaces story-level metadata for direct editing:
 *
 *   - Story name (inline editable; debounced RENAME_STORY_GROUP)
 *   - Story location (single primary string)
 *   - Story date (ISO date)
 *   - "Apply to all in story" button — propagates location → each asset's
 *     editable.geography (as a 1-element array [location]) and date →
 *     editable.captureDate. Composed via per-asset BULK_UPDATE_FIELD
 *     dispatches; no dedicated APPLY action.
 *
 * Mount gating: only renders when state.ui.filter.storyGroupId !== null
 * AND the story exists in storyGroupsById. Sized as a thin row with the
 * inputs at slate-300 borders and a decisive blue button.
 *
 * Per the founder's "explicit creator action" posture (BP/Watermark trust
 * track): the apply button overwrites all asset-level geography + date
 * values regardless of prior values. The creator clicks it as a deliberate
 * stamp.
 */

'use client'

import { useEffect, useState } from 'react'
import { useUploadContext } from './UploadContext'

const FIELD_INPUT =
  'border border-slate-300 px-2 py-1 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-0'
const RENAME_DEBOUNCE_MS = 300

export default function ContactSheetStoryHeader() {
  const { state, dispatch } = useUploadContext()
  const storyGroupId = state.ui.filter.storyGroupId
  const story = storyGroupId ? state.storyGroupsById[storyGroupId] : null

  // Local state for debounced inputs (name + location). Date dispatches
  // immediately on change since native date pickers don't fire onChange
  // per keystroke.
  const [name, setName] = useState(story?.name ?? '')
  const [location, setLocation] = useState(story?.location ?? '')

  // Sync local state when the story id changes (e.g., creator switches
  // filter to a different story) or when the underlying values update via
  // RENAME_STORY_GROUP / UPDATE_STORY_FIELD from elsewhere.
  useEffect(() => {
    setName(story?.name ?? '')
    setLocation(story?.location ?? '')
  }, [storyGroupId, story?.name, story?.location])

  // Debounced rename dispatch.
  useEffect(() => {
    if (!story) return
    if (name === story.name) return
    const t = setTimeout(() => {
      dispatch({ type: 'RENAME_STORY_GROUP', storyGroupId: story.id, name })
    }, RENAME_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [name, story, dispatch])

  // Debounced location dispatch.
  useEffect(() => {
    if (!story) return
    if (location === (story.location ?? '')) return
    const t = setTimeout(() => {
      dispatch({
        type: 'UPDATE_STORY_FIELD',
        storyGroupId: story.id,
        field: 'location',
        value: location,
      })
    }, RENAME_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [location, story, dispatch])

  if (!story) return null

  function handleDateChange(value: string) {
    if (!story) return
    dispatch({
      type: 'UPDATE_STORY_FIELD',
      storyGroupId: story.id,
      field: 'date',
      value: value === '' ? null : value,
    })
  }

  function handleApplyToAll() {
    if (!story) return
    // All assets currently in this story (membership = asset.storyGroupId).
    const assetIds = state.assetOrder.filter(
      id => state.assetsById[id]?.storyGroupId === story.id,
    )
    if (assetIds.length === 0) return
    // Geography: write [location] when location is non-empty; otherwise []
    // (clears the field — explicit creator stamp).
    const geographyValue: string[] = (story.location ?? '').trim()
      ? [(story.location ?? '').trim()]
      : []
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds,
      field: 'geography',
      value: geographyValue,
    })
    // Date: copy story.date as-is (null clears).
    dispatch({
      type: 'BULK_UPDATE_FIELD',
      assetIds,
      field: 'captureDate',
      value: story.date ?? null,
    })
  }

  // Count how many assets the apply button would touch (for the label hint).
  const memberCount = state.assetOrder.filter(
    id => state.assetsById[id]?.storyGroupId === story.id,
  ).length

  return (
    <div
      className="border-b border-slate-200 bg-slate-50 px-4 py-2 flex items-center gap-3 flex-wrap min-w-0"
      data-region="story-header"
      aria-label={`Story metadata for ${story.name}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
        Story
      </span>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        className={`${FIELD_INPUT} flex-1 min-w-[160px] max-w-[320px]`}
        placeholder="Story name"
        aria-label="Story name"
      />
      <input
        type="text"
        value={location}
        onChange={e => setLocation(e.target.value)}
        className={`${FIELD_INPUT} flex-1 min-w-[160px] max-w-[280px]`}
        placeholder="Location (e.g., Lisbon, Portugal)"
        aria-label="Story location"
      />
      <input
        type="date"
        value={story.date ?? ''}
        onChange={e => handleDateChange(e.target.value)}
        className={`${FIELD_INPUT} w-40 font-mono`}
        aria-label="Story date"
      />
      <button
        type="button"
        onClick={handleApplyToAll}
        disabled={memberCount === 0}
        className="bg-blue-600 text-white border border-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={`Apply story location + date to all ${memberCount} asset${memberCount === 1 ? '' : 's'} in this story`}
      >
        Apply to all in story
      </button>
    </div>
  )
}