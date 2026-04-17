'use client'

import Link from 'next/link'
import { AccountShell } from '@/components/account/AccountShell'
import { BuyerAccountEditor } from '@/components/account/BuyerAccountEditor'
import { LegalIdentityPrompt } from '@/components/account/LegalIdentityPrompt'
import { EmptyPanel } from '@/components/platform/Panel'
import { useUser } from '@/lib/user-context'
import { useViewer, isBuyer } from '@/lib/identity/permissions'

export default function AccountBuyerPage() {
  const { sessionUser } = useUser()
  const viewer = useViewer()
  const buyerAccount = viewer.buyerAccount

  const hasBuyerGrant = isBuyer(viewer)

  return (
    <AccountShell
      title="Buyer details"
      description="Your buyer facet — individual or company, plus any VAT or tax identifiers."
    >
      {!hasBuyerGrant && buyerAccount === null ? (
        <div className="flex flex-col gap-4">
          <EmptyPanel
            message="No buyer account yet"
            detail="You do not currently hold a buyer grant."
          />
          <p className="text-xs text-slate-400">
            Adding a buyer facet to an existing account is a later-phase
            flow. Until then, only users who completed buyer onboarding
            (or were seeded with a buyer grant) will see this editor.
          </p>
          <Link
            href="/account"
            className="self-start text-[11px] font-bold uppercase tracking-[0.14em] text-[#0000ff] hover:text-[#0000cc]"
          >
            ← Back to account
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Phase D — JIT legal identity launch.
              Buyer licensing is trust-sensitive: high-value
              licences, assignment funding, and signed
              contracts all rely on a verified legal identity.
              The `buyer_trust` scenario swaps the drawer into
              buyer-trust copy (not payout-focused) and adapts
              the company field labels to "Authorized
              representative" / "Role at company". Hidden when
              already verified so a satisfied buyer does not see
              stale noise. */}
          <LegalIdentityPrompt scenario="buyer_trust" hideWhenVerified />
          <BuyerAccountEditor
            sessionUser={sessionUser}
            buyerAccount={buyerAccount}
          />
        </div>
      )}
    </AccountShell>
  )
}
