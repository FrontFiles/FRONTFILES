'use client'

import { AccountShell } from '@/components/account/AccountShell'
import { CompanyMembershipsPanel } from '@/components/account/CompanyMembershipsPanel'
import { useCompanyMemberships, useUser } from '@/lib/user-context'

export default function AccountCompaniesPage() {
  const { sessionUser } = useUser()
  const memberships = useCompanyMemberships()

  return (
    <AccountShell
      title="Companies"
      description="Company memberships you belong to. Each row is a role binding between you and a company."
    >
      <CompanyMembershipsPanel
        sessionUser={sessionUser}
        memberships={memberships}
      />
    </AccountShell>
  )
}
