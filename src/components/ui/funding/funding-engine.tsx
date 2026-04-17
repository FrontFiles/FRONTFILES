'use client'

import type { FundingCase } from '@/lib/funding/types'
import { useFundingEngine } from '@/hooks/use-funding-engine'
import { FundingIdentity } from './funding-identity'
import { FundingStatusStrip } from './funding-status-strip'
import { FundingCadenceSelector } from './funding-cadence-selector'
import { FundingAmountGrid } from './funding-amount-grid'
import { FundingRuleNotice } from './funding-rule-notice'
import { FundingStripePanel } from './funding-stripe-panel'
import { FundingSummary } from './funding-summary'
import { FundingSuccess, FundingError, FundingUnavailable } from './funding-states'

interface FundingEngineProps {
  fundingCase: FundingCase
}

export function FundingEngine({ fundingCase }: FundingEngineProps) {
  const {
    state,
    selectTier,
    setCustomAmount,
    setCadence,
    goToPayment,
    goBackToSelect,
    submitPayment,
    dismissError,
    reset,
    setCardComplete,
  } = useFundingEngine(fundingCase)

  const { ui, payment } = state
  const fc = state.fundingCase

  // Guard: no case loaded
  if (!fc) return null

  // Guard: terminal lifecycle states
  if (fc.lifecycle === 'cancelled' || fc.lifecycle === 'failed') {
    return (
      <div className="space-y-0">
        <FundingIdentity fundingCase={fc} />
        <FundingUnavailable reason={
          fc.lifecycle === 'cancelled'
            ? 'This funding campaign has been cancelled.'
            : 'This funding campaign did not reach its threshold.'
        } />
      </div>
    )
  }

  if (fc.lifecycle === 'completed') {
    return (
      <div className="space-y-0">
        <FundingIdentity fundingCase={fc} />
        <FundingStatusStrip fundingCase={fc} />
        <FundingUnavailable reason="This funding campaign has been completed. Thank you to all contributors!" />
      </div>
    )
  }

  // Success state
  if (ui.step === 'success') {
    return (
      <div className="space-y-0">
        <FundingIdentity fundingCase={fc} />
        <FundingStatusStrip fundingCase={fc} />
        <FundingSuccess
          message={ui.successMessage ?? 'Payment successful!'}
          amountCents={ui.resolvedAmountCents}
          onReset={reset}
        />
      </div>
    )
  }

  // Error state
  if (ui.step === 'error') {
    return (
      <div className="space-y-0">
        <FundingIdentity fundingCase={fc} />
        <FundingStatusStrip fundingCase={fc} />
        <FundingError
          error={ui.error ?? 'An unexpected error occurred.'}
          onDismiss={dismissError}
          onRetry={submitPayment}
        />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Identity */}
      <FundingIdentity fundingCase={fc} />

      {/* Progress */}
      <FundingStatusStrip fundingCase={fc} />

      {/* Amount selection step */}
      {ui.step === 'select' && (
        <>
          {/* Cadence */}
          <FundingCadenceSelector
            allowedCadences={fc.paymentRule.allowedCadences}
            selected={ui.selectedCadence}
            onSelect={setCadence}
          />

          {/* Amount grid */}
          <FundingAmountGrid
            fundingCase={fc}
            selectedTierId={ui.selectedTierId}
            customAmountCents={ui.customAmountCents}
            onSelectTier={selectTier}
            onSetCustomAmount={setCustomAmount}
          />

          {/* Payment rule breakdown */}
          <FundingRuleNotice
            paymentRule={fc.paymentRule}
            selectedCadence={ui.selectedCadence}
            resolvedAmountCents={ui.resolvedAmountCents}
          />
        </>
      )}

      {/* Payment step */}
      {(ui.step === 'payment' || ui.step === 'confirm' || ui.step === 'processing') && (
        <>
          {/* Rule notice stays visible */}
          <FundingRuleNotice
            paymentRule={fc.paymentRule}
            selectedCadence={ui.selectedCadence}
            resolvedAmountCents={ui.resolvedAmountCents}
          />

          {/* Stripe card panel */}
          <FundingStripePanel
            onCardComplete={setCardComplete}
            onBack={goBackToSelect}
            error={payment.lastError}
          />
        </>
      )}

      {/* Error banner (inline) —
          Soft/transient error message. The terminal `step === 'error'`
          branch already returns the full FundingError screen above, so
          at this point step is narrowed to select|payment|confirm|processing.
          The inline banner covers errors the reducer surfaces without
          transitioning to the terminal error step. */}
      {ui.error && (
        <div className="border-2 border-red-200 bg-red-50 px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{ui.error}</p>
          <button onClick={dismissError} className="text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-wider">Dismiss</button>
        </div>
      )}

      {/* Sticky summary / CTA */}
      <FundingSummary
        resolvedAmountCents={ui.resolvedAmountCents}
        selectedCadence={ui.selectedCadence}
        step={ui.step}
        processing={payment.processing}
        onContinue={goToPayment}
        onSubmit={submitPayment}
      />
    </div>
  )
}
