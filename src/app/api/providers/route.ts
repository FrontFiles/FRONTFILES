// ═══════════════════════════════════════════════════════════════
// GET /api/providers — registry snapshot
//
// Public, read-only. Returns the static descriptors for every
// registered provider. Safe to expose to the browser because it
// contains no secrets — it's the same data the application
// bundles into the typed `ProviderKey` union.
// ═══════════════════════════════════════════════════════════════

import { listProviders } from '@/lib/providers/registry'
import { success, withInternalError } from '@/lib/providers/api-helpers'

export async function GET() {
  return withInternalError(async () => {
    return success(listProviders())
  })
}
