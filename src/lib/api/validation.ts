/**
 * FRONTFILES — API route validation helpers (Zod)
 *
 * Canonical pattern for validating inputs to all API route handlers.
 *
 * Every route should parse its inputs through these helpers — NEVER
 * consume `await req.json()` or `searchParams.get(...)` directly.
 *
 * Returns a tuple pattern so route code stays flat:
 *
 *   const [body, bodyErr] = await parseBody(req, Schema)
 *   if (bodyErr) return bodyErr
 *   // body is typed and validated
 *
 * On validation failure, returns a standard 400 response with a
 * machine-readable error shape:
 *
 *   {
 *     error: {
 *       code: 'VALIDATION_ERROR',
 *       message: 'Request body failed validation',
 *       fields: { fieldName: ['error msg', ...] }
 *     }
 *   }
 *
 * All validation failures are logged via the pino logger with
 * the route path, validation type (body/query/params), and field
 * details — so operators can see input-validation incidents without
 * leaking user data into error responses.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────

/**
 * Tuple result type. Either `[data, null]` on success, or `[null, response]` on
 * validation failure — route code should `if (err) return err` to short-circuit.
 */
export type ValidationResult<T> = [T, null] | [null, NextResponse]

/** Standard error response shape for validation failures. */
export interface ValidationErrorBody {
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    fields: Record<string, string[]>
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Build the canonical 400 response for a Zod validation failure.
 * Also emits a structured log line for operator visibility.
 */
function buildValidationError(
  kind: 'body' | 'query' | 'params',
  error: z.ZodError,
  routeHint?: string,
): NextResponse {
  const fields = error.flatten().fieldErrors as Record<string, string[]>

  logger.warn(
    {
      validation: kind,
      route: routeHint ?? 'unknown',
      fields,
    },
    `[validation] ${kind} rejected`,
  )

  const body: ValidationErrorBody = {
    error: {
      code: 'VALIDATION_ERROR',
      message: `Request ${kind} failed validation`,
      fields,
    },
  }

  return NextResponse.json(body, { status: 400 })
}

/**
 * Parse and validate a JSON request body.
 *
 * Also handles the case where the body is not valid JSON at all —
 * returns 400 with a clear error instead of letting the route crash.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: NextRequest | Request,
  schema: T,
  routeHint?: string,
): Promise<ValidationResult<z.infer<T>>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    logger.warn(
      { validation: 'body', route: routeHint ?? 'unknown' },
      '[validation] body is not valid JSON',
    )
    const body: ValidationErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body is not valid JSON',
        fields: {},
      },
    }
    return [null, NextResponse.json(body, { status: 400 })]
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return [null, buildValidationError('body', result.error, routeHint)]
  }
  return [result.data, null]
}

/**
 * Parse and validate query-string parameters (from the URL).
 *
 * Zod receives the raw key/value object — use `z.coerce.number()`,
 * `z.coerce.boolean()`, etc. in your schema when you need non-string types.
 */
export function parseQuery<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
  routeHint?: string,
): ValidationResult<z.infer<T>> {
  const raw: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value
  })

  const result = schema.safeParse(raw)
  if (!result.success) {
    return [null, buildValidationError('query', result.error, routeHint)]
  }
  return [result.data, null]
}

/**
 * Parse and validate dynamic path params (e.g. `[id]` in App Router).
 *
 * Next.js 15+ delivers params as a Promise — this helper awaits it
 * before validating so route code can stay flat.
 */
export async function parseParams<T extends z.ZodTypeAny>(
  params: Record<string, string | string[]> | Promise<Record<string, string | string[]>>,
  schema: T,
  routeHint?: string,
): Promise<ValidationResult<z.infer<T>>> {
  const resolved = params instanceof Promise ? await params : params
  const result = schema.safeParse(resolved)
  if (!result.success) {
    return [null, buildValidationError('params', result.error, routeHint)]
  }
  return [result.data, null]
}
