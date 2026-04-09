/**
 * Frontfiles Upload Subsystem — State Machine / Reducer
 *
 * Manages per-job and session-level state for the upload workflow.
 * Authority boundaries preserved:
 *   - Vault: asset records, metadata, privacy, Story assignment, pricing
 *   - FCS: layer completion, Validation Declaration state
 *   - CEL: append-only event log (via event emission, not UI state)
 *   - UI: display derived state, collect creator input
 */

import type {
  UploadSession,
  UploadJob,
  UploadJobState,
  UploadFailureReason,
  AssetFormat,
  AnalysisResult,
  MetadataProposal,
  StoryRef,
  PrivacyState,
  PriceInput,
  LicenceType,
  ValidationDeclarationState,
  PublishReadinessCheck,
} from './types'
import { TRANSACTABLE_STATES } from './types'

// ── Actions ──

export type UploadAction =
  // Session
  | { type: 'CREATE_SESSION' }
  | { type: 'SET_ACTIVE_JOB'; payload: string }

  // File selection & validation
  | { type: 'ADD_FILES'; payload: { files: File[]; format: AssetFormat }[] }
  | { type: 'REJECT_FILE'; payload: { jobId: string; reason: UploadFailureReason } }

  // Ingestion
  | { type: 'START_INGESTION'; payload: { jobId: string } }
  | { type: 'UPDATE_PROGRESS'; payload: { jobId: string; progress: number } }
  | { type: 'INGESTION_COMPLETE'; payload: { jobId: string } }
  | { type: 'INGESTION_FAILED'; payload: { jobId: string; reason: UploadFailureReason } }

  // Analysis (FCS L1-L3)
  | { type: 'START_ANALYSIS'; payload: { jobId: string } }
  | { type: 'ANALYSIS_COMPLETE'; payload: { jobId: string; result: AnalysisResult } }
  | { type: 'FLAG_JOB'; payload: { jobId: string; reason: string } }
  | { type: 'MANIFEST_INVALID'; payload: { jobId: string } }

  // Metadata proposals
  | { type: 'SET_METADATA_PROPOSAL'; payload: { jobId: string; proposal: MetadataProposal } }
  | { type: 'CONFIRM_METADATA'; payload: { jobId: string; title: string; description: string; tags: string[]; geographicTags: string[] } }

  // Story assignment
  | { type: 'ASSIGN_STORY'; payload: { jobId: string; story: StoryRef } }
  | { type: 'CLEAR_STORY'; payload: { jobId: string } }

  // Rights / Privacy / Pricing
  | { type: 'SET_PRIVACY'; payload: { jobId: string; privacy: PrivacyState } }
  | { type: 'SET_PRICING'; payload: { jobId: string; pricing: PriceInput } }
  | { type: 'SET_LICENCES'; payload: { jobId: string; licences: LicenceType[] } }

  // Publication
  | { type: 'ATTEMPT_PUBLISH'; payload: { jobId: string } }
  | { type: 'PUBLISH_BLOCKED'; payload: { jobId: string; blockers: string[] } }
  | { type: 'PUBLISH_COMPLETE'; payload: { jobId: string } }
  | { type: 'PUBLISH_FAILED'; payload: { jobId: string } }

  // Reset
  | { type: 'REMOVE_JOB'; payload: { jobId: string } }
  | { type: 'RESET_SESSION' }

// ── Initial State ──

export function createInitialSession(): UploadSession {
  return {
    id: generateId('session'),
    jobs: [],
    createdAt: new Date().toISOString(),
    activeJobId: null,
  }
}

// ── Reducer ──

