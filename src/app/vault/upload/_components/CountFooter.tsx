/**
 * Frontfiles Upload V4 — Count Footer (D2.3 §1.1)
 *
 * Spec: UX-SPEC-V4 §3.6 + IPD3-7 default = (a) "{visible} of {included} · {ready} ready".
 *
 * Bottom-right of CenterPane footer. Reads getV3PublishReadiness for the
 * included/ready counts and getFilteredSortedSearchedAssets for the
 * post-filter visible count.
 */

'use client'

import { useMemo } from 'react'
import { useUploadContext } from './UploadContext'
import {
  getFilteredSortedSearchedAssets,
  getV3PublishReadiness,
  type FilterableView,
  type AssetsView,
} from '@/lib/upload/upload-selectors'

export default function CountFooter() {
  const { state } = useUploadContext()

  const filterView: FilterableView = useMemo(
    () => ({
      assetsById: state.assetsById,
      assetOrder: state.assetOrder,
      filter: state.ui.filter,
      searchQuery: state.ui.searchQuery,
      sortField: state.ui.sortField,
      sortDirection: state.ui.sortDirection,
    }),
    [
      state.assetsById,
      state.assetOrder,
      state.ui.filter,
      state.ui.searchQuery,
      state.ui.sortField,
      state.ui.sortDirection,
    ],
  )
  const visible = useMemo(() => getFilteredSortedSearchedAssets(filterView), [filterView])

  const assetsView: AssetsView = useMemo(
    () => ({ assetsById: state.assetsById, assetOrder: state.assetOrder }),
    [state.assetsById, state.assetOrder],
  )
  const readiness = useMemo(() => getV3PublishReadiness(assetsView), [assetsView])

  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex-shrink-0">
      {visible.length} of {readiness.includedCount} · {readiness.readyCount} ready
    </div>
  )
}
