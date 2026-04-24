/**
 * Frontfiles — Newsroom host detection (NR-D3)
 *
 * Tiny utility for identifying `newsroom.*` subdomain traffic at
 * the proxy layer.  Pure module — no imports, no side effects.
 *
 * The full set of newsroom-domain helpers (canonical-URL builder,
 * licence-class config, embed-snippet generator, receipt-terms
 * generator, state-machine validator, invariants helpers) lands
 * in NR-D4.  This file is intentionally minimal.
 */

export const NEWSROOM_HOST_PATTERN = /^newsroom\./i

export function isNewsroomHost(
  host: string | null | undefined,
): boolean {
  if (!host) return false
  return NEWSROOM_HOST_PATTERN.test(host)
}
