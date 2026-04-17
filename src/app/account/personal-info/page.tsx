'use client'

import { AccountShell } from '@/components/account/AccountShell'
import { PersonalInfoEditor } from '@/components/account/PersonalInfoEditor'
import { useUser } from '@/lib/user-context'

export default function AccountPersonalInfoPage() {
  const { sessionUser } = useUser()

  return (
    <AccountShell
      title="Personal info"
      description="Private contact details. Stored on the users row and separate from your public creator profile."
    >
      <PersonalInfoEditor sessionUser={sessionUser} />
    </AccountShell>
  )
}
