// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: adapter resolver
//
// Single source of truth for adapter ↔ provider key mapping.
// Service code calls `getAdapter(key)` instead of importing
// adapters directly so the canonical webhook route can route
// untrusted input through one switch.
//
// Adding a new provider:
//   1. Implement the `ProviderAdapter` contract under `./`
//   2. Add a case to `getAdapter` below
//   3. Register the descriptor in `../registry.ts`
// ═══════════════════════════════════════════════════════════════

import type { ProviderAdapter, ProviderKey } from '../types'
import { stripeAdapter } from './stripe'
import {
  googleCalendarAdapter,
  googleDriveAdapter,
  googleGmailAdapter,
  googleIdentityAdapter,
} from './google'

export function getAdapter(key: ProviderKey): ProviderAdapter {
  switch (key) {
    case 'stripe':
      return stripeAdapter
    case 'google_identity':
      return googleIdentityAdapter
    case 'google_drive':
      return googleDriveAdapter
    case 'google_gmail':
      return googleGmailAdapter
    case 'google_calendar':
      return googleCalendarAdapter
  }
}

export {
  stripeAdapter,
  googleCalendarAdapter,
  googleDriveAdapter,
  googleGmailAdapter,
  googleIdentityAdapter,
}
