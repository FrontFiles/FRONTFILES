/**
 * Onboarding — mock services.
 *
 * A single helper the live onboarding flow actually calls:
 * `checkUsernameAvailability`, used by `Phase0CreateAccount`
 * to validate the chosen handle before writing a `users` row
 * through the identity store.
 *
 * This module stays client-safe and side-effect free so the
 * Phase 0 form can call it without importing server-only code.
 * When a real availability endpoint is wired, swap this module
 * for a thin fetch wrapper of the same signature and no call
 * site has to change.
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const TAKEN_USERNAMES = ['frontfiles', 'admin', 'sarahchen']

export async function checkUsernameAvailability(
  username: string,
): Promise<{ available: boolean; reason: string | null }> {
  await delay(600)
  if (TAKEN_USERNAMES.includes(username.toLowerCase())) {
    return { available: false, reason: 'This username is already taken' }
  }
  return { available: true, reason: null }
}
