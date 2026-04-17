// ═══════════════════════════════════════════════════════════════
// FRONTFILES — FFF Sharing Post Seed Dataset
//
// Mirrors the pattern used in `src/data/shares.ts`: a small,
// deterministic in-memory seed that Module 3 (service layer)
// reads through an in-memory store adapter.
//
// IMPORTANT — this has NOTHING to do with `src/data/shares.ts`.
// Share records are preview-link tokens for unauthenticated
// external viewers. Posts are authenticated, in-product social
// feed objects. Keep the two domains strictly separate.
//
// Every seed post MUST attach to a real, public, published
// Frontfiles entity. The IDs below are cross-checked against
// `src/data/{assets,stories,articles,collections}.ts`:
//   - asset-001 / asset-004 → creator-001 (Marco Oliveira)
//   - story-002             → creator-002 (Ana Sousa)
//   - article-001           → sourceCreatorIds: ['creator-001']
//   - collection-001        → curatorId: 'creator-002'
// ═══════════════════════════════════════════════════════════════

import type {
  PostRow,
  PostAttachmentType,
  PostStatus,
  PostVisibility,
} from '@/lib/db/schema'

// ─── Re-export the DB types so callers can import from @/data ───
// (matches the shares.ts pattern where ShareRecord is exported here).
export type { PostRow, PostAttachmentType, PostStatus, PostVisibility }

// ─── Seed helpers ──────────────────────────────────────────────

const T = (iso: string) => iso // just a readability alias

// ─── Seed rows ─────────────────────────────────────────────────
//
// Coverage checklist (per Module 2 spec):
//   [x] 4 originals, one per attachment type
//       post-001: asset
//       post-002: story
//       post-003: article        ← also: author != attachment creator
//       post-004: collection
//   [x] 3 reposts, including a repost-of-repost
//       post-006: repost of post-001
//       post-007: repost of post-006 (repost-of-repost)
//       post-008: repost of post-003
//   [x] 1 original with empty body
//       post-005: empty body, asset attachment
//   [x] 1 post where author_user_id !== attachment_creator_user_id
//       post-003: author creator-010 (session demo),
//                 attachment creator creator-001 (Marco)
// ═══════════════════════════════════════════════════════════════

