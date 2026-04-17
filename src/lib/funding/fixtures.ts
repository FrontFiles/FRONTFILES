/**
 * Funding Engine — Demo Fixtures
 *
 * Three funding cases, one per case type:
 *   1. creator_support  — patronage for creator-001
 *   2. project_funding  — crowdfunding a documentary
 *   3. special_commission — one-off commission
 */

import type { FundingCase } from './types'

// ══════════════════════════════════════════════
// CREATOR SUPPORT — Recurring patronage
// ══════════════════════════════════════════════

export const creatorSupportCase: FundingCase = {
  id: 'funding-001',
  type: 'creator_support',
  lifecycle: 'active',

  title: 'Support Marta Reis\u2019s Independent Journalism',
  description: 'Help fund Marta\u2019s ongoing investigative work covering environmental crises across Southern Europe. Your contribution directly supports travel, equipment, and the time needed to produce deeply-reported stories.',
  heroImageRef: '/demo/funding-creator.jpg',
  heroVideoRef: '/assets/videos/protest-sofia-bulgaria.mp4',
  creatorId: 'creator-001',
  relatedEntityId: null,
  relatedEntityType: null,

  goalCents: 500_00,
  thresholdCents: 0,
  raisedCents: 327_50,
  deadlineAt: null,

  paymentRule: {
    type: 'tiered',
    minimumCents: 5_00,
    suggestedAmountsCents: [5_00, 15_00, 25_00, 50_00, 200_00],
    allowedCadences: ['monthly', 'quarterly', 'annual', 'one_time'],
    platformFeePercent: 10,
  },

  tiers: [
    {
      id: 'tier-001',
      name: 'Reader',
      amountCents: 5_00,
      description: 'Access to behind-the-scenes updates and early drafts.',
      perks: ['Behind-the-scenes updates', 'Early story access'],
      maxBackers: null,
      currentBackers: 42,
    },
    {
      id: 'tier-002',
      name: 'Supporter',
      amountCents: 15_00,
      description: 'Everything in Reader plus monthly Q&A sessions.',
      perks: ['All Reader perks', 'Monthly Q&A', 'Name in credits'],
      maxBackers: null,
      currentBackers: 18,
    },
    {
      id: 'tier-003',
      name: 'Champion',
      amountCents: 25_00,
      description: 'Full access plus exclusive prints and editorial input.',
      perks: ['All Supporter perks', 'Exclusive prints', 'Editorial input'],
      maxBackers: 50,
      currentBackers: 7,
    },
    {
      id: 'tier-004',
      name: 'Patron',
      amountCents: 50_00,
      description: 'The highest tier. Direct line and co-credit on funded stories.',
      perks: ['All Champion perks', 'Direct line', 'Co-credit on stories'],
      maxBackers: 10,
      currentBackers: 3,
    },
    {
      id: 'tier-005',
      name: 'Benefactor',
      amountCents: 200_00,
      description: 'Maximum impact. Private briefings, all prints, and naming rights on a story.',
      perks: ['All Patron perks', 'Private briefings', 'Naming rights'],
      maxBackers: 5,
      currentBackers: 1,
    },
  ],

  contributors: [
    { id: 'contrib-001', name: 'Ana Soares', avatarRef: '/assets/avatars/portrait-woman-curly-dark-hair.jpeg', amountCents: 25_00, cadence: 'monthly', tierId: 'tier-003', contributedAt: '2026-03-15T10:00:00Z', isAnonymous: false },
    { id: 'contrib-002', name: 'Thomas Berg', avatarRef: '/assets/avatars/portrait-man-brown-hair-green-bg.jpeg', amountCents: 15_00, cadence: 'monthly', tierId: 'tier-002', contributedAt: '2026-03-10T14:30:00Z', isAnonymous: false },
    { id: 'contrib-003', name: 'Anonymous', avatarRef: '', amountCents: 50_00, cadence: 'quarterly', tierId: 'tier-004', contributedAt: '2026-02-28T09:15:00Z', isAnonymous: true },
  ],
  totalContributors: 70,

  createdAt: '2026-01-01T00:00:00Z',
  publishedAt: '2026-01-05T12:00:00Z',
  completedAt: null,
  currency: 'EUR',
}

// ══════════════════════════════════════════════
// PROJECT FUNDING — Goal-based crowdfunding
// ══════════════════════════════════════════════

