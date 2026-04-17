/**
 * Download UI View-Models — Tests
 *
 * Tests the pure view-model builder functions that map backend
 * entitlement/deny/pack state into concrete UI shapes.
 *
 * These are the testable state-machine assertions for the
 * happy-path QA matrix cases:
 *
 *   #1  Entitled buyer → "Download original"
 *   #4  Creator self-access → "Download original"
 *   #7  Ready buyer pack → "Download buyer pack"
 *   #8  Invoice artifact → "Download"
 *   #9  Certificate artifact → "Download"
 *   #10 original_file artifact → "Download original" (internal delegation)
 *   #14 VM: entitled buyer asset strip
 *   #15 VM: ready buyer pack header
 *
 * CANONICAL BEHAVIOR (original_file artifacts):
 *   The artifact route performs internal server-side delegation.
 *   It does NOT issue a 302 redirect. The expected response is:
 *     - HTTP 200 with file bytes
 *     - Header X-Frontfiles-Via: package-artifact
 *     - Two download_events rows:
 *       1. channel=package_artifact, outcome=redirected, http_status=200
 *       2. channel=original_media, outcome=allowed, http_status=200
 */

import { describe, it, expect } from 'vitest'
import {
  buildAssetDownloadViewModel,
  buildPackHeaderViewModel,
  buildArtifactRowViewModel,
} from '../view-models'

// ══════════════════════════════════════════════
// ASSET DOWNLOAD VIEW-MODEL
// ══════════════════════════════════════════════

describe('buildAssetDownloadViewModel', () => {
  describe('happy path states', () => {
    it('shows "Download original" for entitled buyer', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: true },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Download original',
        primaryVariant: 'default',
        primaryDisabled: false,
        showSpinner: false,
        action: 'download',
      })
      expect(vm.bannerTitle).toBeUndefined()
    })

    it('shows "Download original" for creator self-access', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'creator',
        isCreator: true,
        entitlement: { entitled: true },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Download original',
        action: 'download',
      })
      expect(vm.bannerTitle).toBeUndefined()
    })

    it('shows "Downloading…" while download is in progress', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: true },
        isDownloading: true,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Downloading\u2026',
        primaryDisabled: true,
        showSpinner: true,
        action: 'none',
      })
    })
  })

  describe('deny states', () => {
    it('shows "Purchase licence" for NO_ACTIVE_GRANT (no banner)', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: false, reason: 'NO_ACTIVE_GRANT' },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Purchase licence',
        primaryVariant: 'default',
        action: 'purchase',
      })
      expect(vm.bannerTitle).toBeUndefined()
    })

    it('shows "Renew licence" with banner for GRANT_EXPIRED', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: false, reason: 'GRANT_EXPIRED' },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Renew licence',
        action: 'renew',
      })
      expect(vm.bannerTitle).toBeDefined()
      expect(vm.bannerBody).toBeDefined()
    })

    it('shows "Contact support" for GRANT_SUSPENDED', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: false, reason: 'GRANT_SUSPENDED' },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Contact support',
        primaryVariant: 'outline',
        action: 'contact_support',
      })
      expect(vm.bannerTitle).toBeDefined()
    })

    it('shows "Contact support" for GRANT_REVOKED', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: false, reason: 'GRANT_REVOKED' },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Contact support',
        action: 'contact_support',
      })
    })

    it('shows disabled "Preparing original…" for NO_READY_ORIGINAL_MEDIA', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: false, reason: 'NO_READY_ORIGINAL_MEDIA' },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Preparing original\u2026',
        primaryDisabled: true,
        showSpinner: true,
        action: 'none',
      })
      expect(vm.bannerTitle).toBeDefined()
    })

    it('shows "Request access" for company membership issues', () => {
      for (const reason of ['NO_ACTIVE_COMPANY_MEMBERSHIP', 'INSUFFICIENT_COMPANY_ROLE'] as const) {
        const vm = buildAssetDownloadViewModel({
          audience: 'buyer',
          isCreator: false,
          entitlement: { entitled: false, reason },
          isDownloading: false,
        })

        expect(vm).toMatchObject({
          primaryLabel: 'Request access',
          primaryVariant: 'outline',
          action: 'request_access',
        })
        expect(vm.bannerTitle).toBeDefined()
      }
    })

    it('shows "Try again" for unknown deny reasons', () => {
      const vm = buildAssetDownloadViewModel({
        audience: 'buyer',
        isCreator: false,
        entitlement: { entitled: false, reason: 'SOME_FUTURE_CODE' },
        isDownloading: false,
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Try again',
        action: 'retry',
      })
    })
  })
})