export const postRows: PostRow[] = [
  // ── post-001 ── original, asset, author = attachment creator ─
  {
    id: 'post-001',
    author_user_id: 'creator-001',
    body: 'Third morning on the Sarandi levee. Water is still waist-high along the eastern blocks — the residents who came back yesterday are wading out again. This one is mine, shot at 08:40.',
    attachment_type: 'asset',
    attachment_id: 'asset-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-11T09:10:00Z'),
    created_at: T('2026-03-11T09:10:00Z'),
    updated_at: T('2026-03-11T09:10:00Z'),
  },

  // ── post-002 ── original, story, author = story creator ──────
  {
    id: 'post-002',
    author_user_id: 'creator-002',
    body: 'Putting the full confidence-vote Story together now. Twelve certified frames, two audio recordings from the corridor, and a 90-second walkthrough of how the vote fell. Sources in the captions.',
    attachment_type: 'story',
    attachment_id: 'story-002',
    attachment_creator_user_id: 'creator-002',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-12T14:22:00Z'),
    created_at: T('2026-03-12T14:22:00Z'),
    updated_at: T('2026-03-12T14:22:00Z'),
  },

  // ── post-003 ── original, article, AUTHOR != ATTACHMENT CREATOR
  {
    id: 'post-003',
    author_user_id: 'creator-010',
    body: 'Required reading if you covered the Guaíba flood from a newsroom. The evacuation-routes article ties four certified assets into a single map and explains exactly how the BR-290 collapse reshaped the displacement logistics. Big lift by Frontfiles Editorial with Marco\u2019s frames.',
    attachment_type: 'article',
    attachment_id: 'article-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-18T16:40:00Z'),
    created_at: T('2026-03-18T16:40:00Z'),
    updated_at: T('2026-03-18T16:40:00Z'),
  },

  // ── post-004 ── original, collection ─────────────────────────
  {
    id: 'post-004',
    author_user_id: 'creator-002',
    body: 'Pulled together a cross-border climate-displacement Collection this week. Four creators, four events — the Guaíba flood, Setúbal erosion, Marseille heatwave, and the Huelva wildfire aftermath. Editors can pull from any of them with one licence check.',
    attachment_type: 'collection',
    attachment_id: 'collection-001',
    attachment_creator_user_id: 'creator-002',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-19T11:05:00Z'),
    created_at: T('2026-03-19T11:05:00Z'),
    updated_at: T('2026-03-19T11:05:00Z'),
  },

  // ── post-005 ── original, empty body (silent share) ──────────
  {
    id: 'post-005',
    author_user_id: 'creator-001',
    body: '',
    attachment_type: 'asset',
    attachment_id: 'asset-004',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-20T07:30:00Z'),
    created_at: T('2026-03-20T07:30:00Z'),
    updated_at: T('2026-03-20T07:30:00Z'),
  },

  // ── post-006 ── repost of post-001 by Ana ────────────────────
  {
    id: 'post-006',
    author_user_id: 'creator-002',
    body: 'Marco\u2019s frame from Sarandi should be on every evacuation wire this afternoon. This is what the second-day water level actually looks like.',
    attachment_type: 'asset',
    attachment_id: 'asset-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: 'post-001',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-11T12:45:00Z'),
    created_at: T('2026-03-11T12:45:00Z'),
    updated_at: T('2026-03-11T12:45:00Z'),
  },

  // ── post-007 ── repost-of-repost: session demo reposts post-006
  {
    id: 'post-007',
    author_user_id: 'creator-010',
    body: 'Sharing Ana\u2019s boost of Marco. The Guaíba coverage on Frontfiles this week is the cleanest provenance chain I\u2019ve seen on any platform.',
    attachment_type: 'asset',
    attachment_id: 'asset-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: 'post-006',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-11T18:02:00Z'),
    created_at: T('2026-03-11T18:02:00Z'),
    updated_at: T('2026-03-11T18:02:00Z'),
  },

  // ── post-008 ── repost of post-003 by Marco ──────────────────
  {
    id: 'post-008',
    author_user_id: 'creator-001',
    body: 'Grateful the Frontfiles Editorial team surfaced this. The BR-290 collapse is still doing damage a week later.',
    attachment_type: 'article',
    attachment_id: 'article-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: 'post-003',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-19T08:15:00Z'),
    created_at: T('2026-03-19T08:15:00Z'),
    updated_at: T('2026-03-19T08:15:00Z'),
  },

  // ─── Module A expansion ─────────────────────────────────────
  // Adds ~20 additional published rows so the global feed has
  // enough coverage to demo Following / Relevant / For you tabs.
  // Every row is cross-checked against assets/stories/articles/
  // collections seeds and the followGraph in data/social.ts.
  // ════════════════════════════════════════════════════════════

  // ── post-009 ── original article-share, Dimitris (Evros)
  {
    id: 'post-009',
    author_user_id: 'creator-003',
    body: 'New piece on Evros border processing — three months tracking the contracted security pipeline. Two of the four sources cited here are certified Frontfiles assets so the chain holds end-to-end.',
    attachment_type: 'article',
    attachment_id: 'article-003',
    attachment_creator_user_id: 'creator-003',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-21T07:00:00Z'),
    created_at: T('2026-03-21T07:00:00Z'),
    updated_at: T('2026-03-21T07:00:00Z'),
  },

  // ── post-010 ── original story-share, Carmen (Andalusia)
  {
    id: 'post-010',
    author_user_id: 'creator-008',
    body: 'Closed the Almería drought story today. Eight infographic frames + a 6-minute walkthrough. The driest March on record and the data sits across two municipal water authorities — both were corroborated against the EU drought observatory.',
    attachment_type: 'story',
    attachment_id: 'story-005',
    attachment_creator_user_id: 'creator-008',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-22T11:18:00Z'),
    created_at: T('2026-03-22T11:18:00Z'),
    updated_at: T('2026-03-22T11:18:00Z'),
  },

  // ── post-011 ── repost of post-010 by Yara (cross-cluster)
  {
    id: 'post-011',
    author_user_id: 'creator-005',
    body: 'Carmen\u2019s drought work is a model for how we should be reporting heat events. The infographic discipline alone is worth the read.',
    attachment_type: 'story',
    attachment_id: 'story-005',
    attachment_creator_user_id: 'creator-008',
    repost_of_post_id: 'post-010',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-22T16:42:00Z'),
    created_at: T('2026-03-22T16:42:00Z'),
    updated_at: T('2026-03-22T16:42:00Z'),
  },

  // ── post-012 ── original asset-share, Lucia (Sicily)
  {
    id: 'post-012',
    author_user_id: 'creator-004',
    body: 'Court session adjourned again — fourth time this month. Filed this frame from the corridor at 11:20. The defendant\u2019s legal team is now refusing to confirm the next date.',
    attachment_type: 'asset',
    attachment_id: 'asset-034',
    attachment_creator_user_id: 'creator-004',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-23T11:25:00Z'),
    created_at: T('2026-03-23T11:25:00Z'),
    updated_at: T('2026-03-23T11:25:00Z'),
  },

  // ── post-013 ── original asset-share, Tomasz (Warsaw)
  {
    id: 'post-013',
    author_user_id: 'creator-006',
    body: 'Transit strike entered hour 14. Three frames from the Centralna interchange — the queues are now blocking the entire western arm of Marszałkowska. Filing the audio interviews tonight.',
    attachment_type: 'asset',
    attachment_id: 'asset-025',
    attachment_creator_user_id: 'creator-006',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-23T17:55:00Z'),
    created_at: T('2026-03-23T17:55:00Z'),
    updated_at: T('2026-03-23T17:55:00Z'),
  },

  // ── post-014 ── original collection-share, Tomasz curates
  {
    id: 'post-014',
    author_user_id: 'creator-006',
    body: 'Pulled together the strike-week visuals into one Collection. Editors who licensed yesterday\u2019s piece can pull from this without re-querying.',
    attachment_type: 'collection',
    attachment_id: 'collection-002',
    attachment_creator_user_id: 'creator-006',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-24T09:00:00Z'),
    created_at: T('2026-03-24T09:00:00Z'),
    updated_at: T('2026-03-24T09:00:00Z'),
  },

  // ── post-015 ── repost of post-014 by Elena (cluster reply)
  {
    id: 'post-015',
    author_user_id: 'creator-007',
    body: 'For anyone covering the Bucharest student bloc — Tomasz\u2019s strike Collection is a useful structural reference. Same provenance pattern, different city.',
    attachment_type: 'collection',
    attachment_id: 'collection-002',
    attachment_creator_user_id: 'creator-006',
    repost_of_post_id: 'post-014',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-24T14:30:00Z'),
    created_at: T('2026-03-24T14:30:00Z'),
    updated_at: T('2026-03-24T14:30:00Z'),
  },

  // ── post-016 ── original asset-share, Sarah (demo) covering Asia
  {
    id: 'post-016',
    author_user_id: 'creator-010',
    body: 'Filed from the Lantau evacuation corridor this morning. Wind gusts hit 142 km/h overnight. The shelter at Tung Chung is at capacity already — tracking the second wave of arrivals from the west coast villages.',
    attachment_type: 'asset',
    attachment_id: 'asset-115',
    attachment_creator_user_id: 'creator-010',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-25T08:00:00Z'),
    created_at: T('2026-03-25T08:00:00Z'),
    updated_at: T('2026-03-25T08:00:00Z'),
  },

  // ── post-017 ── empty-body silent share, Sarah
  {
    id: 'post-017',
    author_user_id: 'creator-010',
    body: '',
    attachment_type: 'asset',
    attachment_id: 'asset-116',
    attachment_creator_user_id: 'creator-010',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-25T08:12:00Z'),
    created_at: T('2026-03-25T08:12:00Z'),
    updated_at: T('2026-03-25T08:12:00Z'),
  },

  // ── post-018 ── original asset-share, Kofi (Accra)
  {
    id: 'post-018',
    author_user_id: 'creator-011',
    body: 'Election day frame from the Madina collation centre. Counting started two hours late after the third disputed ballot box. Filing the next set in the morning.',
    attachment_type: 'asset',
    attachment_id: 'asset-059',
    attachment_creator_user_id: 'creator-011',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-25T19:40:00Z'),
    created_at: T('2026-03-25T19:40:00Z'),
    updated_at: T('2026-03-25T19:40:00Z'),
  },

  // ── post-019 ── repost of post-018 by Sarah (flagship boost)
  {
    id: 'post-019',
    author_user_id: 'creator-010',
    body: 'Kofi has been the most reliable single-source feed on the Ghana count. Worth following if you\u2019re assigning anything from West Africa this cycle.',
    attachment_type: 'asset',
    attachment_id: 'asset-059',
    attachment_creator_user_id: 'creator-011',
    repost_of_post_id: 'post-018',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-25T22:11:00Z'),
    created_at: T('2026-03-25T22:11:00Z'),
    updated_at: T('2026-03-25T22:11:00Z'),
  },

  // ── post-020 ── original asset-share, Priya (Mumbai)
  {
    id: 'post-020',
    author_user_id: 'creator-012',
    body: 'Pre-monsoon humidity reading at the Dharavi clinic — the displacement camps haven\u2019t been re-stocked since last year\u2019s flooding. This is what a baseline looks like before the rain even starts.',
    attachment_type: 'asset',
    attachment_id: 'asset-063',
    attachment_creator_user_id: 'creator-012',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-26T06:30:00Z'),
    created_at: T('2026-03-26T06:30:00Z'),
    updated_at: T('2026-03-26T06:30:00Z'),
  },

  // ── post-021 ── original asset-share, Fatima (Amman)
  {
    id: 'post-021',
    author_user_id: 'creator-013',
    body: 'Border crossing at Jaber re-opened for two hours this morning. I have a frame I can\u2019t publish until the family clears the registration line — but the corridor itself is on the wire now.',
    attachment_type: 'asset',
    attachment_id: 'asset-075',
    attachment_creator_user_id: 'creator-013',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-26T13:05:00Z'),
    created_at: T('2026-03-26T13:05:00Z'),
    updated_at: T('2026-03-26T13:05:00Z'),
  },

  // ── post-022 ── original story-share, Marco (return to Sarandi)
  {
    id: 'post-022',
    author_user_id: 'creator-001',
    body: 'Day-six update from Sarandi. The waterline finally dropped below the levee crown overnight. Twelve new frames added to the Story; the sequence with the army engineers is the one I\u2019m most proud of from this assignment.',
    attachment_type: 'story',
    attachment_id: 'story-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-27T07:45:00Z'),
    created_at: T('2026-03-27T07:45:00Z'),
    updated_at: T('2026-03-27T07:45:00Z'),
  },

  // ── post-023 ── repost of post-022 by Sarah (flagship boost)
  {
    id: 'post-023',
    author_user_id: 'creator-010',
    body: 'Six days. Same levee. Marco is doing what we should all aspire to — staying on a single story long enough that the third week is the one that matters.',
    attachment_type: 'story',
    attachment_id: 'story-001',
    attachment_creator_user_id: 'creator-001',
    repost_of_post_id: 'post-022',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-27T11:20:00Z'),
    created_at: T('2026-03-27T11:20:00Z'),
    updated_at: T('2026-03-27T11:20:00Z'),
  },

  // ── post-024 ── original article-share, Yara (Marseille heat)
  {
    id: 'post-024',
    author_user_id: 'creator-005',
    body: 'New explainer on the Marseille hospital throughput issue. The triage data is now public and shows the heat events compounding three discrete failures in the night-shift staffing pipeline. Frontfiles certified the underlying frames last week.',
    attachment_type: 'article',
    attachment_id: 'article-004',
    attachment_creator_user_id: 'creator-005',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-28T10:00:00Z'),
    created_at: T('2026-03-28T10:00:00Z'),
    updated_at: T('2026-03-28T10:00:00Z'),
  },

  // ── post-025 ── original collection-share, Dimitris curates
  {
    id: 'post-025',
    author_user_id: 'creator-003',
    body: 'Compiled the border-week visuals into one Collection. The point isn\u2019t volume — it\u2019s that an editor can lift any one of them and the chain of custody holds.',
    attachment_type: 'collection',
    attachment_id: 'collection-003',
    attachment_creator_user_id: 'creator-003',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-28T15:50:00Z'),
    created_at: T('2026-03-28T15:50:00Z'),
    updated_at: T('2026-03-28T15:50:00Z'),
  },

  // ── post-026 ── original asset-share by Sarah, demoing self-share
  {
    id: 'post-026',
    author_user_id: 'creator-010',
    body: 'Posting a slow-news frame for the archive — semiconductor fabrication line, Hsinchu. Useful as a stock background for any of the supply-chain stories landing this quarter.',
    attachment_type: 'asset',
    attachment_id: 'asset-116',
    attachment_creator_user_id: 'creator-010',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-29T09:30:00Z'),
    created_at: T('2026-03-29T09:30:00Z'),
    updated_at: T('2026-03-29T09:30:00Z'),
  },

  // ── post-027 ── repost of post-002 by Sarah (highlights how the
  //               flagship session user surfaces parliamentary work)
  {
    id: 'post-027',
    author_user_id: 'creator-010',
    body: 'Ana\u2019s confidence-vote walkthrough is the cleanest example of a multi-format Story I\u2019ve seen on Frontfiles this month. Recommended for any of you covering Iberian politics.',
    attachment_type: 'story',
    attachment_id: 'story-002',
    attachment_creator_user_id: 'creator-002',
    repost_of_post_id: 'post-002',
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-29T18:14:00Z'),
    created_at: T('2026-03-29T18:14:00Z'),
    updated_at: T('2026-03-29T18:14:00Z'),
  },

  // ── post-028 ── original article-share, Tomasz (cross-author)
  //               author = creator-006 (Tomasz), source article author
  //               cited (article-005) is co-credited Tomasz/Yara so the
  //               attachment_creator stays Tomasz for the chip but the
  //               body acknowledges the co-byline.
  {
    id: 'post-028',
    author_user_id: 'creator-006',
    body: 'Yara and I co-published the labor-and-heat piece on Marseille\u2019s port handlers. The data overlap with my Warsaw transit work is the thing I want editors to notice — same pattern, different climate.',
    attachment_type: 'article',
    attachment_id: 'article-005',
    attachment_creator_user_id: 'creator-006',
    repost_of_post_id: null,
    visibility: 'public',
    status: 'published',
    published_at: T('2026-03-30T08:00:00Z'),
    created_at: T('2026-03-30T08:00:00Z'),
    updated_at: T('2026-03-30T08:00:00Z'),
  },
]