export const projectFundingCase: FundingCase = {
  id: 'funding-002',
  type: 'project_funding',
  lifecycle: 'open',

  title: 'The Water Crisis: A Documentary Investigation',
  description: 'A 6-month multimedia investigation into water privatisation across three countries. This project will produce a feature-length documentary, a 10-part photo essay, and an interactive data visualisation mapping corporate water extraction.',
  heroImageRef: '/demo/funding-project.jpg',
  heroVideoRef: '/assets/videos/lava-fountain.mp4',
  creatorId: 'creator-002',
  relatedEntityId: 'story-001',
  relatedEntityType: 'story',

  goalCents: 25_000_00,
  thresholdCents: 10_000_00,
  raisedCents: 8_750_00,
  deadlineAt: '2026-06-30T23:59:59Z',

  paymentRule: {
    type: 'tiered',
    minimumCents: 10_00,
    suggestedAmountsCents: [10_00, 25_00, 50_00, 100_00, 250_00],
    allowedCadences: ['one_time'],
    platformFeePercent: 15,
  },

  tiers: [
    {
      id: 'tier-p01',
      name: 'Backer',
      amountCents: 10_00,
      description: 'Your name in the project credits.',
      perks: ['Name in credits'],
      maxBackers: null,
      currentBackers: 156,
    },
    {
      id: 'tier-p02',
      name: 'Insider',
      amountCents: 25_00,
      description: 'Weekly progress dispatches and early access to all content.',
      perks: ['Name in credits', 'Weekly dispatches', 'Early access'],
      maxBackers: null,
      currentBackers: 89,
    },
    {
      id: 'tier-p03',
      name: 'Producer',
      amountCents: 100_00,
      description: 'Co-producer credit plus a signed print from the photo essay.',
      perks: ['All Insider perks', 'Co-producer credit', 'Signed print'],
      maxBackers: 100,
      currentBackers: 24,
    },
    {
      id: 'tier-p04',
      name: 'Executive Producer',
      amountCents: 250_00,
      description: 'Full co-production credit, private screening, and all prints.',
      perks: ['All Producer perks', 'Private screening', 'Full print set'],
      maxBackers: 20,
      currentBackers: 5,
    },
  ],

  contributors: [
    { id: 'contrib-p01', name: 'Clara Mendes', avatarRef: '/assets/avatars/portrait-woman-earrings-brunette.jpeg', amountCents: 100_00, cadence: 'one_time', tierId: 'tier-p03', contributedAt: '2026-04-01T16:00:00Z', isAnonymous: false },
    { id: 'contrib-p02', name: 'Henrik Larsson', avatarRef: '/assets/avatars/portrait-man-older-rimless-glasses.jpeg', amountCents: 250_00, cadence: 'one_time', tierId: 'tier-p04', contributedAt: '2026-03-28T11:00:00Z', isAnonymous: false },
  ],
  totalContributors: 274,

  createdAt: '2026-03-01T00:00:00Z',
  publishedAt: '2026-03-05T10:00:00Z',
  completedAt: null,
  currency: 'EUR',
}

// ══════════════════════════════════════════════
// SPECIAL COMMISSION — One-off commissioned work
// ══════════════════════════════════════════════

export const specialCommissionCase: FundingCase = {
  id: 'funding-003',
  type: 'special_commission',
  lifecycle: 'open',

  title: 'Commission: Wildfire Recovery Photo Series',
  description: 'Commission a 20-image photo series documenting post-wildfire recovery efforts in the Algarve region. Includes on-location coverage over 5 days, full post-production, and exclusive editorial licence.',
  heroImageRef: '/demo/funding-commission.jpg',
  heroVideoRef: '/assets/videos/aerial-establishing-shot.mp4',
  creatorId: 'creator-003',
  relatedEntityId: null,
  relatedEntityType: null,

  goalCents: 3_500_00,
  thresholdCents: 3_500_00,
  raisedCents: 0,
  deadlineAt: '2026-05-15T23:59:59Z',

  paymentRule: {
    type: 'fixed',
    minimumCents: 3_500_00,
    suggestedAmountsCents: [],
    fixedAmountCents: 3_500_00,
    allowedCadences: ['one_time'],
    platformFeePercent: 20,
  },

  tiers: [],

  contributors: [],
  totalContributors: 0,

  createdAt: '2026-04-01T00:00:00Z',
  publishedAt: '2026-04-02T08:00:00Z',
  completedAt: null,
  currency: 'EUR',
}

// ══════════════════════════════════════════════
// ALL FIXTURES
// ══════════════════════════════════════════════

export const fundingFixtures: FundingCase[] = [
  creatorSupportCase,
  projectFundingCase,
  specialCommissionCase,
]

export const fundingFixtureMap: Record<string, FundingCase> = Object.fromEntries(
  fundingFixtures.map(f => [f.id, f])
)
