// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Browser API Client
//
// The single boundary between React land and the server-side
// posts store. UI components NEVER call `lib/post/store.ts`
// directly — they call these wrappers, which fetch from the
// `/api/posts/*` route handlers and return typed results.
//
// Why this layer exists:
//
//   1. The store uses a Supabase service-role client. That key
//      must never be sent to the browser. Routing through
//      `/api/posts/*` keeps secrets server-side.
//
//   2. The dual-mode mock/Supabase swap is hidden from the UI.
//      Components see a stable function signature regardless of
//      backend.
//
//   3. There is exactly one place to add caching, retries, or
//      auth headers later — this file.
//
// ═══════════════════════════════════════════════════════════════

import type {
  PostRow,
  PostAttachmentType,
} from '@/lib/db/schema'
import type {
  PostInput,
  PostValidationError,
} from './types'

// ─── Wire shapes ─────────────────────────────────────────────

interface ApiSuccess<T> {
  data: T
}

interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

type ApiResponse<T> = ApiSuccess<T> | ApiError

function isError<T>(r: ApiResponse<T>): r is ApiError {
  return (r as ApiError).error !== undefined
}

/**
 * Generic fetch wrapper. Forces JSON parsing, attaches an
 * editorial error message on failure, and never throws raw
 * `Error` objects with stack traces to UI consumers.
 */
async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiSuccess<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (cause) {
    throw new PostsClientError(
      'NETWORK_ERROR',
      'Could not reach the Frontfiles API.',
      cause,
    )
  }

  let json: ApiResponse<T>
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    throw new PostsClientError(
      'BAD_RESPONSE',
      `Unexpected response from ${url} (status ${res.status}).`,
    )
  }

  if (isError(json)) {
    throw new PostsClientError(json.error.code, json.error.message, json.error.details)
  }
  return json
}

/**
 * Typed exception thrown by every browser-client function.
 * Components catch it to render an inline error state. Carries
 * the canonical error code so the UI can branch on it without
 * string parsing.
 */
export class PostsClientError extends Error {
  readonly code: string
  readonly details?: unknown
  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.code = code
    this.details = details
    this.name = 'PostsClientError'
  }
}

// ─── Reads ───────────────────────────────────────────────────

/**
 * Most-recent-N posts across the whole platform. Powers the
 * global feed.
 */
export async function fetchRecentPosts(
  limit?: number,
): Promise<PostRow[]> {
  const url = new URL('/api/posts/feed', baseUrl())
  if (limit) url.searchParams.set('limit', String(limit))
  const res = await apiFetch<PostRow[]>(url.pathname + url.search)
  return res.data
}

/**
 * Every published post by a single user. Powers the user feed
 * page and the profile preview blocks.
 */
export async function fetchPostsByAuthor(
  authorUserId: string,
): Promise<PostRow[]> {
  const url = new URL('/api/posts', baseUrl())
  url.searchParams.set('authorUserId', authorUserId)
  const res = await apiFetch<PostRow[]>(url.pathname + url.search)
  return res.data
}

/**
 * Every published post that attaches to a single Frontfiles
 * entity. Powers the (deferred) "X people shared this on
 * Frontfiles" rail on detail pages.
 */
export async function fetchPostsByAttachment(
  type: PostAttachmentType,
  id: string,
): Promise<PostRow[]> {
  const url = new URL('/api/posts', baseUrl())
  url.searchParams.set('attachmentType', type)
  url.searchParams.set('attachmentId', id)
  const res = await apiFetch<PostRow[]>(url.pathname + url.search)
  return res.data
}

/**
 * Single post by id. Returns null when the API responds with
 * 404 (post genuinely missing) so the detail page can render
 * its not-found state without try/catching.
 */
export async function fetchPostById(id: string): Promise<PostRow | null> {
  try {
    const res = await apiFetch<PostRow>(`/api/posts/${encodeURIComponent(id)}`)
    return res.data
  } catch (err) {
    if (err instanceof PostsClientError && err.code === 'POST_NOT_FOUND') {
      return null
    }
    throw err
  }
}

/**
 * Every published repost of a single post id. Powers the
 * "Reposts" rail on the post detail page.
 */
export async function fetchRepostsOf(postId: string): Promise<PostRow[]> {
  const res = await apiFetch<PostRow[]>(
    `/api/posts/${encodeURIComponent(postId)}/reposts`,
  )
  return res.data
}

// ─── Writes ──────────────────────────────────────────────────

/**
 * Result of a `submitPost` call. Mirrors the store's
 * `CreatePostResult` so the composer doesn't need to know
 * about HTTP status codes.
 */
export type SubmitPostResult =
  | { ok: true; row: PostRow }
  | { ok: false; errors: PostValidationError[] }

/**
 * Submit a new post (original or repost). Validation errors
 * come back as `{ ok: false, errors }`; any other failure
 * (network, 500, malformed response) bubbles as a thrown
 * `PostsClientError` so the composer can switch behaviour.
 *
 * Carries the acting user id in `x-frontfiles-user-id`. Until
 * a real session cookie lands, the server uses this header to
 * verify the author of the new row matches the caller. When
 * real auth ships, swap this for a JWT cookie and remove the
 * header from the client.
 */
export async function submitPost(
  input: PostInput,
): Promise<SubmitPostResult> {
  let res: Response
  try {
    res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-frontfiles-user-id': input.authorId,
      },
      body: JSON.stringify({
        authorId: input.authorId,
        body: input.body,
        attachment: input.attachment,
        repostOf: input.repostOf,
      }),
    })
  } catch (cause) {
    throw new PostsClientError(
      'NETWORK_ERROR',
      'Could not reach the Frontfiles API.',
      cause,
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new PostsClientError(
      'BAD_RESPONSE',
      `Unexpected response from /api/posts (status ${res.status}).`,
    )
  }

  // 201 → success, 422 → typed validation failure, other → throw.
  if (res.status === 201) {
    const data = (json as { data: PostRow }).data
    return { ok: true, row: data }
  }
  if (res.status === 422) {
    const errors = (json as {
      error: { details?: PostValidationError[] }
    }).error.details
    return { ok: false, errors: errors ?? [] }
  }
  const err = (json as { error?: { code?: string; message?: string } }).error
  throw new PostsClientError(
    err?.code ?? 'API_ERROR',
    err?.message ?? `Request failed (status ${res.status}).`,
  )
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Resolve the base URL for `new URL` constructions in environments
 * where `window.location` is not defined yet (e.g. SSR cold-call
 * by a client component). Returns a placeholder origin that is
 * safe to pass to `URL` — the pathname/search are what the fetch
 * actually uses.
 */
function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost'
}