// ══════════════════════════════════════════════
// PACK HEADER VIEW-MODEL
// ══════════════════════════════════════════════

describe('buildPackHeaderViewModel', () => {
  describe('buyer pack happy path', () => {
    it('shows "Download buyer pack" when status is ready', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'buyer_pack',
        status: 'ready',
      })

      expect(vm).toMatchObject({
        title: 'Buyer pack',
        primaryLabel: 'Download buyer pack',
        primaryVariant: 'default',
        primaryDisabled: false,
        action: 'download',
      })
      expect(vm.bannerTitle).toBeUndefined()
    })

    it('shows disabled spinner when status is building', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'buyer_pack',
        status: 'building',
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Preparing buyer pack\u2026',
        primaryDisabled: true,
        showSpinner: true,
        action: 'none',
      })
      expect(vm.bannerTitle).toBeDefined()
    })

    it('shows "Retry" when status is failed', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'buyer_pack',
        status: 'failed',
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Retry',
        primaryVariant: 'outline',
        action: 'retry',
      })
      expect(vm.bannerTitle).toBeDefined()
    })

    it('shows disabled "Pack revoked" when status is revoked', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'buyer_pack',
        status: 'revoked',
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Pack revoked',
        primaryDisabled: true,
        action: 'none',
      })
      expect(vm.bannerTitle).toBeDefined()
    })
  })

  describe('creator pack', () => {
    it('shows "Download creator pack" when status is ready', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'creator_pack',
        status: 'ready',
      })

      expect(vm).toMatchObject({
        title: 'Creator pack',
        primaryLabel: 'Download creator pack',
        action: 'download',
      })
    })
  })

  describe('download error overrides', () => {
    it('shows building state when download returns PACKAGE_NOT_READY', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'buyer_pack',
        status: 'ready', // status says ready, but download returned 409
        downloadError: { code: 'PACKAGE_NOT_READY' },
      })

      expect(vm).toMatchObject({
        primaryDisabled: true,
        showSpinner: true,
        action: 'none',
      })
      expect(vm.bannerTitle).toBeDefined()
    })

    it('shows "Contact support" for EMPTY_PACKAGE error', () => {
      const vm = buildPackHeaderViewModel({
        kind: 'buyer_pack',
        status: 'ready',
        downloadError: { code: 'EMPTY_PACKAGE' },
      })

      expect(vm).toMatchObject({
        primaryLabel: 'Contact support',
        action: 'contact_support',
      })
      expect(vm.bannerTitle).toBeDefined()
    })
  })
})

// ══════════════════════════════════════════════
// ARTIFACT ROW VIEW-MODEL
// ══════════════════════════════════════════════

