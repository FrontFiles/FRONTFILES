// ═══════════════════════════════════════════════════════════════
// Frontfiles — External Providers: shared types
//
// The single canonical vocabulary for the provider foundation.
//
// Re-exports the SQL-mirror row types from `@/lib/db/schema` so
// every consumer of this module imports from one place. Adds the
// adapter-facing types (descriptors, capabilities, normalized
// webhook events, signature results) that don't have a SQL
// representation.
//
// Naming rules:
//
//   - `ProviderKey` is a typed union of the providers in the
//     application registry. Adding a new provider means:
//       1. extend the union here
//       2. add the descriptor to `lib/providers/registry.ts`
//       3. (optionally) add an adapter under
//          `lib/providers/adapters/`.
//
//   - `ProviderCapability` is what the rest of the app branches
//     on. Product code asks "is there a billing provider for
//     this owner?" — never "is Stripe connected?".
//
//   - `ProviderOwner` is the polymorphic identity of who owns a
//     connection. Helpers on this type live in
//     `lib/providers/access.ts`.
// ═══════════════════════════════════════════════════════════════

import type {
  ExternalConnectionRow,
  ExternalCredentialRow,
  ExternalWebhookEventRow,
  ProviderAuthType,
  ProviderCategory,
  ProviderConnectionStatus,
  ProviderOwnerType,
  ProviderWebhookProcessingStatus,
  ProviderWebhookSignatureStatus,
} from '@/lib/db/schema'

export type {
  ExternalConnectionRow,
  ExternalCredentialRow,
  ExternalWebhookEventRow,
  ProviderAuthType,
  ProviderCategory,
  ProviderConnectionStatus,
  ProviderOwnerType,
  ProviderWebhookProcessingStatus,
  ProviderWebhookSignatureStatus,
}

// ─── Provider keys ───────────────────────────────────────────

/**
 * Closed union of every provider the app knows about. Adding a
 * new provider means extending this union AND registering it in
 * `lib/providers/registry.ts`. Two layers of safety: the
 * compiler catches missing registry entries and the registry
 * test catches the inverse.
 *
 * Stripe is one PROVIDER but spans two CAPABILITIES (`billing`
 * via PaymentIntents and `payouts` via Connect). Google is one
 * OAuth provider but appears as multiple PROVIDERS here because
 * each Google service has its own auth scopes, owner expectations,
 * and risk profile (Drive ≠ Gmail ≠ Calendar). Treating them
 * as separate keys makes it impossible for a Drive scope grant
 * to silently unlock Gmail.
 */
export type ProviderKey =
  | 'stripe'
  | 'google_identity'
  | 'google_drive'
  | 'google_gmail'
  | 'google_calendar'

// ─── Capabilities ────────────────────────────────────────────

/**
 * What a provider is FOR. Product code branches on this, not on
 * `ProviderKey`. When a future provider (say Mux for video
 * delivery) declares the `storage` capability, every existing
 * `canUseStorageProvider` consumer picks it up automatically.
 */
export type ProviderCapability =
  | 'billing'
  | 'payouts'
  | 'identity_verification'
  | 'storage'
  | 'mail_send'
  | 'mail_read'
  | 'calendar_read'
  | 'calendar_write'
  | 'sso'
  | 'analytics_read'
  | 'crm_sync'

// ─── Owner ───────────────────────────────────────────────────

/**
 * Who owns a connection. The SQL model uses two columns
 * (`owner_type`, `owner_id`); this discriminated union is the
 * application-side analog so callers never have to manually
 * pair the two.
 *
 * `platform` connections carry no `id` — they belong to the
 * Frontfiles installation as a whole (e.g. the Frontfiles
 * Stripe platform account, the Frontfiles outbound mail
 * transport).
 */
export type ProviderOwner =
  | { type: 'user'; id: string }
  | { type: 'company'; id: string }
  | { type: 'workspace'; id: string }
  | { type: 'platform' }

// ─── Provider descriptor ─────────────────────────────────────

/**
 * The static, code-defined facts about a provider. Lives in the
 * registry. The descriptor is the answer to "what does this
 * provider DO" — runtime state about a specific connection
 * lives in `ExternalConnectionRow`.
 */
export interface ProviderDescriptor {
  key: ProviderKey
  /** Display name. Surfaced in admin/dev UIs only — product code never reads this. */
  display_name: string
  category: ProviderCategory
  auth_type: ProviderAuthType
  /** Owner kinds the provider supports. */
  owner_modes: ReadonlyArray<ProviderOwnerType>
  /** Capabilities this provider exposes. */
  capabilities: ReadonlyArray<ProviderCapability>
  /**
   * How the provider's secret material is stored. `env` is
   * acceptable for the Frontfiles platform account only —
   * per-user / per-company secrets must use a real secret
   * manager (`secret_manager`).
   */
  secret_storage_kind: 'env' | 'secret_manager' | 'none'
  /**
   * Whether the provider emits webhooks the canonical ledger
   * should accept. False for read-only providers like Drive
   * file pickers that don't push events.
   */
  emits_webhooks: boolean
}

