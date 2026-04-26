/**
 * Frontfiles — Newsroom pack list (NR-D6a, F5)
 *
 * Server component. Renders the table portion of the distributor
 * dashboard per PRD §5.2 P5. Two empty-state branches:
 *
 *   - No packs + no filters applied:
 *     "No packs yet. Create your first pack." + "New pack" CTA
 *     (subject to canCreatePack gate per PRD §3.4 invariant 2)
 *
 *   - No packs + filters applied:
 *     "No packs match the current filters. Clear filters."
 *     The filter-empty variant is directive-derived UX (PRD silent
 *     on this case); treated as locked-by-directive consistent
 *     with the NR-D5b-ii IP-3 pattern.
 *
 * Title links to /{orgSlug}/manage/packs/{slug} — that route is a
 * placeholder until NR-D6b's Pack editor lands. Links will 404 if
 * clicked in the NR-D6a window. The dashboard is expected to have
 * zero rows in this window anyway (Pack creation is NR-D6b), so
 * the placeholder-link gap is not a user-facing issue in practice.
 *
 * Embargo column copy (PRD §5.1 P5 enumerates exactly 3 cell states):
 *   embargo IS NULL                          → "None"
 *   embargo.state === 'cancelled'            → "None"  (collapsed)
 *   embargo.state === 'lifted'               → "Lifted"
 *   embargo.state === 'active'               → "Lifts {rel}"  (e.g. "Lifts in 3 days")
 *
 * The schema's `newsroom_embargo_state` enum has a fourth value
 * `cancelled` that PRD doesn't enumerate. Per the "PRD wins on
 * drift" standing posture (NR-D6a §9), cancelled embargoes
 * collapse to "None" — matches the column's user-impact purpose
 * ("is publish blocked by an active embargo?"). A cancelled
 * embargo no longer blocks, so the no-embargo branch is the
 * correct render. Founder-ratified post-VERIFY.
 *
 * Downloads (30d) renders "—" in v1 — no DistributionEvent count
 * is wired yet (NR-D11).
 *
 * Spec cross-references:
 *   - PRD.md §5.2 P5 (column spec, empty-state copy)
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F5
 *   - src/lib/newsroom/licence-classes.ts (humanLabel)
 *   - migration 20260425000003_newsroom_schema_d2b.sql
 *     (newsroom_embargoes.state enum: active/lifted/cancelled)
 */

import Link from 'next/link'

import type {
  NewsroomEmbargoRow,
  NewsroomPackRow,
} from '@/lib/db/schema'
import { LICENCE_CLASSES } from '@/lib/newsroom/licence-classes'

type EmbargoSnapshot = Pick<NewsroomEmbargoRow, 'lift_at' | 'state'>
type PackWithEmbargo = NewsroomPackRow & {
  embargo: EmbargoSnapshot | null
}

const RTF = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
const CTA_DISABLED_TOOLTIP = 'Verify your source to create packs.'

function formatRelative(iso: string, now: Date = new Date()): string {
  // Picks the largest unit that yields a non-zero relative phrase
  // ("3 days ago", "in 5 hours", "in 2 minutes"). Caps at days; v1
  // doesn't render "weeks" / "months" / "years" because the data
  // window is too short to make those distinctions land cleanly.
  const target = new Date(iso).getTime()
  const diffMs = target - now.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  const absMin = Math.abs(diffMin)
  if (absMin < 60) return RTF.format(diffMin, 'minute')
  const diffHr = Math.round(diffMs / 3_600_000)
  if (Math.abs(diffHr) < 24) return RTF.format(diffHr, 'hour')
  const diffDay = Math.round(diffMs / 86_400_000)
  return RTF.format(diffDay, 'day')
}

function embargoCell(embargo: EmbargoSnapshot | null): string {
  // PRD §5.1 P5 cell states: None / Lifts {rel} / Lifted. cancelled
  // is silent in PRD and collapses into "None" (a cancelled embargo
  // no longer blocks publish — same user-impact as "no embargo").
  if (!embargo || embargo.state === 'cancelled') return 'None'
  if (embargo.state === 'lifted') return 'Lifted'
  // active
  return `Lifts ${formatRelative(embargo.lift_at)}`
}

function statusLabel(status: NewsroomPackRow['status']): string {
  // Title-cased PRD column label per PRD §5.2 P5 enumeration.
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'scheduled':
      return 'Scheduled'
    case 'published':
      return 'Published'
    case 'archived':
      return 'Archived'
    case 'takedown':
      return 'Takedown'
  }
}

function visibilityLabel(
  visibility: NewsroomPackRow['visibility'],
): string {
  switch (visibility) {
    case 'private':
      return 'Private'
    case 'restricted':
      return 'Restricted'
    case 'public':
      return 'Public'
    case 'tombstone':
      return 'Tombstone'
  }
}

export function PackList({
  orgSlug,
  packs,
  canCreatePack,
  filtersApplied,
}: {
  orgSlug: string
  packs: ReadonlyArray<PackWithEmbargo>
  canCreatePack: boolean
  filtersApplied: boolean
}) {
  // ── Empty-state branches ──
  if (packs.length === 0) {
    if (filtersApplied) {
      return (
        <section aria-label="Pack list (empty — filtered)">
          <p>No packs match the current filters.</p>
          <Link href={`/${orgSlug}/manage`}>Clear filters</Link>
        </section>
      )
    }
    // No packs + no filters → PRD verbatim empty state
    return (
      <section aria-label="Pack list (empty)">
        <p>No packs yet. Create your first pack.</p>
        {canCreatePack ? (
          <Link href={`/${orgSlug}/manage/packs/new`}>New pack</Link>
        ) : (
          <button type="button" disabled title={CTA_DISABLED_TOOLTIP}>
            New pack
          </button>
        )}
      </section>
    )
  }

  // ── Populated table ──
  return (
    <section aria-label="Pack list">
      <table>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Visibility</th>
            <th scope="col">Licence</th>
            <th scope="col">Embargo</th>
            <th scope="col">Downloads (30d)</th>
            <th scope="col">Last edit</th>
          </tr>
        </thead>
        <tbody>
          {packs.map((pack) => (
            <tr key={pack.id}>
              <td>
                <Link href={`/${orgSlug}/manage/packs/${pack.slug}`}>
                  {pack.title}
                </Link>
              </td>
              <td>
                <span aria-label={`Status: ${statusLabel(pack.status)}`}>
                  {statusLabel(pack.status)}
                </span>
              </td>
              <td>
                <span
                  aria-label={`Visibility: ${visibilityLabel(pack.visibility)}`}
                >
                  {visibilityLabel(pack.visibility)}
                </span>
              </td>
              <td>{LICENCE_CLASSES[pack.licence_class].humanLabel}</td>
              <td>{embargoCell(pack.embargo)}</td>
              {/* Downloads (30d): no DistributionEvent count yet — NR-D11 */}
              <td aria-label="Downloads in the last 30 days (not yet tracked)">
                —
              </td>
              <td>{formatRelative(pack.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
