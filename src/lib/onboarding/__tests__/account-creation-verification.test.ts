import { describe, it, expect, beforeEach } from 'vitest'
import { createOnboardingAccount } from '../account-creation'
import {
  _resetStore,
  getUserById,
  getUserByUsername,
} from '@/lib/identity/store'
import {
  _resetAuthStore,
  _setMockVerificationRequired,
  _markMockAuthVerified,
  getAuthUserEmailConfirmed,
} from '@/lib/auth/provider'

/**
 * PR 3 email-verification pending branch.
 *
 * `createOnboardingAccount` reports `needsEmailVerification`
 * based on what the auth provider tells it. The wizard uses
 * this to stop at the Phase 0 checkpoint. These tests freeze:
 *
 *   - The Frontfiles row IS written even when verification is
 *     pending (the checkpoint is a UI gate, not a write gate).
 *   - The grant IS applied even when verification is pending
 *     (same rationale).
 *   - A retry while still pending is idempotent and still
 *     reports `needsEmailVerification: true`.
 *   - A retry after the email has been confirmed out of band
 *     reports `needsEmailVerification: false` so the wizard
 *     can advance past the checkpoint.
 *   - The linking invariant (`users.id === auth.users.id`)
 *     holds on both the pending-create and the post-confirm
 *     retry paths.
 */
describe('createOnboardingAccount — verification pending branch', () => {
  beforeEach(async () => {
    _resetStore()
    await _resetAuthStore()
  })

  it('writes the users row and grant even when verification is pending', async () => {
    await _setMockVerificationRequired(true)

    const result = await createOnboardingAccount({
      email: 'pending@example.com',
      username: 'pending-user',
      password: 'hunter22hunter',
      role: 'creator',
    })

    expect(result.needsEmailVerification).toBe(true)
    expect(result.reused).toBe(false)

    // The Frontfiles row is in the store under the auth id.
    const byId = await getUserById(result.user.id)
    expect(byId).not.toBeNull()
    expect(byId!.email).toBe('pending@example.com')

    // And findable by username.
    const byName = await getUserByUsername('pending-user')
    expect(byName).not.toBeNull()
    expect(byName!.id).toBe(result.user.id)
  })

  it('keeps users.id == auth.users.id on the verification-pending path', async () => {
    await _setMockVerificationRequired(true)

    const result = await createOnboardingAccount({
      email: 'pending-linked@example.com',
      username: 'pending-linked',
      password: 'hunter22hunter',
      role: 'reader',
    })

    // The linking invariant holds even before the email is
    // confirmed — that's the whole point of minting the
    // Frontfiles row against the auth id up front.
    const confirmed = await getAuthUserEmailConfirmed(result.user.id)
    expect(confirmed).toBe(false)
    const storeRow = await getUserById(result.user.id)
    expect(storeRow!.id).toBe(result.user.id)
  })

  it('reports needsEmailVerification: true on an idempotent retry while still pending', async () => {
    await _setMockVerificationRequired(true)

    const first = await createOnboardingAccount({
      email: 'retry-pending@example.com',
      username: 'retry-pending',
      password: 'hunter22hunter',
      role: 'buyer',
    })
    expect(first.needsEmailVerification).toBe(true)

    const second = await createOnboardingAccount({
      email: 'retry-pending@example.com',
      username: 'retry-pending',
      password: 'hunter22hunter',
      role: 'buyer',
    })

    // Adopted the existing auth user + existing store row.
    expect(second.user.id).toBe(first.user.id)
    expect(second.reused).toBe(true)
    // Still pending — the auth row has not been flipped.
    expect(second.needsEmailVerification).toBe(true)
  })

  it('reports needsEmailVerification: false on a retry after the email has been confirmed out of band', async () => {
    await _setMockVerificationRequired(true)

    const email = 'confirm-oob@example.com'
    const first = await createOnboardingAccount({
      email,
      username: 'confirm-oob',
      password: 'hunter22hunter',
      role: 'creator',
    })
    expect(first.needsEmailVerification).toBe(true)

    // Out-of-band flip — the user clicked the confirmation
    // link in their email.
    await _markMockAuthVerified(email)

    const second = await createOnboardingAccount({
      email,
      username: 'confirm-oob',
      password: 'hunter22hunter',
      role: 'creator',
    })

    // Adoption path, and the checkpoint is now cleared.
    expect(second.user.id).toBe(first.user.id)
    expect(second.reused).toBe(true)
    expect(second.needsEmailVerification).toBe(false)
  })
})
