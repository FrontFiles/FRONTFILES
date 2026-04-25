/**
 * Frontfiles — Newsroom pack list filters (NR-D6a, F6)
 *
 * Server component. No client state. Renders a <form method="GET">
 * that resubmits to /{orgSlug}/manage with status / licence / from /
 * to query params. The page re-renders on submit; F8's
 * parseFilterParams in F2 reads them back and re-applies the
 * dashboard query.
 *
 * Filter fields per PRD §5.2 P5:
 *   - Status     : All + 5 newsroom_pack_status enum values
 *   - Licence    : All + 5 newsroom_licence_class enum values
 *   - Date from  : <input type="date">
 *   - Date to    : <input type="date">
 *
 * The licence dropdown iterates LICENCE_CLASSES (single source of
 * truth from NR-D4) — no hardcoded enum list per the standing
 * constraint at NR-D6a §9.
 *
 * Spec cross-references:
 *   - PRD.md §5.2 P5 (filter list)
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F6
 *   - src/lib/newsroom/licence-classes.ts (LICENCE_CLASSES)
 */

import Link from 'next/link'

import type {
  NewsroomLicenceClass,
  NewsroomPackStatus,
} from '@/lib/db/schema'
import { LICENCE_CLASSES } from '@/lib/newsroom/licence-classes'

const STATUS_OPTIONS: ReadonlyArray<{
  value: NewsroomPackStatus
  label: string
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'takedown', label: 'Takedown' },
]

// Licence options derived from LICENCE_CLASSES; no hardcoded enum
// list. Iteration order matches the canonical order set by NR-D4.
const LICENCE_OPTIONS: ReadonlyArray<{
  value: NewsroomLicenceClass
  label: string
}> = (
  Object.keys(LICENCE_CLASSES) as NewsroomLicenceClass[]
).map((id) => ({
  value: id,
  label: LICENCE_CLASSES[id].humanLabel,
}))

export function PackListFilters({
  orgSlug,
  current,
}: {
  orgSlug: string
  current: {
    status?: NewsroomPackStatus
    licence?: NewsroomLicenceClass
    from?: string
    to?: string
  }
}) {
  const action = `/${orgSlug}/manage`

  return (
    <form method="GET" action={action} aria-label="Filter packs">
      <label>
        Status
        <select name="status" defaultValue={current.status ?? ''}>
          <option value="">All</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Licence
        <select name="licence" defaultValue={current.licence ?? ''}>
          <option value="">All</option>
          {LICENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        From
        <input
          type="date"
          name="from"
          defaultValue={current.from ?? ''}
        />
      </label>

      <label>
        To
        <input type="date" name="to" defaultValue={current.to ?? ''} />
      </label>

      <button type="submit">Apply</button>
      <Link href={action}>Clear</Link>
    </form>
  )
}
