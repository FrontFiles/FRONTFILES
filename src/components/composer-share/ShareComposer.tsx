// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Share Composer (modal)
//
// The professional share composer. Three regions:
//   - Search rail (left): scrollable picker of Frontfiles
//     entities the viewer can attach to a post. Filters: Mine /
//     All. Sub-filters: All / Assets / Stories / Articles /
//     Collections.
//   - Editor (center): body textarea, attribution preview,
//     inline validation errors.
//   - Live preview (right): renders the exact `PostCard` the
//     feed will show once the post is published.
//
// Spec guardrails enforced:
//   - Must attach to a real Frontfiles entity (the publish
//     button is disabled until an attachment is picked).
//   - Body length capped (validator + visible counter).
//   - Cannot share a non-public asset.
//   - Repost-with-context flow uses the same shell — the
//     composer accepts `repostOf` as a starting state.
//
// Mock-write only: the composer calls `useDraftStore().addDraft`
// which inserts the row into the in-memory unified pool. The
// global feed reads through that same pool, so the new post
// appears at the top of For You / Following / the user feed
// instantly.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useMemo, useState } from 'react'
import * as s from '@/lib/post/styles'
import {
  useDraftStore,
  type DraftInput,
} from '@/lib/post/draft-store'
import type {
  PostAttachmentType,
  PostRow,
} from '@/lib/db/schema'
import type {
  HydratedPostResult,
  PostValidationError,
} from '@/lib/post/types'
import { POST_BODY_MAX } from '@/lib/post/validation'
import { hydratePost } from '@/lib/post/hydrate'
import { assetMap } from '@/data/assets'
import { storyMap } from '@/data/stories'
import { articleMap } from '@/data/articles'
import { collectionMap } from '@/data/collections'
import { PostCard, PostCardUnavailable } from '@/components/post/PostCard'
import { ShareComposerSearch, type ComposerEntity } from './ShareComposerSearch'
import type { SessionUser } from '@/lib/user-context'

/**
 * Resolve the canonical creator id of a Frontfiles entity for
 * the live preview row. Mirrors `resolveAttachmentCreator` in
 * draft-store but stays local so the composer doesn't import
 * a non-typed helper. Without this the preview's attribution
 * chip would show the post AUTHOR, not the original creator.
 */
function resolvePreviewCreator(
  type: PostAttachmentType,
  id: string,
): string {
  switch (type) {
    case 'asset':
      return assetMap[id]?.creatorId ?? ''
    case 'story':
      return storyMap[id]?.creatorId ?? ''
    case 'article':
      return articleMap[id]?.sourceCreatorIds[0] ?? ''
    case 'collection':
      return collectionMap[id]?.curatorId ?? ''
  }
}

interface ShareComposerProps {
  open: boolean
  onClose: () => void
  sessionUser: SessionUser
  /** Optional starting state for "Share with context" / repost. */
  initialRepostOf?: PostRow | null
  /** Notification fired after a successful publish. */
  onPublished?: (row: PostRow) => void
}

