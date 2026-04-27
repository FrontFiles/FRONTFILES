# Frontfiles AI Suggestion Pipeline — Architecture Detail Brief (E1.5)

**Status:** DRAFT — composed 2026-04-27. Awaiting founder ratification before E2 schema migration composes.
**Date:** 2026-04-27
**Scope:** Resolves the 11 open decisions in `AI-PIPELINE-BRIEF.md` v2 (E1) §9. Build-governing detail layer for the per-asset and clustering job classes.
**Governs:** Phase E directives E2 (schema + service skeleton), E3 (per-asset job), E4 (worker integration), E5 (cluster job), E6 (UI integration). E1.5 is the second of two architecture gates (after E1).
**Reads underlying:**
- `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1; the brief this detail brief implements)
- `INTEGRATION_READINESS.md` v2 — D6/D7/D8/D9 locks
- `PLATFORM_REVIEWS.md` v2 — D-U2 lock
- `CLAUDE_CODE_PROMPT_SEQUENCE.md` — CCP 7 (Vertex wrapper) + CCP 9 (Vision API) + CCP 14 (clustering) — these prompts execute against this brief
- `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql` — shipped pgvector + asset_embeddings + ai_analysis + audit_log
- `src/lib/processing/types.ts` — derivative specs (image-size strategy depends on these)
- `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` — language discipline binding all prompt text

---

## 1. What this brief is

The detail layer below E1. E1 locks vendor (Vertex Gemini), embedding model (text-embedding-004), schema shape, trust posture, and v1 sequencing. **This brief locks the things engineers need to write code**: exact model version strings, exact prompt text per format, exact confidence thresholds, exact image-size pipeline, exact cost ceiling with exceedance behavior, exact tag-taxonomy injection logic, exact region-failover semantics.

If a later E2-E6 directive proposes a value that contradicts §3-§11 below, the directive is wrong. Open follow-on items (§13) are explicit.

---

## 2. Decisions this brief resolves

| E1 §9 ref | Decision | Resolution location |
|---|---|---|
| 1 | Vertex model pins + bump policy | §3.1 |
| 2 | Prompt text per format | §4 |
| 3 | Confidence floor values | §5 |
| 4 | Per-format treatment details | §4 (per-format subsections) + §5.4 |
| 5 | Platform spend cap and behavior | §7 |
| 6 | Image size strategy | §6 |
| 7 | Tag taxonomy size | §8 |
| 8 | Embedding input shape | §10 |
| 9 | Region failover policy | §11 |
| 10 | Caption length cap | §4.1 (200 chars locked) |
| 11 | Cluster name generation prompt | §9 |

---

## 3. Vertex AI client architecture

### 3.1 Model pins + bump policy

| Use | Model family | Production pin policy | Rationale |
|---|---|---|---|
| Per-asset metadata generation (caption + keywords + tags) | `gemini-2.5-flash` (Vertex AI) | Pin to the current Vertex-published stable version string at E2 ship time (e.g., `gemini-2.5-flash` or a dated suffix per Vertex catalog conventions); record in `src/lib/ai-suggestions/models.ts` as a typed constant | Lowest-latency Gemini 2.5 Vision-capable model; cost-optimal at the per-asset volume; supports structured JSON output natively |
| Cluster name generation | `gemini-2.5-pro` (Vertex AI) | Same pin pattern as above | Higher quality reasoning; called once per cluster (batch-amortized); cost-tolerable |
| Text embedding (per asset + cluster signal) | `text-embedding-004` (Vertex AI) | Pin to `text-embedding-004` per D7 lock; track Vertex's stable-version conventions for this model family | D7 lock; 768-dim native compatibility with shipped `asset_embeddings` column |

**Note on version strings:** Vertex AI's published version-suffix conventions (e.g., `-001`, `-002`, `-latest`, dated suffixes) evolve. The exact pinned string at E2 ship time MUST be confirmed against the current Vertex AI model catalog (cloud.google.com/vertex-ai/generative-ai/docs/models) — this brief locks the model **family** and the **pin pattern** (typed constant, regression-tested bump policy); E2 locks the **specific version string**.

**Bump policy:**
- Production env reads the version string from a single source: `src/lib/ai-suggestions/models.ts` (typed constants; one constant per model role).
- A model bump is a separate directive (E-bump-N) that:
  1. Updates the constant
  2. Runs the regression sample (§12.4) on the new version
  3. Surfaces the diff (caption length, confidence distribution, tag overlap) to founder
  4. Approval gate before merge
- Cache invalidation is automatic: `ai_analysis.model_version` is part of the unique key; bumped version → cache miss → new entries.
- Old `asset_proposals.model_version` rows are NOT regenerated on bump (would be expensive and unnecessary; existing proposals remain creator-reviewable; Regenerate button calls the new model on-demand).

**Bump cadence:** quarterly review minimum; immediate on Vertex-published quality/safety advisory; immediate on Frontfiles-side quality regression detection.

### 3.2 Client wrapper module

Per CCP 7 prompt: `src/lib/ai/google.ts` — typed Vertex client wrapper. CCP 7 is the implementation directive; this brief defines its contract.

```typescript
// Public API (locked):

