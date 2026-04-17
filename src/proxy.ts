/**
 * Frontfiles — Asset Delivery Proxy (Next.js 16+)
 *
 * Defense-in-depth: blocks direct browser access to original asset files
 * stored in public/assets/. All asset media must be served through the
 * protected /api/media/[id] endpoint, which enforces delivery policy.
 *
 * Avatars are excluded — they are public profile images, not licensable content.
 *
 * In production, originals would live in a private storage bucket (not public/).
 * This proxy exists to enforce the same boundary in the mock/dev codebase.
 *
 * HISTORY:
 *   Renamed from `middleware.ts` in Next.js 16 per the framework's new
 *   proxy convention. Behaviour is identical; only the file + function
 *   name changed. See: https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Block direct browser access to original asset files
  // Avatars are public profile images — not protected content
  if (pathname.startsWith('/assets/') && !pathname.startsWith('/assets/avatars/')) {
    return new NextResponse(
      JSON.stringify({
        error: 'Direct asset access denied',
        message: 'Assets must be accessed through the delivery API. Use /api/media/[id].',
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

  return NextResponse.next()
}

export const config = {
  matcher: '/assets/:path*',
}
