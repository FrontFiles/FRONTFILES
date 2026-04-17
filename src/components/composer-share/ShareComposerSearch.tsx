// ═══════════════════════════════════════════════════════════════
// FFF Sharing — Composer Search Rail
//
// The "what to attach" picker. Two filters:
//   - Mine | All     — author scope
//   - Assets | Stories | Articles | Collections — entity kind
//
// Every row clicks-to-select; the picked entity is mirrored in
// `picked` and pushed back via `onPick`. Selection is single-
// item (one attachment per post — that's the spec).
//
// Search is a simple substring match against `title`. Cheap
// enough to run on every keystroke against the seed dataset.
// ═══════════════════════════════════════════════════════════════

'use client'

import { useMemo, useState } from 'react'
import * as s from '@/lib/post/styles'
import type { PostAttachmentType } from '@/lib/db/schema'
import { publicAssets } from '@/data/assets'
import { stories } from '@/data/stories'
import { articles } from '@/data/articles'
import { collections } from '@/data/collections'
import { creatorMap } from '@/data/creators'
import type { SessionUser } from '@/lib/user-context'

export interface ComposerEntity {
  kind: PostAttachmentType
  id: string
}

interface ShareComposerSearchProps {
  sessionUser: SessionUser
  picked: ComposerEntity | null
  onPick: (entity: ComposerEntity) => void
  /** Locked picker (used in repost mode). */
  disabled?: boolean
}

type ScopeFilter = 'mine' | 'all'
type KindFilter = 'all' | 'asset' | 'story' | 'article' | 'collection'

interface SearchResult {
  kind: PostAttachmentType
  id: string
  title: string
  subtitle: string
  thumbnail: string | null
  ownerCreatorId: string
}

