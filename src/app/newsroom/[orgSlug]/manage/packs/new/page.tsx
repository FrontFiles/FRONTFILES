/**
 * Frontfiles — Newsroom Pack creation placeholder (NR-D6a, F10)
 *
 * Minimal placeholder so the "New pack" CTA from F3 doesn't 404
 * during the NR-D6a → NR-D6b window. The real Pack-creation form
 * (P6 Details tab per PRD §5.2 P6) ships in NR-D6b.
 *
 * Replaced wholesale by NR-D6b — do not import from elsewhere.
 *
 * Spec cross-reference:
 *   - directives/NR-D6a-distributor-dashboard-tier-gate.md §F10
 */

import Link from 'next/link'

export default async function NewsroomPackNewPlaceholderPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return (
    <main>
      <h1>New pack</h1>
      <p>Pack creation ships in NR-D6b.</p>
      <Link href={`/${orgSlug}/manage`}>Back to dashboard</Link>
    </main>
  )
}
