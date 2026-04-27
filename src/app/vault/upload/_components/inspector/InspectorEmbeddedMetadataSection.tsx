/**
 * Frontfiles Upload V4 — Inspector Embedded Metadata Section (D2.10 follow-up)
 *
 * Read-only surface for the file's own embedded metadata (EXIF / GPS / IPTC).
 * The creator can see "what the file says about itself" without having to
 * trigger a conflict resolver.
 *
 * Three independently-collapsible groups, all closed by default per IPD4-3:
 *   - EXIF: cameraMake, cameraModel, iso, aperture, shutterSpeed, focalLength
 *   - GPS:  gpsLat, gpsLon, gpsLocationLabel
 *   - IPTC: iptcHeadline, iptcCaption, iptcKeywords, iptcByline,
 *           iptcCity, iptcCountry
 *
 * Returns null when asset.extractedMetadata is null (no parsed metadata
 * available — e.g., audio files, or assets where the parser failed). When
 * present but every value in a group is null/empty, that group's row reads
 * "—" instead of the value list.
 *
 * Mounted between InspectorExceptionsSection and InspectorAIProposalDetail.
 */

'use client'

import { useState } from 'react'
import type { V2Asset } from '@/lib/upload/v3-types'

interface Props {
  asset: V2Asset
}

export default function InspectorEmbeddedMetadataSection({ asset }: Props) {
  const [sectionOpen, setSectionOpen] = useState(false)
  const [exifOpen, setExifOpen] = useState(false)
  const [gpsOpen, setGpsOpen] = useState(false)
  const [iptcOpen, setIptcOpen] = useState(false)

  const md = asset.extractedMetadata

  if (!md) {
    return (
      <div className="border-b border-slate-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => setSectionOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
          aria-expanded={sectionOpen}
        >
          <span className="flex items-center gap-2">
            <span>{sectionOpen ? '▼' : '▶'}</span>
            <span>Embedded metadata</span>
          </span>
        </button>
        {sectionOpen && (
          <div className="px-3 pb-3 text-xs text-slate-500 italic">
            No embedded metadata extracted from this file.
          </div>
        )}
      </div>
    )
  }

  const exifCount = countNonEmpty([
    md.cameraMake,
    md.cameraModel,
    md.iso,
    md.aperture,
    md.shutterSpeed,
    md.focalLength,
  ])
  const gpsCount = countNonEmpty([md.gpsLat, md.gpsLon, md.gpsLocationLabel])
  const iptcCount =
    countNonEmpty([
      md.iptcHeadline,
      md.iptcCaption,
      md.iptcByline,
      md.iptcCity,
      md.iptcCountry,
    ]) + (md.iptcKeywords && md.iptcKeywords.length > 0 ? 1 : 0)

  const totalCount = exifCount + gpsCount + iptcCount

  return (
    <div className="border-b border-slate-200 flex-shrink-0">
      <button
        type="button"
        onClick={() => setSectionOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-colors"
        aria-expanded={sectionOpen}
      >
        <span className="flex items-center gap-2">
          <span>{sectionOpen ? '▼' : '▶'}</span>
          <span>Embedded metadata</span>
        </span>
        <span className="text-slate-500 font-mono">{totalCount}</span>
      </button>

      {sectionOpen && (
        <div className="px-3 pb-3 flex flex-col gap-1 min-w-0">
          <DetailRow
            open={exifOpen}
            onToggle={() => setExifOpen(o => !o)}
            label="EXIF"
            count={exifCount}
          >
            <KeyValueList
              rows={[
                ['Camera make', md.cameraMake],
                ['Camera model', md.cameraModel],
                ['ISO', md.iso],
                ['Aperture', md.aperture],
                ['Shutter speed', md.shutterSpeed],
                ['Focal length', md.focalLength],
              ]}
            />
          </DetailRow>

          <DetailRow
            open={gpsOpen}
            onToggle={() => setGpsOpen(o => !o)}
            label="GPS"
            count={gpsCount}
          >
            <KeyValueList
              rows={[
                ['Latitude', md.gpsLat],
                ['Longitude', md.gpsLon],
                ['Location label', md.gpsLocationLabel],
              ]}
            />
          </DetailRow>

          <DetailRow
            open={iptcOpen}
            onToggle={() => setIptcOpen(o => !o)}
            label="IPTC"
            count={iptcCount}
          >
            <KeyValueList
              rows={[
                ['Headline', md.iptcHeadline],
                ['Caption', md.iptcCaption],
                ['Keywords', md.iptcKeywords && md.iptcKeywords.length > 0 ? md.iptcKeywords.join(', ') : null],
                ['Byline', md.iptcByline],
                ['City', md.iptcCity],
                ['Country', md.iptcCountry],
              ]}
            />
          </DetailRow>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  open,
  onToggle,
  label,
  count,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  count: number
  children: React.ReactNode
}) {
  const empty = count === 0
  return (
    <div className="border border-slate-300 bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={empty}
        className={`w-full text-left px-2 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between gap-2 ${
          empty ? 'text-slate-400 cursor-not-allowed' : 'text-black hover:bg-slate-50'
        }`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>{open && !empty ? '▼' : '▶'}</span>
          <span>{label}</span>
        </span>
        <span className="text-slate-500 font-mono">{count}</span>
      </button>
      {open && !empty && <div className="px-2 pb-2">{children}</div>}
    </div>
  )
}

function KeyValueList({
  rows,
}: {
  rows: Array<[label: string, value: string | number | null]>
}) {
  return (
    <dl className="flex flex-col gap-1 text-xs min-w-0">
      {rows.map(([label, value]) => {
        if (value === null || value === undefined || value === '') return null
        return (
          <div key={label} className="flex items-baseline gap-2 min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500 w-24 flex-shrink-0">
              {label}
            </dt>
            <dd
              className="text-xs text-black font-mono break-all min-w-0"
              title={String(value)}
            >
              {String(value)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function countNonEmpty(values: Array<string | number | null | undefined>): number {
  return values.reduce<number>((acc, v) => {
    if (v === null || v === undefined) return acc
    if (typeof v === 'string' && v.trim() === '') return acc
    return acc + 1
  }, 0)
}
