import { describe, it, expect } from 'vitest'
import { uploadReducer, createInitialSession, checkPublishReadiness } from '../reducer'
import type { UploadSession, UploadJob, AnalysisResult, MetadataProposal } from '../types'

function makeFile(name: string): File {
  return new File([new ArrayBuffer(1024)], name, { type: 'image/jpeg' })
}

function makeSession(): UploadSession {
  return createInitialSession()
}

function addFile(session: UploadSession, name = 'test.jpg'): UploadSession {
  return uploadReducer(session, {
    type: 'ADD_FILES',
    payload: [{ files: [makeFile(name)], format: 'photo' }],
  })
}

const MOCK_ANALYSIS: AnalysisResult = {
  contentReadingComplete: true,
  metadataExtractionComplete: true,
  c2paDetected: true,
  c2paVersion: '2.2',
  c2paValid: true,
  manifestInvalid: false,
  conflictZoneAlert: false,
  extractedMetadata: {
    exifData: null,
    gpsCoordinates: null,
    timestamp: null,
    cameraModel: null,
    detectedObjects: [],
    detectedScenes: [],
    detectedLocation: null,
  },
  layerOneComplete: true,
  layerTwoComplete: true,
  declarationState: 'fully_validated',
}

const MOCK_PROPOSAL: MetadataProposal = {
  title: { value: 'Test title', source: 'ai', confidence: 0.8, confirmed: false },
  description: { value: 'Test description', source: 'ai', confidence: 0.7, confirmed: false },
  tags: { value: ['tag1'], source: 'ai', confidence: 0.9, confirmed: false },
  geographicTags: { value: ['Location'], source: 'extracted', confidence: 0.95, confirmed: false },
  suggestedStoryId: null,
  suggestedStoryTitle: null,
}

describe('uploadReducer', () => {
  it('creates an initial session', () => {
    const session = makeSession()
    expect(session.jobs).toEqual([])
    expect(session.activeJobId).toBeNull()
    expect(session.id).toMatch(/^session-/)
  })

  it('adds files and sets first as active', () => {
    const s = addFile(makeSession())
    expect(s.jobs.length).toBe(1)
    expect(s.activeJobId).toBe(s.jobs[0].id)
    expect(s.jobs[0].state).toBe('selecting')
    expect(s.jobs[0].format).toBe('photo')
  })

  it('rejects a file', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id
    s = uploadReducer(s, { type: 'REJECT_FILE', payload: { jobId, reason: 'file_empty' } })
    expect(s.jobs[0].state).toBe('rejected')
    expect(s.jobs[0].failureReason).toBe('file_empty')
  })

  it('progresses through ingestion', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    s = uploadReducer(s, { type: 'START_INGESTION', payload: { jobId } })
    expect(s.jobs[0].state).toBe('ingesting')

    s = uploadReducer(s, { type: 'UPDATE_PROGRESS', payload: { jobId, progress: 50 } })
    expect(s.jobs[0].uploadProgress).toBe(50)

    s = uploadReducer(s, { type: 'INGESTION_COMPLETE', payload: { jobId } })
    expect(s.jobs[0].state).toBe('uploaded')
    expect(s.jobs[0].uploadProgress).toBe(100)
  })

  it('handles analysis completion with fully_validated', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    s = uploadReducer(s, { type: 'START_ANALYSIS', payload: { jobId } })
    expect(s.jobs[0].state).toBe('analysing')

    s = uploadReducer(s, { type: 'ANALYSIS_COMPLETE', payload: { jobId, result: MOCK_ANALYSIS } })
    expect(s.jobs[0].state).toBe('ready_for_completion')
    expect(s.jobs[0].declarationState).toBe('fully_validated')
  })

  it('quarantines manifest_invalid assets', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    const invalidResult = { ...MOCK_ANALYSIS, manifestInvalid: true, declarationState: 'manifest_invalid' as const }
    s = uploadReducer(s, { type: 'ANALYSIS_COMPLETE', payload: { jobId, result: invalidResult } })
    expect(s.jobs[0].state).toBe('manifest_invalid')
    expect(s.jobs[0].manifestReviewState).toBe('quarantined')
  })

  it('transitions through metadata confirmation to story assignment', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    s = uploadReducer(s, { type: 'SET_METADATA_PROPOSAL', payload: { jobId, proposal: MOCK_PROPOSAL } })
    expect(s.jobs[0].state).toBe('awaiting_creator_confirmation')

    s = uploadReducer(s, {
      type: 'CONFIRM_METADATA',
      payload: { jobId, title: 'My Title', description: 'My Desc', tags: ['t1'], geographicTags: ['NYC'] },
    })
    expect(s.jobs[0].state).toBe('awaiting_story_assignment')
    expect(s.jobs[0].confirmedMetadata?.title).toBe('My Title')
  })

  it('transitions through story assignment to rights config', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    s = uploadReducer(s, { type: 'CONFIRM_METADATA', payload: { jobId, title: 'T', description: 'D', tags: [], geographicTags: [] } })
    s = uploadReducer(s, { type: 'ASSIGN_STORY', payload: { jobId, story: { id: 's1', title: 'Story', assetCount: 0, isNew: false } } })
    expect(s.jobs[0].state).toBe('awaiting_rights_configuration')
    expect(s.jobs[0].storyAssignment?.id).toBe('s1')
  })

  it('clears story assignment', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    s = uploadReducer(s, { type: 'CONFIRM_METADATA', payload: { jobId, title: 'T', description: 'D', tags: [], geographicTags: [] } })
    s = uploadReducer(s, { type: 'ASSIGN_STORY', payload: { jobId, story: { id: 's1', title: 'Story', assetCount: 0, isNew: false } } })
    s = uploadReducer(s, { type: 'CLEAR_STORY', payload: { jobId } })
    expect(s.jobs[0].state).toBe('awaiting_story_assignment')
    expect(s.jobs[0].storyAssignment).toBeNull()
  })

  it('auto-transitions to ready_for_publish when all requirements met', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    // Complete analysis
    s = uploadReducer(s, { type: 'ANALYSIS_COMPLETE', payload: { jobId, result: MOCK_ANALYSIS } })
    // Confirm metadata
    s = uploadReducer(s, { type: 'CONFIRM_METADATA', payload: { jobId, title: 'T', description: 'D', tags: [], geographicTags: [] } })
    // Assign story
    s = uploadReducer(s, { type: 'ASSIGN_STORY', payload: { jobId, story: { id: 's1', title: 'S', assetCount: 0, isNew: false } } })
    // Set privacy
    s = uploadReducer(s, { type: 'SET_PRIVACY', payload: { jobId, privacy: 'PUBLIC' } })
    // Set pricing
    s = uploadReducer(s, { type: 'SET_PRICING', payload: { jobId, pricing: { amount: 5000, currency: 'EUR', priceBandGuidance: null } } })

    expect(s.jobs[0].state).toBe('ready_for_publish')
  })

  it('skips pricing requirement for PRIVATE assets', () => {
    let s = addFile(makeSession())
    const jobId = s.jobs[0].id

    s = uploadReducer(s, { type: 'ANALYSIS_COMPLETE', payload: { jobId, result: MOCK_ANALYSIS } })
    s = uploadReducer(s, { type: 'CONFIRM_METADATA', payload: { jobId, title: 'T', description: 'D', tags: [], geographicTags: [] } })
    s = uploadReducer(s, { type: 'ASSIGN_STORY', payload: { jobId, story: { id: 's1', title: 'S', assetCount: 0, isNew: false } } })
    s = uploadReducer(s, { type: 'SET_PRIVACY', payload: { jobId, privacy: 'PRIVATE' } })

    expect(s.jobs[0].state).toBe('ready_for_publish')
  })

  it('removes a job and updates activeJobId', () => {
    let s = addFile(addFile(makeSession(), 'a.jpg'), 'b.jpg')
    expect(s.jobs.length).toBe(2)
    const firstId = s.jobs[0].id

    s = uploadReducer(s, { type: 'SET_ACTIVE_JOB', payload: firstId })
    s = uploadReducer(s, { type: 'REMOVE_JOB', payload: { jobId: firstId } })
    expect(s.jobs.length).toBe(1)
    expect(s.activeJobId).toBe(s.jobs[0].id)
  })

  it('resets session', () => {
    let s = addFile(makeSession())
    s = uploadReducer(s, { type: 'RESET_SESSION' })
    expect(s.jobs).toEqual([])
  })
})

