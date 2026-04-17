'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { AccountShell } from '@/components/account/AccountShell'
import { LegalIdentityPrompt } from '@/components/account/LegalIdentityPrompt'
import {
  useUser,
  useBuyerAccount,
  useCreatorProfile,
  useCompanyMemberships,
} from '@/lib/user-context'
import {
  mockLightbox,
  mockTransactions,
  mockSettlements,
  mockVaultAssets,
} from '@/lib/mock-data'
import { savedSearches } from '@/data/searches'
import {
  PAYOUT_STATE_LABELS,
  LICENCE_TYPE_LABELS,
  USER_TYPE_LABELS,
} from '@/lib/types'

type OverviewTab = 'summary' | 'transactions' | 'lightboxes'

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<OverviewTab>('summary')
  const { sessionUser, activeUserType, grantedUserTypes } = useUser()
  const creatorProfile = useCreatorProfile()
  const buyerAccount = useBuyerAccount()
  const memberships = useCompanyMemberships()

  // Scope saved-search count to searches matching the current
  // session's grants (Phase A placeholder — the mock dataset has
  // no per-user id yet).
  const savedSearchCount = savedSearches.filter((s) =>
    grantedUserTypes.includes(s.userType),
  ).length

  const activeMembershipsCount = memberships.filter(
    (m) => m.status === 'active',
  ).length

  const tabs: { key: OverviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'lightboxes', label: 'Lightboxes' },
  ]

  return (
    <AccountShell
      title="Account"
      description={`Signed in as ${USER_TYPE_LABELS[activeUserType]}. Pick a section on the left to edit your identity data.`}
    >
      <div className="flex flex-col gap-8">
        {/* ── Identity summary panel ─────────── */}
        <Panel
          title={`${USER_TYPE_LABELS[activeUserType]} account`}
          headerStyle="black"
          borderStyle="emphasis"
        >
          <div className="grid grid-cols-2 gap-4">
            <KeyValue label="Name" value={sessionUser.displayName} bold />
            <KeyValue label="Email" value={sessionUser.email} />
            {creatorProfile?.professional_title && (
              <KeyValue
                label="Title"
                value={creatorProfile.professional_title}
              />
            )}
            {buyerAccount?.company_name && (
              <KeyValue label="Company" value={buyerAccount.company_name} />
            )}
            <KeyValue
              label="Active type"
              value={USER_TYPE_LABELS[activeUserType]}
            />
            <KeyValue
              label="Granted types"
              value={grantedUserTypes.map((t) => USER_TYPE_LABELS[t]).join(', ')}
            />
            <KeyValue
              label="Status"
              value={sessionUser.accountState}
              capitalize
            />
            {activeMembershipsCount > 0 && (
              <KeyValue
                label="Companies"
                value={`${activeMembershipsCount} active`}
              />
            )}
          </div>
        </Panel>

        {/* ── Legal identity prompt ─────────────
            Phase D — neutral account-side launch. Same
            reusable card the app uses at JIT launch points
            elsewhere; the `account_setup` scenario selects
            the calm, non-payout framing. */}
        <LegalIdentityPrompt scenario="account_setup" />

        {/* ── Quick links to editors ──────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink
            href="/account/profile"
            label="Profile"
            detail="Name, avatar, professional title, biography"
          />
          <QuickLink
            href="/account/personal-info"
            label="Personal info"
            detail="Email and contact details"
          />
          {(grantedUserTypes.includes('buyer') || buyerAccount) && (
            <QuickLink
              href="/account/buyer"
              label="Buyer details"
              detail="Individual or company, VAT, tax id"
            />
          )}
          {(grantedUserTypes.includes('buyer') ||
            buyerAccount ||
            memberships.length > 0) && (
            <QuickLink
              href="/account/companies"
              label="Companies"
              detail="Your company memberships and roles"
            />
          )}
          <QuickLink
            href="/account/security"
            label="Security"
            detail="Session, authentication, and verification"
          />
        </div>

        {/* ── Tabs (existing transactions/lightboxes) ── */}
        <div className="flex items-center border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-[#0000ff] text-black'
                  : 'text-slate-400 hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Transactions" value={mockTransactions.length} />
            <StatCard label="Lightboxes" value={1} />
            <StatCard label="Saved searches" value={savedSearchCount} />
          </div>
        )}

        {activeTab === 'transactions' &&
          (mockTransactions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {mockTransactions.map((txn) => {
                const asset = mockVaultAssets.find((a) => a.id === txn.assetId)
                const settlement = mockSettlements.find(
                  (s) => s.transactionId === txn.id,
                )
                return (
                  <div
                    key={txn.id}
                    className="border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-black">
                          {asset?.title ?? txn.assetId}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {txn.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-400">
                            {LICENCE_TYPE_LABELS[txn.licenceType]}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-1">
                          {new Date(txn.completedAt).toLocaleDateString(
                            'en-GB',
                            { day: '2-digit', month: 'short', year: 'numeric' },
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm font-bold text-black">
                          &euro;{(txn.buyerPays / 100).toFixed(2)}
                        </div>
                        {settlement && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                            {PAYOUT_STATE_LABELS[settlement.state]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyPanel
              message="No transactions yet"
              detail="Licence assets to see transaction history"
            />
          ))}

        {activeTab === 'lightboxes' && (
          <div className="flex flex-col gap-3">
            <a
              href="/lightbox"
              className="border-2 border-black px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-black">
                    {mockLightbox.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {mockLightbox.assetIds.length} assets · Updated{' '}
                    {new Date(mockLightbox.updatedAt).toLocaleDateString(
                      'en-GB',
                      { day: '2-digit', month: 'short', year: 'numeric' },
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  View &rarr;
                </span>
              </div>
            </a>
          </div>
        )}
      </div>
    </AccountShell>
  )
}

// ── Small building blocks ────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-black px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
        {label}
      </span>
      <span className="text-2xl font-bold text-black font-mono mt-1 block">
        {value}
      </span>
    </div>
  )
}

function KeyValue({
  label,
  value,
  bold,
  capitalize,
}: {
  label: string
  value: string
  bold?: boolean
  capitalize?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span
        className={`text-sm text-black ${bold ? 'font-bold' : ''} ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function QuickLink({
  href,
  label,
  detail,
}: {
  href: string
  label: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="border-2 border-black px-4 py-3 hover:bg-slate-50 transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">
            {label}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{detail}</div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] group-hover:text-[#0000cc] shrink-0">
          Open →
        </span>
      </div>
    </Link>
  )
}
