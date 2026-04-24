/**
 * Frontfiles — Newsroom route group layout (NR-D3)
 *
 * Minimal wrapper — no chrome, no nav, no fonts beyond what the
 * root layout already provides.  The real newsroom chrome
 * (subdomain header, org identity, footer) ships in NR-D11.
 */

export default function NewsroomLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div data-subsurface="newsroom">{children}</div>
}
