/**
 * Frontfiles Upload — Batch Mock Data & Processing Simulation
 *
 * Generates realistic mock data for the batch upload flow.
 * Simulates upload progress, analysis, and metadata proposal generation.
 */

import type { AnalysisResult, MetadataProposal, ValidationDeclarationState, StoryRef } from './types'
import type { BatchAsset } from './batch-types'
import type { BatchAction } from './batch-state'

// ── Mock Stories ──

export const MOCK_STORIES: StoryRef[] = [
  { id: 'story-001', title: 'The Frontline of Climate Collapse', assetCount: 17, isNew: false },
  { id: 'story-002', title: "Inside Shenzhen's Silicon Shield", assetCount: 12, isNew: false },
  { id: 'story-003', title: 'Myanmar Border Crisis', assetCount: 9, isNew: false },
  { id: 'story-004', title: 'Latin America Unrest 2026', assetCount: 0, isNew: false },
  { id: 'story-005', title: 'Indigenous Resistance', assetCount: 0, isNew: false },
]

// ── Mock Processing Simulation ──

const MOCK_LOCATIONS = [
  'Hong Kong', 'Manila', 'Shenzhen', 'Bangkok', 'Jakarta',
  'Taipei', 'Singapore', 'Cebu', 'Mae Sot', 'Hanoi',
  'São Paulo', 'Lima', 'Bogotá', 'Beirut', 'Nairobi',
]

const MOCK_SCENES = [
  'street protest', 'press conference', 'refugee camp',
  'factory floor', 'coastline damage', 'market scene',
  'military checkpoint', 'ceremony', 'portrait session',
  'aerial landscape', 'underwater reef', 'night vigil',
]

const MOCK_OBJECTS = [
  'crowd', 'vehicle', 'building', 'flag', 'smoke',
  'water', 'vegetation', 'signage', 'equipment', 'aircraft',
]

const MOCK_CAMERAS = [
  'Canon EOS R5', 'Sony A7 IV', 'Nikon Z9', 'Fuji X-T5',
  'Leica Q3', 'Canon EOS R6 II', 'Sony A1', null,
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1))
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function generateMockAnalysis(fileName: string): { analysis: AnalysisResult; declaration: ValidationDeclarationState } {
  const hasC2PA = Math.random() > 0.4
  const c2paVersion = hasC2PA ? (Math.random() > 0.3 ? '2.2' : '2.0') : null
  const c2paValid = hasC2PA ? Math.random() > 0.1 : null
  const manifestInvalid = hasC2PA && !c2paValid

  const location = randomFrom(MOCK_LOCATIONS)
  const scenes = randomSubset(MOCK_SCENES, 1, 3)
  const objects = randomSubset(MOCK_OBJECTS, 2, 5)
  const camera = randomFrom(MOCK_CAMERAS)
  const hasGPS = Math.random() > 0.3

  let declaration: ValidationDeclarationState
  if (manifestInvalid) {
    declaration = 'manifest_invalid'
  } else if (hasC2PA && c2paVersion === '2.2' && c2paValid) {
    declaration = 'fully_validated'
  } else {
    declaration = 'provenance_pending'
  }

  const analysis: AnalysisResult = {
    contentReadingComplete: true,
    metadataExtractionComplete: true,
    c2paDetected: hasC2PA,
    c2paVersion,
    c2paValid,
    manifestInvalid,
    conflictZoneAlert: Math.random() > 0.85,
    extractedMetadata: {
      exifData: camera ? { 'Camera': camera, 'ISO': `${Math.floor(Math.random() * 3200) + 100}`, 'Aperture': `f/${(Math.random() * 8 + 1.4).toFixed(1)}` } : null,
      gpsCoordinates: hasGPS ? { lat: (Math.random() * 60) - 30, lng: (Math.random() * 180) - 90 } : null,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      cameraModel: camera,
      detectedObjects: objects,
      detectedScenes: scenes,
      detectedLocation: location,
    },
    layerOneComplete: true,
    layerTwoComplete: true,
    declarationState: declaration,
  }

  return { analysis, declaration }
}

function generateMockProposal(fileName: string, analysis: AnalysisResult): MetadataProposal {
  const location = analysis.extractedMetadata.detectedLocation ?? 'Unknown Location'
  const scenes = analysis.extractedMetadata.detectedScenes
  const objects = analysis.extractedMetadata.detectedObjects

  const nameBase = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')

  return {
    title: {
      value: `${location}: ${scenes[0] ?? 'documentation'}`,
      source: 'ai',
      confidence: 0.72 + Math.random() * 0.2,
      confirmed: false,
    },
    description: {
      value: `${scenes.join(', ')} documented in ${location}. ${objects.slice(0, 3).join(', ')} visible.`,
      source: 'ai',
      confidence: 0.65 + Math.random() * 0.2,
      confirmed: false,
    },
    tags: {
      value: [...scenes.slice(0, 2), ...objects.slice(0, 3), location.toLowerCase()],
      source: 'ai',
      confidence: 0.8 + Math.random() * 0.15,
      confirmed: false,
    },
    geographicTags: {
      value: analysis.extractedMetadata.gpsCoordinates ? [location] : [],
      source: analysis.extractedMetadata.gpsCoordinates ? 'extracted' : 'ai',
      confidence: analysis.extractedMetadata.gpsCoordinates ? 0.95 : 0.55,
      confirmed: false,
    },
    suggestedStoryId: Math.random() > 0.4 ? randomFrom(MOCK_STORIES).id : null,
    suggestedStoryTitle: null,
  }
}

// ── Processing Simulation ──

export function simulateBatchProcessing(
  assets: BatchAsset[],
  dispatch: (action: BatchAction) => void
) {
  assets.forEach((asset, index) => {
    const baseDelay = index * 200 // Stagger starts

    // Simulate upload progress
    const uploadDuration = 1000 + Math.random() * 2000
    const uploadSteps = 8
    for (let step = 1; step <= uploadSteps; step++) {
      setTimeout(() => {
        dispatch({
          type: 'UPDATE_UPLOAD_PROGRESS',
          assetId: asset.id,
          progress: Math.round((step / uploadSteps) * 100),
        })
      }, baseDelay + (uploadDuration / uploadSteps) * step)
    }

    // Upload complete
    setTimeout(() => {
      dispatch({ type: 'UPLOAD_COMPLETE', assetId: asset.id })
    }, baseDelay + uploadDuration)

    // Processing complete (or failed)
    const processingDuration = 1500 + Math.random() * 3000
    setTimeout(() => {
      // 5% chance of failure
      if (Math.random() < 0.05) {
        dispatch({ type: 'PROCESSING_FAILED', assetId: asset.id })
        return
      }

      const { analysis, declaration } = generateMockAnalysis(asset.fileName)
      const proposal = generateMockProposal(asset.fileName, analysis)

      dispatch({
        type: 'PROCESSING_COMPLETE',
        assetId: asset.id,
        analysis,
        proposal,
        declarationState: declaration,
      })
    }, baseDelay + uploadDuration + processingDuration)
  })

  // Auto-transition to review after all processing likely done
  const maxDelay = assets.length * 200 + 6500
  setTimeout(() => {
    dispatch({ type: 'SET_SCREEN', screen: 'review' })
  }, maxDelay)
}
