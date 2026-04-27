/**
 * Frontfiles Upload — Rule-Based Price Recommendation Engine
 *
 * Transparent, deterministic pricing scaffold.
 * Not ML. Not fake-AI. Just rules based on observable asset attributes.
 * The UI must show WHY a price was recommended.
 */

import type { AssetFormat, ValidationDeclarationState, PrivacyState, LicenceType } from './types'
import type { PriceRecommendation, PriceFactor } from './batch-types'

// ── Base prices by format (EUR cents) ──

const FORMAT_BASE_PRICE: Record<AssetFormat, number> = {
  photo: 12000,       // €120
  video: 35000,       // €350
  audio: 8000,        // €80
  text: 15000,        // €150
  illustration: 10000, // €100
  infographic: 8000,  // €80
  vector: 6000,       // €60
}

// ── Multipliers ──

const VALIDATION_MULTIPLIER: Record<string, number> = {
  fully_validated: 1.3,
  provenance_pending: 1.0,
  corroborated: 1.4,
  under_review: 0.9,
  // non-transactable states don't get priced
}

const PRIVACY_MULTIPLIER: Record<string, number> = {
  PUBLIC: 1.0,
  RESTRICTED: 1.5,
  // PRIVATE doesn't get priced
}

const LICENCE_PREMIUM: Record<LicenceType, number> = {
  editorial: 0,
  commercial: 0.15,
  broadcast: 0.20,
  print: 0.05,
  digital: 0,
  web: -0.05,
  merchandise: 0.25,
  // Creative Commons is a public-licence path — no commercial premium.
  // Final price math may still set this to free (handled at the recommendation
  // layer); 0 here keeps the multiplier neutral relative to the base.
  creative_commons: 0,
}

export function generatePriceRecommendation(params: {
  format: AssetFormat | null
  declarationState: ValidationDeclarationState | null
  privacy: PrivacyState | null
  enabledLicences: LicenceType[]
  hasStory: boolean
  isExclusive?: boolean
}): PriceRecommendation | null {
  const { format, declarationState, privacy, enabledLicences, hasStory } = params

  // Can't price without format
  if (!format) return null

  // Can't price private assets
  if (privacy === 'PRIVATE') return null

  // Can't price non-transactable validation states
  if (declarationState === 'manifest_invalid' || declarationState === 'disputed' || declarationState === 'invalidated') {
    return null
  }

  const factors: PriceFactor[] = []
  let price = FORMAT_BASE_PRICE[format]

  // Format factor
  factors.push({
    label: format,
    effect: 'neutral',
    weight: 1.0,
  })

  // Validation multiplier
  if (declarationState) {
    const mult = VALIDATION_MULTIPLIER[declarationState] ?? 1.0
    price = Math.round(price * mult)
    factors.push({
      label: declarationState.replace(/_/g, ' '),
      effect: mult > 1 ? 'increase' : mult < 1 ? 'decrease' : 'neutral',
      weight: Math.abs(mult - 1),
    })
  }

  // Privacy multiplier
  if (privacy) {
    const mult = PRIVACY_MULTIPLIER[privacy] ?? 1.0
    price = Math.round(price * mult)
    if (privacy === 'RESTRICTED') {
      factors.push({
        label: 'restricted access',
        effect: 'increase',
        weight: 0.5,
      })
    }
  }

  // Licence premium (cumulative)
  if (enabledLicences.length > 0) {
    const licenceMult = enabledLicences.reduce((sum, l) => sum + (LICENCE_PREMIUM[l] || 0), 0)
    price = Math.round(price * (1 + licenceMult))
    const highValue = enabledLicences.filter(l => LICENCE_PREMIUM[l] > 0)
    if (highValue.length > 0) {
      factors.push({
        label: highValue.join(' + '),
        effect: 'increase',
        weight: licenceMult,
      })
    }
  }

  // Story presence bonus
  if (hasStory) {
    price = Math.round(price * 1.1)
    factors.push({
      label: 'story context',
      effect: 'increase',
      weight: 0.1,
    })
  }

  // Build basis string
  const basisParts: string[] = [format]
  if (privacy) basisParts.push(privacy.toLowerCase())
  if (declarationState) basisParts.push(declarationState.replace(/_/g, ' '))
  if (enabledLicences.length > 0) basisParts.push(enabledLicences.join('+'))

  // Confidence based on how many attributes we have
  let confidence = 0.5
  if (declarationState) confidence += 0.15
  if (privacy) confidence += 0.1
  if (enabledLicences.length > 0) confidence += 0.1
  if (hasStory) confidence += 0.1
  confidence = Math.min(confidence, 0.95)

  return {
    amount: price,
    confidence,
    basis: basisParts.join(' / '),
    factors,
  }
}