export type AiRegion = 'eu' | 'us'  // enum on users.ai_region

export interface VertexClient {
  generateText(opts: GenerateTextOpts): Promise<TextResult>
  generateEmbedding(opts: EmbeddingOpts): Promise<number[]>  // 768-dim
  analyseImage(opts: AnalyseImageOpts): Promise<JsonResult>  // gemini vision, structured JSON
}

export function getClient(region: AiRegion): VertexClient
// Cached per region; one instance per region per process.

export interface AnalyseImageOpts {
  imageBytes: Buffer            // long-edge ≤ 1568px (per §6)
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  prompt: string                // per-format text from §4
  model: 'flash' | 'pro'        // resolves via models.ts
  responseSchema: object        // structured JSON schema for Gemini
  region: AiRegion              // resolved from users.ai_region upstream
}
```

**Region resolution rules (D8 binding):**
- Every call resolves `region` from the creator's `users.ai_region` field
- `users.ai_region` enum default = `'eu'` for new users outside the US (set during onboarding per CCP 7)
- The `ai_region` field is populated before any Vertex call is dispatched (per `INTEGRATION_READINESS.md` Phase 4.B.5a)
- **No cross-region fall-through.** If creator's region is unhealthy, the call holds pending (circuit breaker, §11) — never routes to the other region.

**Sequencing prerequisite:** E3 (per-asset Vertex calls) requires `users.ai_region` to exist as a column. That column is added by `INTEGRATION_READINESS.md` Phase 4.B.5a (or as part of CCP 7 if 4.B.5a hasn't shipped first). E2 (schema migration for proposal tables) does NOT require `ai_region` — E2 is unblocked. The hard dependency is **E3 ← (4.B.5a OR CCP 7-partial creating the column)**. If `ai_region` is missing at E3 ship time, E3's directive includes the column-add as a prerequisite migration; if Phase 4.B.5a / CCP 7 has already shipped it, E3 just reads the existing column.

**Read-through cache (CCP 7 spec):**
- Every `analyseImage` call consults `ai_analysis` first
- Cache key: `(subject_type='asset', subject_id=asset_id, model=<pinned version>, model_version=<pinned version>, input_hash=sha256(prompt + image_sha256 + format))`
- Cache hit → return `output` JSONB; do NOT call Vertex; emit `audit_log.event_type='ai.gemini.cache_hit'`
- Cache miss → call Vertex; persist result with token counts + cost; emit `audit_log.event_type='ai.gemini.call'`

---

## 4. Per-format prompt text

All prompts share a system preamble + format-specific instruction block + creator-tag-list injection + structured-output schema. The structured output enforces the response shape regardless of model choice.

### 4.1 Shared preamble (every format)

```
You are providing AI-suggested metadata for an editorial asset on Frontfiles, a
professional platform for journalists, creators, editors, and publishers.

The creator will review every suggestion. Be specific but conservative. If you
are uncertain, lower your confidence score for that field.

Constraints — these are not optional:
1. Do not assert factual claims about identified persons, locations, or events
   that you cannot derive from the image alone. No naming people. No location
   identification beyond what is visually unambiguous (e.g., "Eiffel Tower" is
   visible; "Paris" is inferable but should be a tag, not the caption).
2. Do not include intent, motive, or context not visually present.
3. Do not use authoritative or certifying language. Output describes what is
   visible, not what is true.
4. Caption: maximum 200 characters. Do not exceed.
5. Output ONLY valid JSON matching the provided schema. No commentary, no
   markdown, no preface.

Existing creator taxonomy (preferred tag vocabulary, ordered by usage):
{tag_taxonomy_top_n}

Asset format: {format}
```

`{tag_taxonomy_top_n}` is the top-N (§8) tags by `vault_assets.tags` usage for this creator, comma-separated. Empty string if creator has no prior tags.

`{format}` is `'photo' | 'illustration' | 'infographic' | 'vector'`.

### 4.2 Per-format instruction blocks

**`photo` block:**

```
For a photograph, generate:
- caption: a description of what is visible — subject, setting, action, mood.
  Plain descriptive prose. Avoid editorialising.
- keywords: 3-8 words/phrases capturing visual concepts (subject, setting,
  light, mood, composition).
