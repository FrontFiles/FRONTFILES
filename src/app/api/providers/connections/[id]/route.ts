// ═══════════════════════════════════════════════════════════════
// /api/providers/connections/[id] — single-connection ops
//
// GET    /api/providers/connections/[id]   read one (use rights)
// DELETE /api/providers/connections/[id]   revoke (manage rights)
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import {
  errorResponse,
  success,
  withInternalError,
} from '@/lib/providers/api-helpers'
import {
  getConnectionById,
  revokeConnection,
} from '@/lib/providers/service'
import {
  canManageProviderConnection,
  canUseProviderConnection,
} from '@/lib/providers/access'
import { getUserWithFacets } from '@/lib/identity/store'
import type { ProviderViewer } from '@/lib/providers/access'

async function buildViewer(
  request: NextRequest,
): Promise<ProviderViewer | null> {
  const viewerId = request.headers.get('x-frontfiles-user-id')
  if (!viewerId) return null
  const facets = await getUserWithFacets(viewerId)
  if (!facets) return null
  return {
    user: facets.user,
    companyMemberships: facets.companyMemberships,
    isStaff: false,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withInternalError(async () => {
    const viewer = await buildViewer(request)
    if (!viewer) {
      return errorResponse('AUTH_REQUIRED', 'Authentication required.', 401)
    }
    const { id } = await params
    const connection = await getConnectionById(id)
    if (!connection) {
      return errorResponse('CONNECTION_NOT_FOUND', `Connection ${id} not found.`, 404)
    }
    if (!canUseProviderConnection(viewer, connection)) {
      return errorResponse(
        'FORBIDDEN_CONNECTION',
        'You do not have access to this connection.',
        403,
      )
    }
    return success(connection)
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withInternalError(async () => {
    const viewer = await buildViewer(request)
    if (!viewer) {
      return errorResponse('AUTH_REQUIRED', 'Authentication required.', 401)
    }
    const { id } = await params
    const connection = await getConnectionById(id)
    if (!connection) {
      return errorResponse('CONNECTION_NOT_FOUND', `Connection ${id} not found.`, 404)
    }
    if (!canManageProviderConnection(viewer, connection)) {
      return errorResponse(
        'FORBIDDEN_MANAGE',
        'You cannot manage this connection.',
        403,
      )
    }
    const revoked = await revokeConnection(id)
    return success(revoked)
  })
}
