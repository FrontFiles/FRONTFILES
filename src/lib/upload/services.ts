/**
 * Frontfiles Upload Subsystem — Mock Services
 *
 * These mock services simulate the backend pipeline for:
 *   - File ingestion (upload to Vault)
 *   - Content analysis (FCS L1-L2)
 *   - Validation Declaration issuance (FCS L3)
 *   - AI metadata proposal generation
 *   - Story listing
 *   - Vault publication
 *
 * Each service emits events compatible with the CEL model.
 * In production, these become real API adapters; the contracts remain stable.
 */

import type {
  AnalysisResult,
  MetadataProposal,
  StoryRef,
  UploadEvent,
  UploadEventType,
  ValidationDeclarationState,
} from './types'

// ── Event Bus ──
// Simple in-memory event collector for CEL compatibility

const eventLog: UploadEvent[] = []

function emitEvent(
  type: UploadEventType,
  jobId: string,
  sessionId: string,
  detail: string,
  metadata?: Record<string, unknown>
): UploadEvent {
  const event: UploadEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    jobId,
    sessionId,
    timestamp: new Date().toISOString(),
    detail,
    metadata: metadata ?? null,
  }
  eventLog.push(event)
  return event
}

export function getEventLog(): UploadEvent[] {
  return [...eventLog]
}

export function getJobEvents(jobId: string): UploadEvent[] {
  return eventLog.filter(e => e.jobId === jobId)
}

// ── File Ingestion ──

export async function simulateFileUpload(
  jobId: string,
  sessionId: string,
  fileName: string,
  onProgress: (progress: number) => void
): Promise<{ success: boolean }> {
  emitEvent('upload_started', jobId, sessionId, `Upload started: ${fileName}`)

  // Simulate chunked upload progress
  for (let p = 0; p <= 100; p += Math.floor(Math.random() * 15) + 5) {
    await delay(200 + Math.random() * 300)
    const clamped = Math.min(p, 100)
    onProgress(clamped)
    emitEvent('upload_progressed', jobId, sessionId, `Progress: ${clamped}%`, { progress: clamped })
  }

  onProgress(100)
  emitEvent('upload_completed', jobId, sessionId, `Upload completed: ${fileName}`)
  return { success: true }
}

// ── Content Analysis (FCS L1-L3) ──

export async function simulateContentAnalysis(
  jobId: string,
  sessionId: string,
  fileName: string
): Promise<AnalysisResult> {
  emitEvent('analysis_started', jobId, sessionId, `Analysis started: ${fileName}`)

  // Simulate L1 processing
  await delay(1200)
  emitEvent('metadata_extracted', jobId, sessionId, 'Metadata extraction complete')

  // Simulate C2PA detection
  await delay(800)
  const hasC2pa = Math.random() > 0.4
  const c2paVersion = hasC2pa ? (Math.random() > 0.3 ? '2.2' : '2.0') : null
  const c2paValid = hasC2pa ? Math.random() > 0.1 : null
  const manifestInvalid = hasC2pa && c2paValid === false

  if (hasC2pa) {
    emitEvent('c2pa_detected', jobId, sessionId, `C2PA manifest detected: v${c2paVersion}`, { version: c2paVersion, valid: c2paValid })
  } else {
    emitEvent('c2pa_missing', jobId, sessionId, 'No C2PA manifest detected')
  }

  if (manifestInvalid) {
    emitEvent('manifest_invalid_detected', jobId, sessionId, 'C2PA manifest corrupt or unverifiable. Asset quarantined for staff review.')
  }

  // Simulate L2 processing
  await delay(1500)

  // Determine declaration state (L3)
  let declarationState: ValidationDeclarationState | null = null
  if (manifestInvalid) {
    declarationState = 'manifest_invalid'
  } else if (hasC2pa && c2paVersion === '2.2' && c2paValid) {
    declarationState = 'fully_validated'
  } else {
    declarationState = 'provenance_pending'
  }

  emitEvent('analysis_completed', jobId, sessionId, `Analysis complete. Declaration: ${declarationState}`, { declarationState })

  const result: AnalysisResult = {
    contentReadingComplete: true,
    metadataExtractionComplete: true,
    c2paDetected: hasC2pa,
    c2paVersion,
    c2paValid,
    manifestInvalid,
    conflictZoneAlert: Math.random() > 0.9, // 10% chance
    extractedMetadata: {
      exifData: { 'Make': 'Canon', 'Model': 'EOS R5', 'ISO': '400', 'Aperture': 'f/2.8' },
      gpsCoordinates: Math.random() > 0.3 ? { lat: 22.3193, lng: 114.1694 } : null,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      cameraModel: 'Canon EOS R5',
      detectedObjects: ['person', 'building', 'vehicle'],
      detectedScenes: ['urban', 'street'],
      detectedLocation: Math.random() > 0.3 ? 'Hong Kong, China' : null,
    },
    layerOneComplete: true,
    layerTwoComplete: true,
    declarationState,
  }

  return result
}

