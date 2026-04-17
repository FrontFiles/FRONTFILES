'use client'

import { useEffect, useState } from 'react'
import { Panel, EmptyPanel } from '@/components/platform/Panel'
import { listCompaniesForUser } from '@/lib/identity/store'
import type { SessionUser } from '@/lib/user-context'
import type {
  CompanyMembershipFullRow,
  CompanyRow,
} from '@/lib/db/schema'

interface CompanyMembershipsPanelProps {
  sessionUser: SessionUser
  memberships: CompanyMembershipFullRow[]
}

const STATUS_LABEL: Record<CompanyMembershipFullRow['status'], string> = {
  active: 'Active',
  invited: 'Invited',
  revoked: 'Revoked',
  left: 'Left',
}

const STATUS_COLOR: Record<CompanyMembershipFullRow['status'], string> = {
  active: 'text-[#0000ff]',
  invited: 'text-amber-600',
  revoked: 'text-red-600',
  left: 'text-slate-400',
}

/**
 * Phase C — Company memberships panel.
 *
 * Reads through `useCompanyMemberships()` and resolves the
 * related `companies` rows via the identity store so it can
 * show a real company name next to each membership.
 *
 * Actions (accept invitation, leave) are intentionally
 * surfaced as "coming soon" rather than dead buttons because
 * the Phase A identity store does not yet expose write
 * helpers for `company_memberships.status` transitions.
 * Phase E or a dedicated company-admin pass will add them.
 */
export function CompanyMembershipsPanel({
  sessionUser,
  memberships,
}: CompanyMembershipsPanelProps) {
  const [companies, setCompanies] = useState<CompanyRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const rows = await listCompaniesForUser(sessionUser.id)
      if (!cancelled) setCompanies(rows)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [sessionUser.id])

  const companyById = new Map(companies.map((c) => [c.id, c]))

  if (memberships.length === 0) {
    return (
      <EmptyPanel
        message="No company memberships"
        detail="Invitations and memberships you accept will appear here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Your memberships" headerStyle="black">
        <div className="flex flex-col divide-y divide-slate-200">
          {memberships.map((m) => {
            const company = companyById.get(m.company_id)
            return (
              <div
                key={m.id}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-black">
                    {company?.name ?? `Company ${m.company_id.slice(0, 8)}…`}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {m.role.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_COLOR[m.status]}`}
                    >
                      {STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  {company?.country_code && (
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {company.country_code}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    {m.status === 'invited'
                      ? 'Accept · coming soon'
                      : m.status === 'active'
                        ? 'Leave · coming soon'
                        : '·'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
      <Panel title="Coming later" borderStyle="standard">
        <p className="text-xs text-slate-400 leading-relaxed">
          Accepting invitations, leaving memberships, and inviting
          colleagues will be wired once the identity store exposes
          the matching writers. Until then this panel is read-only.
        </p>
      </Panel>
    </div>
  )
}
