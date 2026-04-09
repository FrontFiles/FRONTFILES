'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  mockUploadBatch,
  mockProposedGroups,
  getGroupFiles,
  getUnassignedFiles,
  getBatchStats,
  type UploadFile,
  type ProposedStoryGroup,
  type PlacementConfidence,
} from '@/data/upload-mock'

// ── Types for local state ──

interface GroupingState {
  groups: ProposedStoryGroup[]
  files: UploadFile[]
  expandedGroupId: string | null
  selectedFileId: string | null
  dragFileId: string | null
}

// ── Confidence Badge ──

function ConfidenceBadge({ level }: { level: PlacementConfidence }) {
  const styles = {
    high: 'border-blue-600 text-blue-600',
    medium: 'border-slate-500 text-slate-500',
    low: 'border-black text-black bg-black/5',
  }
  return (
    <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border', styles[level])}>
      {level}
    </span>
  )
}

// ── Signal Tag ──

function SignalTag({ signal }: { signal: string }) {
  return (
    <span className="text-[9px] font-mono text-slate-500 border border-slate-200 px-1.5 py-0.5 inline-block">
      {signal}
    </span>
  )
}

// ── Format Badge ──

function FormatBadge({ format }: { format: string }) {
  const colors: Record<string, string> = {
    Photo: 'bg-black text-white',
    Video: 'bg-blue-600 text-white',
    Audio: 'bg-slate-700 text-white',
    Infographic: 'bg-slate-500 text-white',
    Text: 'bg-slate-400 text-white',
  }
  return (
    <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5', colors[format] || 'bg-slate-300 text-white')}>
      {format}
    </span>
  )
}

// ── File Tile (inside a group column) ──