describe('checkPublishReadiness', () => {
  function makeReadyJob(): UploadJob {
    return {
      id: 'j1',
      file: makeFile('test.jpg'),
      fileName: 'test.jpg',
      fileSize: 1024,
      format: 'photo',
      state: 'awaiting_rights_configuration',
      failureReason: null,
      uploadProgress: 100,
      analysisResult: MOCK_ANALYSIS,
      metadataProposal: MOCK_PROPOSAL,
      confirmedMetadata: { title: 'T', description: 'D', tags: [], geographicTags: [] },
      storyAssignment: { id: 's1', title: 'S', assetCount: 1, isNew: false },
      privacy: 'PUBLIC',
      pricing: { amount: 5000, currency: 'EUR', priceBandGuidance: null },
      enabledLicences: ['editorial'],
      declarationState: 'fully_validated',
      manifestReviewState: 'not_applicable',
      createdAt: new Date().toISOString(),
      publishedAt: null,
    }
  }

  it('returns all requirements met for a fully ready job', () => {
    const r = checkPublishReadiness(makeReadyJob())
    expect(r.allRequirementsMet).toBe(true)
    expect(r.blockers).toEqual([])
  })

  it('blocks on missing metadata', () => {
    const job = makeReadyJob()
    job.confirmedMetadata = null
    const r = checkPublishReadiness(job)
    expect(r.metadataComplete).toBe(false)
    expect(r.allRequirementsMet).toBe(false)
    expect(r.blockers).toContain('Metadata incomplete')
  })

  it('blocks on missing story', () => {
    const job = makeReadyJob()
    job.storyAssignment = null
    const r = checkPublishReadiness(job)
    expect(r.storyAssigned).toBe(false)
    expect(r.blockers).toContain('Story assignment required')
  })

  it('blocks on missing privacy', () => {
    const job = makeReadyJob()
    job.privacy = null
    const r = checkPublishReadiness(job)
    expect(r.privacySelected).toBe(false)
    expect(r.blockers).toContain('Privacy state required')
  })

  it('blocks on missing pricing for PUBLIC assets', () => {
    const job = makeReadyJob()
    job.pricing = null
    const r = checkPublishReadiness(job)
    expect(r.pricingSet).toBe(false)
    expect(r.blockers).toContain('Pricing required for transactable assets')
  })

  it('does not require pricing for PRIVATE assets', () => {
    const job = makeReadyJob()
    job.privacy = 'PRIVATE'
    job.pricing = null
    const r = checkPublishReadiness(job)
    expect(r.pricingSet).toBe(true)
  })

  it('blocks on quarantined manifest', () => {
    const job = makeReadyJob()
    job.manifestReviewState = 'quarantined'
    const r = checkPublishReadiness(job)
    expect(r.noManifestInvalid).toBe(false)
    expect(r.blockers).toContain('Asset held for manifest review')
  })
})
