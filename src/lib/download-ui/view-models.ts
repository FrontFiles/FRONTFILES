/**
 * Frontfiles — Download View-Model Builders
 *
 * Pure functions that turn backend entitlement/deny state into
 * concrete UI state (button labels, variants, banners).
 *
 * BOUNDARY:
 *   These functions do not make API calls or authorization
 *   decisions. They map ALREADY-DECIDED outcomes into UI shapes.
 *   Copy comes from @/lib/deny-messages; this module only
 *   decides WHICH copy to show and HOW to present it.
 */

import type { DenyReason, Audience } from '@/lib/deny-messages'
import { mapDenyReasonToUi } from '@/lib/deny-messages'
import type { PackageStatus, ArtifactStatus, ArtifactType } from '@/lib/fulfilment'

// ══════════════════════════════════════════════
// SHARED TYPES
// ══════════════════════════════════════════════

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'destructive'

// ══════════════════════════════════════════════
// ASSET DOWNLOAD (lightbox / asset detail)
// ══════════════════════════════════════════════

export interface AssetDownloadViewModel {
  primaryLabel: string
  primaryVariant: ButtonVariant
  primaryDisabled: boolean
  showSpinner: boolean
  bannerTitle?: string
  bannerBody?: string
  /** Hint for the action handler: what the button press should do. */
  action: 'download' | 'purchase' | 'renew' | 'contact_support' | 'request_access' | 'retry' | 'none'
}

export function buildAssetDownloadViewModel(params: {
  audience: Audience
  isCreator: boolean
  entitlement: { entitled: boolean; reason?: string }
  isDownloading: boolean
}): AssetDownloadViewModel {
  const { audience, isCreator, entitlement, isDownloading } = params

  // Creator self-access — always allowed
  if (isCreator) {
    return {
      primaryLabel: isDownloading ? 'Downloading\u2026' : 'Download original',
      primaryVariant: 'default',
      primaryDisabled: isDownloading,
      showSpinner: isDownloading,
      action: isDownloading ? 'none' : 'download',
    }
  }

  // Entitled buyer
  if (entitlement.entitled) {
    return {
      primaryLabel: isDownloading ? 'Downloading\u2026' : 'Download original',
      primaryVariant: 'default',
      primaryDisabled: isDownloading,
      showSpinner: isDownloading,
      action: isDownloading ? 'none' : 'download',
    }
  }

  // Denied — map reason to specific UI state
  const reason = entitlement.reason as DenyReason | undefined
  const msg = mapDenyReasonToUi(reason, audience)

  switch (reason) {
    case 'NO_ACTIVE_GRANT':
      return {
        primaryLabel: 'Purchase licence',
        primaryVariant: 'default',
        primaryDisabled: false,
        showSpinner: false,
        action: 'purchase',
        // No negative banner — this is the normal pre-purchase state.
      }

    case 'GRANT_EXPIRED':
      return {
        primaryLabel: 'Renew licence',
        primaryVariant: 'default',
        primaryDisabled: false,
        showSpinner: false,
        bannerTitle: msg.title,
        bannerBody: msg.body,
        action: 'renew',
      }

    case 'GRANT_SUSPENDED':
    case 'GRANT_REVOKED':
      return {
        primaryLabel: 'Contact support',
        primaryVariant: 'outline',
        primaryDisabled: false,
        showSpinner: false,
        bannerTitle: msg.title,
        bannerBody: msg.body,
        action: 'contact_support',
      }

    case 'NO_READY_ORIGINAL_MEDIA':
      return {
        primaryLabel: 'Preparing original\u2026',
        primaryVariant: 'secondary',
        primaryDisabled: true,
        showSpinner: true,
        bannerTitle: msg.title,
        bannerBody: msg.body,
        action: 'none',
      }

    case 'NO_ACTIVE_COMPANY_MEMBERSHIP':
    case 'INSUFFICIENT_COMPANY_ROLE':
      return {
        primaryLabel: 'Request access',
        primaryVariant: 'outline',
        primaryDisabled: false,
        showSpinner: false,
        bannerTitle: msg.title,
        bannerBody: msg.body,
        action: 'request_access',
      }

    default:
      return {
        primaryLabel: 'Try again',
        primaryVariant: 'outline',
        primaryDisabled: false,
        showSpinner: false,
        bannerTitle: msg.title,
        bannerBody: msg.body,
        action: 'retry',
      }
  }
}

// ══════════════════════════════════════════════
// PACK HEADER (buyer pack / creator pack)
// ══════════════════════════════════════════════

export interface PackHeaderViewModel {
  title: string
  primaryLabel: string
  primaryVariant: ButtonVariant
  primaryDisabled: boolean
  showSpinner: boolean
  bannerTitle?: string
  bannerBody?: string
  action: 'download' | 'contact_support' | 'retry' | 'none'
}

