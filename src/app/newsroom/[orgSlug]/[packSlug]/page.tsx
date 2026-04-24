/**
 * Frontfiles — Newsroom pack placeholder (NR-D3 stub for J4)
 *
 * Served from `newsroom.frontfiles.com/{orgSlug}/{packSlug}` via
 * the proxy rewrite in src/proxy.ts.  The real J4 pack page
 * lands in NR-D11.
 *
 * Next 16 App Router: `params` is a Promise (async dynamic APIs).
 */

export default async function NewsroomPackPlaceholder({
  params,
}: {
  params: Promise<{ orgSlug: string; packSlug: string }>
}) {
  const { orgSlug, packSlug } = await params
  return (
    <div>
      <h1>
        Newsroom: {orgSlug} / {packSlug}
      </h1>
      <p>This is the placeholder pack page.</p>
      <p>The live pack surface lands in NR-D11.</p>
    </div>
  )
}
