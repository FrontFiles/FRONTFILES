'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'
import { uploadReducer, createInitialSession } from '@/lib/upload/reducer'
import { validateFile } from '@/lib/upload/validation'
import {
  simulateFileUpload,
  simulateContentAnalysis,
  generateMetadataProposal,
  getExistingStories,
  createNewStory,
  publishToVault,
} from '@/lib/upload/services'
import { UploadDropZone } from './UploadDropZone'
import { UploadJobList } from './UploadJobList'
import { AnalysisPanel } from './AnalysisPanel'
import { MetadataCompletionPanel } from './MetadataCompletionPanel'
import { StoryAssignmentPanel } from './StoryAssignmentPanel'
import { RightsConfigPanel } from './RightsConfigPanel'
import { PublishReadinessGate } from './PublishReadinessGate'
import type { AssetFormat, StoryRef, PrivacyState, PriceInput, LicenceType } from '@/lib/upload/types'

export function UploadWorkflow() {
  const [session, dispatch] = useReducer(uploadReducer, null, createInitialSession)
  const processingRef = useRef<Set<string>>(new Set())

  const activeJob = session.jobs.find(j => j.id === session.activeJobId) ?? null
  const stories = getExistingStories()

  // ── Auto-pipeline: process jobs in 'selecting' state ──

  useEffect(() => {
    const pending = session.jobs.filter(
      j => j.state === 'selecting' && !processingRef.current.has(j.id)
    )

    for (const job of pending) {
      processingRef.current.add(job.id)
      runJobPipeline(job.id, job.file, job.format!, session.id)
    }
  }, [session.jobs])

  async function runJobPipeline(jobId: string, file: File, format: AssetFormat, sessionId: string) {
    // Validate
    const validation = validateFile(file, format)
    if (!validation.valid) {
      dispatch({ type: 'REJECT_FILE', payload: { jobId, reason: validation.reason! } })
      processingRef.current.delete(jobId)
      return
    }

    // Ingest
    dispatch({ type: 'START_INGESTION', payload: { jobId } })
    try {
      await simulateFileUpload(jobId, sessionId, file.name, (progress) => {
        dispatch({ type: 'UPDATE_PROGRESS', payload: { jobId, progress } })
      })
      dispatch({ type: 'INGESTION_COMPLETE', payload: { jobId } })
    } catch {
      dispatch({ type: 'INGESTION_FAILED', payload: { jobId, reason: 'transfer_failed' } })
      processingRef.current.delete(jobId)
      return
    }

    // Analyse
    dispatch({ type: 'START_ANALYSIS', payload: { jobId } })
    try {
      const result = await simulateContentAnalysis(jobId, sessionId, file.name)
      dispatch({ type: 'ANALYSIS_COMPLETE', payload: { jobId, result } })

      if (result.manifestInvalid) {
        processingRef.current.delete(jobId)
        return
      }

      // Generate metadata proposal
      const proposal = await generateMetadataProposal(jobId, sessionId, file.name, result)
      dispatch({ type: 'SET_METADATA_PROPOSAL', payload: { jobId, proposal } })
    } catch {
      dispatch({ type: 'INGESTION_FAILED', payload: { jobId, reason: 'analysis_failed' } })
    }

    processingRef.current.delete(jobId)
  }

  // ── File selection ──

  const handleFilesAdded = useCallback((groups: { files: File[]; format: AssetFormat }[]) => {
    dispatch({ type: 'ADD_FILES', payload: groups })
  }, [])

  // ── Creator actions ──

  function handleConfirmMetadata(title: string, description: string, tags: string[], geographicTags: string[]) {
    if (!activeJob) return
    dispatch({
      type: 'CONFIRM_METADATA',
      payload: { jobId: activeJob.id, title, description, tags, geographicTags },
    })
  }

  function handleAssignStory(story: StoryRef) {
    if (!activeJob) return
    dispatch({ type: 'ASSIGN_STORY', payload: { jobId: activeJob.id, story } })
  }

  function handleCreateStory(title: string): StoryRef {
    return createNewStory(title)
  }

  function handleClearStory() {
    if (!activeJob) return
    dispatch({ type: 'CLEAR_STORY', payload: { jobId: activeJob.id } })
  }

  function handleSetPrivacy(privacy: PrivacyState) {
    if (!activeJob) return
    dispatch({ type: 'SET_PRIVACY', payload: { jobId: activeJob.id, privacy } })
  }

  function handleSetPricing(pricing: PriceInput) {
    if (!activeJob) return
    dispatch({ type: 'SET_PRICING', payload: { jobId: activeJob.id, pricing } })
  }

  function handleSetLicences(licences: LicenceType[]) {
    if (!activeJob) return
    dispatch({ type: 'SET_LICENCES', payload: { jobId: activeJob.id, licences } })
  }

  async function handlePublish() {
    if (!activeJob) return
    dispatch({ type: 'ATTEMPT_PUBLISH', payload: { jobId: activeJob.id } })

    try {
      await publishToVault(activeJob.id, session.id)
      dispatch({ type: 'PUBLISH_COMPLETE', payload: { jobId: activeJob.id } })
    } catch {
      dispatch({ type: 'PUBLISH_FAILED', payload: { jobId: activeJob.id } })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Drop zone */}
      <UploadDropZone onFilesSelected={handleFilesAdded} />

      {/* Job list */}
      <UploadJobList
        jobs={session.jobs}
        activeJobId={session.activeJobId}
        onSelectJob={(id) => dispatch({ type: 'SET_ACTIVE_JOB', payload: id })}
        onRemoveJob={(id) => dispatch({ type: 'REMOVE_JOB', payload: { jobId: id } })}
      />

      {/* Active job panels */}
      {activeJob && (
        <div className="flex flex-col gap-6">
          <AnalysisPanel job={activeJob} />
          <MetadataCompletionPanel job={activeJob} onConfirm={handleConfirmMetadata} />
          <StoryAssignmentPanel
            job={activeJob}
            stories={stories}
            onAssignStory={handleAssignStory}
            onCreateStory={handleCreateStory}
            onClearStory={handleClearStory}
          />
          <RightsConfigPanel
            job={activeJob}
            onSetPrivacy={handleSetPrivacy}
            onSetPricing={handleSetPricing}
            onSetLicences={handleSetLicences}
          />
          <PublishReadinessGate job={activeJob} onPublish={handlePublish} />
        </div>
      )}
    </div>
  )
}
