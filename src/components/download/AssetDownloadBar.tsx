'use client'

/**
 * Frontfiles — Asset Download Bar
 *
 * Renders the download action strip for asset detail / lightbox.
 * Consumes buildAssetDownloadViewModel for all state logic.
 *
 * Placement: inside asset detail panel or lightbox footer.
 */

import { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildAssetDownloadViewModel } from '@/lib/download-ui'
import type { Audience } from '@/lib/deny-messages'
import { cn } from '@/lib/utils'

interface AssetDownloadBarProps {
  assetId: string
  audience: Audience
  isCreator: boolean
  entitlement: { entitled: boolean; reason?: string }
}

export function AssetDownloadBar({
  assetId,
  audience,
  isCreator,
  entitlement,
}: AssetDownloadBarProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const vm = buildAssetDownloadViewModel({
    audience,
    isCreator,
    entitlement,
    isDownloading,
  })

  const handleClick = useCallback(async () => {
    switch (vm.action) {
      case 'download': {
        setIsDownloading(true)
        try {
          // TODO: replace with real download trigger
          // (signed URL fetch or window.location assignment)
          const res = await fetch(`/api/media/${assetId}?delivery=original`)
          if (!res.ok) {
            // Error handling would re-probe entitlement or show inline error.
          }
        } finally {
          setIsDownloading(false)
        }
        break
      }
      case 'purchase':
        // TODO: navigate to purchase flow
        break
      case 'renew':
        // TODO: navigate to licence renewal
        break
      case 'contact_support':
        // TODO: open support dialog or mailto
        break
      case 'request_access':
        // TODO: open company access request flow
        break
      case 'retry':
        // Re-probe entitlement or retry download
        break
    }
  }, [vm.action, assetId])

  return (
    <div className="flex flex-col gap-3">
      {vm.bannerTitle && (
        <div className={cn(
          'rounded-lg border px-4 py-3',
          vm.action === 'none'
            ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
        )}>
          <h4 className="text-sm font-medium">{vm.bannerTitle}</h4>
          <p className="mt-0.5 text-sm opacity-80">{vm.bannerBody}</p>
        </div>
      )}

      <Button
        variant={vm.primaryVariant}
        disabled={vm.primaryDisabled}
        onClick={handleClick}
      >
        {vm.showSpinner && <Loader2 className="animate-spin" data-icon="inline-start" />}
        {vm.primaryLabel}
      </Button>
    </div>
  )
}