describe('buildArtifactRowViewModel', () => {
  describe('non-original artifacts (happy path)', () => {
    it('shows "Download" for available invoice', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'invoice',
        status: 'available',
      })

      expect(vm).toMatchObject({
        label: 'Invoice',
        buttonLabel: 'Download',
        buttonVariant: 'outline',
        buttonDisabled: false,
        isOriginalFile: false,
        action: 'download',
      })
    })

    it('shows "Download" for available certificate', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'certificate',
        status: 'available',
      })

      expect(vm).toMatchObject({
        label: 'Certificate',
        buttonLabel: 'Download',
        action: 'download',
      })
    })

    it('shows "Download" for available licence agreement', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'licence_agreement',
        status: 'available',
      })

      expect(vm).toMatchObject({
        label: 'Standard Editorial Licence',
        action: 'download',
      })
    })
  })

  describe('original_file artifact (internal delegation)', () => {
    /**
     * CANONICAL BEHAVIOR (post-redirect-fix):
     *
     * When the buyer clicks "Download original" in the artifact list:
     *   1. Client calls GET /api/packages/:packageId/artifacts/:artifactId
     *   2. Artifact route performs INTERNAL delegation (no 302):
     *      a. Logs package_artifact event (outcome='redirected', http_status=200)
     *      b. Runs entitlement check via resolveDownloadAuthorization
     *      c. Logs original_media event (outcome='allowed', http_status=200)
     *      d. Returns 200 with file bytes + X-Frontfiles-Via: package-artifact
     *   3. Client receives the file directly — no redirect to follow.
     *
     * Expected audit rows for ONE artifact click:
     *   Row 1: { channel: 'package_artifact', artifact_type: 'original_file',
     *            outcome: 'redirected', http_status: 200 }
     *   Row 2: { channel: 'original_media', outcome: 'allowed',
     *            http_status: 200, licence_grant_id: <grant_id> }
     *
     * This differs from pre-fix behavior where:
     *   - Artifact route returned 302 (http_status was 302)
     *   - Media route was called as a separate HTTP request
     *   - Browser had to forward auth headers (which it didn't)
     */
    it('shows "Download original" with primary variant for available original_file', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'original_file',
        status: 'available',
      })

      expect(vm).toMatchObject({
        label: 'Original file',
        buttonLabel: 'Download original',
        buttonVariant: 'default',
        buttonDisabled: false,
        showSpinner: false,
        isOriginalFile: true,
        action: 'download_original',
      })
    })
  })

  describe('non-available artifact states', () => {
    it('shows "Generating…" for pending artifacts', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'certificate',
        status: 'pending',
      })

      expect(vm).toMatchObject({
        buttonLabel: 'Generating\u2026',
        buttonDisabled: true,
        showSpinner: true,
        action: 'none',
      })
      expect(vm.tooltip).toBeDefined()
    })

    it('shows "Generating…" for generated artifacts', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'licence_agreement',
        status: 'generated',
      })

      expect(vm).toMatchObject({
        buttonLabel: 'Generating\u2026',
        buttonDisabled: true,
        action: 'none',
      })
    })

    it('shows "Failed" for failed artifacts', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'invoice',
        status: 'failed',
      })

      expect(vm).toMatchObject({
        buttonLabel: 'Failed',
        buttonVariant: 'destructive',
        buttonDisabled: true,
        action: 'none',
      })
    })

    it('shows "Revoked" for revoked artifacts', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'certificate',
        status: 'revoked',
      })

      expect(vm).toMatchObject({
        buttonLabel: 'Revoked',
        buttonDisabled: true,
        action: 'none',
      })
    })

    it('shows "Generating…" for pending original_file (same as other artifacts)', () => {
      const vm = buildArtifactRowViewModel({
        artifactType: 'original_file',
        status: 'pending',
      })

      expect(vm).toMatchObject({
        buttonLabel: 'Generating\u2026',
        buttonDisabled: true,
        isOriginalFile: true,
        action: 'none',
      })
    })
  })
})

// ══════════════════════════════════════════════
// EXPECTED AUDIT EVENT SHAPES
//
// These describe constants document the exact download_events
// rows that should be written for each happy-path scenario.
// They serve as the source of truth for integration tests
// when the DB layer is available.
// ══════════════════════════════════════════════

