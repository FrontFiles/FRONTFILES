import { ImageResponse } from 'next/og'
import { getSharePreviewMetadataPayload } from '@/lib/share/metadata'
import { OgWatermark, OG_WATERMARK_BAR_HEIGHT } from '@/lib/watermark/og-watermark'
import { isWatermarkEnabled } from '@/lib/watermark/policy'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Wordmark element — reused in both card variants
function Wordmark() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        left: 56,
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 5,
      }}
    >
      FRONTFILES
    </div>
  )
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const payload = getSharePreviewMetadataPayload(token)

  // ── Fallback card ────────────────────────────────────────────
  if (payload.status !== 'active' || !payload.previewImageUrl) {
    const label =
      payload.status === 'expired'
        ? 'LINK EXPIRED'
        : payload.status === 'revoked'
        ? 'UNAVAILABLE'
        : payload.status === 'missing'
        ? 'NOT FOUND'
        : 'FRONTFILES'

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#080808',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 6,
            }}
          >
            FRONTFILES
          </div>
          {payload.status !== 'active' && (
            <div
              style={{
                color: 'rgba(255,255,255,0.2)',
                fontSize: 11,
                letterSpacing: 4,
                marginTop: 18,
              }}
            >
              {label}
            </div>
          )}
        </div>
      ),
      size
    )
  }

  // ── Active card with preview image ───────────────────────────
  // previewImageUrl is a protected delivery URL (/api/media/[id]?ctx=share-preview)
  // or an avatar path. Never a raw storage path.
  const bgUrl = `${APP_URL}${payload.previewImageUrl}`

  const titleFontSize = payload.title.length > 70 ? 34 : payload.title.length > 45 ? 42 : 50
  const displayTitle =
    payload.title.length > 100 ? payload.title.slice(0, 97) + '…' : payload.title

  const showWatermark = !!payload.assetId && isWatermarkEnabled('share-preview')
  // Push title above watermark bar when it's visible
  const titleBottom = showWatermark ? 52 + OG_WATERMARK_BAR_HEIGHT : 52

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#080808',
        }}
      >
        {/* Background: preview derivative — not original */}
        <img
          src={bgUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.12) 100%)',
          }}
        />

        {/* Watermark bar — bottom edge, branded protection */}
        {showWatermark && (
          <OgWatermark
            imageWidth={size.width}
            imageHeight={size.height}
            assetId={payload.assetId!}
            attribution={payload.creatorName}
          />
        )}

        {/* Wordmark — top left */}
        <Wordmark />

        {/* Creator + title — bottom left, raised above watermark bar */}
        <div
          style={{
            position: 'absolute',
            bottom: titleBottom,
            left: 56,
            right: 56,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {payload.creatorName && (
            <div
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: 'uppercase' as const,
              }}
            >
              {payload.creatorName}
            </div>
          )}
          <div
            style={{
              color: 'white',
              fontSize: titleFontSize,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: 860,
            }}
          >
            {displayTitle}
          </div>
        </div>
      </div>
    ),
    size
  )
}
