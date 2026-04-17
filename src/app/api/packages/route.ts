import { NextRequest, NextResponse } from 'next/server'
import { listPackagesForUser } from '@/lib/fulfilment'

/**
 * Frontfiles — Package List Endpoint
 *
 * GET /api/packages
 * GET /api/packages?kind=buyer_pack
 * GET /api/packages?kind=creator_pack
 * GET /api/packages?transactionId={txnId}
 *
 * Lists all certified packages accessible to the current user.
 *
 * AUTHORIZATION SOURCE: package ownership (owner_user_id or
 *   owner_company_id with eligible membership).
 *   This endpoint NEVER checks licence_grants.
 *
 * Empty result is valid — returns { packages: [] }, not 404.
 */

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-frontfiles-user-id') ?? null

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  const { searchParams } = request.nextUrl
  const kindFilter = searchParams.get('kind') ?? undefined
  const transactionFilter = searchParams.get('transactionId') ?? undefined

  const packages = await listPackagesForUser(userId, kindFilter, transactionFilter)

  return NextResponse.json({ packages })
}
