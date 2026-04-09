'use client'

import { useState, useReducer } from 'react'
import { VaultLeftRail, type VaultSection } from '@/components/platform/VaultLeftRail'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { StateBadge } from '@/components/platform/StateBadge'
import { mockVaultAssets, mockArticles } from '@/lib/mock-data'
import type { PrivacyState, ArticlePublishState } from '@/lib/types'

interface ComposerState {
  title: string
  body: string
  selectedAssetIds: string[]
  publishState: ArticlePublishState
}

type ComposerAction =
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_BODY'; payload: string }
  | { type: 'TOGGLE_ASSET'; payload: string }
  | { type: 'SAVE_DRAFT' }
  | { type: 'SUBMIT_FOR_REVIEW' }

function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'SET_TITLE':
      return { ...state, title: action.payload }
    case 'SET_BODY':
      return { ...state, body: action.payload }
    case 'TOGGLE_ASSET': {
      const ids = state.selectedAssetIds.includes(action.payload)
        ? state.selectedAssetIds.filter(id => id !== action.payload)
        : [...state.selectedAssetIds, action.payload]
      return { ...state, selectedAssetIds: ids }
    }
    case 'SAVE_DRAFT':
      return { ...state, publishState: 'draft' }
    case 'SUBMIT_FOR_REVIEW':
      return { ...state, publishState: 'pending_review' }
    default:
      return state
  }
}

export default function ComposerPage() {
  const [activeSection, setActiveSection] = useState<VaultSection>('all')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyState | 'ALL'>('ALL')

  const [state, dispatch] = useReducer(composerReducer, {
    title: '',
    body: '',
    selectedAssetIds: [],
    publishState: 'draft',
  })

  const availableAssets = mockVaultAssets.filter(
    a => a.declarationState === 'fully_validated' || a.declarationState === 'provenance_pending'
  )

  const wordCount = state.body.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <VaultLeftRail
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          privacyFilter={privacyFilter}
          onPrivacyFilterChange={setPrivacyFilter}
          onUploadClick={() => {}}
        />
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-black tracking-tight">Composer</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {wordCount} words
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">·</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {state.selectedAssetIds.length} source assets
                </span>
              </div>
            </div>

            {/* Article type */}
            <Panel title="Article" headerStyle="black" borderStyle="emphasis">
              <div className="flex flex-col gap-4">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={state.title}
                    onChange={e => dispatch({ type: 'SET_TITLE', payload: e.target.value })}
                    placeholder="Article title…"
                    className="w-full h-10 border-2 border-black px-3 text-sm text-black placeholder:text-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Body</label>
                  <textarea
                    value={state.body}
                    onChange={e => dispatch({ type: 'SET_BODY', payload: e.target.value })}
                    placeholder="Write your article…"
                    rows={12}
                    className="w-full border-2 border-black px-3 py-2 text-sm text-black placeholder:text-slate-300 focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>
              </div>
            </Panel>

            {/* Source assets — FCS L4 Assembly */}
            <Panel title="Source assets (FCS Layer 4)" borderStyle="blue">
              <p className="text-xs text-slate-500 mb-3">
                Select source assets to link to this article. Assembly verification (FCS Layer 4) creates a certified chain between source assets and the published article.
              </p>
              <div className="flex flex-col gap-2">
                {availableAssets.map(asset => {
                  const selected = state.selectedAssetIds.includes(asset.id)
                  return (
                    <button
                      key={asset.id}
                      onClick={() => dispatch({ type: 'TOGGLE_ASSET', payload: asset.id })}
                      className={`flex items-center gap-3 px-3 py-2 border text-left transition-colors ${
                        selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                        selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                      }`}>
                        {selected && (
                          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-black truncate">{asset.title}</div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{asset.format}</span>
                      </div>
                      {asset.declarationState && <StateBadge variant={asset.declarationState} />}
                    </button>
                  )
                })}
              </div>
            </Panel>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
              <button
                onClick={() => dispatch({ type: 'SAVE_DRAFT' })}
                className="h-10 px-4 border-2 border-black text-black text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors"
              >
                Save draft
              </button>
              <button
                onClick={() => dispatch({ type: 'SUBMIT_FOR_REVIEW' })}
                disabled={!state.title || wordCount < 100}
                className="h-10 px-4 bg-blue-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-1"
              >
                Submit for review
              </button>
              {state.publishState === 'pending_review' && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Submitted</span>
              )}
            </div>

            {/* Existing articles */}
            <div className="flex flex-col gap-3 mt-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your articles</span>
              {mockArticles.map(article => (
                <div key={article.id} className="border border-slate-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-black">{article.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-slate-400">{article.wordCount} words</span>
                        <StateBadge variant={article.publishState === 'published' ? 'published' : 'draft'} />
                        {article.assemblyVerified && <StateBadge variant="assembly-verified" />}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {article.sourceAssetCount} sources
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