export function ShareComposer({
  open,
  onClose,
  sessionUser,
  initialRepostOf = null,
  onPublished,
}: ShareComposerProps) {
  const { addDraft } = useDraftStore()

  const [body, setBody] = useState('')
  const [picked, setPicked] = useState<ComposerEntity | null>(null)
  const [errors, setErrors] = useState<PostValidationError[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Reset on close → reopen so a previous composition doesn't bleed.
  useEffect(() => {
    if (!open) {
      setBody('')
      setPicked(null)
      setErrors([])
      setSubmitting(false)
    }
  }, [open])

  // If the composer was opened in repost mode, lock the
  // attachment to the repost target and seed the search rail.
  useEffect(() => {
    if (open && initialRepostOf) {
      setPicked({
        kind: initialRepostOf.attachment_type,
        id: initialRepostOf.attachment_id,
      })
    }
  }, [open, initialRepostOf])

  // Build a hydrated preview card from the current state. We
  // never persist the preview — it's just `hydratePost` over a
  // throwaway PostRow stamped with the live composer state.
  // CRITICAL: `attachment_creator_user_id` must be the original
  // creator of the attached entity, NOT the post author. The
  // hydrator reads that field directly to render the attribution
  // chip — a wrong value here makes a cross-author share look
  // like the post author owns the underlying work.
  const previewResult: HydratedPostResult | null = useMemo(() => {
    if (!picked) return null
    const attachmentCreator = resolvePreviewCreator(picked.kind, picked.id)
    const row: PostRow = {
      id: 'preview',
      author_user_id: sessionUser.id,
      body,
      attachment_type: picked.kind,
      attachment_id: picked.id,
      attachment_creator_user_id: attachmentCreator || sessionUser.id,
      repost_of_post_id: initialRepostOf?.id ?? null,
      visibility: 'public',
      status: 'published',
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return hydratePost(row)
  }, [picked, body, sessionUser.id, initialRepostOf])

  if (!open) return null

  const tooLong = body.length > POST_BODY_MAX
  const canPublish = !!picked && !tooLong && !submitting

  async function handlePublish() {
    if (!picked) return
    setSubmitting(true)
    const input: DraftInput = {
      authorUserId: sessionUser.id,
      body,
      attachmentType: picked.kind,
      attachmentId: picked.id,
      repostOfPostId: initialRepostOf?.id ?? null,
    }
    const result = await addDraft(input)
    if (!result.ok) {
      setErrors(result.errors)
      setSubmitting(false)
      return
    }
    onPublished?.(result.row)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Share to Frontfiles feed"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="m-0 sm:m-4 lg:m-10 w-full max-w-[1180px] bg-[var(--post-surface)] border border-[var(--post-border)] sm:rounded-[var(--post-card-radius)] overflow-hidden flex flex-col">
        {/* Header ─────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--post-divider)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="post-type-meta text-[var(--post-text-meta)] uppercase">
              {initialRepostOf ? 'Repost with context' : 'Share to Frontfiles'}
            </span>
            <span className="font-mono post-type-meta-compact text-[var(--post-text-disabled)]">
              · As {sessionUser.displayName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="post-type-meta text-[var(--post-text-meta)] uppercase hover:text-[var(--post-accent)] transition-colors"
            aria-label="Close composer"
          >
            Cancel
          </button>
        </header>

        {/* Body grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] flex-1 min-h-0 overflow-hidden">
          {/* Search rail ─────────────────────────────── */}
          <ShareComposerSearch
            sessionUser={sessionUser}
            picked={picked}
            onPick={setPicked}
            disabled={!!initialRepostOf}
          />

          {/* Editor ──────────────────────────────────── */}
          <div className="flex flex-col min-h-0 border-x border-[var(--post-divider)] overflow-y-auto">
            <div className="p-5 flex flex-col gap-4 min-h-full">
              {initialRepostOf && (
                <div className="post-type-meta text-[var(--post-text-meta)] uppercase border-l-2 border-[var(--post-accent)] pl-3 py-1">
                  Reposting Frontfiles post · {initialRepostOf.id}
                </div>
              )}

              <label className="post-type-meta text-[var(--post-text-meta)] uppercase">
                Your context
              </label>
              <textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  if (errors.length) setErrors([])
                }}
                placeholder={
                  initialRepostOf
                    ? 'Add an editorial note explaining why this is worth seeing…'
                    : 'Add a note explaining the context of what you\u2019re sharing. (Optional, but encouraged.)'
                }
                rows={10}
                maxLength={POST_BODY_MAX + 200}
                className="w-full resize-none post-type-body text-[var(--post-text-primary)] bg-[var(--post-surface-nested)] border border-[var(--post-border)] rounded-[var(--post-embed-radius)] p-4 focus:outline-none focus:border-[var(--post-accent)] transition-colors"
              />

              <div className="flex items-center justify-between">
                <span className="post-type-meta text-[var(--post-text-meta)] uppercase">
                  Frontfiles-native context
                </span>
                <span
                  className={
                    tooLong
                      ? 'font-mono post-type-meta text-red-500'
                      : 'font-mono post-type-meta text-[var(--post-text-disabled)]'
                  }
                >
                  {body.length} / {POST_BODY_MAX}
                </span>
              </div>

              {/* Inline error bag */}
              {errors.length > 0 && (
                <div className="border border-red-300 bg-red-50 rounded-[var(--post-embed-radius)] p-3 flex flex-col gap-1">
                  {errors.map((err) => (
                    <p
                      key={err.code}
                      className="post-type-body-compact text-red-700"
                    >
                      {err.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="border border-dashed border-[var(--post-border)] rounded-[var(--post-embed-radius)] p-3">
                <p className="post-type-meta text-[var(--post-text-meta)] uppercase mb-1">
                  Provenance reminder
                </p>
                <p className="post-type-empty text-[var(--post-text-secondary)]">
                  Frontfiles preserves attribution at every level. The original creator&rsquo;s name will appear on every reshare of this post — even if you remove yours later.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[var(--post-divider)] flex items-center justify-between bg-[var(--post-surface-nested)]">
              <span className="post-type-meta text-[var(--post-text-meta)] uppercase">
                Visibility · Public
              </span>
              <button
                type="button"
                disabled={!canPublish}
                onClick={handlePublish}
                className={
                  canPublish
                    ? 'h-10 px-5 rounded-[var(--post-chip-radius)] bg-[var(--post-accent)] text-white post-type-action-label uppercase hover:bg-[var(--post-accent-hover)] transition-colors'
                    : 'h-10 px-5 rounded-[var(--post-chip-radius)] bg-[var(--post-surface-nested)] border border-[var(--post-border)] text-[var(--post-text-disabled)] post-type-action-label uppercase cursor-not-allowed'
                }
              >
                {submitting
                  ? 'Publishing…'
                  : initialRepostOf
                  ? 'Publish repost'
                  : 'Publish to feed'}
              </button>
            </div>
          </div>

          {/* Live preview ───────────────────────────── */}
          <div className="bg-[var(--post-surface-nested)] overflow-y-auto p-5 hidden lg:flex flex-col gap-3">
            <span className={s.railSectionLabel}>Live preview</span>
            {previewResult ? (
              previewResult.ok ? (
                <PostCard card={previewResult.card} />
              ) : (
                <PostCardUnavailable
                  placeholder={previewResult.placeholder}
                  reason={previewResult.reason}
                />
              )
            ) : (
              <div className="border border-dashed border-[var(--post-border)] rounded-[var(--post-card-radius)] p-8 flex flex-col items-center gap-2 text-center">
                <p className="post-type-meta text-[var(--post-text-meta)] uppercase">
                  Nothing picked yet
                </p>
                <p className="post-type-empty text-[var(--post-text-meta)]">
                  Pick something from the left rail to see the live preview here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