function FileTile({
  file,
  selected,
  onSelect,
  onDragStart,
  compact = false,
}: {
  file: UploadFile
  selected: boolean
  onSelect: () => void
  onDragStart: () => void
  compact?: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', file.id)
        onDragStart()
      }}
      onClick={onSelect}
      className={cn(
        'border cursor-grab active:cursor-grabbing transition-all group',
        selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-black',
        file.isDuplicate && 'border-dashed opacity-70',
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden">
        <img src={file.thumbnailRef} alt={file.suggestedTitle} className="w-full h-full object-cover" />
        <div className="absolute top-1 left-1">
          <FormatBadge format={file.format} />
        </div>
        {file.isDuplicate && (
          <div className="absolute top-1 right-1">
            <span className="text-[8px] font-bold uppercase tracking-widest bg-black/80 text-white px-1 py-0.5">
              Duplicate
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[8px] font-mono text-white/80 truncate block">{file.filename}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-2 space-y-1">
        <p className="text-[10px] font-bold text-black leading-tight line-clamp-2">{file.suggestedTitle}</p>
        {!compact && (
          <>
            <div className="flex items-center gap-1.5">
              <ConfidenceBadge level={file.placementConfidence} />
              {file.gpsPresent && (
                <span className="text-[8px] font-mono text-slate-400">GPS</span>
              )}
              {file.exifPresent && (
                <span className="text-[8px] font-mono text-slate-400">EXIF</span>
              )}
              {file.c2paPresent && (
                <span className="text-[8px] font-mono text-blue-600">C2PA</span>
              )}
            </div>
            {file.locationDetected && (
              <p className="text-[9px] font-mono text-slate-400 truncate">{file.locationDetected}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Group Column ──

function GroupColumn({
  group,
  files,
  expanded,
  onToggleExpand,
  selectedFileId,
  onSelectFile,
  onDragStart,
  onDrop,
}: {
  group: ProposedStoryGroup
  files: UploadFile[]
  expanded: boolean
  onToggleExpand: () => void
  selectedFileId: string | null
  onSelectFile: (id: string) => void
  onDragStart: (id: string) => void
  onDrop: (fileId: string, groupId: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  const typeStyles = {
    'proposed-new': {
      border: 'border-blue-600',
      badge: 'bg-blue-600 text-white',
      label: 'NEW STORY',
    },
    'matched-existing': {
      border: 'border-black',
      badge: 'bg-black text-white',
      label: 'EXISTING STORY',
    },
    'review-needed': {
      border: 'border-slate-400',
      badge: 'bg-slate-500 text-white',
      label: 'NEEDS REVIEW',
    },
  }

  const style = typeStyles[group.type]

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const fileId = e.dataTransfer.getData('text/plain')
        if (fileId) onDrop(fileId, group.id)
      }}
      className={cn(
        'border-2 transition-colors flex flex-col',
        style.border,
        dragOver && 'bg-blue-50 border-blue-600',
      )}
    >
      {/* Group Header */}
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5', style.badge)}>
            {style.label}
          </span>
          <span className="text-[9px] font-mono text-slate-400">{files.length} files</span>
        </div>
        <h3 className="text-xs font-bold text-black leading-tight">{group.suggestedTitle}</h3>
        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{group.suggestedDek}</p>

        {/* Date & Location */}
        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-slate-400">
          <span>{group.dateRange.start} — {group.dateRange.end}</span>
          <span>{group.locationRange}</span>
        </div>

        {/* Existing story match */}
        {group.type === 'matched-existing' && group.existingStoryTitle && (
          <div className="mt-2 border border-black/20 bg-black/5 p-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Matches existing:</span>
            <p className="text-[10px] font-bold text-black mt-0.5">{group.existingStoryTitle}</p>
            <p className="text-[9px] font-mono text-slate-500">{group.existingStoryAssetCount} assets already in Story</p>
          </div>
        )}

        {/* Expand/Collapse rationale */}
        <button
          onClick={onToggleExpand}
          className="mt-2 text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:underline"
        >
          {expanded ? 'Hide rationale' : 'Show rationale'}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[9px] text-slate-600 leading-relaxed">{group.rationale}</p>
            <div className="flex flex-wrap gap-1">
              {group.signals.map((s, i) => (
                <SignalTag key={i} signal={s} />
              ))}
            </div>
          </div>
        )}

        {/* Tags preview */}
        <div className="flex flex-wrap gap-1 mt-2">
          {group.suggestedTags.map(t => (
            <span key={t} className="text-[8px] font-bold uppercase tracking-wider border border-slate-200 px-1 py-0 text-slate-400">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* File tiles */}
      <div className="p-2 flex-1 overflow-y-auto space-y-2">
        {files.map(f => (
          <FileTile
            key={f.id}
            file={f}
            selected={selectedFileId === f.id}
            onSelect={() => onSelectFile(f.id)}
            onDragStart={() => onDragStart(f.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── File Detail Drawer ──

function FileDetailDrawer({ file, onClose }: { file: UploadFile; onClose: () => void }) {
  return (
    <div className="border-l-2 border-black w-[340px] flex-shrink-0 overflow-y-auto bg-white">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest">Asset Detail</span>
        <button onClick={onClose} className="text-slate-400 hover:text-black text-sm">&times;</button>
      </div>

      {/* Thumbnail */}
      <div className="aspect-video bg-slate-100 overflow-hidden">
        <img src={file.thumbnailRef} alt={file.suggestedTitle} className="w-full h-full object-cover" />
      </div>

      <div className="p-4 space-y-4">
        {/* File info */}
        <div className="space-y-1">
          <p className="text-[9px] font-mono text-slate-400">{file.filename}</p>
          <p className="text-sm font-bold text-black">{file.suggestedTitle}</p>
          <p className="text-[10px] text-slate-600 leading-relaxed">{file.suggestedDescription}</p>
        </div>

        {/* Metadata signals */}
        <div className="border border-slate-200 p-3 space-y-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Detection signals</span>
          <div className="grid grid-cols-2 gap-2">
            <MetaSignal label="GPS" present={file.gpsPresent} />
            <MetaSignal label="EXIF" present={file.exifPresent} />
            <MetaSignal label="C2PA" present={file.c2paPresent} />
            <MetaSignal label="Date" present={!!file.captureDate} />
          </div>
          {file.locationDetected && (
            <div className="pt-1 border-t border-slate-100">
              <span className="text-[9px] font-mono text-slate-400">Location: </span>
              <span className="text-[9px] font-mono text-black">{file.locationDetected}</span>
            </div>
          )}
          {file.captureDate && (
            <div>
              <span className="text-[9px] font-mono text-slate-400">Captured: </span>
              <span className="text-[9px] font-mono text-black">{new Date(file.captureDate).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Placement rationale */}
        <div className="border border-slate-200 p-3 space-y-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Placement</span>
          <div className="flex items-center gap-2">
            <ConfidenceBadge level={file.placementConfidence} />
            <span className="text-[9px] font-mono text-slate-500">confidence</span>
          </div>
          <p className="text-[9px] text-slate-600 leading-relaxed">{file.placementRationale}</p>
        </div>

        {/* Suggested price */}
        <div className="border border-slate-200 p-3 space-y-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Suggested price</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold font-mono text-black">&euro;{file.suggestedPrice}</span>
          </div>
          <p className="text-[9px] text-slate-500">{file.priceReason}</p>
        </div>

        {/* Suggested tags */}
        <div className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Suggested tags</span>
          <div className="flex flex-wrap gap-1">
            {file.suggestedTags.map(t => (
              <span key={t} className="text-[9px] font-bold uppercase tracking-wider border border-slate-300 px-1.5 py-0.5 text-slate-500">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Geo tags */}
        {file.suggestedGeoTags.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Geography</span>
            <div className="flex flex-wrap gap-1">
              {file.suggestedGeoTags.map(t => (
                <span key={t} className="text-[9px] font-bold uppercase tracking-wider border border-blue-300 px-1.5 py-0.5 text-blue-600">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate warning */}
        {file.isDuplicate && (
          <div className="border-2 border-black p-3 bg-black/5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-black">Possible duplicate</span>
            <p className="text-[9px] text-slate-600 mt-1">Near-duplicate of {file.duplicateOfId}. Consider excluding.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaSignal({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2 h-2', present ? 'bg-blue-600' : 'bg-slate-200')} />
      <span className={cn('text-[9px] font-mono', present ? 'text-black' : 'text-slate-300')}>{label}</span>
    </div>
  )
}

// ── Main Screen ──

interface StoryGroupingScreenProps {
  onContinue: () => void
  onBack: () => void
}

export function StoryGroupingScreen({ onContinue, onBack }: StoryGroupingScreenProps) {
  const [state, setState] = useState<GroupingState>(() => ({
    groups: [...mockProposedGroups],
    files: [...mockUploadBatch.files],
    expandedGroupId: null,
    selectedFileId: null,
    dragFileId: null,
  }))

  const stats = getBatchStats(mockUploadBatch)

  const handleToggleExpand = useCallback((groupId: string) => {
    setState(s => ({
      ...s,
      expandedGroupId: s.expandedGroupId === groupId ? null : groupId,
    }))
  }, [])

  const handleSelectFile = useCallback((fileId: string) => {
    setState(s => ({
      ...s,
      selectedFileId: s.selectedFileId === fileId ? null : fileId,
    }))
  }, [])

  const handleDragStart = useCallback((fileId: string) => {
    setState(s => ({ ...s, dragFileId: fileId }))
  }, [])

  const handleDropToGroup = useCallback((fileId: string, groupId: string) => {
    setState(s => {
      // Update the file's group assignment
      const newFiles = s.files.map(f =>
        f.id === fileId ? { ...f, assignedGroupId: groupId } : f
      )
      // Add fileId to the target group's fileIds if not already there
      const newGroups = s.groups.map(g => {
        if (g.id === groupId && !g.fileIds.includes(fileId)) {
          return { ...g, fileIds: [...g.fileIds, fileId] }
        }
        if (g.id !== groupId && g.fileIds.includes(fileId)) {
          return { ...g, fileIds: g.fileIds.filter(id => id !== fileId) }
        }
        return g
      })
      return { ...s, files: newFiles, groups: newGroups, dragFileId: null }
    })
  }, [])

  const handleDropToUnassigned = useCallback((fileId: string) => {
    setState(s => {
      const newFiles = s.files.map(f =>
        f.id === fileId ? { ...f, assignedGroupId: null } : f
      )
      const newGroups = s.groups.map(g => ({
        ...g,
        fileIds: g.fileIds.filter(id => id !== fileId),
      }))
      return { ...s, files: newFiles, groups: newGroups, dragFileId: null }
    })
  }, [])

  const selectedFile = state.selectedFileId
    ? state.files.find(f => f.id === state.selectedFileId) ?? null
    : null

  const unassignedFiles = state.files.filter(f => !f.assignedGroupId && !f.excluded)
  const totalSuggestedPrice = state.files.filter(f => !f.excluded).reduce((s, f) => s + f.suggestedPrice, 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="border-b-2 border-black p-3 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {state.groups.length} PROPOSED STORIES
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {state.files.filter(f => !f.excluded).length} files &middot; {stats.formats.Photo || 0} photo &middot; {stats.formats.Video || 0} video &middot; {stats.formats.Audio || 0} audio
          </span>
          {unassignedFiles.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-black border border-black px-1.5 py-0.5">
              {unassignedFiles.length} UNASSIGNED
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400">
            Est. &euro;{totalSuggestedPrice}
          </span>
          <span className="text-[9px] font-mono text-slate-300">
            Drag files between groups to reassign
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Group columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-0 h-full min-w-0">
            {/* Story group columns */}
            {state.groups.map(group => {
              const groupFiles = state.files.filter(f => f.assignedGroupId === group.id)
              return (
                <div key={group.id} className="w-[320px] min-w-[320px] flex-shrink-0 h-full overflow-hidden flex flex-col border-r border-slate-200">
                  <GroupColumn
                    group={group}
                    files={groupFiles}
                    expanded={state.expandedGroupId === group.id}
                    onToggleExpand={() => handleToggleExpand(group.id)}
                    selectedFileId={state.selectedFileId}
                    onSelectFile={handleSelectFile}
                    onDragStart={handleDragStart}
                    onDrop={handleDropToGroup}
                  />
                </div>
              )
            })}

            {/* Unassigned column */}
            {unassignedFiles.length > 0 && (
              <div
                className="w-[280px] min-w-[280px] flex-shrink-0 h-full overflow-hidden flex flex-col border-r border-slate-200"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const fileId = e.dataTransfer.getData('text/plain')
                  if (fileId) handleDropToUnassigned(fileId)
                }}
              >
                <div className="border-2 border-dashed border-slate-400 flex flex-col h-full">
                  <div className="p-3 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-slate-500 text-white px-1.5 py-0.5">
                        UNASSIGNED
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">{unassignedFiles.length} files</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Files that could not be automatically grouped. Drag to a Story group or review individually.
                    </p>
                  </div>
                  <div className="p-2 flex-1 overflow-y-auto space-y-2">
                    {unassignedFiles.map(f => (
                      <FileTile
                        key={f.id}
                        file={f}
                        selected={state.selectedFileId === f.id}
                        onSelect={() => handleSelectFile(f.id)}
                        onDragStart={() => handleDragStart(f.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail drawer */}
        {selectedFile && (
          <FileDetailDrawer
            file={selectedFile}
            onClose={() => setState(s => ({ ...s, selectedFileId: null }))}
          />
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t-2 border-black p-3 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
          >
            Back
          </button>
          <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
            <span>
              {state.groups.filter(g => g.type === 'proposed-new').length} new stories
            </span>
            <span>&middot;</span>
            <span>
              {state.groups.filter(g => g.type === 'matched-existing').length} existing matches
            </span>
            {unassignedFiles.length > 0 && (
              <>
                <span>&middot;</span>
                <span className="text-black font-bold">{unassignedFiles.length} need attention</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onContinue}
          className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest border-2 border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Confirm Grouping &amp; Continue
        </button>
      </div>
    </div>
  )
}
