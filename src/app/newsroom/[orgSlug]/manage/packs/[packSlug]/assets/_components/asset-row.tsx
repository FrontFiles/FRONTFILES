'use client'

/**
 * Frontfiles — Asset row (NR-D7a, F4)
 *
 * Per-asset row inside the Pack-editor Assets tab. Renders the
 * scan-state indicator + metadata-edit form + actions (Replace,
 * Remove, Retry scan) keyed off the 4-state matrix in PRD §5.1
 * P7.
 *
 * NR-D7a runtime reachability: ALL rows render with
 * scanResult.result === 'pending' because no scanner runs yet.
 * The 4-state matrix is implemented in full so NR-D7b lights up
 * `clean` / `flagged` / `error` without F4 changes. Branches
 * marked "(reachable from NR-D7b onward)" in code comments.
 *
 * Autosave on blur: caption + alt_text PATCH when the field
 * blurs with a changed value. is_trademark_asset PATCHes on
 * change. No "Save" button — the Pack editor's save indicator
 * (in F3 of NR-D6b) reflects state at the page level; per-row
 * autosave is a UX choice for v1, can be lifted to explicit
 * save-on-submit in v1.1.
 *
 * Delete: confirmation via window.confirm (browser-native) for
 * v1; a real modal lands as a polish pass.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P7 (scan-result matrix + metadata fields)
 *   - directives/NR-D7a-asset-upload-storage-metadata.md §F4
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type {
  NewsroomAssetRow,
  NewsroomAssetScanResultRow,
} from '@/lib/db/schema'
import {
  ASSET_ALT_TEXT_MAX,
  ASSET_CAPTION_MAX,
} from '@/lib/newsroom/asset-form-constants'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

// ── PRD §5.1 P7 verbatim copy ─────────────────────────────────

const COPY_RENDITIONS_NOTE =
  'Thumbnail 400px · Web 1600px · Print 3000px · Social 1200×630'
const COPY_DELETE_CONFIRM =
  'Delete this asset? This cannot be undone.'

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function ScanIndicator({
  scanResult,
}: {
  scanResult: NewsroomAssetScanResultRow | null
}) {
  // PRD §5.1 P7 indicator copy. NR-D7a always lands in 'pending'
  // because no scanner runs; later branches reachable from NR-D7b.
  if (!scanResult || scanResult.result === 'pending') {
    return <span aria-label="Scan: pending">Scanning…</span>
  }
  if (scanResult.result === 'clean') {
    return <span aria-label="Scan: clean">●</span>
  }
  if (scanResult.result === 'flagged') {
    return <span aria-label="Scan: flagged">● Flagged for review</span>
  }
  // 'error'
  return <span aria-label="Scan: error">● Scan error</span>
}

export function AssetRow({
  orgSlug,
  packSlug,
  asset,
  scanResult,
}: {
  orgSlug: string
  packSlug: string
  asset: NewsroomAssetRow
  scanResult: NewsroomAssetScanResultRow | null
}) {
  const router = useRouter()

  // Local state — only the editable fields. The scan state is
  // server-authoritative and re-rendered on router.refresh().
  const [caption, setCaption] = useState(asset.caption ?? '')
  const [altText, setAltText] = useState(asset.alt_text ?? '')
  const [isTrademark, setIsTrademark] = useState(asset.is_trademark_asset)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanState = scanResult?.result ?? 'pending'
  const canEdit = scanState === 'pending' || scanState === 'clean'
  const showReplace = scanState === 'clean'
  const showRetryScan = scanState === 'error'

  async function patch(payload: Record<string, unknown>): Promise<void> {
    setSubmitting(true)
    setError(null)
    const token = await getAuthToken()
    if (!token) {
      setError('Session expired. Refresh and try again.')
      setSubmitting(false)
      return
    }
    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/assets/${asset.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        setError("Couldn't save. Try again.")
        setSubmitting(false)
        return
      }
      router.refresh()
    } catch {
      setError("Couldn't save. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleCaptionBlur() {
    if (caption === (asset.caption ?? '')) return
    void patch({ caption: caption.length > 0 ? caption : null })
  }

  function handleAltTextBlur() {
    if (altText === (asset.alt_text ?? '')) return
    void patch({ alt_text: altText.length > 0 ? altText : null })
  }

  function handleTrademarkChange(checked: boolean) {
    setIsTrademark(checked)
    void patch({ is_trademark_asset: checked })
  }

  async function handleDelete() {
    if (!window.confirm(COPY_DELETE_CONFIRM)) return
    setSubmitting(true)
    setError(null)
    const token = await getAuthToken()
    if (!token) {
      setError('Session expired. Refresh and try again.')
      setSubmitting(false)
      return
    }
    try {
      const res = await fetch(
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/assets/${asset.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (!res.ok && res.status !== 204) {
        setError("Couldn't delete. Try again.")
        setSubmitting(false)
        return
      }
      router.refresh()
    } catch {
      setError("Couldn't delete. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <article aria-label={`Asset: ${asset.original_filename}`}>
      <header>
        <strong>{asset.original_filename}</strong>
        <ScanIndicator scanResult={scanResult} />
      </header>

      {/* Editable metadata — only when scan is pending or clean */}
      {canEdit ? (
        <div>
          <label>
            Caption (appears beside asset)
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={handleCaptionBlur}
              maxLength={ASSET_CAPTION_MAX}
              disabled={submitting}
            />
          </label>

          <label>
            Alt text (accessibility, required for images)
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={handleAltTextBlur}
              maxLength={ASSET_ALT_TEXT_MAX}
              disabled={submitting}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={isTrademark}
              onChange={(e) => handleTrademarkChange(e.target.checked)}
              disabled={submitting}
            />
            This is a logo or trademark
            <small>
              {' '}
              Adds a trademark notice wherever the asset appears.
            </small>
          </label>
        </div>
      ) : null}

      {/* Renditions placeholder — actual renditions land post-D7c */}
      <p>
        <small>{COPY_RENDITIONS_NOTE}</small>
      </p>

      {error ? <p role="alert">{error}</p> : null}

      <div>
        {showReplace ? (
          // Reachable from NR-D7b onward. Until then no rows have
          // scanState === 'clean'. The button is intentionally
          // present so the matrix is complete; clicking it does
          // nothing in NR-D7a (no replace handler wired).
          <button type="button" disabled title="Replace ships in v1.1">
            Replace
          </button>
        ) : null}
        {showRetryScan ? (
          // Reachable from NR-D7b onward. Same posture as Replace.
          <button
            type="button"
            disabled
            title="Retry scan ships with the scanner pipeline (NR-D7b)."
          >
            Retry scan
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting}
        >
          Remove
        </button>
      </div>
    </article>
  )
}
