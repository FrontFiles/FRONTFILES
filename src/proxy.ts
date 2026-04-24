/**
 * Frontfiles — Proxy (Next.js 16+) composing two concerns:
 *
 *   1. Asset-delivery protection — blocks direct browser access
 *      to original asset files stored in /assets/.  All asset
 *      media must be served through the protected
 *      /api/media/[id] endpoint.  Avatars are excluded (public
 *      profile images, not licensable content).  In production,
 *      originals would live in a private storage bucket; this
 *      proxy enforces the same boundary in the mock/dev codebase.
 *
 *   2. Newsroom subdomain rewrite (NR-D3) — `newsroom.*` host
 *      traffic is rewritten into the `/newsroom/*` route group
 *      transparently (URL in the address bar stays subdomain-
 *      rooted).  Main-domain requests to `/newsroom/*` are
 *      denied with 404 (PRD §9.3 separation).
 *
 * Matcher is an array with two entries:
 *
 *   - '/assets/:path*' keeps asset-delivery protection on files
 *     with extensions (e.g. /assets/photo.jpg), which the broad
 *     all-paths matcher excludes via `.*\\..*`.
 *   - '/((?!_next/static|_next/image|favicon\\.ico|assets/|.*\\..*).*)' fires
 *     the newsroom logic on every other request path.  `assets/`
 *     is excluded here to avoid double-processing (matcher 1
 *     handles it already).
 *
 * HISTORY:
 *   Renamed from `middleware.ts` in Next.js 16 per the framework's
 *   new proxy convention.  Newsroom rewrite added in NR-D3.
 *   See: https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isNewsroomHost } from '@/lib/newsroom/host'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Asset-delivery protection (pre-existing) ──
  //
  // Block direct browser access to original asset files.
  // Avatars are public profile images — not protected content.
  if (
    pathname.startsWith('/assets/') &&
    !pathname.startsWith('/assets/avatars/')
  ) {
    return new NextResponse(
      JSON.stringify({
        error: 'Direct asset access denied',
        message:
          'Assets must be accessed through the delivery API. Use /api/media/[id].',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Frontfiles-Policy': 'asset-delivery-blocked',
        },
      },
    )
  }

  // ── 2. Newsroom subdomain rewrite (NR-D3) ──

  // In Next 16.2.2 (dev and prod), `request.nextUrl.host`
  // reflects the TCP listening host (e.g. localhost:3000),
  // NOT the incoming Host header.  For subdomain detection
  // we must read the Host header directly.  `nextUrl.host`
  // is kept as a defensive fallback only.
  const host =
    request.headers.get('host') || request.nextUrl.host || ''

  if (isNewsroomHost(host)) {
    // Defensive pass-through: if for any reason the pathname
    // already lives under /newsroom, don't wrap it again.
    if (pathname === '/newsroom' || pathname.startsWith('/newsroom/')) {
      return NextResponse.next()
    }

    const rewritten = request.nextUrl.clone()
    rewritten.pathname =
      pathname === '/' ? '/newsroom' : `/newsroom${pathname}`
    return NextResponse.rewrite(rewritten)
  }

  // Main domain: the /newsroom/* namespace is reserved for
  // subdomain traffic.  Return 404 so the main-domain surface
  // does not expose the internal route-group paths.
  if (pathname === '/newsroom' || pathname.startsWith('/newsroom/')) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Keep asset-delivery protection on file-extension paths,
    // which the broader matcher below excludes via `.*\\..*`.
    '/assets/:path*',
    // Newsroom rewrite + main-domain /newsroom denial.  Exclude
    // Next static, optimised images, favicon, files with
    // extensions, and /assets/* (handled by the first matcher).
    '/((?!_next/static|_next/image|favicon\\.ico|assets/|.*\\..*).*)',
  ],
}
