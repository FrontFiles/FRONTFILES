// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Client Draft Store (React surface)
//
// Thin React-side cache over the `/api/posts/*` endpoints.
//
// Responsibilities:
//
//   1. Hold the unified post pool that powers the global feed,
//      the user feed page, the post detail page, the profile
//      preview, and the frontfolio Posts tab. The pool is
//      hydrated from Supabase via `fetchRecentPosts` on mount;
//      newly-composed posts are spliced in optimistically.
//
//   2. Expose `addDraft(input)` which validates + persists via
//      the `/api/posts` endpoint and updates the pool. Returns
//      typed validation errors so the composer renders inline.
//
//   3. Lift the share composer overlay state so any "Share"
//      button anywhere in the app can open it via `openComposer`.
//
//   4. Surface loading + error state to consumers so feed
//      surfaces can show a skeleton during the initial fetch
//      and an editorial error block on failure.
//
// This module deliberately re-exports the canonical
// `PostValidationError` / `PostInput` types from the service
// layer instead of inventing its own — there is exactly one
// validation vocabulary in the codebase.
// ═══════════════════════════════════════════════════════════════

'use client'

// (touched to invalidate the turbopack SSR cache after the
// seed → API-client refactor)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  PostRow,
  PostAttachmentType,
} from '@/lib/db/schema'
import { assetMap } from '@/data/assets'
import { storyMap } from '@/data/stories'
import { articleMap } from '@/data/articles'
import { collectionMap } from '@/data/collections'
import { creatorMap } from '@/data/creators'
import { fetchRecentPosts, submitPost, PostsClientError } from './client'
import { isFffSharingEnabled } from '@/lib/flags'
import type { PostInput, PostValidationError } from './types'

// ─── Re-export the canonical vocabulary ─────────────────────

export type { PostInput, PostValidationError } from './types'

// ─── Composer-friendly input shape ───────────────────────────
//
// The composer doesn't know about the seed adjacency for repost
// validation — it just knows the chosen entity + body. We keep
// this input shape for the React layer, then translate it to a
// `PostInput` (the canonical service-layer shape) inside
// `addDraft` so callers don't need to thread row references.

export interface DraftInput {
  authorUserId: string
  body: string
  attachmentType: PostAttachmentType
  attachmentId: string
  /** Set when this is a repost-with-context. */
  repostOfPostId: string | null
}

export type DraftResult =
  | { ok: true; row: PostRow }
  | { ok: false; errors: PostValidationError[] }

// ─── React context ───────────────────────────────────────────

interface DraftStoreState {
  /**
   * The unified post pool every feed surface reads from. The
   * server-side store fills this on first mount via
   * `fetchRecentPosts`; new posts written by `addDraft` are
   * spliced in optimistically and the pool is refreshed in the
   * background to reconcile with the canonical state.
   */
  unifiedRows: PostRow[]
  /** True while the initial fetch is in flight. */
  loading: boolean
  /**
   * Set when the initial fetch fails. Consumers render a small
   * editorial "couldn't load the feed" block. Cleared on the
   * next successful refresh.
   */
  loadError: string | null
  /** Force a fresh fetch from the server. */
  refresh: () => Promise<void>
  /**
   * Compose + persist a new post. Validates via the canonical
   * service-layer validator (server-side), persists via the
   * `/api/posts` endpoint, and updates the pool. Returns typed
   * validation errors so the composer can render inline messages.
   */
  addDraft: (input: DraftInput) => Promise<DraftResult>
  /** Number of drafts created in this session. */
  draftCount: number

  // ── Composer overlay state (lifted into context) ─────────
  composerOpen: boolean
  composerRepostOf: PostRow | null
  openComposer: (opts?: { repostOf?: PostRow | null }) => void
  closeComposer: () => void
}

const DraftStoreContext = createContext<DraftStoreState | null>(null)

// ─── Attachment → creator resolution ─────────────────────────
//
// The validator needs the canonical creator id of the attachment
// so the snapshot stored on the row preserves attribution. We
// resolve it here in the React layer (mock mode) so the call to
// `createPost` stays a one-shot. In Supabase mode this is
// replaced with a server-side join.

function resolveAttachmentCreatorId(
  type: PostAttachmentType,
  id: string,
): string | null {
  switch (type) {
    case 'asset':
      return assetMap[id]?.creatorId ?? null
    case 'story':
      return storyMap[id]?.creatorId ?? null
    case 'article':
      return articleMap[id]?.sourceCreatorIds[0] ?? null
    case 'collection':
      return collectionMap[id]?.curatorId ?? null
  }
}

// ─── Provider ────────────────────────────────────────────────