// ─── Connection (decorated row) ──────────────────────────────

/**
 * Application-facing connection shape. Wraps the SQL row in the
 * typed `ProviderOwner` discriminated union so callers don't
 * juggle `owner_type` + `owner_id` pairs.
 */
export interface ExternalConnection {
  id: string
  provider: ProviderKey
  category: ProviderCategory
  owner: ProviderOwner
  external_account_id: string
  account_label: string | null
  status: ProviderConnectionStatus
  granted_scopes: string[]
  created_by_user_id: string | null
  created_at: string
  revoked_at: string | null
  last_synced_at: string | null
  metadata: Record<string, unknown>
}

// ─── Adapter contracts ───────────────────────────────────────

/**
 * Outcome of a webhook signature check. `unverified` means the
 * adapter could not run a check (no signing secret configured,
 * no headers present); the ingestion boundary still records the
 * event so an operator can investigate.
 */
export type WebhookSignatureResult =
  | { status: 'verified' }
  | { status: 'rejected'; reason: string }
  | { status: 'unverified'; reason: string }

/**
 * Raw webhook input the canonical ingestion accepts. Adapters
 * read `headers` + `rawBody` to verify, then return a
 * `NormalizedWebhookEvent` for the ledger.
 */
export interface RawWebhookInput {
  provider: ProviderKey
  headers: Record<string, string>
  /** Raw body text — adapters must NOT receive a parsed object. */
  rawBody: string
}

/**
 * Adapter-normalized event. Whatever the wire format, the
 * canonical ledger stores it in this shape.
 */
export interface NormalizedWebhookEvent {
  external_event_id: string
  event_type: string
  payload: Record<string, unknown>
  /**
   * Resolved connection id, when the adapter can determine which
   * connection an event belongs to. Adapters typically leave this
   * null and surface `external_account_id_hint` instead — the
   * canonical webhook pipeline runs the `(provider,
   * external_account_id)` lookup once via
   * `findConnectionByExternalAccount` and writes the resulting id
   * into the ledger row.
   */
  connection_id: string | null
  /**
   * Provider-account hint the adapter pulls out of the payload
   * (Stripe `account` for Connect events, Stripe `data.object.id`
   * for top-level Account events, Google `sub` if present, etc.).
   * The pipeline uses this to resolve `connection_id` against the
   * `idx_external_connections_external_account` index. NULL means
   * the adapter could not extract a stable account hint and the
   * event will be persisted with `connection_id=null`.
   */
  external_account_id_hint?: string | null
}

/**
 * Adapter contract. Every provider that needs to plug into the
 * canonical foundation implements this interface. Adapters are
 * STATELESS — they never reach into the store directly. Service
 * functions in `lib/providers/service.ts` call adapters and
 * write the results.
 */
export interface ProviderAdapter {
  /** Static facts about this provider. */
  descriptor: ProviderDescriptor

  /**
   * Verify a webhook signature. Implementations MUST treat the
   * input as untrusted until this returns `verified`.
   */
  verifyWebhookSignature(input: RawWebhookInput): WebhookSignatureResult

  /**
   * Normalize an already-verified raw payload into the canonical
   * event shape. Throws if the payload is malformed (the
   * caller catches and stores `signature_status='rejected'` with
   * the error message).
   */
  normalizeWebhookEvent(input: RawWebhookInput): NormalizedWebhookEvent

  /**
   * Build the URL the user is redirected to in order to start
   * the connection flow. Returns null for providers that don't
   * have an interactive start (`api_key`, `none`).
   */
  buildAuthorizationUrl(input: {
    owner: ProviderOwner
    redirectUri: string
    state: string
    scopes?: string[]
  }): string | null

  /**
   * Map a raw provider account object into the canonical
   * `(external_account_id, account_label)` pair. Used when the
   * connection is first created.
   */
  normalizeAccountIdentity(rawAccount: unknown): {
    external_account_id: string
    account_label: string | null
  }
}

// ─── Service input shapes ────────────────────────────────────

export interface CreateConnectionInput {
  provider: ProviderKey
  owner: ProviderOwner
  external_account_id: string
  account_label?: string | null
  status?: ProviderConnectionStatus
  granted_scopes?: string[]
  created_by_user_id?: string | null
  metadata?: Record<string, unknown>
}

export interface RecordWebhookEventInput {
  provider: ProviderKey
  external_event_id: string
  event_type: string
  payload: Record<string, unknown>
  signature_status: ProviderWebhookSignatureStatus
  connection_id?: string | null
}

export interface MarkWebhookProcessedInput {
  id: string
  outcome: 'succeeded' | 'failed' | 'dead_letter'
  error_message?: string | null
}
