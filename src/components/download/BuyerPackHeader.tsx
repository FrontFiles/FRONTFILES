'use client'

/**
 * Frontfiles — Buyer Pack Header
 *
 * Renders the header section of a buyer (Blue) or creator (White)
 * pack detail page with download action and status banners.
 * Consumes buildPackHeaderViewModel for all state logic.
 *
 * Placement: top of /packs/:packageId detail page.
 */

import { useState, useCallback } from 'react'
import { Loader2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildPackHeaderViewModel } from '@/lib/download-ui'
import type { PackageStatus, PackageKind } from '@/lib/fulfilment'
import { cn } from '@/lib/utils'

interface BuyerPackHeaderProps {
  packageId: string
  packageNumber: string
  kind: PackageKind
  status: PackageStatus
}

export function BuyerPackHeader({
  packageId,
  packageNumber,
  kind,
  status,
}: BuyerPackHeaderProps) {
  const [downloadError, setDownloadError] = useState<{ code?: string } | undefined>()

  const vm = buildPackHeaderViewModel({ kind, status, downloadError })

  const handleClick = useCallback(async () => {
    if (vm.action === 'download') {
      setDownloadError(undefined)
      try {
        const res = await fetch(`/api/packages/${packageId}/download`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setDownloadError({ code: body.code })
        }
        // TODO: on success, trigger browser download from response blob
      } catch {
        setDownloadError({ code: undefined })
      }
    }
    // retry resets the error and re-attempts
    if (vm.action === 'retry') {
      setDownloadError(undefined)
    }
  }, [vm.action, packageId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-muted-foreground" />
          <div>
            <h2 className="text-base font-semibold">{vm.title}</h2>
            <p className="text-sm text-muted-foreground">{packageNumber}</p>
          </div>
        </div>

        <Button
          variant={vm.primaryVariant}
          disabled={vm.primaryDisabled}
          onClick={handleClick}
        >
          {vm.showSpinner && <Loader2 className="animate-spin" data-icon="inline-start" />}
          {vm.primaryLabel}
        </Button>
      </div>

      {vm.bannerTitle && (
        <div className={cn(
          'rounded-lg border px-4 py-3',
          status === 'revoked' || status === 'failed'
            ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
            : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
        )}>
          <h4 className="text-sm font-medium">{vm.bannerTitle}</h4>
          <p className="mt-0.5 text-sm opacity-80">{vm.bannerBody}</p>
        </div>
      )}
    </div>
  )
}