- tags: choose primarily from the creator's existing taxonomy above. Suggest
  a new tag only if no existing tag fits AND your confidence is at least 0.75.
```

**`illustration` block:**

```
For an illustration, generate:
- caption: describe both the subject and the visual style (e.g., "watercolor
  portrait of a woman reading", "isometric line drawing of a city skyline").
- keywords: 3-8 words/phrases — style descriptors, subject, palette where
  meaningful.
- tags: choose primarily from the creator's existing taxonomy above. New tag
  only if no existing tag fits AND confidence ≥ 0.75. Include a style tag
  (e.g., 'watercolor', 'line-art') if obvious.
```

**`infographic` block:**

```
For an infographic, generate:
- caption: describe the topic AND the chart/diagram type (e.g., "bar chart
  showing global temperature anomalies 1880-2024", "flowchart of an OAuth
  request").
- keywords: 3-8 words/phrases — subject domain, chart type, time period
  if applicable.
- tags: choose primarily from the creator's existing taxonomy above. New tag
  only if no existing tag fits AND confidence ≥ 0.75. Include a domain tag
  (e.g., 'climate', 'economics') if obvious.
```

**`vector` block:**

```
For a vector graphic, generate:
- caption: describe the subject and the visual treatment (e.g., "flat-design
  icon set of weather symbols", "geometric pattern of interlocking triangles").
- keywords: 3-8 words/phrases — style descriptors, subject, use case if obvious.
- tags: choose primarily from the creator's existing taxonomy above. New tag
  only if no existing tag fits AND confidence ≥ 0.75.
```

### 4.3 Structured output schema (Gemini `responseSchema`)

```json
{
  "type": "OBJECT",
  "properties": {
    "caption": {
      "type": "STRING",
      "description": "Max 200 characters. Descriptive, not editorial."
    },
    "caption_confidence": {
      "type": "NUMBER",
      "description": "0.0 to 1.0; lower if uncertain"
    },
    "keywords": {
      "type": "ARRAY",
      "items": { "type": "STRING" },
      "minItems": 3,
      "maxItems": 8
    },
    "keywords_confidence": {
      "type": "NUMBER"
    },
    "tags": {
      "type": "ARRAY",
      "items": { "type": "STRING" }
    },
    "tags_confidence": {
      "type": "NUMBER"
    },
    "new_tags_with_confidence": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "tag": { "type": "STRING" },
          "confidence": { "type": "NUMBER" }
        },
        "required": ["tag", "confidence"]
      },
      "description": "Tags NOT in creator taxonomy; surface only those with confidence >= 0.75"
    }
  },
  "required": ["caption", "caption_confidence", "keywords", "keywords_confidence", "tags", "tags_confidence"]
}
```

The `new_tags_with_confidence` array is filtered server-side to keep only entries with `confidence >= 0.75` before merging into the final `tags` array. This is the §3 E9 + §5 E1 v2 enforcement.

### 4.4 Caption length enforcement

- Prompt explicitly constrains "Caption: maximum 200 characters."
- Server-side post-validation: if `caption.length > 200`, truncate at last word boundary ≤ 197 chars + `"..."` (defensive — Gemini structured output usually respects, but the cap is binding).
- Truncation event logged to `audit_log.event_type='ai.gemini.caption_truncated'` (low-volume; useful signal for prompt refinement).

---

## 5. Confidence floor values

### 5.1 Surfacing thresholds

| Field | Floor | Behavior |
|---|---|---|
| caption | `confidence < 0.30` | Surfaced with extra muting + "Low confidence" indicator; per-field `→ all` button disabled for this field on this asset |
| keywords | `confidence < 0.30` | Same |
| tags (existing-taxonomy) | `confidence < 0.30` | Same |
| **tags (new, not in taxonomy)** | `confidence < 0.75` | **Not surfaced at all.** This is the strictest floor — new tags add to the creator's vocabulary, so the bar is higher. |
| cluster (silhouette score) | `silhouette < 0.30` | Cluster not surfaced; member assets remain in "Ungrouped" until creator manually clusters or re-runs |

### 5.2 Rationale

- `0.30` for general fields is defensive: above-noise but well below "confident." Anything below this is more likely to confuse than help.
- `0.75` for new tags reflects that new tags compound — they end up in the creator's taxonomy and influence future suggestions. False-positive new tags pollute the taxonomy permanently.
- `0.30` silhouette for clusters is the standard HDBSCAN noise threshold; below this, points are essentially noise from a clustering perspective.

### 5.3 Tunability

These are defaults. Operations may tune them via:
- Settings table `ai_pipeline_settings` (added in E2 schema migration, not yet specified — §13 follow-on)
- Per-creator overrides if a creator wants higher/lower thresholds (v2 enrichment, not v1)

### 5.4 Confidence semantics per format

The model is instructed to lower confidence on uncertainty. In practice:
- `photo`: confidence is typically 0.6-0.9 for caption/keywords; tags vary widely depending on creator taxonomy size
- `illustration` / `vector`: confidence skews lower for caption (style descriptors are more interpretive); tags often higher (style is well-recognized vocabulary)
- `infographic`: confidence on caption is often higher (chart type is unambiguous); domain-tag confidence depends on legibility of text in the image

Server-side, no per-format confidence multiplier is applied — the model self-reports and we honor that. If post-launch data shows systematic over- or under-confidence per format, tune the prompt (E-bump-N), not the threshold.

---

## 6. Image size strategy

### 6.1 Source: `original`, not `watermarked_preview`

**Critical:** the `watermarked_preview` derivative (long-edge 1600px, watermarked per `IMAGE_DERIVATIVE_SPECS`) has the Frontfiles bar baked into the image. Sending it to Gemini Vision contaminates the caption ("a Frontfiles preview showing..." or worse). Always use `original`.

The Class A worker fetches `original` bytes via the storage bridge (same bridge as PR 4 derivative worker).

### 6.2 In-memory resize before Vertex call

```typescript
// In src/lib/ai-suggestions/image-prep.ts (E3)

