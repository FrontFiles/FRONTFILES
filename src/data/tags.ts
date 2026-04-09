// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Tag Vocabulary
// Controlled tag set for discovery clustering and search
// ═══════════════════════════════════════════════════════════════

export interface Tag {
  id: string
  label: string
  category: 'event' | 'condition' | 'institution' | 'sector' | 'action'
}

export const tags: Tag[] = [
  // Event
  { id: 'tag-flood', label: 'flood', category: 'event' },
  { id: 'tag-wildfire', label: 'wildfire', category: 'event' },
  { id: 'tag-drought', label: 'drought', category: 'event' },
  { id: 'tag-storm', label: 'storm damage', category: 'event' },
  { id: 'tag-heatwave', label: 'heatwave', category: 'event' },
  { id: 'tag-election', label: 'election security', category: 'event' },
  { id: 'tag-court', label: 'court hearing', category: 'event' },
  { id: 'tag-protest', label: 'student protest', category: 'event' },
  { id: 'tag-strike', label: 'labor strike', category: 'event' },
  { id: 'tag-eviction', label: 'eviction dispute', category: 'event' },

  // Condition
  { id: 'tag-displacement', label: 'displacement', category: 'condition' },
  { id: 'tag-evacuation', label: 'evacuation', category: 'condition' },
  { id: 'tag-coastal-erosion', label: 'coastal erosion', category: 'condition' },
  { id: 'tag-hospital-pressure', label: 'hospital pressure', category: 'condition' },
  { id: 'tag-port-congestion', label: 'port congestion', category: 'condition' },
  { id: 'tag-transit-disruption', label: 'transit disruption', category: 'condition' },
  { id: 'tag-school-closure', label: 'school closure', category: 'condition' },
  { id: 'tag-water-access', label: 'water access', category: 'condition' },
  { id: 'tag-civic-unrest', label: 'civic unrest', category: 'condition' },

  // Institution
  { id: 'tag-parliament', label: 'parliament', category: 'institution' },
  { id: 'tag-police-accountability', label: 'police accountability', category: 'institution' },
  { id: 'tag-municipal-politics', label: 'municipal politics', category: 'institution' },
  { id: 'tag-public-health', label: 'public health', category: 'institution' },

  // Sector
  { id: 'tag-fishing', label: 'fishing livelihoods', category: 'sector' },
  { id: 'tag-logistics', label: 'logistics', category: 'sector' },
  { id: 'tag-border-crossing', label: 'border crossing', category: 'sector' },
  { id: 'tag-asylum', label: 'asylum route', category: 'sector' },

  // Action
  { id: 'tag-recovery', label: 'recovery', category: 'action' },
  { id: 'tag-distribution', label: 'distribution', category: 'action' },
]

export const tagMap = Object.fromEntries(tags.map(t => [t.id, t]))
export const tagsByLabel = Object.fromEntries(tags.map(t => [t.label, t]))
