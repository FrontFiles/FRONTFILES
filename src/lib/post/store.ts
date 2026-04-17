// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Posts Store
//
// Mirrors the `src/lib/identity/store.ts` dual-mode pattern:
//   - Supabase configured  → real DB queries
//   - Supabase not configured → in-memory Maps seeded from
//                               `src/data/posts.ts` at first read.
//
// This module is the ONLY place post rows should be read from
// or written to. UI code, hooks, and server actions must go
// through the functions exported here.
//
// Phase 2 (this session): the read paths and the mock-write
// paths are real and identical in shape to the Supabase path.
// The Supabase path is implemented but conditionally executed
// only when env vars are present — so a deploy that flips
// `NEXT_PUBLIC_SUPABASE_URL` on becomes the production cutover
// without any UI-side change.
// ═══════════════════════════════════════════════════════════════

import { isSupabaseConfigured } from '@/lib/db/client'
import type { PostRow, PostAttachmentType } from '@/lib/db/schema'
import type {
  HydratedPostResult,
  PostInput,
  PostValidationResult,
} from './types'
import { hydratePost, hydratePosts } from './hydrate'
import { validatePostInput } from './validation'

// ─── In-memory store (dev/test mode) ──────────────────────────

const postStore = new Map<string, PostRow>()
let _seedLoaded = false

async function ensureSeedLoaded(): Promise<void> {
  if (_seedLoaded) return
  _seedLoaded = true
  // Lazy import to avoid a circular dependency between the store
  // and the seed (matches the identity/store pattern).
  const { postRows } = await import('@/data/posts')
  for (const row of postRows) {
    postStore.set(row.id, row)
  }
}

// ─── Read paths ──────────────────────────────────────────────

/**
 * Default cap for "most recent N posts" feed reads. Tuned to
 * a single screenful of cards plus a comfortable scroll buffer.
 * Pagination lands in a follow-up; this cap keeps the prototype
 * cheap.
 */
export const DEFAULT_FEED_LIMIT = 100

/**
 * Return the raw row for a post id, or null.
 */
export async function getPostRow(postId: string): Promise<PostRow | null> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return postStore.get(postId) ?? null
  }

  const client = await db()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('id', postId)
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(`posts store: getPostRow failed (${error.message})`)
  }
  return (data as PostRow | null) ?? null
}

/**
 * Author feed — every published post authored by this user,
 * newest first. Returns raw rows so the caller can choose
 * whether to hydrate (the API route does that, the store
 * stays pure).
 */
export async function getAuthorPostRows(
  authorUserId: string,
): Promise<PostRow[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return Array.from(postStore.values())
      .filter(
        (p) =>
          p.author_user_id === authorUserId && p.status === 'published',
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
  }

  const client = await db()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('author_user_id', authorUserId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(DEFAULT_FEED_LIMIT)
  if (error) {
    throw new Error(`posts store: getAuthorPostRows failed (${error.message})`)
  }
  return (data ?? []) as PostRow[]
}

/**
 * Hydrated variant of `getAuthorPostRows` for callers that want
 * UI-ready cards in one round-trip.
 */
export async function getAuthorFeed(
  authorUserId: string,
): Promise<HydratedPostResult[]> {
  const rows = await getAuthorPostRows(authorUserId)
  return hydratePosts(rows)
}

/**
 * Most-recent-N posts across the whole platform, newest first.
 * Powers the global feed. Bounded by `DEFAULT_FEED_LIMIT` so
 * the wire payload stays small.
 */
export async function listRecentPostRows(
  limit: number = DEFAULT_FEED_LIMIT,
): Promise<PostRow[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return Array.from(postStore.values())
      .filter((p) => p.status === 'published')
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, limit)
  }

  const client = await db()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) {
    throw new Error(`posts store: listRecentPostRows failed (${error.message})`)
  }
  return (data ?? []) as PostRow[]
}

/**
 * Reverse-attachment feed — every published post that attaches
 * to this entity. Used by the "X shared this on Frontfiles"
 * rail on content detail pages.
 */
