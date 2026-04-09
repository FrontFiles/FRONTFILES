// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Curated Selections
// 8 human-selected editorial highlights (always labelled "Frontfiles Curated")
// ═══════════════════════════════════════════════════════════════

export interface CuratedSelection {
  id: string
  objectType: 'asset' | 'story' | 'article'
  objectId: string
  curatorNote: string
  displayLabel: 'Frontfiles Curated'
  rationale: string
}

export const curatedSelections: CuratedSelection[] = [
  {
    id: 'curated-001',
    objectType: 'asset',
    objectId: 'asset-001',
    curatorNote: 'Defining aerial image of the Guaíba levee breach. Strong compositional clarity and immediate context.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'High visual impact, strong provenance record, wide licensing applicability.',
  },
  {
    id: 'curated-002',
    objectType: 'story',
    objectId: 'story-004',
    curatorNote: 'Complete border crossing package with checkpoint, processing, overnight, and humanitarian documentation.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Multi-format Story covering the full logistics of a border surge event.',
  },
  {
    id: 'curated-003',
    objectType: 'asset',
    objectId: 'asset-006',
    curatorNote: 'Rare wide-angle chamber photograph during an active confidence vote roll call.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Institutional access, compositional strength, clear editorial utility.',
  },
  {
    id: 'curated-004',
    objectType: 'article',
    objectId: 'article-004',
    curatorNote: 'Evidence-built analysis of hospital capacity failure during an unseasonal heat event.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Strong source linkage, public health relevance, multiformat sourcing.',
  },
  {
    id: 'curated-005',
    objectType: 'asset',
    objectId: 'asset-034',
    curatorNote: 'Court-day arrival sequence with clear institutional framing and verified access credentials.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Court reporting access, clean provenance, accountability journalism.',
  },
  {
    id: 'curated-006',
    objectType: 'story',
    objectId: 'story-006',
    curatorNote: 'Complete hospital overload package: corridor, ambulance, triage, and audio testimony.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Full-coverage editorial package with rare frontline access.',
  },
  {
    id: 'curated-007',
    objectType: 'asset',
    objectId: 'asset-017',
    curatorNote: 'Data-led burn scar infographic with municipal-level granularity.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Data visualization quality, environmental reporting utility.',
  },
  {
    id: 'curated-008',
    objectType: 'article',
    objectId: 'article-003',
    curatorNote: 'Multi-creator sourced analysis of EU external border processing failure.',
    displayLabel: 'Frontfiles Curated',
    rationale: 'Cross-creator sourcing, strong evidence chain, displacement relevance.',
  },
]

export const curatedMap = Object.fromEntries(curatedSelections.map(c => [c.id, c]))
