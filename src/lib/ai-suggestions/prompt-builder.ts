/**
 * Frontfiles — AI-suggestions prompt builder
 *
 * Per E1.5 §4 + E3-DIRECTIVE.md §14.5.1.
 *
 * Builds (a) the per-format prompt text and (b) the JSON-Schema
 * responseSchema Vertex Gemini requires. The real vertex-vision adapter
 * calls these to assemble the Vertex Gemini request.
 *
 * Locked-text source: E1.5 §4. Changes to prompt text are bump-policy
 * decisions (E1.5 §3.1) — regression sample (§12.4) reruns on prompt
 * changes the same way it does on model bumps.
 *
 * SERVER-ONLY.
 */

import type { AssetFormat } from '@/lib/upload/types'

const SHARED_PREAMBLE = (taxonomyTopN: string[], format: AssetFormat) =>
  `You are providing AI-suggested metadata for an editorial asset on Frontfiles, a
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
${taxonomyTopN.length > 0 ? taxonomyTopN.join(', ') : '(none — creator has no prior tags; suggest new tags above 0.75 confidence)'}

Asset format: ${format}`.trim()

const PHOTO_BLOCK = `For a photograph, generate:
- caption: a description of what is visible — subject, setting, action, mood.
  Plain descriptive prose. Avoid editorialising.
- keywords: 3-8 words/phrases capturing visual concepts (subject, setting,
  light, mood, composition).
- tags: choose primarily from the creator's existing taxonomy above. Suggest
  a new tag only if no existing tag fits AND your confidence is at least 0.75.`.trim()

const ILLUSTRATION_BLOCK = `For an illustration, generate:
- caption: describe both the subject and the visual style (e.g., "watercolor
  portrait of a woman reading", "isometric line drawing of a city skyline").
- keywords: 3-8 words/phrases — style descriptors, subject, palette where
  meaningful.
- tags: choose primarily from the creator's existing taxonomy above. New tag
  only if no existing tag fits AND confidence ≥ 0.75. Include a style tag
  (e.g., 'watercolor', 'line-art') if obvious.`.trim()

const INFOGRAPHIC_BLOCK = `For an infographic, generate:
- caption: describe the topic AND the chart/diagram type (e.g., "bar chart
  showing global temperature anomalies 1880-2024", "flowchart of an OAuth
  request").
- keywords: 3-8 words/phrases — subject domain, chart type, time period
  if applicable.
- tags: choose primarily from the creator's existing taxonomy above. New tag
  only if no existing tag fits AND confidence ≥ 0.75. Include a domain tag
  (e.g., 'climate', 'economics') if obvious.`.trim()

const VECTOR_BLOCK = `For a vector graphic, generate:
- caption: describe the subject and the visual treatment (e.g., "flat-design
  icon set of weather symbols", "geometric pattern of interlocking triangles").
- keywords: 3-8 words/phrases — style descriptors, subject, use case if obvious.
- tags: choose primarily from the creator's existing taxonomy above. New tag
  only if no existing tag fits AND confidence ≥ 0.75.`.trim()

const FORMAT_BLOCKS: Record<'photo' | 'illustration' | 'infographic' | 'vector', string> = {
  photo: PHOTO_BLOCK,
  illustration: ILLUSTRATION_BLOCK,
  infographic: INFOGRAPHIC_BLOCK,
  vector: VECTOR_BLOCK,
}

export function buildPrompt(format: AssetFormat, taxonomyTopN: string[]): string {
  const block = (FORMAT_BLOCKS as Record<string, string | undefined>)[format]
  if (!block) {
    // Defensive — non-image formats should be gated upstream and never reach here
    throw new Error(`buildPrompt: unsupported format '${format}' (image formats only in v1)`)
  }
  return `${SHARED_PREAMBLE(taxonomyTopN, format)}\n\n${block}`
}

/**
 * JSON-Schema for Vertex's responseSchema parameter. Mirrors the Zod
 * VisionResponseSchema (schema.ts) so adapter-side response validation
 * against Zod always succeeds when Gemini honors this schema.
 */
export const VISION_RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    caption: { type: 'STRING' },
    caption_confidence: { type: 'NUMBER' },
    keywords: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 8 },
    keywords_confidence: { type: 'NUMBER' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    tags_confidence: { type: 'NUMBER' },
    new_tags_with_confidence: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tag: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['tag', 'confidence'],
      },
    },
  },
  required: [
    'caption',
    'caption_confidence',
    'keywords',
    'keywords_confidence',
    'tags',
    'tags_confidence',
  ],
} as const
