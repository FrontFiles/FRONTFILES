/**
 * Frontfiles — Vertex AI Client Wrapper (focused subset for AI suggestions)
 *
 * Per E3-DIRECTIVE.md §8 + CCP 7 §1. Implements the narrow subset of CCP 7's
 * broader Vertex client wrapper that the AI suggestion pipeline needs:
 *   - analyseImage (gemini-2.5-flash for per-asset; gemini-2.5-pro for cluster)
 *   - generateEmbedding (text-embedding-004)
 *
 * CCP 7's wider scope (generateText for query understanding etc.) is a future
 * expansion that builds on top of this module.
 *
 * SERVER-ONLY. Never import from a client component.
 *
 * AUTHENTICATION: Application Default Credentials (ADC) via
 * GOOGLE_APPLICATION_CREDENTIALS env var. Service account requires
 * Vertex AI User role (per H2 in CLAUDE_CODE_PROMPT_SEQUENCE.md).
 *
 * REGION ROUTING: per D8. Each call accepts a VertexRegion explicitly;
 * resolution from users.ai_region happens upstream (not in this module).
 *
 * NO CACHE LAYER HERE: cache.ts wraps this module. Caller is responsible
 * for cache lookup before calling analyseImage or generateEmbedding.
 *
 * NO CIRCUIT BREAKER HERE: circuit-breaker.ts wraps this module. Caller
 * checks circuit state before calling.
 *
 * SDK loading is lazy (dynamic import on first call) so the bundler doesn't
 * pay the SDK cost when ai-suggestions never runs.
 */

import { env } from '@/lib/env'
import type { VertexRegion } from '@/lib/ai-suggestions/types'

// ── Public types ───────────────────────────────────────────────

export interface AnalyseImageOpts {
  imageBytes: Buffer
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp'
  prompt: string
  responseSchema: object
  model: 'flash' | 'pro'
  region: VertexRegion
}

export interface AnalyseImageResult {
  output: unknown // structured JSON; caller validates via Zod
  modelVersion: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export interface GenerateEmbeddingOpts {
  text: string
  region: VertexRegion
}

export interface GenerateEmbeddingResult {
  embedding: number[] // 768-dim per text-embedding-004
  modelVersion: string
  inputTokens: number
  latencyMs: number
}

// ── Typed error classes (per §8.3) ─────────────────────────────

/** Auth failure (missing JSON, invalid creds). Circuit counts. */
export class VertexAuthError extends Error {
  constructor(message: string) {
    super(`VertexAuthError: ${message}`)
    this.name = 'VertexAuthError'
  }
}

/** Vertex-side quota exceeded (RateLimitExceeded). Circuit counts. */
export class VertexQuotaError extends Error {
  constructor(message: string) {
    super(`VertexQuotaError: ${message}`)
    this.name = 'VertexQuotaError'
  }
}

/** Permanent error (malformed request, schema rejection). Circuit does NOT count. */
export class VertexPermanentError extends Error {
  constructor(message: string) {
    super(`VertexPermanentError: ${message}`)
    this.name = 'VertexPermanentError'
  }
}

/** Transient error (5xx, network, timeout). Circuit counts. */
export class VertexTransientError extends Error {
  constructor(message: string) {
    super(`VertexTransientError: ${message}`)
    this.name = 'VertexTransientError'
  }
}

/** Empty/invalid response (parsing fails). Circuit counts. */
export class VertexResponseError extends Error {
  constructor(message: string) {
    super(`VertexResponseError: ${message}`)
    this.name = 'VertexResponseError'
  }
}

// ── Internal: lazy SDK + per-region client cache ───────────────

type VertexAiModule = typeof import('@google-cloud/vertexai')
let _vertexAiModule: VertexAiModule | null = null
async function getVertexModule(): Promise<VertexAiModule> {
  if (_vertexAiModule) return _vertexAiModule
  try {
    _vertexAiModule = await import('@google-cloud/vertexai')
  } catch (err) {
    throw new VertexAuthError(
      `Failed to load @google-cloud/vertexai SDK: ${err instanceof Error ? err.message : String(err)}. Did you run \`bun install\`?`,
    )
  }
  return _vertexAiModule
}

// Per-region client cache. Map<VertexRegion, VertexAI instance>.
type AnyVertexAi = unknown
const _clientCache = new Map<VertexRegion, AnyVertexAi>()

async function getClient(region: VertexRegion): Promise<AnyVertexAi> {
  const cached = _clientCache.get(region)
  if (cached) return cached

  const projectId = env.GOOGLE_CLOUD_PROJECT_ID
  if (!projectId) {
    throw new VertexAuthError(
      'GOOGLE_CLOUD_PROJECT_ID env var is required when FFF_AI_REAL_PIPELINE=true. Set it in your environment.',
    )
  }
  if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new VertexAuthError(
      'GOOGLE_APPLICATION_CREDENTIALS env var is required when FFF_AI_REAL_PIPELINE=true. Point it at your GCP service account JSON file.',
    )
  }

  const mod = await getVertexModule()
  // The @google-cloud/vertexai SDK exposes a `VertexAI` constructor that takes
  // { project, location } where location is the regional endpoint string
  // (matches our VertexRegion enum: 'europe-west4' | 'us-central1').
  const VertexAI = (mod as { VertexAI: new (opts: { project: string; location: string }) => unknown })
    .VertexAI
  const client = new VertexAI({ project: projectId, location: region })
  _clientCache.set(region, client)
  return client
}

