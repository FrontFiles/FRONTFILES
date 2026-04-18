import type { Metadata } from 'next'
import Link from 'next/link'
import { env } from '@/lib/env'
import { getSharePreviewMetadataPayload } from '@/lib/share/metadata'

const APP_URL = env.NEXT_PUBLIC_APP_URL

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const payload = getSharePreviewMetadataPayload(token)

  // Invalid states — no-index, minimal metadata
  if (payload.status !== 'active') {
    return {
      title: 'Frontfiles',
      description: payload.description,
      robots: { index: false, follow: false },
    }
  }

  const canonicalUrl = `${APP_URL}${payload.canonicalPath}`
  const ogImageUrl = `${APP_URL}/share/${token}/opengraph-image`
  const titleWithCredit = payload.creatorName
    ? `${payload.title} · ${payload.creatorName}`
    : payload.title

  return {
    title: titleWithCredit,
    description: payload.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: payload.title,
      description: payload.description,
      url: canonicalUrl,
      type: 'website',
      siteName: 'Frontfiles',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: payload.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: payload.title,
      description: payload.description,
      images: [ogImageUrl],
    },
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const payload = getSharePreviewMetadataPayload(token)

  // ── Invalid state ────────────────────────────────────────────
  if (payload.status !== 'active') {
    const label =
      payload.status === 'expired'
        ? 'This link has expired.'
        : payload.status === 'revoked'
        ? 'This link has been removed.'
        : 'This link could not be found.'

    return (
      <div className="flex-1 overflow-y-auto bg-black flex flex-col items-center justify-center px-6 gap-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/25">
          {payload.status}
        </p>
        <h1 className="text-lg font-bold text-white/70 text-center">{label}</h1>
        <Link
          href="/"
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 border border-white/15 px-4 py-2.5 hover:text-white hover:border-white/40 transition-colors"
        >
          Go to Frontfiles
        </Link>
      </div>
    )
  }

  // ── Resolve link target ──────────────────────────────────────
  const href =
    payload.ogTemplate === 'frontfolio' && payload.creatorHandle
      ? `/creator/${payload.creatorHandle}/frontfolio`
      : payload.ogTemplate === 'creator' && payload.creatorHandle
      ? `/creator/${payload.creatorHandle}`
      : payload.ogTemplate === 'collection'
      ? '/'
      : '/'

  // ── Active share page ────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-black">
      {/* Hero — preview derivative only, never original */}
      {payload.previewImageUrl && (
        <div className="relative w-full" style={{ maxHeight: '62vh', overflow: 'hidden' }}>
          <img
            src={payload.previewImageUrl}
            alt={payload.title}
            className="w-full object-cover"
            style={{ maxHeight: '62vh' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="max-w-xl mx-auto px-6 py-10">
        {payload.creatorName && (
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35 mb-4">
            {payload.creatorName}
          </p>
        )}
        <h1 className="text-[22px] font-bold text-white leading-snug mb-4">
          {payload.title}
        </h1>
        <p className="text-[13px] text-white/45 leading-relaxed mb-10">
          {payload.description}
        </p>
        <Link
          href={href}
          className="inline-flex items-center gap-2.5 bg-[#0000ff] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-3 hover:bg-[#0000cc] transition-colors"
        >
          View on Frontfiles
        </Link>
      </div>
    </div>
  )
}
