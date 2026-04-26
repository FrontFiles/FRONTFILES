/**
 * Frontfiles — Pre-publish checklist sidebar (NR-D9b, F3)
 *
 * Server component. Renders 7 rows from a derived `ChecklistItem[]`
 * per PRD §5.1 P10 verbatim labels (lines 945–951) + state strings
 * (lines 948–951).
 *
 * State → glyph mapping (PRD-strict):
 *   ok      → "✓"
 *   missing → "✗"
 *   partial → `detail` text (e.g. "1 scanning", "Missing on 2",
 *             "Not confirmed")
 *   na      → "N/A"
 *
 * Derivation lives in `src/lib/newsroom/publish-checklist.ts`
 * (server-only). This component takes the already-derived items
 * and renders — no logic.
 *
 * Spec cross-references:
 *   - directives/NR-D9b-publish-flow.md §F3
 *   - PRD.md §5.1 P10 (line 941) — verbatim labels + states
 *   - src/lib/newsroom/publish-checklist.ts — derivation
 */

import type { ChecklistItem } from '@/lib/newsroom/publish-checklist'

function renderState(item: ChecklistItem): string {
  switch (item.state) {
    case 'ok':
      return '✓'
    case 'missing':
      return '✗'
    case 'na':
      return 'N/A'
    case 'partial':
      // PRD-verbatim short string — derivation guarantees `detail`
      // is set when state is 'partial'.
      return item.detail ?? ''
  }
}

export function PrePublishChecklist({
  items,
}: {
  items: ReadonlyArray<ChecklistItem>
}) {
  return (
    <aside aria-label="Pre-publish checklist">
      <h2>Pre-publish checklist</h2>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <span aria-label={`Status: ${renderState(item)}`}>
              {renderState(item)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