export function DraftStoreProvider({ children }: { children: ReactNode }) {
  // Server-fetched canonical pool. `serverRows` is the live
  // snapshot from `/api/posts/feed`; `localDrafts` is the
  // optimistic insert buffer for posts created in-session that
  // the next refresh hasn't acknowledged yet.
  const [serverRows, setServerRows] = useState<PostRow[]>([])
  const [localDrafts, setLocalDrafts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Composer overlay state — lifted into the store so any
  // "Share" button anywhere in the app can call openComposer().
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerRepostOf, setComposerRepostOf] = useState<PostRow | null>(
    null,
  )

  // Single read path for the React layer. Normalises any error
  // (network, 5xx, malformed JSON) into a short editorial
  // message so consumers don't unwrap exceptions themselves.
  // Short-circuits to a no-op when the FFF Sharing feature flag
  // is off — the provider stays mounted (so `useDraftStore`
  // never throws for incidental consumers) but performs zero
  // network work.
  const refresh = useCallback(async () => {
    if (!isFffSharingEnabled()) {
      setServerRows([])
      setLoadError(null)
      setLoading(false)
      return
    }
    try {
      const rows = await fetchRecentPosts()
      setServerRows(rows)
      // Drop any local draft whose id now appears in the server
      // snapshot — it has been acknowledged. Keep drafts that
      // haven't landed yet (this happens during the brief gap
      // between the optimistic insert and the next refresh).
      setLocalDrafts((current) => {
        const serverIds = new Set(rows.map((r) => r.id))
        return current.filter((r) => !serverIds.has(r.id))
      })
      setLoadError(null)
    } catch (err) {
      const message =
        err instanceof PostsClientError
          ? err.message
          : 'Could not load the Frontfiles feed.'
      setLoadError(message)
      // Server-side log so failures are auditable. The UI
      // surfaces a softer message via `loadError`.
      console.error('[DraftStore] refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch on mount.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Unified pool — drafts are placed at the top so a freshly
  // composed post appears immediately in every feed surface.
  // Once the next refresh acknowledges the row, it migrates
  // into `serverRows` and the duplicate is removed by the
  // refresh handler above.
  const unifiedRows = useMemo(
    () => [...localDrafts, ...serverRows],
    [localDrafts, serverRows],
  )

  const addDraft = useCallback(
    async (input: DraftInput): Promise<DraftResult> => {
      // Translate the React-layer input to the canonical
      // service-layer `PostInput`. Attachment creator resolution
      // is a client-side cache lookup against the same seed maps
      // the rest of the app uses; the server does not trust this
      // value (the validator re-resolves on its side).
      const creatorUserId = resolveAttachmentCreatorId(
        input.attachmentType,
        input.attachmentId,
      )
      if (!creatorUserId && input.attachmentId) {
        return {
          ok: false,
          errors: [
            {
              code: 'attachment_not_found',
              message: 'That entity is not in the Frontfiles index.',
            },
          ],
        }
      }

      // For reposts, the server validator runs its own self-
      // repost + duplicate-repost checks against the canonical
      // row set. We only need to thread the parent row through
      // so the validator can read `parent.author_user_id`.
      const parentRow = input.repostOfPostId
        ? unifiedRows.find((r) => r.id === input.repostOfPostId) ?? null
        : null

      const postInput: PostInput = {
        authorId: input.authorUserId,
        body: input.body,
        attachment: {
          kind: input.attachmentType,
          id: input.attachmentId,
          creatorUserId: creatorUserId ?? '',
        },
        repostOf: parentRow,
      }

      try {
        const result = await submitPost(postInput)
        if (!result.ok) {
          return { ok: false, errors: result.errors }
        }
        // Optimistic insert at the top of the pool. The next
        // refresh deduplicates against the server snapshot.
        setLocalDrafts((current) => [result.row, ...current])
        // Fire-and-forget refresh so the canonical snapshot
        // catches up. Errors are silent because the optimistic
        // insert already succeeded.
        void refresh()
        return { ok: true, row: result.row }
      } catch (err) {
        const message =
          err instanceof PostsClientError
            ? err.message
            : 'Could not publish your post. Try again.'
        return {
          ok: false,
          errors: [{ code: 'attachment_not_found', message }],
        }
      }
    },
    [unifiedRows, refresh],
  )

  const openComposer = useCallback(
    (opts?: { repostOf?: PostRow | null }) => {
      setComposerRepostOf(opts?.repostOf ?? null)
      setComposerOpen(true)
    },
    [],
  )

  const closeComposer = useCallback(() => {
    setComposerOpen(false)
    setComposerRepostOf(null)
  }, [])

  const value: DraftStoreState = useMemo(
    () => ({
      unifiedRows,
      loading,
      loadError,
      refresh,
      addDraft,
      draftCount: localDrafts.length,
      composerOpen,
      composerRepostOf,
      openComposer,
      closeComposer,
    }),
    [
      unifiedRows,
      loading,
      loadError,
      refresh,
      addDraft,
      localDrafts.length,
      composerOpen,
      composerRepostOf,
      openComposer,
      closeComposer,
    ],
  )

  return (
    <DraftStoreContext.Provider value={value}>
      {children}
    </DraftStoreContext.Provider>
  )
}

export function useDraftStore(): DraftStoreState {
  const ctx = useContext(DraftStoreContext)
  if (!ctx) {
    throw new Error(
      'useDraftStore must be used within a <DraftStoreProvider>',
    )
  }
  return ctx
}

// ─── Helpers consumed by the composer's preview ─────────────

/**
 * Return a stable display name for an attachment id, used by
 * the search rail to show the picked entity in the live
 * composer preview before the row is built.
 */
export function previewLabelForAttachment(
  type: PostAttachmentType,
  id: string,
): string {
  switch (type) {
    case 'asset':
      return assetMap[id]?.title ?? id
    case 'story':
      return storyMap[id]?.title ?? id
    case 'article':
      return articleMap[id]?.title ?? id
    case 'collection':
      return collectionMap[id]?.title ?? id
  }
}

/** Resolve the original creator's display name (for attribution preview). */
export function previewAttributionForAttachment(
  type: PostAttachmentType,
  id: string,
): string | null {
  const creatorId = resolveAttachmentCreatorId(type, id)
  if (!creatorId) return null
  return creatorMap[creatorId]?.name ?? null
}
