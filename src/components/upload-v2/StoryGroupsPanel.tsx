'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useUploadV2 } from './UploadV2Context'
import {
  getStoryGroups,
  getAssetsForStoryGroup,
  getUnassignedAssets,
  getIncludedAssets,
  getAssetExceptions,
  centsToEur,
} from '@/lib/upload/v2-state'
import {
  Plus, ChevronDown, ChevronRight, FolderOpen, Globe, Pencil, Check, X,
  MoreVertical, Trash2, ArrowRight,
} from 'lucide-react'

interface ContextMenuState {
  groupId: string
  x: number
  y: number
}

export function StoryGroupsPanel() {
  const { state, dispatch } = useUploadV2()
  const groups = getStoryGroups(state)
  const unassigned = getUnassignedAssets(state)
  const included = getIncludedAssets(state)

  const [newStoryName, setNewStoryName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedGroups)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    setCollapsedGroups(next)
  }

  const handleCreateStory = () => {
    if (newStoryName.trim()) {
      dispatch({ type: 'CREATE_STORY_GROUP', name: newStoryName.trim() })
      setNewStoryName('')
      setShowCreate(false)
    }
  }

  const handleRename = (groupId: string) => {
    if (editName.trim()) {
      dispatch({ type: 'RENAME_STORY_GROUP', storyGroupId: groupId, name: editName.trim() })
    }
    setEditingId(null)
  }

  const handleContextAction = (action: string, groupId: string) => {
    setContextMenu(null)
    switch (action) {
      case 'rename':
        setEditingId(groupId)
        setEditName(state.storyGroupsById[groupId]?.name ?? '')
        break
      case 'assign-selected':
        if (state.ui.selectedAssetIds.length > 0) {
          dispatch({ type: 'BULK_ASSIGN_ASSETS', assetIds: state.ui.selectedAssetIds, storyGroupId: groupId })
        }
        break
      case 'delete': {
        const groupAssets = getAssetsForStoryGroup(state, groupId)
        if (groupAssets.length === 0 || confirm(`Delete story and unassign ${groupAssets.length} asset(s)?`)) {
          dispatch({ type: 'DELETE_STORY_GROUP', storyGroupId: groupId })
        }
        break
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-black bg-slate-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest">Story Groups</span>
          <span className="text-[10px] font-mono text-slate-400">
            {included.length - unassigned.length}/{included.length}
          </span>
        </div>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {groups.map(group => {
          const groupAssets = getAssetsForStoryGroup(state, group.id)
          const isSelected = state.ui.selectedStoryGroupId === group.id
          const isCollapsed = collapsedGroups.has(group.id)
          const isEditing = editingId === group.id

          // Compute group-level metrics
          const blockingCount = groupAssets.filter(a => getAssetExceptions(a).some(e => e.severity === 'blocking')).length
          const groupValue = groupAssets
            .filter(a => a.editable.privacy === 'PUBLIC' || a.editable.privacy === 'RESTRICTED')
            .reduce((sum, a) => sum + (a.editable.price ?? 0), 0)

          return (
            <div
              key={group.id}
              className={cn(
                'border-2 transition-colors',
                isSelected ? 'border-[#0000ff] bg-[#0000ff]/5/50' : 'border-slate-200 hover:border-slate-400',
              )}
              onContextMenu={e => {
                e.preventDefault()
                setContextMenu({ groupId: group.id, x: e.clientX, y: e.clientY })
              }}
            >
              {/* Group header */}
              <div
                className="flex items-start gap-1.5 px-2.5 py-2 cursor-pointer"
                onClick={() => {
                  dispatch({ type: 'SELECT_STORY_GROUP', storyGroupId: isSelected ? null : group.id })
                  dispatch({ type: 'SET_FILTER', filter: { storyGroupId: isSelected ? null : group.id } })
                }}
              >
                <button
                  onClick={e => { e.stopPropagation(); toggleCollapse(group.id) }}
                  className="mt-0.5 p-0.5 hover:bg-slate-100"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>

                <div className="flex-1 min-w-0">
                  {/* Kind badge + count + metrics */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={cn(
                      'text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5',
                      group.kind === 'proposed' && 'bg-[#0000ff]/10 text-[#0000cc]',
                      group.kind === 'matched-existing' && 'bg-slate-100 text-black',
                      group.kind === 'creator' && 'bg-black text-white',
                    )}>
                      {group.kind === 'proposed' ? 'Proposed' : group.kind === 'matched-existing' ? 'Existing' : 'Created'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {groupAssets.length}
                    </span>
                    {blockingCount > 0 && (
                      <span className="text-[9px] font-mono font-bold text-black">{blockingCount} blocked</span>
                    )}
                  </div>

                  {/* Name (editable) */}
                  {isEditing ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(group.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 text-xs font-bold border-b-2 border-[#0000ff] bg-transparent outline-none py-0.5"
                      />
                      <button onClick={() => handleRename(group.id)} className="p-0.5"><Check size={12} className="text-[#0000ff]" /></button>
                      <button onClick={() => setEditingId(null)} className="p-0.5"><X size={12} className="text-slate-400" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group/name">
                      <span className="text-xs font-bold truncate">{group.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingId(group.id); setEditName(group.name) }}
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 transition-opacity"
                      >
                        <Pencil size={10} className="text-slate-400" />
                      </button>
                      {/* Context menu trigger */}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const rect = e.currentTarget.getBoundingClientRect()
                          setContextMenu({ groupId: group.id, x: rect.right, y: rect.bottom })
                        }}
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 transition-opacity ml-auto"
                      >
                        <MoreVertical size={10} className="text-slate-400" />
                      </button>
                    </div>
                  )}

                  {/* Existing story match */}
                  {group.kind === 'matched-existing' && group.existingStoryTitle && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Globe size={10} className="text-slate-500" />
                      <span className="text-[10px] text-slate-600 truncate">
                        {group.existingStoryTitle} ({group.existingStoryAssetCount})
                      </span>
                    </div>
                  )}

                  {/* Group value */}
                  {groupValue > 0 && (
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {centsToEur(groupValue)}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded: asset thumbnails */}
              {!isCollapsed && groupAssets.length > 0 && (
                <div className="px-2.5 pb-2 flex flex-wrap gap-1">
                  {groupAssets.slice(0, 8).map(a => {
                    const hasBlocking = getAssetExceptions(a).some(e => e.severity === 'blocking')
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          'w-8 h-8 border text-[8px] font-mono flex items-center justify-center cursor-pointer transition-colors overflow-hidden relative',
                          state.ui.focusedAssetId === a.id
                            ? 'border-[#0000ff] bg-[#0000ff]/10'
                            : hasBlocking
                              ? 'border-black bg-slate-50 hover:bg-slate-100'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-400',
                        )}
                        onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_ASSET', assetId: a.id }) }}
                        title={a.filename}
                      >
                        {a.thumbnailRef ? (
                          <img src={a.thumbnailRef} alt="" className="w-full h-full object-cover" />
                        ) : (
                          a.format?.charAt(0).toUpperCase() ?? '?'
                        )}
                      </div>
                    )
                  })}
                  {groupAssets.length > 8 && (
                    <div className="w-8 h-8 border border-slate-200 text-[8px] font-mono flex items-center justify-center text-slate-400">
                      +{groupAssets.length - 8}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned section */}
        {unassigned.length > 0 && (
          <div className="border-2 border-dashed border-black">
            <div
              className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-50"
              onClick={() => dispatch({ type: 'SET_FILTER_PRESET', preset: 'unassigned' })}
            >
              <FolderOpen size={14} className="text-black" />
              <span className="text-xs font-bold text-black">Not yet assigned</span>
              <span className="text-[10px] font-mono text-slate-500 ml-auto">{unassigned.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Create new story */}
      <div className="p-2 border-t border-black flex-shrink-0">
        {showCreate ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newStoryName}
              onChange={e => setNewStoryName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateStory()
                if (e.key === 'Escape') { setShowCreate(false); setNewStoryName('') }
              }}
              placeholder="Story name..."
              className="flex-1 px-2 py-1.5 text-xs border-2 border-black outline-none"
            />
            <button onClick={handleCreateStory} className="p-1.5 bg-black text-white"><Check size={12} /></button>
            <button onClick={() => { setShowCreate(false); setNewStoryName('') }} className="p-1.5"><X size={12} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-dashed border-black hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={12} /> Create new Story
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-[100] bg-white border-2 border-black shadow-lg min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleContextAction('rename', contextMenu.groupId)}
            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
          >
            <Pencil size={12} /> Rename
          </button>
          {state.ui.selectedAssetIds.length > 0 && (
            <button
              onClick={() => handleContextAction('assign-selected', contextMenu.groupId)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
            >
              <ArrowRight size={12} /> Assign {state.ui.selectedAssetIds.length} selected here
            </button>
          )}
          <button
            onClick={() => handleContextAction('delete', contextMenu.groupId)}
            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 text-black flex items-center gap-2 border-t border-slate-100"
          >
            <Trash2 size={12} /> Delete Story
          </button>
        </div>
      )}
    </div>
  )
}