describe('expected audit event shapes (documentation)', () => {
  /**
   * These tests don't call route handlers — they document
   * the expected audit event payloads so that integration
   * tests can assert against them.
   */

  it('documents original download from asset page (QA #3)', () => {
    const expectedEvent = {
      delivery_channel: 'original_media',
      access_basis: 'personal_grant',
      outcome: 'allowed',
      http_status: 200,
      // asset_id: '<asset-id>',
      // licence_grant_id: '<grant-id>',
      // user_id: '<buyer-id>',
    }
    expect(expectedEvent.delivery_channel).toBe('original_media')
    expect(expectedEvent.outcome).toBe('allowed')
  })

  it('documents creator self-access original download (QA #4)', () => {
    const expectedEvent = {
      delivery_channel: 'original_media',
      access_basis: 'creator_self_access',
      outcome: 'allowed',
      http_status: 200,
      // licence_grant_id: null (no grant checked)
    }
    expect(expectedEvent.access_basis).toBe('creator_self_access')
  })

  it('documents package ZIP download (QA #7)', () => {
    const expectedEvent = {
      delivery_channel: 'package_zip',
      access_basis: 'package_owner',
      outcome: 'allowed',
      http_status: 200,
      // package_id: '<package-id>',
    }
    expect(expectedEvent.delivery_channel).toBe('package_zip')
  })

  it('documents non-original artifact download (QA #8, #9)', () => {
    const expectedEvent = {
      delivery_channel: 'package_artifact',
      access_basis: 'package_owner',
      outcome: 'allowed',
      http_status: 200,
      // artifact_type: 'invoice' | 'certificate' | etc.
      // package_id: '<package-id>',
      // artifact_id: '<artifact-id>',
    }
    expect(expectedEvent.delivery_channel).toBe('package_artifact')
    expect(expectedEvent.outcome).toBe('allowed')
  })

  it('documents original_file artifact via internal delegation (QA #10 — replaces old #10 + #11)', () => {
    // OLD BEHAVIOR (obsolete):
    //   - Artifact route returned 302
    //   - Media route was called separately
    //   - Two separate HTTP requests, two audit rows
    //
    // NEW BEHAVIOR (canonical):
    //   - Single HTTP request to artifact route
    //   - Returns 200 with file bytes + X-Frontfiles-Via header
    //   - Two audit rows written from the same request

    const artifactEvent = {
      delivery_channel: 'package_artifact',
      artifact_type: 'original_file',
      access_basis: 'package_owner',
      outcome: 'redirected',
      http_status: 200, // was 302 in old behavior
      // asset_id: '<asset-id>' (set for redirect tracking)
      // package_id: '<package-id>',
      // artifact_id: '<artifact-id>',
    }

    const mediaEvent = {
      delivery_channel: 'original_media',
      access_basis: 'personal_grant', // or 'company_grant' or 'creator_self_access'
      outcome: 'allowed',
      http_status: 200,
      // asset_id: '<asset-id>',
      // licence_grant_id: '<grant-id>',
    }

    // Key assertions for the new behavior:
    expect(artifactEvent.http_status).toBe(200) // NOT 302
    expect(artifactEvent.outcome).toBe('redirected') // conceptual redirect preserved
    expect(mediaEvent.delivery_channel).toBe('original_media') // separate audit domain
    expect(mediaEvent.outcome).toBe('allowed')

    // Both events have the same asset_id for correlation
    // Both events have the same user_id (from same request)
    // The X-Frontfiles-Via: package-artifact header distinguishes
    // this from a direct /api/media download
  })

  it('documents that masked 404s produce zero audit events (QA #12)', () => {
    // When findArtifactForUser returns null (not found or not authorized),
    // the route returns 404 and does NOT write a download_events row.
    // This is by design — cannot distinguish not-found from not-authorized.
    const expectedAuditRowCount = 0
    expect(expectedAuditRowCount).toBe(0)
  })

  it('documents that preview requests produce zero audit events (QA #13)', () => {
    // GET /api/media/:assetId?ctx=preview does NOT write audit events.
    // Only ?delivery=original triggers audit logging.
    const expectedAuditRowCount = 0
    expect(expectedAuditRowCount).toBe(0)
  })
})