export function ShareComposerSearch({
  sessionUser,
  picked,
  onPick,
  disabled = false,
}: ShareComposerSearchProps) {
  const [scope, setScope] = useState<ScopeFilter>('mine')
  const [kind, setKind] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')

  const results = useMemo(
    () => buildResults({ sessionUser, scope, kind, query }),
    [sessionUser, scope, kind, query],
  )

  return (
    <div className="flex flex-col min-h-0 bg-[var(--post-surface)]">
      {/* Scope toggle ───────────────────────────── */}
      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        <span className={s.railSectionLabel}>Pick something to share</span>
        <div className="flex items-center gap-1 p-1 bg-[var(--post-surface-nested)] rounded-[var(--post-chip-radius)] border border-[var(--post-border)]">
          <ScopeButton
            active={scope === 'mine'}
            onClick={() => setScope('mine')}
            disabled={disabled}
            label="Mine"
          />
          <ScopeButton
            active={scope === 'all'}
            onClick={() => setScope('all')}
            disabled={disabled}
            label="All"
          />
        </div>

        {/* Kind filters ─────────────────────────── */}
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              ['all', 'All'],
              ['asset', 'Assets'],
              ['story', 'Stories'],
              ['article', 'Articles'],
              ['collection', 'Collections'],
            ] as [KindFilter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              disabled={disabled}
              className={
                kind === k
                  ? 'h-7 px-2.5 rounded-[var(--post-chip-radius)] bg-[var(--post-accent-tint)] text-[var(--post-accent)] post-type-chip'
                  : 'h-7 px-2.5 rounded-[var(--post-chip-radius)] text-[var(--post-text-meta)] post-type-chip hover:text-[var(--post-text-primary)]'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input ─────────────────────────── */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title…"
          disabled={disabled}
          className="w-full h-9 px-3 post-type-body-compact text-[var(--post-text-primary)] bg-[var(--post-surface-nested)] border border-[var(--post-border)] rounded-[var(--post-chip-radius)] focus:outline-none focus:border-[var(--post-accent)] disabled:opacity-50"
        />
      </div>

      {/* Result list ─────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        {results.length === 0 ? (
          <div className="post-type-empty text-[var(--post-text-meta)] py-6 text-center">
            Nothing matches.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((r) => {
              const isPicked = picked?.kind === r.kind && picked.id === r.id
              return (
                <button
                  key={`${r.kind}:${r.id}`}
                  type="button"
                  onClick={() => onPick({ kind: r.kind, id: r.id })}
                  disabled={disabled}
                  className={
                    'flex items-stretch gap-3 p-2 text-left rounded-[var(--post-embed-radius)] border transition-colors ' +
                    (isPicked
                      ? 'border-[var(--post-accent)] bg-[var(--post-accent-tint)]'
                      : 'border-[var(--post-border)] hover:border-[var(--post-border-hover)] hover:bg-[var(--post-surface-nested)]')
                  }
                >
                  <div className="w-14 h-14 shrink-0 rounded-[var(--post-thumb-radius)] bg-[var(--post-surface-nested)] border border-[var(--post-border)] overflow-hidden flex items-center justify-center relative">
                    {r.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="post-type-meta-compact text-[var(--post-text-disabled)] uppercase">
                        {r.kind.slice(0, 4)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5 py-0.5">
                    <span className="post-type-embed-title text-[var(--post-text-primary)] line-clamp-2">
                      {r.title}
                    </span>
                    <span className="post-type-meta-compact text-[var(--post-text-meta)] uppercase">
                      {r.kind} · {r.subtitle}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Filter and result building ───────────────────────────────

function buildResults({
  sessionUser,
  scope,
  kind,
  query,
}: {
  sessionUser: SessionUser
  scope: ScopeFilter
  kind: KindFilter
  query: string
}): SearchResult[] {
  const q = query.trim().toLowerCase()
  const me = sessionUser.id
  const out: SearchResult[] = []

  // Assets
  if (kind === 'all' || kind === 'asset') {
    for (const a of publicAssets) {
      if (scope === 'mine' && a.creatorId !== me) continue
      if (q && !a.title.toLowerCase().includes(q)) continue
      out.push({
        kind: 'asset',
        id: a.id,
        title: a.title,
        subtitle: creatorMap[a.creatorId]?.name ?? 'Unknown',
        thumbnail: a.thumbnailRef
          ? `/api/media/${a.id}?ctx=thumbnail`
          : null,
        ownerCreatorId: a.creatorId,
      })
    }
  }

  // Stories
  if (kind === 'all' || kind === 'story') {
    for (const story of stories) {
      if (scope === 'mine' && story.creatorId !== me) continue
      if (q && !story.title.toLowerCase().includes(q)) continue
      out.push({
        kind: 'story',
        id: story.id,
        title: story.title,
        subtitle: `${story.assetIds.length} assets · ${
          creatorMap[story.creatorId]?.name ?? 'Unknown'
        }`,
        thumbnail: story.heroAssetId
          ? `/api/media/${story.heroAssetId}?ctx=thumbnail`
          : null,
        ownerCreatorId: story.creatorId,
      })
    }
  }

  // Articles
  if (kind === 'all' || kind === 'article') {
    for (const article of articles) {
      if (scope === 'mine' && !article.sourceCreatorIds.includes(me)) continue
      if (q && !article.title.toLowerCase().includes(q)) continue
      const ownerId = article.sourceCreatorIds[0] ?? ''
      out.push({
        kind: 'article',
        id: article.id,
        title: article.title,
        subtitle: `Article · ${
          creatorMap[ownerId]?.name ?? 'Editorial'
        }`,
        thumbnail: article.heroAssetId
          ? `/api/media/${article.heroAssetId}?ctx=thumbnail`
          : null,
        ownerCreatorId: ownerId,
      })
    }
  }

  // Collections
  if (kind === 'all' || kind === 'collection') {
    for (const collection of collections) {
      if (scope === 'mine' && collection.curatorId !== me) continue
      if (q && !collection.title.toLowerCase().includes(q)) continue
      const firstAssetId = collection.assetIds[0]
      out.push({
        kind: 'collection',
        id: collection.id,
        title: collection.title,
        subtitle: `${collection.assetIds.length} items · ${
          creatorMap[collection.curatorId]?.name ?? 'Curator'
        }`,
        thumbnail: firstAssetId
          ? `/api/media/${firstAssetId}?ctx=thumbnail`
          : null,
        ownerCreatorId: collection.curatorId,
      })
    }
  }

  return out
}

// ─── Scope toggle button ─────────────────────────────────────

function ScopeButton({
  active,
  onClick,
  disabled,
  label,
}: {
  active: boolean
  onClick: () => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? 'flex-1 h-7 px-3 rounded-[var(--post-chip-radius)] bg-[var(--post-surface)] border border-[var(--post-border)] post-type-chip text-[var(--post-text-primary)]'
          : 'flex-1 h-7 px-3 rounded-[var(--post-chip-radius)] post-type-chip text-[var(--post-text-meta)] hover:text-[var(--post-text-primary)]'
      }
    >
      {label}
    </button>
  )
}