// ── AI Metadata Proposal ──

export async function generateMetadataProposal(
  jobId: string,
  sessionId: string,
  fileName: string,
  analysis: AnalysisResult
): Promise<MetadataProposal> {
  await delay(1000)

  const location = analysis.extractedMetadata.detectedLocation ?? 'Unknown location'
  const scenes = analysis.extractedMetadata.detectedScenes
  const objects = analysis.extractedMetadata.detectedObjects

  const proposal: MetadataProposal = {
    title: {
      value: inferTitle(fileName, location, scenes),
      source: 'ai',
      confidence: 0.78,
      confirmed: false,
    },
    description: {
      value: inferDescription(location, objects, scenes),
      source: 'ai',
      confidence: 0.72,
      confirmed: false,
    },
    tags: {
      value: [...objects, ...scenes].slice(0, 6),
      source: 'ai',
      confidence: 0.85,
      confirmed: false,
    },
    geographicTags: {
      value: analysis.extractedMetadata.detectedLocation
        ? [analysis.extractedMetadata.detectedLocation]
        : [],
      source: analysis.extractedMetadata.gpsCoordinates ? 'extracted' : 'ai',
      confidence: analysis.extractedMetadata.gpsCoordinates ? 0.95 : 0.6,
      confirmed: false,
    },
    suggestedStoryId: null,
    suggestedStoryTitle: `${location} — ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
  }

  emitEvent('metadata_proposal_generated', jobId, sessionId, 'AI metadata proposal ready for creator review')

  return proposal
}

// ── Story Listing ──

const MOCK_STORIES: StoryRef[] = [
  { id: 'story-001', title: 'The Frontline of Climate Collapse', assetCount: 15, isNew: false },
  { id: 'story-002', title: "Inside Shenzhen's Silicon Shield", assetCount: 12, isNew: false },
  { id: 'story-003', title: 'Myanmar Border Crisis', assetCount: 9, isNew: false },
]

export function getExistingStories(): StoryRef[] {
  return MOCK_STORIES
}

export function createNewStory(title: string): StoryRef {
  const story: StoryRef = {
    id: `story-${Date.now()}`,
    title,
    assetCount: 0,
    isNew: true,
  }
  MOCK_STORIES.push(story)
  return story
}

// ── Vault Publication ──

export async function publishToVault(
  jobId: string,
  sessionId: string
): Promise<{ success: boolean; assetId: string }> {
  emitEvent('publish_attempted', jobId, sessionId, 'Vault publication attempted')
  await delay(1500)

  const assetId = `asset-${Date.now().toString(36)}`
  emitEvent('publish_completed', jobId, sessionId, `Published to Vault as ${assetId}`, { assetId })

  return { success: true, assetId }
}

// ── Helpers ──

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function inferTitle(fileName: string, location: string, scenes: string[]): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
  if (location !== 'Unknown location') {
    return `${scenes[0] ? capitalize(scenes[0]) + ' scene' : 'Content'} — ${location}`
  }
  return capitalize(base)
}

function inferDescription(location: string, objects: string[], scenes: string[]): string {
  const parts: string[] = []
  if (scenes.length > 0) parts.push(`${capitalize(scenes.join(' and '))} scene`)
  if (objects.length > 0) parts.push(`showing ${objects.slice(0, 3).join(', ')}`)
  if (location !== 'Unknown location') parts.push(`in ${location}`)
  return parts.join(' ') + '.'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
