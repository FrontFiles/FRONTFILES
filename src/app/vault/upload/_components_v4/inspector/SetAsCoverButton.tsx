/**
 * Frontfiles Upload V4 — Set As Cover Button (D2.4 §1.1)
 *
 * Spec: UX-SPEC-V4 §7.3 (corrected per external review — TWO co-equal
 * primary cover-set paths: drag-onto-story-header in left rail (D2.2)
 * AND this button).
 *
 * Renders only when the open asset is in a story (asset.storyGroupId !== null
 * AND the story exists in storyGroupsById). When the asset is already the
 * story's cover (story.coverAssetId === asset.id), reads "✓ Cover" disabled.
 * Otherwise reads "Set as cover · {storyName}" and dispatches SET_STORY_COVER
 * on click.
 *
 * Per IPD4-4 = (a) visibility rule: shown when in a story; disabled when
 * already cover.
 */

'use client'

import { useUploadContext } from '../../_components/UploadContext'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
}

export default function SetAsCoverButton({ asset }: Props) {
  const { state, dispatch } = useUploadContext()

  if (!asset.storyGroupId) return null
  const story = state.storyGroupsById[asset.storyGroupId]
  if (!story) return null

  const isCover = story.coverAssetId === asset.id

  return (
    <div className="border-b border-black p-3 flex-shrink-0">
      <button
        type="button"
        disabled={isCover}
        onClick={() =>
          dispatch({
            type: 'SET_STORY_COVER',
            storyGroupId: asset.storyGroupId!,
            assetId: asset.id,
          })
        }
        className={`w-full border border-black px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
          isCover
            ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
            : 'bg-white text-black hover:bg-blue-600 hover:text-white hover:border-blue-600'
        }`}
        title={isCover ? `Already the cover for ${story.name}` : `Set as cover for ${story.name}`}
      >
        {isCover ? `✓ Cover · ${story.name}` : `Set as cover · ${story.name}`}
      </button>
    </div>
  )
}