/** Test-only: clear the per-region client cache. */
export function _resetClientCacheForTest(): void {
  _clientCache.clear()
  _vertexAiModule = null
}

// ── Error classification ───────────────────────────────────────

function classifyError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: number | string } | undefined)?.code
  const status = (err as { status?: number | string } | undefined)?.status

  // Auth failures — service account / ADC problems
  if (
    /UNAUTHENTICATED|PERMISSION_DENIED|invalid_grant|invalid_credentials/i.test(msg) ||
    code === 16 || code === 7 || status === 401 || status === 403
  ) {
    return new VertexAuthError(msg)
  }

  // Quota exceeded
  if (
    /RATE_LIMIT|QUOTA_EXCEEDED|RESOURCE_EXHAUSTED|429/i.test(msg) ||
    code === 8 || status === 429
  ) {
    return new VertexQuotaError(msg)
  }

  // Permanent — malformed request, schema rejection
  if (
    /INVALID_ARGUMENT|FAILED_PRECONDITION|400/i.test(msg) ||
    code === 3 || code === 9 || status === 400
  ) {
    return new VertexPermanentError(msg)
  }

  // Transient — 5xx / network / timeout
  if (
    /UNAVAILABLE|DEADLINE_EXCEEDED|INTERNAL|5\d\d|ECONNRESET|ETIMEDOUT|timeout/i.test(msg) ||
    code === 14 || code === 4 || code === 13 ||
    (typeof status === 'number' && status >= 500)
  ) {
    return new VertexTransientError(msg)
  }

  // Default — treat as transient (caller can retry)
  return new VertexTransientError(msg)
}

// ── Public functions ───────────────────────────────────────────

/**
 * Call Vertex Gemini Vision with an image + prompt + structured JSON schema.
 * Returns the parsed JSON output + token counts + latency.
 *
 * @throws VertexAuthError | VertexQuotaError | VertexPermanentError |
 *         VertexTransientError | VertexResponseError
 */
export async function analyseImage(opts: AnalyseImageOpts): Promise<AnalyseImageResult> {
  const start = Date.now()
  const client = (await getClient(opts.region)) as {
    getGenerativeModel: (cfg: {
      model: string
      generationConfig?: { responseMimeType?: string; responseSchema?: object }
    }) => {
      generateContent: (req: {
        contents: Array<{
          role: string
          parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }>
        }>
      }) => Promise<{
        response: {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
          modelVersion?: string
        }
      }>
    }
  }

  const modelName = opts.model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash'

  let result: Awaited<ReturnType<ReturnType<typeof client.getGenerativeModel>['generateContent']>>
  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: opts.responseSchema,
      },
    })

    result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: opts.imageMime,
                data: opts.imageBytes.toString('base64'),
              },
            },
            { text: opts.prompt },
          ],
        },
      ],
    })
  } catch (err) {
    throw classifyError(err)
  }

  const latencyMs = Date.now() - start
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new VertexResponseError(
      `Empty response from gemini-${opts.model}; no text in candidates[0].content.parts[0].`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new VertexResponseError(
      `Response is not valid JSON: ${err instanceof Error ? err.message : String(err)}. Raw: ${text.slice(0, 200)}`,
    )
  }

  return {
    output: parsed,
    modelVersion: result.response.modelVersion ?? modelName,
    inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs,
  }
}

/**
 * Generate a text embedding (text-embedding-004; 768-dim).
 *
 * The @google-cloud/vertexai SDK doesn't expose embeddings at the same
 * surface as Gemini Generation; we use the underlying prediction client
 * via the SDK's lower-level interface. The exact call shape may need
 * adjustment per current SDK docs at E3 ship — verify before merge.
 *
 * @throws VertexAuthError | VertexQuotaError | VertexPermanentError |
 *         VertexTransientError | VertexResponseError
 */
export async function generateEmbedding(
  opts: GenerateEmbeddingOpts,
): Promise<GenerateEmbeddingResult> {
  const start = Date.now()
  const client = (await getClient(opts.region)) as {
    preview: {
      getGenerativeModel: (cfg: { model: string }) => {
        embedContent: (req: {
          content: { role: string; parts: Array<{ text: string }> }
        }) => Promise<{
          embedding?: { values?: number[] }
          usageMetadata?: { totalTokenCount?: number }
        }>
      }
    }
  }

  const modelName = 'text-embedding-004'
  let result: Awaited<
    ReturnType<ReturnType<typeof client.preview.getGenerativeModel>['embedContent']>
  >
  try {
    const model = client.preview.getGenerativeModel({ model: modelName })
    result = await model.embedContent({
      content: { role: 'user', parts: [{ text: opts.text }] },
    })
  } catch (err) {
    throw classifyError(err)
  }

  const latencyMs = Date.now() - start
  const values = result.embedding?.values
  if (!values || values.length !== 768) {
    throw new VertexResponseError(
      `Expected 768-dim embedding from ${modelName}; got ${values?.length ?? 0}.`,
    )
  }

  return {
    embedding: values,
    modelVersion: modelName,
    inputTokens: result.usageMetadata?.totalTokenCount ?? 0,
    latencyMs,
  }
}