const MAX_LONG_EDGE_PX = 1568  // Gemini 2.5 internal grid sweet spot
const MAX_INLINE_BYTES = 4 * 1024 * 1024  // 4 MiB — Vertex inline limit

async function prepareForVision(
  originalBytes: Buffer,
): Promise<{ bytes: Buffer; mime: string; mode: 'inline' | 'signed_url' }> {
  const resized = await sharp(originalBytes)
    .resize(MAX_LONG_EDGE_PX, MAX_LONG_EDGE_PX, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()

  const mime = 'image/jpeg'

  if (resized.byteLength <= MAX_INLINE_BYTES) {
    return { bytes: resized, mime, mode: 'inline' }
  }

  // Larger than 4 MiB even after resize (rare at long-edge 1568) — use signed URL
  return { bytes: resized, mime, mode: 'signed_url' }
}
```

### 6.3 Why long-edge 1568px

- Vertex AI documentation describes Gemini Vision's image processing as a tile/grid pipeline with a documented optimal input range; sending larger than the optimum does not improve caption quality (the model internally downsamples) but does cost more (per-image-token billing scales with image area)
- Sending smaller (e.g., 1024) loses fine detail for tag/keyword extraction on detail-dense formats (infographic, vector)
- **1568px is a balanced midpoint locked as the v1 default.** This value is a defensible default at brief composition; E2 implementation MUST verify the current Google-published optimal long-edge for the pinned `gemini-2.5-flash` version against Vertex AI documentation and adjust `MAX_LONG_EDGE_PX` if Google publishes a different recommended grid. The constant is centralised in `src/lib/ai-suggestions/image-prep.ts` so the bump policy (§3.1) can adjust it via a small follow-on directive without touching the rest of the pipeline.
- A regression in the §12.4 sample on a smaller value would also justify revisiting

### 6.4 Why JPEG quality 85

Matches existing `watermarked_preview` quality (consistency); marginal quality gains above 85 don't justify the size increase; below 85 introduces JPEG artifacts that confuse vision models on fine detail.

### 6.5 No watermark, no overlay

The resized buffer is the original visual content alone. No watermark, no Frontfiles UI chrome, no orientation correction beyond what Sharp does by default (EXIF rotation honored). The Vision input is the cleanest representation of the asset.

---

## 7. Cost envelope + ceiling + behavior

### 7.1 Per-call cost capture

Vertex returns token counts in the API response. `ai_analysis.cost_cents` is computed per-call from the published Vertex pricing table:

```typescript
// src/lib/ai-suggestions/cost.ts (E3)

const VERTEX_PRICING = {
  // ALL VALUES BELOW ARE PLACEHOLDERS — to be confirmed against the current
  // Vertex AI pricing page (cloud.google.com/vertex-ai/generative-ai/pricing)
  // at E2 implementation time. The schema is locked here; the numbers are
  // illustrative defaults that E2 MUST replace with verified-current values
  // before any production call is made.
  'gemini-2.5-flash': {
    input_per_1m_tokens_cents: null,    // CONFIRM AT E2
    output_per_1m_tokens_cents: null,   // CONFIRM AT E2
    image_per_unit_cents: null,         // CONFIRM AT E2 (may be bundled into input tokens; check)
  },
  'gemini-2.5-pro': {
    input_per_1m_tokens_cents: null,    // CONFIRM AT E2
    output_per_1m_tokens_cents: null,   // CONFIRM AT E2
    image_per_unit_cents: null,         // CONFIRM AT E2
  },
  'text-embedding-004': {
    input_per_1m_tokens_cents: null,    // CONFIRM AT E2
  },
} as const

// Pricing constants verified quarterly via the model bump policy (§3.1).
// Source of truth: cloud.google.com/vertex-ai/generative-ai/pricing.
```

**Pricing constants are deliberately left null in this brief.** Vertex pricing changes; "current" values at brief-composition date are not load-bearing — they will be wrong by E2 ship time. The contract this brief locks is the **schema** (which models, what dimensions to track) and the **bump cadence** (verified quarterly). E2 implementation directive includes a "verify current pricing against Vertex docs" step before merge; verified values land in `src/lib/ai-suggestions/cost.ts` with the source URL + verification date as a comment.

**Cost envelope for §7.2 ceiling defaults below is order-of-magnitude only.** Founder ratification of the ceiling default values (or amendment) is part of E1.5 ratification.

### 7.2 Platform spend ceiling

Two ceilings, each enforced before each Vertex call:

| Scope | Default (production) | Default (preview/dev) | Behavior on exceedance |
|---|---|---|---|
| Daily | 50000 cents ($500/day) | 5000 cents ($50/day) | Worker holds the call; sets `generation_status='not_applicable'` with `error='platform_quota_exceeded_daily'`; emits `audit_log.event_type='ai.gemini.quota_exceeded'` |
| Monthly | 1000000 cents ($10,000/month) | 50000 cents ($500/month) | Same shape, `error='platform_quota_exceeded_monthly'` |

Both default values are in `ai_pipeline_settings` (§13 follow-on; E2 lands the table). Founder-tunable.

### 7.3 Spend check implementation

```typescript
// src/lib/ai-suggestions/quota.ts (E3)

async function checkSpendOrFail(): Promise<void> {
  const dailySpentCents = await sumCostCents({ since: startOfDay })
  if (dailySpentCents >= settings.daily_cap_cents) {
    throw new QuotaExceededError('platform_quota_exceeded_daily')
  }
  const monthlySpentCents = await sumCostCents({ since: startOfMonth })
  if (monthlySpentCents >= settings.monthly_cap_cents) {
    throw new QuotaExceededError('platform_quota_exceeded_monthly')
  }
}

// Sum reads from ai_analysis.cost_cents (the read-through cache table)
// — this is the authoritative source per CCP 7.
```

**Race condition note:** the check is not transactional with the call. Under concurrent burst, the worker can briefly exceed the cap by ~the parallelism factor. This is acceptable: caps are platform-protective, not transaction-strict; the founder alert fires within seconds of breach; auto-recovery at next-period boundary.

### 7.4 Auto-recovery

- On `daily_cap_cents` breach: queue resumes at next 00:00 UTC
- On `monthly_cap_cents` breach: queue resumes at next month start (1st 00:00 UTC)
- Queued assets remain `generation_status='not_applicable'` with the breach reason; founder can manually trigger reprocessing via a "Regenerate" admin tool (E6 surface; not exposed to creators)

### 7.5 Founder alert

`audit_log.event_type='ai.gemini.quota_exceeded'` is monitored:
- Sentry alert via the existing audit-log → Sentry pipeline (per CCP 5)
- One alert per breach event (rate-limited so a quota-breached day doesn't spam)

---

## 8. Tag taxonomy injection

### 8.1 Top-N selection

```sql
-- Locked in this brief: N = 50

SELECT tag, count(*) AS usage_count
FROM (
  SELECT unnest(tags) AS tag
  FROM vault_assets
  WHERE creator_id = $1
) t
GROUP BY tag
ORDER BY usage_count DESC, tag ASC  -- tie-break alphabetically for determinism
LIMIT 50
```

- Tied counts break alphabetically (deterministic; cache-friendly — same input hash on re-run)
- 50 is a defensible default: large enough that creators with active vocabularies see their top tags; small enough to fit the Gemini prompt budget without bloating

### 8.2 Edge cases

| Creator state | Behavior |
|---|---|
| ≥ 50 tags | Top 50 by usage |
| < 50 tags | All of them; no padding |
| 0 tags | Empty taxonomy in prompt; prompt explicitly invites new tags above 0.75 confidence |

### 8.3 Caching

- Per-creator taxonomy is fetched once per Class A worker invocation
- Not cached across invocations (creator may have added tags since last fetch; cache staleness is more harmful than the small repeated cost)
- Future optimization: in-process LRU cache with 60s TTL (v2; not v1)

### 8.4 Refresh semantics

The taxonomy snapshot used for a given proposal is captured in `ai_analysis.input_hash` — if the creator adds new tags and an asset is regenerated later, the taxonomy is fresh and the input_hash differs, producing a cache miss and a new call (correct behavior).

---

## 9. Cluster naming pipeline

### 9.1 Trigger and inputs

Class B (cluster job) fires on `upload_batches` `'committing'` transition or explicit creator action. After HDBSCAN produces clusters, each cluster with `silhouette_score >= 0.30` gets a name proposed via `gemini-2.5-pro`.

### 9.2 Cluster-naming prompt

```
You are naming a Story group on Frontfiles. The group contains photos or
illustrations the creator took or made together — same shoot, same event, same
project.

Below are AI-suggested captions for the {N} assets in this group, plus the date
range across them.

Captions:
{caption_1}
{caption_2}
...
{caption_N}

Date range: {date_range_human}  (e.g., "Mar 14, 2026" or "Mar 14–16, 2026")

Suggest a 2-4 word descriptive title for this group.

Constraints — these are not optional:
1. 2-4 words. Not 1, not 5+.
2. Descriptive of the visible subject. No editorialising. No factual claims about
   identified persons or events you cannot derive from the captions alone.
3. If the captions are too generic to differentiate (e.g., "Photos", "Images"),
   reply with the empty string. The system will fall back to the date range.
4. Output ONLY the title, no commentary, no quotes, no markdown.
```

### 9.3 Date range formatting

```typescript
// src/lib/ai-suggestions/cluster-naming.ts (E5)

function formatDateRange(dates: Date[]): string {
  const sorted = dates.sort((a, b) => a.getTime() - b.getTime())
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (sameDay(first, last)) return formatHumanDate(first)
  if (sameMonth(first, last)) return `${first.getDate()}–${last.getDate()} ${formatMonthYear(first)}`
  return `${formatHumanDate(first)} – ${formatHumanDate(last)}`
}

// Examples:
// Mar 14, 2026
// 14–16 Mar 2026
// Mar 14, 2026 – Apr 2, 2026
```

Locale: en-US in v1. Per-creator-locale tuning is v2 enrichment.

### 9.4 Fallback to date range

If `gemini-2.5-pro` returns empty string, or the response is just a generic noun ("Photos", "Images", "Pictures", "Stuff", "Group"), the worker substitutes the date range as the cluster name. Detection is a static regex match against ~10 generic single-word responses.

### 9.5 Caching cluster names

- Cluster naming is cached in `ai_analysis` keyed on `(subject_type='cluster', subject_id=cluster_id, model='gemini-2.5-pro', model_version, input_hash)`
- `input_hash = sha256(captions.sort().join('\n') + '\n' + date_range)` — order-independent so re-runs with identical assets produce identical hash
- Cache hit (e.g., creator re-runs analysis on same batch): return cached name
- Cache miss: call Vertex; persist; return

### 9.6 Cost (per cluster)

- One `gemini-2.5-pro` call per cluster
- Input tokens: ~50-200 (captions are short; date range is a few tokens)
- Output tokens: 5-15
- Cost per cluster: ~$0.0001 - $0.0003

For a 100-asset batch with ~10 clusters: ~$0.001-$0.003 in cluster naming. Negligible relative to the per-asset Vision cost.

---

## 10. Embedding shape + storage

### 10.1 Input string

```typescript
// src/lib/ai-suggestions/embedding.ts (E3)

function buildEmbeddingInput(
  caption: string,
  tags: string[],
  format: AssetFormat,
): string {
  const tagsStr = tags.length > 0 ? tags.join(', ') : '(no tags)'
  return `${caption} | ${tagsStr} | ${format}`
}
```

Examples:
```
"Bicycle leaning against a stone wall in evening light | bicycle, urban, golden-hour | photo"
"Flowchart of an OAuth authorization request | oauth, security, flowchart | infographic"
"Watercolor portrait of a woman reading | watercolor, portrait, reading | illustration"
```

### 10.2 Why this shape

| Signal | Source | Discriminative for |
|---|---|---|
| Visual content | AI caption (Gemini Vision sees the image) | Subject + setting + composition |
| Categorization | Tags (creator + AI suggestions) | Topic + style + reuse intent |
| Modality | Format string | Format-distinct clusters (don't mix photo + illustration in a Story group) |

The pipe separator is a hint to text-embedding-004 that the segments are distinct facets, not a single sentence. Empirically (per Vertex docs), the model attends across segments well in the 768-dim space.

### 10.3 Storage

- One row per asset in `asset_embeddings` (already shipped: `(asset_id PRIMARY KEY, embedding vector(768), model, model_version, region, created_at, updated_at)`)
- `model = 'text-embedding-004'`, `model_version` set at write time, `region` matches creator's `ai_region`
- Upsert on every Class A run (creator may regenerate; cluster job reads latest)

### 10.4 Truncation safety

- Caption max 200 chars; tags rarely exceed 50 chars total; format is one word
- Worst case: ~280 chars → ~70 tokens (English; well under text-embedding-004's 8192-token input cap)
- No truncation logic needed in v1; revisit only if non-English content lengths surface as a problem

### 10.5 Quality evaluation gate

If post-launch clustering Silhouette scores remain pathologically low (e.g., median < 0.20 across 3 representative test batches at 1000+ cumulative assets), the embedding shape is the first variable to revisit. Order of fallback:

1. Tune the embedding input (weight subject more; drop format if not discriminative; etc.)
2. Add per-format separate embedding (Vertex multimodal `multimodalembedding@001`, 1408-dim, requires column migration to `vector(1408)` — likely separate table to preserve existing 768 column)
3. Hybrid: caption-text embedding + Vision-API-labels embedding (concatenated or ensembled; multi-call cost)

This is post-v1 enrichment work, not v1 scope.

---

## 11. Region failover policy

### 11.1 Circuit breaker per region

```typescript
// src/lib/ai-suggestions/circuit-breaker.ts (E3)

interface CircuitState {
  consecutiveFailures: number
  state: 'closed' | 'open'
  openedAt?: number  // epoch ms
}

const FAILURE_THRESHOLD = 5
const COOLDOWN_MS = 60_000  // 60s

const circuitStates: Map<AiRegion, CircuitState> = new Map()
```

### 11.2 Trip and cool-down

| Event | Action |
|---|---|
| Vertex call fails (any error) | Increment `consecutiveFailures` for that region |
| `consecutiveFailures >= 5` | Trip circuit: state = 'open', stamp `openedAt`. Emit `audit_log.event_type='ai.gemini.circuit_open'` |
| Circuit open, < 60s elapsed | Calls hold pending. Worker leaves `asset_proposals.generation_status='pending'` (no retry_count increment). Reaper does NOT mark these as failed during cool-down. |
| Circuit open, ≥ 60s elapsed | Half-open: next call probes. If success, close circuit + reset counter. If failure, re-open + reset cool-down. |
| Vertex call succeeds | Reset `consecutiveFailures = 0`. Close circuit. |

### 11.3 No cross-region fall-through (D8 binding)

When a creator's region is open (failing), their assets wait. They do NOT route to the other region. This honors D8 (per-creator residency is binding).

If both regions go open simultaneously (Vertex platform incident), the entire pipeline waits. Founder is alerted via the audit log → Sentry path.

### 11.4 Per-call retry vs circuit

- Per-call retry: one immediate retry on transient failure (HTTP 503, rate-limit) before incrementing the failure counter
- The 5-failure threshold is "5 distinct calls failed" not "5 retries on one call"
- Permanent errors (auth, malformed request) do NOT contribute to the counter — they flow straight to `generation_status='failed'`

### 11.5 Half-open probe semantics

- After 60s cool-down, the next call is treated as a probe
- If probe succeeds, circuit closes immediately and queued calls resume
- If probe fails, circuit re-opens with fresh 60s timer
- The probe is the next pending `asset_proposals` row in that region — no special "synthetic probe" call (which would itself cost money)

### 11.6 Reaper interaction

The PR 4 reaper clears stuck `asset_proposals` rows past `FFF_PROCESSING_TIMEOUT_SECONDS`. During circuit open, the worker does not claim rows in that region (FOR UPDATE SKIP LOCKED). This means waiting rows don't have `processing_started_at` stamped — the reaper's age check (`processing_started_at + timeout < now()`) doesn't fire. Rows wait safely.

If circuit stays open longer than timeout (configurable, default 600s), founder intervention required. Auto-recovery: cool-down expires + probe succeeds.

---

## 12. Test plan

### 12.1 Unit tests (E3)

- Prompt builder: per-format prompt text contains the format-specific block + shared preamble + injected taxonomy + structured-output schema reference
- Image prep: `original` resized to long-edge 1568, JPEG q85, returns inline mode for ≤ 4 MiB
- Embedding builder: input string format matches §10.1
- Cost calculator: sample token counts → expected cents per Vertex pricing
- Cache key builder: `(subject_type, subject_id, model, model_version, input_hash)` matches CCP 3 schema

### 12.2 Integration tests (E3 + E4)

- End-to-end pending → ready transition with mock vertex adapter (returns canned JSON)
- Cache hit path: second invocation returns cached output, no Vertex call
- Region routing: `users.ai_region='us'` routes to us-central1 client; `'eu'` routes to europe-west4
- Circuit breaker: 5 consecutive failures → open; 60s wait → half-open probe; success → closed
- Quota exceedance: pre-call check returns false → status = `'not_applicable'` with reason

### 12.3 Class B tests (E5)

- HDBSCAN reproducibility on a fixed-seed fixture batch
- Silhouette filter: clusters below 0.30 not surfaced
- Cluster naming: gemini-2.5-pro mock returns title; fallback to date range on empty/generic
- Idempotent re-run: same batch → same clusters (modulo HDBSCAN's deterministic-with-seed property)

### 12.4 Regression sample (model bump policy)

A fixed test set of ~30 representative assets (per format: 8 photos, 8 illustrations, 8 infographics, 6 vectors) with hand-curated expected outputs. Test set lives at `src/lib/ai-suggestions/__fixtures__/regression-set/`. Bump directives run the new model against this set and compare:
- Caption length distribution
- Tag overlap (Jaccard) with expected
- New-tag rate
- Confidence distribution
- Per-format pass rate

Pass criteria: no metric regresses by > 10% vs. the prior pinned version. Founder reviews the diff before bump approval.

---

## 13. Open follow-on items

These are explicitly NOT resolved here; either they belong in the implementing directive (E2-E6) or in future enrichment work:

| # | Item | Where resolved |
|---|---|---|
| 1 | `ai_pipeline_settings` table shape (daily_cap_cents, monthly_cap_cents, top_n_taxonomy, confidence_floors) | E2 schema migration |
| 2 | Onboarding UI for `users.ai_region` field | CCP 7 (out of scope for E2-E6; runs in parallel as Phase 4.B work) |
| 3 | Vertex pricing constants verification (current as of E2 ship date) | E2 (read-through verification step in directive) |
| 4 | Per-creator opt-out UI | E6 (UI integration) |
| 5 | Admin "Regenerate" tool for quota-recovered assets | E6 (UI integration) |
| 6 | Per-creator-locale cluster naming | v2 enrichment |
| 7 | Multimodal embedding (`multimodalembedding@001`) fallback path | v2 if cluster quality demands |
| 8 | OCR / landmark / safe-search Vision API integration (separate from Gemini Vision) | v2 enrichment |
| 9 | Face detection consent flag (BP-relevant) | v2 enrichment |
| 10 | LRU cache for per-creator taxonomy | v2 enrichment |
| 11 | `proposal_shown` view-tracking event | v2 (deferred per E1 §7.2 per cost-vs-signal trade) |

---

## 14. Approval gate

Before E2 schema migration composes, the founder ratifies this brief.

Ratification means:
- Model pins (§3.1) are correct
- Per-format prompt text (§4) is signed off
- Confidence floors (§5) are correct
- Image-size strategy (§6) is correct
- Cost ceiling defaults (§7) are correct (or amended)
- Tag taxonomy size N=50 (§8) is correct
- Cluster naming prompt (§9) is signed off
- Embedding shape (§10) is correct
- Region failover policy (§11) is correct
- Test plan (§12) is sufficient
- Open follow-on items (§13) are properly bracketed

Founder's options:
1. **Approve** — E2 directive composes against this brief.
2. **Approve with corrections** — name the section(s) that need adjustment; I revise; founder approves the revision.
3. **Revise before approval** — substantial concerns; I redraft.
4. **Reject** — kill or restart; this brief was wrong about architecture, not just details.

---

## 15. References

- Parent brief: `src/lib/processing/AI-PIPELINE-BRIEF.md` v2 (E1, 2026-04-27)
- Architectural locks: `INTEGRATION_READINESS.md` v2 D1–D12 (D6/D7/D8/D9 binding) + `PLATFORM_REVIEWS.md` v2 D-U2
- Implementation prompts: `CLAUDE_CODE_PROMPT_SEQUENCE.md` CCP 7 (Vertex wrapper) + CCP 9 (Vision API) + CCP 14 (clustering)
- Shipped infra: `supabase/migrations/20260419110000_phase1_vector_cache_audit.sql`
- Derivative specs (image-size source): `src/lib/processing/types.ts` (`IMAGE_DERIVATIVE_SPECS`)
- Worker reuse: `src/lib/processing/PR-4-PLAN.md` + `dispatcher.ts` + `reaper.ts`
- Trust-language audit: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`
- Vertex pricing source: `cloud.google.com/vertex-ai/generative-ai/pricing` (verify quarterly)

---

End of AI suggestion pipeline architecture detail brief (E1.5, 2026-04-27).
