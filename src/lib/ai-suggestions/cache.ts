/**
 * Frontfiles — AI analysis read-through cache
 *
 * Per E1.5 §3.2 + E3-DIRECTIVE.md §10. Implements cache lookup against the
 * shipped ai_analysis table (migration 20260419110000).
 *
 * Cache key matches ai_analysis UNIQUE constraint:
 *   (subject_type, COALESCE(subject_id, sentinel), model, model_version, input_hash)
 *
 * Hit  → return cached output JSONB; emit audit_log 'ai.gemini.cache_hit'
 * Miss → return null; caller invokes Vertex; cache writes via cacheWrite()
 *        after successful call.
 *
 * Cache lookup or write failures are LOGGED but not propagated — they
 * should never block the call path. Force the cache miss path on failure
 * (worst case: extra Vertex call; cost is trivial).
 *
 * SERVER-ONLY.
 */

import crypto from 'node:crypto'
import { getSupabaseClient } from '@/lib/db/client'
import { audit } from '@/lib/logger'

const SENTINEL_UUID = '00000000-0000-0000-0000-000000000000'

export type CacheSubjectType = 'asset' | 'cluster' | 'query' | 'brief' | 'post'

export interface CacheKey {
  subjectType: CacheSubjectType
  /** null for subject types like 'query' that don't have a row id (uses SENTINEL). */
  subjectId: string | null
  model: string
  modelVersion: string
  inputHash: string
}

export interface CacheEntry {
  output: unknown
  inputTokens: number | null
  outputTokens: number | null
  costCents: number | null
  modelVersion: string
}

/** Read a cache entry. Returns null on miss or on lookup error. */
export async function cacheRead(key: CacheKey): Promise<CacheEntry | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ai_analysis')
    .select('output, token_input, token_output, cost_cents, model_version')
    .eq('subject_type', key.subjectType)
    .eq('subject_id', key.subjectId ?? SENTINEL_UUID)
    .eq('model', key.model)
    .eq('model_version', key.modelVersion)
    .eq('input_hash', key.inputHash)
    .maybeSingle()

  if (error) {
    // Cache lookup failures should NOT block the call. Log and force miss.
    // eslint-disable-next-line no-console
    console.error(
      'cache.cacheRead: lookup_error',
      JSON.stringify({ code: 'cache_read_error', error: error.message, key }),
    )
    return null
  }
  if (!data) return null

  await audit({
    event_type: 'ai.gemini.cache_hit',
    target_type: key.subjectType,
    target_id: key.subjectId,
    metadata: { model: key.model, model_version: key.modelVersion },
  })

  return {
    output: data.output,
    inputTokens: data.token_input ?? null,
    outputTokens: data.token_output ?? null,
    costCents: data.cost_cents ?? null,
    modelVersion: data.model_version,
  }
}

export interface CacheWriteEntry {
  output: unknown
  inputTokens: number
  outputTokens: number
  costCents: number
  region: string
}

/** Write a cache entry. Errors are logged but don't propagate. */
export async function cacheWrite(key: CacheKey, entry: CacheWriteEntry): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('ai_analysis').insert({
    subject_type: key.subjectType,
    subject_id: key.subjectId,
    model: key.model,
    model_version: key.modelVersion,
    region: entry.region,
    input_hash: key.inputHash,
    output: entry.output,
    token_input: entry.inputTokens,
    token_output: entry.outputTokens,
    cost_cents: entry.costCents,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      'cache.cacheWrite: write_error',
      JSON.stringify({ code: 'cache_write_error', error: error.message, key }),
    )
  }
}

/** Build a deterministic SHA-256 hash from input parts joined by NUL. */
export function buildInputHash(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('\x00')).digest('hex')
}