export function buildPackHeaderViewModel(params: {
  kind: 'buyer_pack' | 'creator_pack'
  status: PackageStatus
  /** Set when a download attempt returned a deny code (409). */
  downloadError?: { code?: string }
}): PackHeaderViewModel {
  const { kind, status, downloadError } = params
  const packLabel = kind === 'buyer_pack' ? 'buyer pack' : 'creator pack'

  // If a download was attempted and got a specific error, that
  // takes precedence over the static status (the user clicked
  // the button and needs to see the API's response).
  if (downloadError?.code) {
    const msg = mapDenyReasonToUi(downloadError.code, 'buyer')
    return {
      title: kind === 'buyer_pack' ? 'Buyer pack' : 'Creator pack',
      primaryLabel: downloadError.code === 'PACKAGE_NOT_READY'
        ? `Preparing ${packLabel}\u2026`
        : 'Contact support',
      primaryVariant: downloadError.code === 'PACKAGE_NOT_READY' ? 'secondary' : 'outline',
      primaryDisabled: downloadError.code === 'PACKAGE_NOT_READY',
      showSpinner: downloadError.code === 'PACKAGE_NOT_READY',
      bannerTitle: msg.title,
      bannerBody: msg.body,
      action: downloadError.code === 'PACKAGE_NOT_READY' ? 'none' : 'contact_support',
    }
  }

  // Static status-based states
  switch (status) {
    case 'ready':
      return {
        title: kind === 'buyer_pack' ? 'Buyer pack' : 'Creator pack',
        primaryLabel: `Download ${packLabel}`,
        primaryVariant: 'default',
        primaryDisabled: false,
        showSpinner: false,
        action: 'download',
      }

    case 'building':
      return {
        title: kind === 'buyer_pack' ? 'Buyer pack' : 'Creator pack',
        primaryLabel: `Preparing ${packLabel}\u2026`,
        primaryVariant: 'secondary',
        primaryDisabled: true,
        showSpinner: true,
        bannerTitle: 'Pack is still building',
        bannerBody: "We're generating your documents. This pack will be ready to download soon.",
        action: 'none',
      }

    case 'failed':
      return {
        title: kind === 'buyer_pack' ? 'Buyer pack' : 'Creator pack',
        primaryLabel: 'Retry',
        primaryVariant: 'outline',
        primaryDisabled: false,
        showSpinner: false,
        bannerTitle: 'Pack generation failed',
        bannerBody: 'Something went wrong while building this pack. Try again or contact support.',
        action: 'retry',
      }

    case 'revoked':
      return {
        title: kind === 'buyer_pack' ? 'Buyer pack' : 'Creator pack',
        primaryLabel: 'Pack revoked',
        primaryVariant: 'secondary',
        primaryDisabled: true,
        showSpinner: false,
        bannerTitle: 'Pack no longer available',
        bannerBody: 'This pack was revoked. Your transaction history still records that it existed.',
        action: 'none',
      }
  }
}

// ══════════════════════════════════════════════
// ARTIFACT ROW (buyer pack artifact list)
// ══════════════════════════════════════════════

export interface ArtifactRowViewModel {
  label: string
  buttonLabel: string
  buttonVariant: ButtonVariant
  buttonDisabled: boolean
  showSpinner: boolean
  tooltip?: string
  /** When true, the row should use the asset download deny
   *  messages if the media route denies the original. */
  isOriginalFile: boolean
  action: 'download' | 'download_original' | 'none'
}

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  certificate: 'Certificate',
  licence_agreement: 'Standard Editorial Licence',
  original_file: 'Original file',
  contract_with_frontfiles: 'Platform contract',
  invoice: 'Invoice',
  payment_receipt: 'Payment receipt',
  payout_summary: 'Payout summary',
}

export function buildArtifactRowViewModel(params: {
  artifactType: ArtifactType
  status: ArtifactStatus
}): ArtifactRowViewModel {
  const { artifactType, status } = params
  const label = ARTIFACT_TYPE_LABELS[artifactType]
  const isOriginalFile = artifactType === 'original_file'

  switch (status) {
    case 'available':
      return {
        label,
        buttonLabel: isOriginalFile ? 'Download original' : 'Download',
        buttonVariant: isOriginalFile ? 'default' : 'outline',
        buttonDisabled: false,
        showSpinner: false,
        isOriginalFile,
        action: isOriginalFile ? 'download_original' : 'download',
      }

    case 'pending':
    case 'generated':
      return {
        label,
        buttonLabel: 'Generating\u2026',
        buttonVariant: 'secondary',
        buttonDisabled: true,
        showSpinner: true,
        tooltip: 'This document is still being generated.',
        isOriginalFile,
        action: 'none',
      }

    case 'failed':
      return {
        label,
        buttonLabel: 'Failed',
        buttonVariant: 'destructive',
        buttonDisabled: true,
        showSpinner: false,
        tooltip: 'Document generation failed. Contact support if this persists.',
        isOriginalFile,
        action: 'none',
      }

    case 'revoked':
      return {
        label,
        buttonLabel: 'Revoked',
        buttonVariant: 'secondary',
        buttonDisabled: true,
        showSpinner: false,
        tooltip: 'This document has been revoked.',
        isOriginalFile,
        action: 'none',
      }
  }
}
