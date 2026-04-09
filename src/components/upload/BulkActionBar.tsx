'use client'

import { cn } from '@/lib/utils'
import type { BatchAsset } from '@/lib/upload/batch-types'

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onBulkAction: (action: string) => void
  onToggleDrawer: () => void
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkAction,
  onToggleDrawer,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="border-2 border-blue-600 bg-blue-50 px-3 py-2 flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
        {selectedCount} SELECTED
      </span>

      <div className="h-4 w-px bg-blue-300" />

      <button
        onClick={() => selectedCount < totalCount ? onSelectAll() : onDeselectAll()}
        className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:underline"
      >
        {selectedCount < totalCount ? 'Select All' : 'Deselect All'}
      </button>

      <div className="h-4 w-px bg-blue-300" />

      <ActionBtn onClick={() => onBulkAction('assign_story')}>Assign Story</ActionBtn>
      <ActionBtn onClick={() => onBulkAction('set_privacy')}>Set Privacy</ActionBtn>
      <ActionBtn onClick={() => onBulkAction('apply_licences')}>Licences</ActionBtn>
      <ActionBtn onClick={() => onBulkAction('apply_recommended_price')}>Apply Rec. Price</ActionBtn>
      <ActionBtn onClick={() => onBulkAction('hold_from_commit')}>Hold</ActionBtn>
      <ActionBtn onClick={() => onBulkAction('remove_from_batch')}>Remove</ActionBtn>

      <div className="flex-1" />

      <button
        onClick={onToggleDrawer}
        className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors"
      >
        Bulk Edit
      </button>
    </div>
  )
}

function ActionBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 border border-blue-600 text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
    >
      {children}
    </button>
  )
}