export function uploadReducer(state: UploadSession, action: UploadAction): UploadSession {
  switch (action.type) {
    case 'CREATE_SESSION':
      return createInitialSession()

    case 'SET_ACTIVE_JOB':
      return { ...state, activeJobId: action.payload }

    case 'ADD_FILES': {
      const newJobs: UploadJob[] = action.payload.map(({ files, format }) =>
        files.map(file => createJob(file, format))
      ).flat()
      return {
        ...state,
        jobs: [...state.jobs, ...newJobs],
        activeJobId: state.activeJobId ?? newJobs[0]?.id ?? null,
      }
    }

    case 'REJECT_FILE':
      return updateJob(state, action.payload.jobId, {
        state: 'rejected',
        failureReason: action.payload.reason,
      })

    case 'START_INGESTION':
      return updateJob(state, action.payload.jobId, {
        state: 'ingesting',
        uploadProgress: 0,
      })

    case 'UPDATE_PROGRESS':
      return updateJob(state, action.payload.jobId, {
        uploadProgress: action.payload.progress,
      })

    case 'INGESTION_COMPLETE':
      return updateJob(state, action.payload.jobId, {
        state: 'uploaded',
        uploadProgress: 100,
      })

    case 'INGESTION_FAILED':
      return updateJob(state, action.payload.jobId, {
        state: 'failed',
        failureReason: action.payload.reason,
      })

    case 'START_ANALYSIS':
      return updateJob(state, action.payload.jobId, {
        state: 'analysing',
      })

    case 'ANALYSIS_COMPLETE': {
      const result = action.payload.result
      let nextState: UploadJobState = 'ready_for_completion'
      if (result.manifestInvalid) {
        nextState = 'manifest_invalid'
      }
      return updateJob(state, action.payload.jobId, {
        state: nextState,
        analysisResult: result,
        declarationState: result.declarationState,
        manifestReviewState: result.manifestInvalid ? 'quarantined' : 'not_applicable',
      })
    }

    case 'FLAG_JOB':
      return updateJob(state, action.payload.jobId, {
        state: 'flagged',
      })

    case 'MANIFEST_INVALID':
      return updateJob(state, action.payload.jobId, {
        state: 'manifest_invalid',
        manifestReviewState: 'quarantined',
      })

    case 'SET_METADATA_PROPOSAL':
      return updateJob(state, action.payload.jobId, {
        metadataProposal: action.payload.proposal,
        state: 'awaiting_creator_confirmation',
      })

    case 'CONFIRM_METADATA':
      return updateJob(state, action.payload.jobId, {
        confirmedMetadata: {
          title: action.payload.title,
          description: action.payload.description,
          tags: action.payload.tags,
          geographicTags: action.payload.geographicTags,
        },
        state: 'awaiting_story_assignment',
      })

    case 'ASSIGN_STORY':
      return updateJob(state, action.payload.jobId, {
        storyAssignment: action.payload.story,
        state: 'awaiting_rights_configuration',
      })

    case 'CLEAR_STORY':
      return updateJob(state, action.payload.jobId, {
        storyAssignment: null,
        state: 'awaiting_story_assignment',
      })

    case 'SET_PRIVACY':
      return updateJobAndCheckReadiness(state, action.payload.jobId, {
        privacy: action.payload.privacy,
      })

    case 'SET_PRICING':
      return updateJobAndCheckReadiness(state, action.payload.jobId, {
        pricing: action.payload.pricing,
      })

    case 'SET_LICENCES':
      return updateJobAndCheckReadiness(state, action.payload.jobId, {
        enabledLicences: action.payload.licences,
      })

    case 'ATTEMPT_PUBLISH': {
      const job = state.jobs.find(j => j.id === action.payload.jobId)
      if (!job) return state
      const readiness = checkPublishReadiness(job)
      if (!readiness.allRequirementsMet) {
        return updateJob(state, action.payload.jobId, { state: 'readiness_blocked' })
      }
      return updateJob(state, action.payload.jobId, { state: 'publishing' })
    }

    case 'PUBLISH_BLOCKED':
      return updateJob(state, action.payload.jobId, {
        state: 'readiness_blocked',
      })

    case 'PUBLISH_COMPLETE':
      return updateJob(state, action.payload.jobId, {
        state: 'published',
        publishedAt: new Date().toISOString(),
      })

    case 'PUBLISH_FAILED':
      return updateJob(state, action.payload.jobId, {
        state: 'failed',
        failureReason: 'unknown',
      })

    case 'REMOVE_JOB': {
      const filtered = state.jobs.filter(j => j.id !== action.payload.jobId)
      return {
        ...state,
        jobs: filtered,
        activeJobId: state.activeJobId === action.payload.jobId
          ? filtered[0]?.id ?? null
          : state.activeJobId,
      }
    }

    case 'RESET_SESSION':
      return createInitialSession()

    default:
      return state
  }
}

// ── Helpers ──

function createJob(file: File, format: AssetFormat): UploadJob {
  return {
    id: generateId('job'),
    file,
    fileName: file.name,
    fileSize: file.size,
    format,
    state: 'selecting',
    failureReason: null,
    uploadProgress: 0,
    analysisResult: null,
    metadataProposal: null,
    confirmedMetadata: null,
    storyAssignment: null,
    privacy: null,
    pricing: null,
    enabledLicences: [],
    declarationState: null,
    manifestReviewState: 'not_applicable',
    createdAt: new Date().toISOString(),
    publishedAt: null,
  }
}

function updateJob(state: UploadSession, jobId: string, updates: Partial<UploadJob>): UploadSession {
  return {
    ...state,
    jobs: state.jobs.map(j => j.id === jobId ? { ...j, ...updates } : j),
  }
}

function updateJobAndCheckReadiness(state: UploadSession, jobId: string, updates: Partial<UploadJob>): UploadSession {
  const updated = updateJob(state, jobId, updates)
  const job = updated.jobs.find(j => j.id === jobId)
  if (!job) return updated
  const merged = { ...job, ...updates }
  const readiness = checkPublishReadiness(merged as UploadJob)
  const nextState: UploadJobState = readiness.allRequirementsMet
    ? 'ready_for_publish'
    : 'awaiting_rights_configuration'
  return updateJob(updated, jobId, { state: nextState })
}

export function checkPublishReadiness(job: UploadJob): PublishReadinessCheck {
  const blockers: string[] = []

  const metadataComplete = job.confirmedMetadata !== null
    && job.confirmedMetadata.title.trim().length > 0
    && job.confirmedMetadata.description.trim().length > 0
  if (!metadataComplete) blockers.push('Metadata incomplete')

  const storyAssigned = job.storyAssignment !== null
  if (!storyAssigned) blockers.push('Story assignment required')

  const privacySelected = job.privacy !== null
  if (!privacySelected) blockers.push('Privacy state required')

  const pricingSet = job.privacy === 'PRIVATE' || (job.pricing !== null && job.pricing.amount !== null && job.pricing.amount > 0)
  if (!pricingSet) blockers.push('Pricing required for transactable assets')

  const declarationTransactable = job.declarationState !== null
    && TRANSACTABLE_STATES.includes(job.declarationState)
  if (!declarationTransactable && job.declarationState !== null) {
    blockers.push('Validation Declaration is not transactable')
  }

  const noManifestInvalid = job.manifestReviewState !== 'quarantined'
  if (!noManifestInvalid) blockers.push('Asset held for manifest review')

  const allRequirementsMet = metadataComplete && storyAssigned && privacySelected && pricingSet && noManifestInvalid

  return {
    metadataComplete,
    storyAssigned,
    privacySelected,
    pricingSet,
    declarationTransactable,
    noManifestInvalid,
    allRequirementsMet,
    blockers,
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
