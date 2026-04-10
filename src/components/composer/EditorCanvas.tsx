'use client'

import { useCallback, useState, useEffect } from 'react'
import { useComposer } from '@/lib/composer/context'
import { getOrderedBlocks } from '@/lib/composer/selectors'
import { assetMap, creatorMap } from '@/data'
import { ValidationBadge } from '@/components/discovery/ValidationBadge'
import { formatEur } from '@/lib/composer/split-engine'

export function EditorCanvas() {
  const { state, dispatch } = useComposer()
  const blocks = getOrderedBlocks(state)

  const handleDrop = useCallback(
    (e: React.DragEvent, afterBlockId: string | null) => {
      e.preventDefault()
      const assetId = e.dataTransfer.getData('text/plain')
      if (assetId) {
        dispatch({ type: 'ADD_ASSET_BLOCK', payload: { assetId, afterBlockId } })
      }
    },
    [dispatch]
  )

  const handleAddText = useCallback(
    (afterBlockId: string | null) => {
      dispatch({ type: 'ADD_TEXT_BLOCK', payload: { afterBlockId } })
    },
    [dispatch]
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Title */}
        <input
          type="text"
          value={state.title}
          onChange={e => dispatch({ type: 'SET_TITLE', payload: e.target.value })}
          placeholder="Article title..."
          className="w-full text-2xl font-black text-black placeholder:text-slate-200 focus:outline-none border-b-2 border-transparent focus:border-[#0000ff] pb-2 mb-2 transition-colors"
        />

        {/* Dek */}
        <input
          type="text"
          value={state.dek}
          onChange={e => dispatch({ type: 'SET_DEK', payload: e.target.value })}
          placeholder="Short description..."
          className="w-full text-sm text-slate-500 placeholder:text-slate-200 focus:outline-none border-b border-transparent focus:border-[#0000ff] pb-2 mb-6 transition-colors"
        />

        {/* Blocks with insertion points between each */}
        <div className="flex flex-col gap-0">
          {/* Insertion point before first block */}
          <InsertionPoint
            afterBlockId={null}
            onDrop={handleDrop}
            onAddText={handleAddText}
          />

          {blocks.map((block, index) => (
            <div key={block.id}>
              {block.type === 'text' ? (
                <TextBlockEditor
                  blockId={block.id}
                  content={block.content}
                  isFocused={state.ui.focusedBlockId === block.id}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                />
              ) : (
                <AssetBlockEditor
                  blockId={block.id}
                  assetId={block.assetId}
                  caption={block.caption}
                  editorCaption={block.editorCaption}
                  isFocused={state.ui.focusedBlockId === block.id}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                />
              )}
              {/* Insertion point after every block */}
              <InsertionPoint
                afterBlockId={block.id}
                onDrop={handleDrop}
                onAddText={handleAddText}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Insertion point (drop zone + add text) ─────────────────

function InsertionPoint({
  afterBlockId,
  onDrop,
  onAddText,
}: {
  afterBlockId: string | null
  onDrop: (e: React.DragEvent, afterBlockId: string | null) => void
  onAddText: (afterBlockId: string | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`relative flex items-center justify-center transition-all ${
        dragOver
          ? 'h-16 border-2 border-dashed border-[#0000ff] bg-[#0000ff]/5'
          : 'h-8'
      }`}
      onDrop={e => { onDrop(e, afterBlockId); setDragOver(false) }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true) }}
      onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
    >
      {dragOver ? (
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff]">
          Drop asset here
        </span>
      ) : (
        <div className="flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex-1 h-px bg-slate-200" />
          <button
            onClick={() => onAddText(afterBlockId)}
            className="h-6 px-2 border border-slate-200 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:border-black hover:text-black transition-colors"
          >
            + Text
          </button>
          <span className="text-[9px] text-slate-300">or drop asset</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      )}
    </div>
  )
}

// ── Text block ──────────────────────────────────────────────

function TextBlockEditor({
  blockId,
  content,
  isFocused,
  isFirst,
  isLast,
}: {
  blockId: string
  content: string
  isFocused: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const { state, dispatch } = useComposer()
  const inlineAsset = state.inlineTextAssets[blockId]

  return (
    <div
      className={`relative group ${isFocused ? 'ring-2 ring-[#0000ff]' : ''}`}
      onClick={() => dispatch({ type: 'FOCUS_BLOCK', payload: blockId })}
    >
      {/* Asset indicator bar — text content is a vault asset */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-50 border-2 border-b-0 border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5 leading-none">Text</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Vault asset</span>
        </div>
        {inlineAsset && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-400">{inlineAsset.wordCount}w</span>
            <span className="text-[9px] font-bold font-mono text-black">{formatEur(inlineAsset.price)}</span>
          </div>
        )}
      </div>
      <textarea
        value={content}
        onChange={e => dispatch({ type: 'UPDATE_TEXT_BLOCK', payload: { blockId, content: e.target.value } })}
        onFocus={() => dispatch({ type: 'FOCUS_BLOCK', payload: blockId })}
        placeholder="Write..."
        rows={4}
        className="w-full border-2 border-t-0 border-slate-200 focus:border-black px-4 py-3 text-sm text-black placeholder:text-slate-300 focus:outline-none resize-none transition-colors"
      />
      {/* Block controls — reorder + remove */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isFirst && (
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_BLOCK_UP', payload: { blockId } }) }}
            className="w-5 h-5 text-[10px] text-slate-300 hover:text-black flex items-center justify-center"
            title="Move up"
          >
            &#9650;
          </button>
        )}
        {!isLast && (
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_BLOCK_DOWN', payload: { blockId } }) }}
            className="w-5 h-5 text-[10px] text-slate-300 hover:text-black flex items-center justify-center"
            title="Move down"
          >
            &#9660;
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_BLOCK', payload: { blockId } }) }}
          className="w-5 h-5 text-[10px] text-slate-300 hover:text-black flex items-center justify-center"
        >
          &times;
        </button>
      </div>
    </div>
  )
}

// ── Asset block ─────────────────────────────────────────────

function AssetBlockEditor({
  blockId,
  assetId,
  caption,
  editorCaption,
  isFocused,
  isFirst,
  isLast,
}: {
  blockId: string
  assetId: string
  caption: string
  editorCaption: string
  isFocused: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const { dispatch } = useComposer()
  const asset = assetMap[assetId]
  const creator = asset ? creatorMap[asset.creatorId] : null

  // Fetch full text content for Text-format assets
  const [fullText, setFullText] = useState<string | null>(null)
  useEffect(() => {
    if (asset?.format === 'Text' && asset.textUrl && !fullText) {
      fetch(asset.textUrl).then(r => r.text()).then(t => setFullText(t)).catch(() => {})
    }
  }, [asset?.format, asset?.textUrl, fullText])

  if (!asset) {
    return (
      <div className="border-2 border-dashed border-slate-200 px-4 py-6 text-center">
        <span className="text-[10px] text-slate-400">Asset not found</span>
      </div>
    )
  }

  return (
    <div
      className={`relative group border-2 transition-colors ${
        isFocused ? 'border-[#0000ff]' : 'border-slate-200 hover:border-black'
      }`}
      onClick={() => {
        dispatch({ type: 'FOCUS_BLOCK', payload: blockId })
        dispatch({ type: 'FOCUS_ASSET', payload: assetId })
      }}
    >
      {/* Asset preview */}
      <div className="relative bg-slate-100 aspect-video overflow-hidden">
        {asset.videoUrl ? (
          <video
            src={asset.videoUrl}
            poster={asset.thumbnailRef}
            muted
            playsInline
            autoPlay
            loop
            className="w-full h-full object-cover"
          />
        ) : asset.audioUrl ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="flex items-end gap-[3px] h-10">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-[3px] bg-white/40" style={{ height: `${(Math.sin(i * 0.8) * 0.4 + 0.5) * 100}%` }} />
              ))}
            </div>
          </div>
        ) : asset.format === 'Text' ? (
          <div className="w-full h-full bg-white px-10 pt-10 pb-6 flex flex-col overflow-hidden relative">
            <h4 className="text-sm font-bold text-black leading-snug line-clamp-2">{asset.title}</h4>
            {asset.textExcerpt && (
              <p className="text-[13px] leading-[1.8] text-black/50 font-serif mt-3 line-clamp-5 flex-1">{asset.textExcerpt}</p>
            )}
            {asset.wordCount && (
              <span className="text-[10px] font-mono text-black/30 mt-2">{asset.wordCount} words</span>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
          </div>
        ) : (
          <img src={asset.thumbnailRef} alt={asset.title} className="w-full h-full object-cover" />
        )}
        <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
          {asset.format}
        </span>
      </div>

      {/* Credit line: Creator Name / FRONTFILES */}
      <div className="px-3 py-1.5 bg-black border-t border-black">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">
          {creator?.name ?? 'Unknown'} / Frontfiles
        </span>
      </div>

      {/* Asset info bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200">
        <span className="text-[10px] font-bold text-black truncate flex-1">{asset.title}</span>
        <ValidationBadge state={asset.validationDeclaration} />
        {asset.price && (
          <span className="text-[9px] font-bold font-mono text-black shrink-0">&euro;{asset.price}</span>
        )}
      </div>

      {/* Caption / Full text — for Text assets, show full content */}
      {asset.format === 'Text' && fullText ? (
        <div className="border-t border-slate-200 bg-white">
          <div className="px-3 pt-1.5">
            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300">Full text</span>
          </div>
          <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
            <p className="text-[13px] leading-[1.9] text-black/70 font-serif whitespace-pre-line">{fullText}</p>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-slate-200 bg-white">
          <p className="text-xs text-slate-500 leading-relaxed">{caption}</p>
        </div>
      )}

      {/* Editor caption — additional note by the article editor */}
      <div className="border-t border-slate-200">
        <div className="flex items-center gap-1.5 px-3 pt-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300">Editor caption</span>
        </div>
        <input
          type="text"
          value={editorCaption}
          onChange={e => dispatch({ type: 'UPDATE_ASSET_EDITOR_CAPTION', payload: { blockId, editorCaption: e.target.value } })}
          placeholder="Add editor caption..."
          className="w-full px-3 py-1.5 text-xs text-black placeholder:text-slate-300 focus:outline-none bg-white"
        />
      </div>

      {/* Block controls — reorder + remove */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isFirst && (
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_BLOCK_UP', payload: { blockId } }) }}
            className="w-6 h-6 bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black transition-colors"
            title="Move up"
          >
            &#9650;
          </button>
        )}
        {!isLast && (
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_BLOCK_DOWN', payload: { blockId } }) }}
            className="w-6 h-6 bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black transition-colors"
            title="Move down"
          >
            &#9660;
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_BLOCK', payload: { blockId } }) }}
          className="w-6 h-6 bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black transition-colors"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
