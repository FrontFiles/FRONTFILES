import type {
  IdentityVerificationResult,
  IdentityAnchor,
  CrossCheckSignal,
  ValidationOutcome,
  CreatorProfileDraft,
} from './types'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type MockScenario = 'happy' | 'flagged' | 'standard_block' | 'hard_block'

// Store scenario globally for testing (in real app, this would come from env/config)
let activeScenario: MockScenario = 'happy'
export function setMockScenario(scenario: MockScenario) { activeScenario = scenario }
export function getMockScenario(): MockScenario { return activeScenario }

export async function startIdentityVerification(): Promise<{ sessionId: string; providerUrl: string }> {
  await delay(800)
  return {
    sessionId: 'mock-session-' + Math.random().toString(36).slice(2),
    providerUrl: '#mock-provider',
  }
}

export async function pollIdentityVerification(_sessionId: string): Promise<IdentityVerificationResult> {
  await delay(2000)
  if (activeScenario === 'hard_block') {
    return { status: 'failed', provider: 'Onfido', verifiedAt: null, failureReason: 'Document could not be verified' }
  }
  return {
    status: 'verified',
    provider: 'Onfido',
    verifiedAt: new Date().toISOString(),
    failureReason: null,
  }
}

export async function getIdentityAnchor(sessionId: string): Promise<IdentityAnchor> {
  await delay(500)
  return {
    fullName: 'Sarah Chen',
    dateOfBirth: '1988-03-15',
    nationality: 'British',
    documentType: 'Passport',
    verificationId: sessionId,
  }
}

export async function runCreatorCrossCheck(_anchor: IdentityAnchor): Promise<CrossCheckSignal[]> {
  await delay(4000) // simulate lengthy cross-check

  const signals: CrossCheckSignal[] = [
    {
      field: 'professionalTitle',
      proposedValue: 'Senior Correspondent, Asia Pacific',
      sources: [
        { platform: 'LinkedIn', url: null, found: true, confidence: 0.95, summary: 'Profile lists Senior Correspondent role' },
        { platform: 'Reuters', url: null, found: true, confidence: 0.9, summary: 'Byline attributed to this title' },
      ],
      confidence: 0.93,
      conflictsWithIdentity: false,
      flagReason: null,
    },
    {
      field: 'biography',
      proposedValue: 'Award-winning journalist covering conflict, climate, and technology across Asia Pacific for over 12 years. Previously with Reuters and the South China Morning Post.',
      sources: [
        { platform: 'LinkedIn', url: null, found: true, confidence: 0.88, summary: 'Professional summary' },
        { platform: 'Open Web', url: null, found: true, confidence: 0.72, summary: 'Author bio on multiple outlets' },
      ],
      confidence: 0.82,
      conflictsWithIdentity: false,
      flagReason: null,
    },
    {
      field: 'mediaAffiliations',
      proposedValue: 'Reuters, South China Morning Post, Foreign Policy',
      sources: [
        { platform: 'Byline records', url: null, found: true, confidence: 0.91, summary: 'Multiple attributed bylines' },
      ],
      confidence: 0.91,
      conflictsWithIdentity: false,
      flagReason: activeScenario === 'flagged' ? 'One affiliation could not be corroborated across sources' : null,
    },
    {
      field: 'geographicCoverageAreas',
      proposedValue: 'China, Hong Kong, Taiwan, Southeast Asia',
      sources: [
        { platform: 'Byline geotags', url: null, found: true, confidence: 0.89, summary: 'Coverage geography from published work' },
      ],
      confidence: 0.89,
      conflictsWithIdentity: false,
      flagReason: null,
    },
    {
      field: 'pressAccreditations',
      proposedValue: "Foreign Correspondents' Club of China, HKJA",
      sources: [
        { platform: 'Accreditation records', url: null, found: true, confidence: 0.85, summary: 'Public accreditation listings' },
      ],
      confidence: 0.85,
      conflictsWithIdentity: false,
      flagReason: null,
    },
  ]

  return signals
}

