// ═══════════════════════════════════════════════════════════════
// /api/providers/connections — list + create connections
//
// GET  /api/providers/connections?ownerType=user&ownerId=…
//      List active and inactive connections for an owner. The
//      acting user must have READ rights on the owner
//      (`canUseProviderConnection` semantics — being the user
//      themselves, or an active member of the company).
//
// POST /api/providers/connections
//      Create (register) a new connection. Body shape:
//        {
//          provider:           ProviderKey,
//          ownerType:          'user' | 'company' | 'workspace' | 'platform',
//          ownerId?:           string,            // required unless platform
//          externalAccountId:  string,
//          accountLabel?:      string | null,
//          status?:            ProviderConnectionStatus,
//          grantedScopes?:     string[],
//          metadata?:          Record<string, unknown>
//        }
//
// Auth: until real session cookies land, the acting user id
// is read from the `x-frontfiles-user-id` header (the same
// pattern the FFF Sharing API uses). When real auth lands,
// replace the header lookup with a session resolver.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server'
import {
  errorResponse,
  success,
  withInternalError,
} from '@/lib/providers/api-helpers'
import {
  createConnection,
  listConnectionsForOwner,
} from '@/lib/providers/service'
import { canConnectProvider } from '@/lib/providers/access'
import { getUserWithFacets } from '@/lib/identity/store'
import { isKnownProvider } from '@/lib/providers/registry'
import type {
  ProviderKey,
  ProviderOwner,
  ProviderOwnerType,
} from '@/lib/providers/types'
import type { ProviderViewer } from '@/lib/providers/access'

// ─── Shared: build viewer from header ────────────────────────

async function buildViewerFromHeader(
  request: NextRequest,
): Promise<ProviderViewer | null> {
  const viewerId = request.headers.get('x-frontfiles-user-id')
  if (!viewerId) return null
  const facets = await getUserWithFacets(viewerId)
  if (!facets) return null
  return {
    user: facets.user,
    companyMemberships: facets.companyMemberships,
    isStaff: false, // staff role placeholder
  }
}

// ─── Shared: parse owner from query/body ─────────────────────

function parseOwnerFromQuery(searchParams: URLSearchParams): {
  ok: true
  owner: ProviderOwner
} | { ok: false; message: string } {
  const ownerType = searchParams.get('ownerType') as ProviderOwnerType | null
  const ownerId = searchParams.get('ownerId')
  if (!ownerType) return { ok: false, message: 'Missing ?ownerType=' }
  if (ownerType === 'platform') return { ok: true, owner: { type: 'platform' } }
  if (
    ownerType !== 'user' &&
    ownerType !== 'company' &&
    ownerType !== 'workspace'
  ) {
    return { ok: false, message: `Unknown ownerType '${ownerType}'` }
  }
  if (!ownerId) {
    return {
      ok: false,
      message: `ownerType=${ownerType} requires ?ownerId=`,
    }
  }
  return { ok: true, owner: { type: ownerType, id: ownerId } }
}

function parseOwnerFromBody(body: unknown): {
  ok: true
  owner: ProviderOwner
} | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Missing body' }
  }
  const { ownerType, ownerId } = body as {
    ownerType?: unknown
    ownerId?: unknown
  }
  if (typeof ownerType !== 'string') {
    return { ok: false, message: 'Missing ownerType' }
  }
  if (ownerType === 'platform') return { ok: true, owner: { type: 'platform' } }
  if (
    ownerType !== 'user' &&
    ownerType !== 'company' &&
    ownerType !== 'workspace'
  ) {
    return { ok: false, message: `Unknown ownerType '${ownerType}'` }
  }
  if (typeof ownerId !== 'string' || ownerId.length === 0) {
    return {
      ok: false,
      message: `ownerType=${ownerType} requires ownerId`,
    }
  }
  return { ok: true, owner: { type: ownerType, id: ownerId } }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  return withInternalError(async () => {
    const viewer = await buildViewerFromHeader(request)
    if (!viewer) {
      return errorResponse('AUTH_REQUIRED', 'Authentication required.', 401)
    }

    const ownerParse = parseOwnerFromQuery(request.nextUrl.searchParams)
    if (!ownerParse.ok) {
      return errorResponse('INVALID_OWNER', ownerParse.message)
    }

    // Read access: viewer must be able to act on the owner.
    // For user-owned this is self. For company-owned this is
    // any active membership.
    const { isOwnerActor } = await import('@/lib/providers/access')
    if (!isOwnerActor(viewer, ownerParse.owner)) {
      return errorResponse(
        'FORBIDDEN_OWNER',
        'You do not have access to this owner\u2019s connections.',
        403,
      )
    }

    const connections = await listConnectionsForOwner(ownerParse.owner)
    return success(connections)
  })
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  return withInternalError(async () => {
    const viewer = await buildViewerFromHeader(request)
    if (!viewer) {
      return errorResponse('AUTH_REQUIRED', 'Authentication required.', 401)
    }

    const body = await request.json()

    const ownerParse = parseOwnerFromBody(body)
    if (!ownerParse.ok) {
      return errorResponse('INVALID_OWNER', ownerParse.message)
    }
    const owner = ownerParse.owner

    const provider =
      typeof body.provider === 'string' ? (body.provider as ProviderKey) : null
    if (!provider || !isKnownProvider(provider)) {
      return errorResponse(
        'UNKNOWN_PROVIDER',
        `Unknown provider '${String(body.provider)}'.`,
      )
    }
    if (typeof body.externalAccountId !== 'string') {
      return errorResponse('INVALID_INPUT', 'Missing externalAccountId.')
    }

    // Capability gate: viewer must be the owner-admin (manage
    // rights). The pure predicate runs on the static owner +
    // viewer; we don't need to consult the registry here because
    // `canConnectProvider` already does.
    if (!canConnectProvider(viewer, provider, owner)) {
      return errorResponse(
        'FORBIDDEN_CONNECT',
        'You cannot connect this provider for this owner.',
        403,
      )
    }

    // Status is intentionally NOT taken from the body. A new
    // connection always lands as 'pending' from the public API —
    // the only path to 'active' is a server-side OAuth callback
    // that can prove the viewer actually authorized the upstream
    // account. Without this, an authenticated user could POST
    // `status: 'active'` and downstream capability predicates
    // (`canUseBillingProvider` etc.) would silently return true
    // for a connection that has no real upstream credential.
    const result = await createConnection({
      provider,
      owner,
      external_account_id: body.externalAccountId,
      account_label: body.accountLabel ?? null,
      status: 'pending',
      granted_scopes: Array.isArray(body.grantedScopes) ? body.grantedScopes : [],
      created_by_user_id: viewer.user!.id,
      metadata:
        body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    })

    if (!result.ok) {
      return errorResponse(result.error.code, result.error.message)
    }
    return success(result.connection, 201)
  })
}
