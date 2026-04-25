/**
 * Frontfiles — Newsroom KPI strip (NR-D6a, F7)
 *
 * Server component. Renders 4 placeholder KPI tiles per PRD §5.2 P5:
 *   - Total packs
 *   - Drafts
 *   - Scheduled
 *   - Published
 *
 * The Downloads (30d) tile is a v1 placeholder — DistributionEvent
 * isn't wired until NR-D11. Renders "—" with a helper line so
 * admins know the count is coming, not broken.
 *
 * Spec cross-references:
 *   - PRD.md §5.2 P5 (KPI strip)
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F7
 */

export interface KpiStats {
  totalPacks: number
  drafts: number
  scheduled: number
  published: number
  // v1: always 0; rendered as "—" until NR-D11 wires
  // DistributionEvent counts.
  downloads30d: number
}

export function KpiStrip({ stats }: { stats: KpiStats }) {
  return (
    <section aria-label="Pack KPIs">
      <dl>
        <div>
          <dt>Total packs</dt>
          <dd>{stats.totalPacks}</dd>
        </div>
        <div>
          <dt>Drafts</dt>
          <dd>{stats.drafts}</dd>
        </div>
        <div>
          <dt>Scheduled</dt>
          <dd>{stats.scheduled}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{stats.published}</dd>
        </div>
        <div>
          <dt>Downloads (30d)</dt>
          <dd aria-label="Not yet tracked">—</dd>
          <p>Available after first downloads</p>
        </div>
      </dl>
    </section>
  )
}
