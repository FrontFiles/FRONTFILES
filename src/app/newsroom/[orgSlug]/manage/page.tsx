/**
 * Frontfiles — Newsroom distributor manage stub (NR-D5a, F5)
 *
 * Post-signup landing at
 *   `newsroom.frontfiles.com/{orgSlug}/manage`.
 *
 * Deliberately minimal. The real distributor dashboard (PRD §5.2
 * P5 — verification banner, Pack list, KPI strip) ships in NR-D6.
 * Membership + role gating also lands in NR-D6 proper.
 *
 * Auth guard deferred: the codebase has no server-readable session
 * (see NR-D5a IP-1 and `src/app/newsroom/start/page.tsx` header).
 * The stub is a static render with no sensitive data — a slug
 * name echoed from the URL plus a forward-looking note — so a
 * visitor-without-session lands on an inert page rather than a
 * protected one. NR-D6 will add the proper server-authenticated
 * membership check.
 */

export default async function NewsroomManageStub({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return (
    <main>
      <h1>Welcome, your newsroom &apos;{orgSlug}&apos; is being set up.</h1>
      <p>Complete verification to publish your first pack.</p>
      <p>(Dashboard UI coming soon — NR-D6.)</p>
    </main>
  )
}