// ─── Lookups ───────────────────────────────────────────────────

/** O(1) lookup by post id. */
export const postMap: Record<string, PostRow> = Object.fromEntries(
  postRows.map((p) => [p.id, p]),
)

// ─── Helpers (spec-required names) ─────────────────────────────

/**
 * Returns every post authored by this user, published-only,
 * newest first. Used by the `/creator/[handle]/posts` page.
 */
export function getPostsByAuthor(authorUserId: string): PostRow[] {
  return postRows
    .filter(
      (p) => p.author_user_id === authorUserId && p.status === 'published',
    )
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
}

/**
 * Returns every published post attached to the given entity,
 * newest first. Powers the future "X people shared this on
 * Frontfiles" rail on content detail pages.
 */
export function getPostsAttachedTo(
  attachmentType: PostAttachmentType,
  attachmentId: string,
): PostRow[] {
  return postRows
    .filter(
      (p) =>
        p.status === 'published' &&
        p.attachment_type === attachmentType &&
        p.attachment_id === attachmentId,
    )
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
}

/**
 * Returns every published repost whose parent is `postId`,
 * newest first. Used by the post detail page's "Reposts of this
 * post" rail (Module 6, deferred — exposed now for seed parity).
 */
export function getPostRepostsOf(postId: string): PostRow[] {
  return postRows
    .filter((p) => p.status === 'published' && p.repost_of_post_id === postId)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
}