export async function getPostsByAttachment(
  attachmentType: PostAttachmentType,
  attachmentId: string,
): Promise<PostRow[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return Array.from(postStore.values())
      .filter(
        (p) =>
          p.status === 'published' &&
          p.attachment_type === attachmentType &&
          p.attachment_id === attachmentId,
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
  }

  const client = await db()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .eq('attachment_type', attachmentType)
    .eq('attachment_id', attachmentId)
    .order('published_at', { ascending: false })
    .limit(DEFAULT_FEED_LIMIT)
  if (error) {
    throw new Error(`posts store: getPostsByAttachment failed (${error.message})`)
  }
  return (data ?? []) as PostRow[]
}

/**
 * Backwards-compatible alias kept so older call sites keep
 * working while we migrate them. New code should call
 * `getPostsByAttachment` directly.
 */
export async function getFeedForAttachment(
  attachmentType: PostAttachmentType,
  attachmentId: string,
): Promise<HydratedPostResult[]> {
  const rows = await getPostsByAttachment(attachmentType, attachmentId)
  return hydratePosts(rows)
}

/**
 * Every published repost whose parent is `postId`. Powers the
 * "Reposts" rail on the post detail page.
 */
export async function getRepostsOfRows(
  postId: string,
): Promise<PostRow[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return Array.from(postStore.values())
      .filter(
        (p) =>
          p.status === 'published' && p.repost_of_post_id === postId,
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
  }

  const client = await db()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .eq('repost_of_post_id', postId)
    .order('published_at', { ascending: false })
    .limit(DEFAULT_FEED_LIMIT)
  if (error) {
    throw new Error(`posts store: getRepostsOfRows failed (${error.message})`)
  }
  return (data ?? []) as PostRow[]
}

/**
 * Repost-history snapshot for the validator's duplicate probe.
 * Returns the rows the author has authored as reposts (i.e.
 * `repost_of_post_id IS NOT NULL`). Tiny payload; matches the
 * partial unique index exactly.
 */
export async function getAuthorRepostRows(
  authorUserId: string,
): Promise<PostRow[]> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    return Array.from(postStore.values()).filter(
      (p) =>
        p.author_user_id === authorUserId &&
        p.status === 'published' &&
        p.repost_of_post_id !== null,
    )
  }

  const client = await db()
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('author_user_id', authorUserId)
    .eq('status', 'published')
    .not('repost_of_post_id', 'is', null)
  if (error) {
    throw new Error(`posts store: getAuthorRepostRows failed (${error.message})`)
  }
  return (data ?? []) as PostRow[]
}

/**
 * Hydrate a single post id for the detail page.
 * Returns null when the row doesn't exist at all (hard 404);
 * returns a failing `HydratedPostResult` when the row exists
 * but hydration fails.
 */
export async function getHydratedPost(
  postId: string,
): Promise<HydratedPostResult | null> {
  const row = await getPostRow(postId)
  if (!row) return null
  return hydratePost(row)
}

// ─── Lazy Supabase client accessor ──────────────────────────
//
// Mirrors the identity store's `db()` helper. Lazy-imported so
// callers that never reach Supabase mode don't pay the cost of
// loading `@supabase/supabase-js` (which isn't installed in dev).

async function db() {
  const { getSupabaseClient } = await import('@/lib/db/client')
  return getSupabaseClient()
}

// ─── Write paths ─────────────────────────────────────────────

/**
 * Discriminated result for `createPost`. Mirrors the validator's
 * shape so the composer can render inline errors without
 * mapping any error codes itself.
 */
export type CreatePostResult =
  | { ok: true; row: PostRow }
  | { ok: false; validation: PostValidationResult & { ok: false } }

/**
 * Create a new original or repost.
 *
 * Behaviour:
 *   1. Validate the input against the canonical service-layer
 *      validator (`validatePostInput`). On failure, return the
 *      typed error list — no DB write happens.
 *   2. Materialise the row. The `attachment_creator_user_id` is
 *      snapshotted at write time (preserving attribution if the
 *      source entity is later removed or renamed).
 *   3. Persist:
 *        - Mock mode → push into the in-memory `postStore`.
 *        - Supabase mode → INSERT through the typed client.
 *   4. Return the persisted row.
 *
 * The two persistence paths are intentionally identical in
 * shape so the UI never branches on storage backend.
 */
