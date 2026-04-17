'use client'

import { AccountShell } from '@/components/account/AccountShell'
import { SecurityPanel } from '@/components/account/SecurityPanel'
import { useUser } from '@/lib/user-context'

export default function AccountSecurityPage() {
  const { sessionUser } = useUser()

  return (
    <AccountShell
      title="Security"
      description="Your session and the state of authentication for this account."
    >
      <SecurityPanel sessionUser={sessionUser} />
    </AccountShell>
  )
}
