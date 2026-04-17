'use client'

/**
 * Frontfiles — Artifact Row
 *
 * Renders a single artifact within a buyer pack's artifact list.
 * Consumes buildArtifactRowViewModel for all state logic.
 *
 * For original_file artifacts, download errors from the media
 * route are surfaced using the same deny-message mapping as the
 * asset download bar — the entitlement boundary is preserved.
 *
 * Placement: inside pack detail page artifact list.
 */

import { useState, useCallback } from 'react'
import { Loader2, FileText, Download, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildArtifactRowViewModel } from '@/lib/download-ui'
import { mapDenyReasonToUi } from '@/lib/deny-messages'
import type { ArtifactType, ArtifactStatus } from '@/lib/fulfilment'
import { cn } from '@/lib/utils'

interface ArtifactRowProps {
  artifactId: string
  packageId: string
  artifactType: ArtifactType
  status: ArtifactStatus
  /** For original_file artifacts, the vault asset ID for redirect. */
  assetId?: string | null
}

export function ArtifactRow({
  artifactId,
  packageId,
  artifactType,
  status,
  assetId,
}: ArtifactRowProps) {
  const [originalDenyReason, setOriginalDenyReason] = useState<string | null>(null)

  const vm = buildArtifactRowViewModel({ artifactType, status })

  const handleClick = useCallback(async () => {
    setOriginalDenyReason(null)

    if (vm.action === 'download') {
      // Non-original artifact: fetch directly from artifact endpoint.
      try {
        const res = await fetch(
          `/api/packages/${packageId}/artifacts/${artifactId}`,
        )
        if (!res.ok) {
          // TODO: handle error (show inline toast or retry)
        }
        // TODO: on success, trigger browser download from response blob
      } catch {
        // network error
      }
    }

    if (vm.action === 'download_original') {
      // original_file: the artifact endpoint 302-redirects to the
      // media route, which independently checks entitlement.
      // If the media route denies, we show the same deny messages
      // as the asset download bar.
      try {
        const res = await fetch(
          `/api/packages/${packageId}/artifacts/${artifactId}`,
          { redirect: 'follow' },
        )
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}))
          setOriginalDenyReason(body.code ?? null)
        } else if (!res.ok) {
          // TODO: handle other errors
        }
        // TODO: on success, trigger browser download
      } catch {
        // network error
      }
    }
  }, [vm.action, packageId, artifactId])

  const denyMsg = originalDenyReason
    ? mapDenyReasonToUi(originalDenyReason, 'buyer')
    : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="size-4 text-muted-foreground" />
          <span className={cn(
            vm.buttonDisabled && status !== 'available' && 'text-muted-foreground',
          )}>
            {vm.label}
          </span>
          {vm.tooltip && (
            <span title={vm.tooltip}>
              <AlertCircle className="size-3.5 text-muted-foreground" />
            </span>
          )}
        </div>

        <Button
          variant={vm.buttonVariant}
          size="sm"
          disabled={vm.buttonDisabled}
          onClick={handleClick}
        >
          {vm.showSpinner && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
          {!vm.showSpinner && vm.action !== 'none' && (
            <Download className="size-3.5" data-icon="inline-start" />
          )}
          {vm.buttonLabel}
        </Button>
      </div>

      {denyMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <h4 className="text-sm font-medium">{denyMsg.title}</h4>
          <p className="mt-0.5 text-sm opacity-80">{denyMsg.body}</p>
        </div>
      )}
    </div>
  )
}
