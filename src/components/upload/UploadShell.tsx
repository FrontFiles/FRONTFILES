'use client'

import { useReducer, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { batchReducer, createBatchSession } from '@/lib/upload/batch-state'
import { simulateBatchProcessing } from '@/lib/upload/batch-mock-data'
import type { BatchScreen } from '@/lib/upload/batch-types'
import type { BatchAction } from '@/lib/upload/batch-state'
import { IntakeScreen } from './IntakeScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { StoryGroupingScreen } from './StoryGroupingScreen'
import { BatchReviewScreen } from './BatchReviewScreen'
import { ExceptionQueueScreen } from './ExceptionQueueScreen'
import { CommitScreen } from './CommitScreen'

type UploadScreen = BatchScreen | 'grouping'

const SCREEN_LABELS: Record<UploadScreen, string> = {
  intake: '1. Intake',
  processing: '2. Processing',
  grouping: '3. Story Grouping',
  review: '4. Batch Review',
  exceptions: '5. Exceptions',
  commit: '6. Commit',
}

const SCREEN_ORDER: UploadScreen[] = ['intake', 'processing', 'grouping', 'review', 'exceptions', 'commit']

export function UploadShell() {
  const [state, rawDispatch] = useReducer(batchReducer, null, createBatchSession)
  const [currentScreen, setCurrentScreen] = useState<UploadScreen>('intake')
  const processingStarted = useRef(false)

  // Wrapped dispatch that triggers processing on START_BATCH
  const dispatch = useCallback((action: BatchAction) => {
    rawDispatch(action)

    if (action.type === 'START_BATCH' && !processingStarted.current) {
      processingStarted.current = true
      setCurrentScreen('processing')
      setTimeout(() => {
        simulateBatchProcessing(state.assets, rawDispatch)
      }, 100)
    }

    if (action.type === 'SET_SCREEN') {
      setCurrentScreen(action.screen as UploadScreen)
    }

    if (action.type === 'RETRY_ASSETS') {
      setTimeout(() => {
        const retried = state.assets.filter(a => (action as { assetIds: string[] }).assetIds.includes(a.id))
        simulateBatchProcessing(retried, rawDispatch)
      }, 100)
    }
  }, [state.assets])

  // Also handle START_BATCH simulation using the latest assets
  const latestAssetsRef = useRef(state.assets)
  latestAssetsRef.current = state.assets

  useEffect(() => {
    if (currentScreen === 'processing' && !processingStarted.current) {
      processingStarted.current = true
      simulateBatchProcessing(latestAssetsRef.current, rawDispatch)
    }
  }, [currentScreen])

  // When batch processing auto-transitions to review, intercept and go to grouping instead
  useEffect(() => {
    if (state.screen === 'review' && currentScreen === 'processing') {
      setCurrentScreen('grouping')
    }
  }, [state.screen, currentScreen])

  const currentScreenIndex = SCREEN_ORDER.indexOf(currentScreen)

  return (
    <div className="flex flex-col h-full">
      {/* Screen nav */}
      <div className="flex items-center border-b-2 border-black flex-shrink-0">
        {SCREEN_ORDER.map((screen, i) => {
          const isActive = currentScreen === screen
          const isPast = i < currentScreenIndex
          const canNavigate = isPast
          return (
            <button
              key={screen}
              onClick={() => {
                if (canNavigate) {
                  if (screen === 'grouping') {
                    setCurrentScreen('grouping')
                  } else {
                    rawDispatch({ type: 'SET_SCREEN', screen: screen as BatchScreen })
                    setCurrentScreen(screen)
                  }
                }
              }}
              disabled={!canNavigate && !isActive}
              className={cn(
                'px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest border-r border-black transition-colors',
                isActive && 'bg-black text-white',
                isPast && !isActive && 'text-[#0000ff] hover:bg-[#0000ff]/5 cursor-pointer',
                !isActive && !isPast && 'text-slate-300 cursor-default',
              )}
            >
              {SCREEN_LABELS[screen]}
            </button>
          )
        })}
        <div className="flex-1" />
        <div className="px-4 py-2.5 text-[10px] font-mono text-slate-400">
          {state.assets.length} asset{state.assets.length !== 1 ? 's' : ''} in batch
        </div>
      </div>

      {/* Screen content */}
      {currentScreen === 'intake' && (
        <IntakeScreen
          assets={state.assets}
          defaults={state.defaults}
          dispatch={dispatch}
        />
      )}

      {currentScreen === 'processing' && (
        <ProcessingScreen
          assets={state.assets}
          dispatch={dispatch}
        />
      )}

      {currentScreen === 'grouping' && (
        <StoryGroupingScreen
          onContinue={() => {
            rawDispatch({ type: 'SET_SCREEN', screen: 'review' })
            setCurrentScreen('review')
          }}
          onBack={() => setCurrentScreen('processing')}
        />
      )}

      {currentScreen === 'review' && (
        <BatchReviewScreen
          assets={state.assets}
          selectedAssetIds={state.selectedAssetIds}
          filterState={state.filterState}
          viewMode={state.viewMode}
          drawerOpen={state.drawerOpen}
          dispatch={dispatch}
        />
      )}

      {currentScreen === 'exceptions' && (
        <ExceptionQueueScreen
          assets={state.assets}
          dispatch={dispatch}
        />
      )}

      {currentScreen === 'commit' && (
        <CommitScreen
          assets={state.assets}
          dispatch={dispatch}
        />
      )}
    </div>
  )
}
