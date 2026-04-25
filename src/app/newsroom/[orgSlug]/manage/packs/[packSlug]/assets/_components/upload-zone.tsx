'use client'

/**
 * Frontfiles — Asset upload zone (NR-D7a, F3)
 *
 * Drag-and-drop multi-file upload. Per-file pipeline:
 *
 *   1. Validate size + MIME (PRD §5.1 P7 error strings verbatim)
 *   2. Extract kind-specific dimensions via DOM APIs
 *      - image: HTMLImageElement.naturalWidth/Height
 *      - video: HTMLVideoElement.videoWidth/Height + duration
 *      - audio: HTMLAudioElement.duration
 *   3. Compute SHA-256 over file bytes (full-buffer; v1 acceptance —
 *      streaming hash with chunked digest is a v1.1 polish pass for
 *      mobile / low-memory devices)
 *   4. POST metadata to /api/.../assets — server INSERTs the row
 *      and returns { asset, signedUploadUrl }
 *   5. PUT bytes to signedUploadUrl via XMLHttpRequest (fetch's
 *      upload progress is unfeasible until ReadableStream arrives
 *      universally; XHR's progress events work today)
 *   6. router.refresh() on success — F1 re-fetches assets +
 *      scan_results and renders the new row
 *
 * Errors per file are surfaced inline; the orphan asset row that
 * results from a server INSERT but failed PUT is documented as v1
 * acceptance (NR-D7a §F3 step 7). A v1.1 cleanup sweep handles
 * orphans.
 *
 * Auth: Bearer via getSupabaseBrowserClient. No server actions.
 *
 * Spec cross-references:
 *   - PRD.md §5.1 P7 (upload-zone copy + validation strings)
 *   - directives/NR-D7a-asset-upload-storage-metadata.md §F3
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type {
  NewsroomAssetKind,
  NewsroomAssetRow,
} from '@/lib/db/schema'
import {
  ACCEPTED_MIME_TYPES,
  ASSET_MAX_BYTES,
  kindFromMime,
} from '@/lib/newsroom/asset-form-constants'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

// ── PRD §5.1 P7 verbatim copy ─────────────────────────────────

const COPY_EMPTY =
  'Drop files or click to upload. Images, video, audio, PDFs, up to 500 MB each.'
const COPY_DRAG_OVER = 'Drop to upload'
const COPY_OVERSIZE = 'File exceeds 500 MB. Compress or split.'
const COPY_BAD_MIME =
  'File type not accepted. Accepted: images (jpg/png/webp/gif), video (mp4/webm/mov), audio (mp3/wav/aac/ogg), PDF, plain text, markdown.'
const COPY_GENERIC = 'Upload failed. Try again in a moment.'

// ── Per-file state ────────────────────────────────────────────

type PerFileStatus =
  | { kind: 'preparing'; file: File }
  | { kind: 'uploading'; file: File; progress: number }
  | { kind: 'success'; file: File }
  | { kind: 'error'; file: File; message: string }

interface PerFileEntry {
  id: string
  status: PerFileStatus
}

// ── Helpers ───────────────────────────────────────────────────

function newEntryId(): string {
  // Local-only id for React key stability. Not the eventual asset id.
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function bytesToHex(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer)
  let out = ''
  for (const b of arr) {
    out += b.toString(16).padStart(2, '0')
  }
  return out
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return bytesToHex(hash)
}

interface KindDims {
  kind: NewsroomAssetKind
  width?: number | null
  height?: number | null
  duration_seconds?: number | null
}

async function extractKindDims(
  file: File,
  kind: NewsroomAssetKind,
): Promise<KindDims> {
  if (kind === 'image') {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({
          kind,
          width: img.naturalWidth || null,
          height: img.naturalHeight || null,
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read image dimensions'))
      }
      img.src = url
    })
  }
  if (kind === 'video') {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve({
          kind,
          width: v.videoWidth || null,
          height: v.videoHeight || null,
          duration_seconds: Number.isFinite(v.duration)
            ? Math.round(v.duration)
            : null,
        })
      }
      v.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read video metadata'))
      }
      v.src = url
    })
  }
  if (kind === 'audio') {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const a = document.createElement('audio')
      a.preload = 'metadata'
      a.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve({
          kind,
          duration_seconds: Number.isFinite(a.duration)
            ? Math.round(a.duration)
            : null,
        })
      }
      a.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read audio metadata'))
      }
      a.src = url
    })
  }
  // document / text — no dimensions
  return { kind }
}

function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (pct: number) => void,
): Promise<void> {
  // XHR rather than fetch — fetch's upload progress relies on
  // ReadableStream support that's not universal. XHR's progress
  // event is the cross-browser baseline.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v)
      }
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload PUT failed: HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Upload PUT network error'))
    xhr.send(file)
  })
}

// ── Component ─────────────────────────────────────────────────

export function UploadZone({
  orgSlug,
  packSlug,
  packId: _packId,
}: {
  orgSlug: string
  packSlug: string
  packId: string
}) {
  const router = useRouter()
  const [dragOver, setDragOver] = useState(false)
  const [entries, setEntries] = useState<PerFileEntry[]>([])

  function updateEntry(id: string, status: PerFileStatus) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status } : e)),
    )
  }

  async function getAuthToken(): Promise<string | null> {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    } catch {
      return null
    }
  }

  async function processOneFile(entry: PerFileEntry): Promise<void> {
    const file = entry.status.file
    try {
      // ── 1. Size + MIME validation ──
      if (file.size > ASSET_MAX_BYTES) {
        updateEntry(entry.id, {
          kind: 'error',
          file,
          message: COPY_OVERSIZE,
        })
        return
      }
      const kind = kindFromMime(file.type)
      if (!kind) {
        updateEntry(entry.id, {
          kind: 'error',
          file,
          message: COPY_BAD_MIME,
        })
        return
      }

      // ── 2. Dimensions ──
      const dims = await extractKindDims(file, kind).catch(
        () => ({ kind }) as KindDims,
      )

      // ── 3. SHA-256 ──
      const checksum = await sha256Hex(file)

      // ── 4. POST metadata ──
      const token = await getAuthToken()
      if (!token) {
        updateEntry(entry.id, {
          kind: 'error',
          file,
          message: 'Session expired. Refresh and try again.',
        })
        return
      }

      const metadataRes = await fetch(
        `/api/newsroom/orgs/${orgSlug}/packs/${packSlug}/assets`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type,
            file_size_bytes: file.size,
            checksum_sha256: checksum,
            kind,
            width: dims.width ?? null,
            height: dims.height ?? null,
            duration_seconds: dims.duration_seconds ?? null,
          }),
        },
      )
      const metaJson = (await metadataRes.json().catch(() => null)) as
        | {
            ok: true
            asset: NewsroomAssetRow
            signedUploadUrl: string
            uploadHeaders?: Record<string, string>
          }
        | { ok: false; reason?: string }
        | null
      if (!metadataRes.ok || !metaJson || !metaJson.ok) {
        updateEntry(entry.id, {
          kind: 'error',
          file,
          message: COPY_GENERIC,
        })
        return
      }

      // ── 5. PUT bytes to signed URL ──
      updateEntry(entry.id, { kind: 'uploading', file, progress: 0 })
      try {
        await uploadWithProgress(
          metaJson.signedUploadUrl,
          file,
          metaJson.uploadHeaders,
          (pct) =>
            updateEntry(entry.id, {
              kind: 'uploading',
              file,
              progress: pct,
            }),
        )
      } catch {
        updateEntry(entry.id, {
          kind: 'error',
          file,
          message: COPY_GENERIC,
        })
        return
      }

      // ── 6. Success → refresh ──
      updateEntry(entry.id, { kind: 'success', file })
      router.refresh()
    } catch {
      updateEntry(entry.id, {
        kind: 'error',
        file,
        message: COPY_GENERIC,
      })
    }
  }

  function enqueueFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const newEntries: PerFileEntry[] = arr.map((f) => ({
      id: newEntryId(),
      status: { kind: 'preparing', file: f },
    }))
    setEntries((prev) => [...prev, ...newEntries])
    // Process in parallel — browsers limit per-host concurrent
    // requests, so kicking off N at once is fine; the runtime
    // throttles for us.
    for (const e of newEntries) {
      void processOneFile(e)
    }
  }

  function handleDragOver(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault()
    setDragOver(true)
  }
  function handleDragLeave() {
    setDragOver(false)
  }
  function handleDrop(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault()
    setDragOver(false)
    if (ev.dataTransfer.files.length > 0) {
      enqueueFiles(ev.dataTransfer.files)
    }
  }
  function handleFileInputChange(
    ev: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (ev.target.files && ev.target.files.length > 0) {
      enqueueFiles(ev.target.files)
    }
    // Reset input so the same file can be re-picked
    ev.target.value = ''
  }

  function handleRetry(id: string) {
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    const file = entry.status.file
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: { kind: 'preparing', file } } : e,
      ),
    )
    void processOneFile({
      id,
      status: { kind: 'preparing', file },
    })
  }

  // Flat MIME accept list for the <input> picker — derived from
  // ACCEPTED_MIME_TYPES so adding a new type updates the picker
  // automatically.
  const acceptList = (
    Object.values(ACCEPTED_MIME_TYPES) as ReadonlyArray<readonly string[]>
  )
    .flat()
    .join(',')

  return (
    <section aria-label="Upload assets">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="Asset drop zone"
      >
        <p>{dragOver ? COPY_DRAG_OVER : COPY_EMPTY}</p>
        <label>
          <input
            type="file"
            multiple
            accept={acceptList}
            onChange={handleFileInputChange}
          />
          Choose files
        </label>
      </div>

      {entries.length > 0 ? (
        <ul aria-label="Pending uploads">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>{entry.status.file.name}</span>
              {entry.status.kind === 'preparing' ? (
                <span aria-live="polite"> Preparing…</span>
              ) : null}
              {entry.status.kind === 'uploading' ? (
                <progress
                  value={entry.status.progress}
                  max={100}
                  aria-label={`Uploading ${entry.status.file.name}`}
                >
                  {entry.status.progress}%
                </progress>
              ) : null}
              {entry.status.kind === 'success' ? (
                <span aria-live="polite"> Uploaded.</span>
              ) : null}
              {entry.status.kind === 'error' ? (
                <span role="alert">
                  {' '}
                  Upload failed. {entry.status.message}{' '}
                  <button
                    type="button"
                    onClick={() => handleRetry(entry.id)}
                  >
                    Retry
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
