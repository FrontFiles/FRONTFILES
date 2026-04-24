/**
 * Frontfiles — Newsroom manage layout (NR-D5b-i, F1a)
 *
 * Nested layout under `src/app/newsroom/layout.tsx` (NR-D3). Gates
 * every page under `/newsroom/{orgSlug}/manage/**` to signed-in
 * admins of the org.
 *
 * ─── Auth-gate architecture (IP-B, IP-C — ratified 2026-04-24) ──
 *
 * Layout stays a SERVER component (per directive F1 wording), but
 * the authentication check happens on the CLIENT via the sibling
 * <AdminGate> wrapper — mirrors the NR-D5a IP-1 precedent where
 * the signup page is a server shell + client gate inside
 * signup-form.tsx.
 *
 * AdminGate reads the browser Supabase session, posts the Bearer
 * token to GET /api/newsroom/orgs/{orgSlug}/me, and conditionally
 * renders children. Non-admins are redirected to '/'. Unauthed
 * users are redirected to `/signin?return=/{orgSlug}/manage`.
 *
 * ─── SSR-before-gate window (IP-B, acknowledged, ratified) ──────
 *
 * Because the gate fires on mount, nested pages will briefly SSR
 * their content into the initial HTML payload before the gate
 * decides to unmount them. The surfaces under /manage expose:
 *   - verification_tier (already public on the newsroom org page)
 *   - value_checked tokens (the HMAC-derived challenge for a
 *     PUBLIC DNS record — knowing the token gives no leverage
 *     without domain control)
 *   - primary_domain (public — on the newsroom profile page)
 * Net sensitivity is low; the architecture was ratified on those
 * grounds. A stricter posture (server-side membership check via
 * @supabase/ssr, or client-fetched state only) is v1.1 scope.
 *
 * Spec cross-references:
 *   - docs/public-newsroom/directives/NR-D5b-i-verification-dashboard-dns.md §F1
 *   - src/app/newsroom/start/_components/signup-form.tsx (IP-1 precedent)
 */

import { AdminGate } from './_components/admin-gate'

export default async function NewsroomManageLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  return <AdminGate orgSlug={orgSlug}>{children}</AdminGate>
}
