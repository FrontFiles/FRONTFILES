/**
 * Frontfiles — KMS adapter factory (NR-D10, F3)
 *
 * Resolves the configured KMS adapter. v1 always returns
 * `StubKmsAdapter`. v1.1 / NR-G5 introduces driver selection
 * (analogous to `FFF_STORAGE_DRIVER` and the scanner adapter
 * factory) gated on env vars like `KMS_DRIVER='gcp'`.
 *
 * Module-level cache: parsing the PEM on each call is non-trivial,
 * and the adapter holds key material once loaded. Cleared via
 * `_resetKmsAdapterCache()` from tests only.
 *
 * Spec cross-references:
 *   - directives/NR-D10-signing-keys-receipts.md §F3
 *   - src/lib/scanner/index.ts (factory pattern precedent)
 */

import { StubKmsAdapter } from './stub-adapter'
import type { KmsAdapter } from './types'

export type {
  KmsAdapter,
  KmsKeyRef,
  SignInput,
  SignOutput,
} from './types'
export { KmsError } from './types'
export { StubKmsAdapter } from './stub-adapter'

let cachedAdapter: KmsAdapter | null = null

/**
 * Returns the configured KMS adapter, instantiating on first call.
 * Throws `KmsError('config')` when the underlying adapter rejects
 * its env config (e.g. `NEWSROOM_SIGNING_KEY_PRIVATE` unset).
 *
 * v1: always `StubKmsAdapter`. The factory exists now to keep the
 * v1.1 swap to a real adapter caller-side-invisible — receipt
 * minting paths (F4) call `getKmsAdapter()` and never need to
 * change.
 */
export function getKmsAdapter(): KmsAdapter {
  if (cachedAdapter !== null) return cachedAdapter
  cachedAdapter = new StubKmsAdapter()
  return cachedAdapter
}

/**
 * Test-only helper. Clears the module-level cache so a vitest
 * `beforeEach` can rebuild the adapter under different env-var
 * configurations. Not exported through the package's public
 * surface; `_` prefix flags internal use.
 */
export function _resetKmsAdapterCache(): void {
  cachedAdapter = null
}
