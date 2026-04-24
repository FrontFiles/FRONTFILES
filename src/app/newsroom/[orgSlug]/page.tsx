/**
 * Frontfiles — Newsroom org placeholder (NR-D3 stub for J3)
 *
 * Served from `newsroom.frontfiles.com/{orgSlug}` via the proxy
 * rewrite in src/proxy.ts.  The real J3 org page lands in NR-D13.
 *
 * Next 16 App Router: `params` is a Promise (async dynamic APIs).
 */

export default async function NewsroomOrgPlaceholder({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return (
    <div>
      <h1>Newsroom: {orgSlug}</h1>
      <p>This is the placeholder org page.</p>
      <p>The live org surface lands in NR-D13.</p>
    </div>
  )
}
