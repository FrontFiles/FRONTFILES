/**
 * Frontfiles — AI Suggestion Pipeline Model Pins
 *
 * Per AI-PIPELINE-ARCHITECTURE.md (E1.5) §3.1.
 *
 * NOTE: at E3 ship time, verify the current Vertex-published stable
 * version for each model family at:
 *   cloud.google.com/vertex-ai/generative-ai/docs/models
 * and replace the strings below with the verified version pins.
 *
 * The "VERIFY_AT_E3_SHIP" sentinel must be replaced before E3 merges
 * (E3 verification gate enforces this).
 *
 * Bump policy: typed constant + regression sample (E1.5 §12.4). A
 * model bump is its own directive (E-bump-N) that:
 *   1. Updates the constant
 *   2. Runs the regression sample on the new version
 *   3. Surfaces the diff to founder
 *   4. Approval gate before merge
 */

export const MODELS = {
  /** Per-asset metadata generation (caption + keywords + tags). */
  vision_per_asset: 'gemini-2.5-flash',
  /** Cluster name generation (called once per cluster, batch-amortized). */
  cluster_naming: 'gemini-2.5-pro',
  /** Text embedding for cluster signal + semantic search (D7 lock). */
  embedding: 'text-embedding-004',
} as const

export type ModelRole = keyof typeof MODELS