export async function validateCreatorPersonalData(_signals: CrossCheckSignal[], _anchor: IdentityAnchor): Promise<ValidationOutcome> {
  await delay(1000)

  switch (activeScenario) {
    case 'flagged':
      return {
        status: 'FLAGGED',
        canContinue: true,
        reviewMessage: 'One or more signals could not be fully corroborated. You may continue, but your profile will be queued for manual review before going live.',
        flags: [
          { field: 'mediaAffiliations', severity: 'medium', description: 'Foreign Policy affiliation could not be independently confirmed. Please verify during profile setup.', resolvable: true },
        ],
      }
    case 'standard_block':
      return {
        status: 'STANDARD_BLOCK',
        canContinue: false,
        reviewMessage: 'Your application has been paused following our review. Our team will contact you within 5 business days.',
        flags: [
          { field: 'identity', severity: 'high', description: 'Significant inconsistencies were found between your stated identity and discoverable professional record.', resolvable: false },
        ],
      }
    case 'hard_block':
      return {
        status: 'HARD_BLOCK',
        canContinue: false,
        reviewMessage: 'Your application has been permanently closed. This decision is not subject to appeal.',
        flags: [],
      }
    default:
      return {
        status: 'VALIDATED',
        canContinue: true,
        reviewMessage: null,
        flags: [],
      }
  }
}

export async function buildProfileDraft(_signals: CrossCheckSignal[], anchor: IdentityAnchor): Promise<CreatorProfileDraft> {
  await delay(600)

  function makeEntry(value: string, source: 'ai-cross-check' | 'identity' = 'ai-cross-check') {
    return { id: Math.random().toString(36).slice(2), value, source, confirmed: false }
  }

  return {
    fullName: { value: anchor.fullName, source: 'identity', confidence: 1, confirmed: false, edited: false },
    professionalTitle: { value: 'Senior Correspondent, Asia Pacific', source: 'ai-cross-check', confidence: 0.93, confirmed: false, edited: false },
    biography: { value: 'Award-winning journalist covering conflict, climate, and technology across Asia Pacific for over 12 years. Previously with Reuters and the South China Morning Post.', source: 'ai-cross-check', confidence: 0.82, confirmed: false, edited: false },
    geographicCoverageAreas: [
      makeEntry('China'), makeEntry('Hong Kong'), makeEntry('Taiwan'), makeEntry('Southeast Asia'),
    ],
    contentSpecialisations: [
      makeEntry('Conflict Reporting'), makeEntry('Climate'), makeEntry('Technology'), makeEntry('Politics'),
    ],
    mediaAffiliations: [
      makeEntry('Reuters'), makeEntry('South China Morning Post'), makeEntry('Foreign Policy'),
    ],
    pressAccreditations: [
      makeEntry("Foreign Correspondents' Club of China"), makeEntry('Hong Kong Journalists Association'),
    ],
    publishedIn: [
      makeEntry('Reuters'), makeEntry('South China Morning Post'), makeEntry('Foreign Policy'), makeEntry('The Guardian'),
    ],
    skills: [
      makeEntry('Long-form Reporting'), makeEntry('Photojournalism'), makeEntry('Video Production'), makeEntry('Data Journalism'),
    ],
    alsoMeLinks: [
      makeEntry('https://linkedin.com/in/sarahchen-journalist'), makeEntry('https://twitter.com/sarahchenreports'),
    ],
  }
}

export async function validateConfirmedProfile(profile: CreatorProfileDraft, anchor: IdentityAnchor): Promise<ValidationOutcome> {
  await delay(1500)

  const nameMatches = profile.fullName.value.toLowerCase().includes(anchor.fullName.toLowerCase().split(' ')[0].toLowerCase())

  if (!nameMatches) {
    return {
      status: 'FLAGGED',
      canContinue: false,
      reviewMessage: 'The name in your profile does not match your verified identity. Please correct this before proceeding.',
      flags: [
        { field: 'fullName', severity: 'high', description: 'Profile name does not match identity anchor.', resolvable: true },
      ],
    }
  }

  return {
    status: 'VALIDATED',
    canContinue: true,
    reviewMessage: null,
    flags: [],
  }
}

export async function createVaultAccount(_profile: CreatorProfileDraft, _anchor: IdentityAnchor): Promise<{ vaultId: string; createdAt: string }> {
  await delay(2000)
  return {
    vaultId: 'vault-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    createdAt: new Date().toISOString(),
  }
}