export async function createPost(
  input: PostInput,
): Promise<CreatePostResult> {
  // Snapshot the author's existing repost history for the
  // duplicate-repost probe. Mock mode: in-memory pool. Supabase
  // mode: a one-shot SELECT against the partial-unique index.
  // Skipped entirely for originals to keep originals as cheap
  // as one INSERT round-trip.
  let existingRows: PostRow[] = []
  if (input.repostOf !== null) {
    existingRows = await getAuthorRepostRows(input.authorId)
  }

  const validation = validatePostInput(input, existingRows)
  if (!validation.ok) {
    return { ok: false, validation }
  }

  const now = new Date().toISOString()
  const id = mockPostId()

  // The validator already resolved the attachment + creator
  // when it accepted the input, but we re-resolve here so the
  // snapshot is independent of the validator's internal state.
  const attachmentCreatorUserId = input.attachment.creatorUserId

  const row: PostRow = {
    id,
    author_user_id: input.authorId,
    body: input.body.trim(),
    attachment_type: input.attachment.kind,
    attachment_id: input.attachment.id,
    attachment_creator_user_id: attachmentCreatorUserId,
    repost_of_post_id: input.repostOf?.id ?? null,
    visibility: 'public',
    status: 'published',
    published_at: now,
    created_at: now,
    updated_at: now,
  }

  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    postStore.set(row.id, row)
    return { ok: true, row }
  }

  // Supabase path — let the DB pick the id and timestamps so the
  // SQL CHECK + DEFAULT contracts run authoritatively.
  const client = await db()
  const { data, error } = await client
    .from('posts')
    .insert({
      author_user_id: row.author_user_id,
      body: row.body,
      attachment_type: row.attachment_type,
      attachment_id: row.attachment_id,
      attachment_creator_user_id: row.attachment_creator_user_id,
      repost_of_post_id: row.repost_of_post_id,
      visibility: row.visibility,
      status: row.status,
    })
    .select('*')
    .single()
  if (error || !data) {
    // Map the most common Postgres failure (23505 = unique
    // violation) to the typed validation error so the composer
    // shows the same inline message the pre-flight would have.
    if (error?.code === '23505') {
      return {
        ok: false,
        validation: {
          ok: false,
          errors: [
            {
              code: 'duplicate_repost',
              message: 'You have already reposted this post.',
            },
          ],
        },
      }
    }
    throw new Error(
      `posts store: Supabase insert failed (${error?.message ?? 'no row returned'})`,
    )
  }
  return { ok: true, row: data as PostRow }
}

/**
 * Soft-remove a post (author-only). Status moves to 'removed'.
 * Mock mode mutates the in-memory row; Supabase mode UPDATEs the
 * row by id. The hydrator already filters out non-published
 * statuses, so the feed will skip this post on the next read.
 */
export async function removePost(postId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await ensureSeedLoaded()
    const row = postStore.get(postId)
    if (!row) return
    postStore.set(postId, {
      ...row,
      status: 'removed',
      updated_at: new Date().toISOString(),
    })
    return
  }

  const client = await db()
  const { error } = await client
    .from('posts')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) {
    throw new Error(`posts store: Supabase update failed (${error.message})`)
  }
}

// ─── Mock id ─────────────────────────────────────────────────

function mockPostId(): string {
  return `post_${Math.random().toString(36).slice(2, 10)}`
}

// ─── Test helpers ────────────────────────────────────────────
//
// Exposed for vitest only — lets tests isolate the store by
// seeding a custom row set and clearing between cases. Not
// consumed by any production code path.

export const __testing = {
  async reset(): Promise<void> {
    postStore.clear()
    _seedLoaded = false
  },
  async seed(rows: PostRow[]): Promise<void> {
    postStore.clear()
    for (const row of rows) postStore.set(row.id, row)
    _seedLoaded = true
  },
}
