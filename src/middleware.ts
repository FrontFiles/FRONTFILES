/**
 * Frontfiles — Asset Delivery Middleware
 *
 * Defense-in-depth: blocks direct browser access to original asset files
 * stored in public/assets/. All asset media must be served through the
 * protected /api/media/[id] endpoint, which enforces delivery policy.
 *
 * Avatars are excluded — they are public profile images, not licensable content.
 *
 * In production, originals would live in a private storage bucket (not public/).
 * This middleware exists to enforce the same boundary in the mock/dev codebase.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
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
