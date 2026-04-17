'use client'

import { Suspense } from 'react'
import { AccountShell } from '@/components/account/AccountShell'
import { ProfileEditor } from '@/components/account/ProfileEditor'
import { useCreatorProfile, useUser } from '@/lib/user-context'

export default function AccountProfilePage() {
  const { sessionUser } = useUser()
  const creatorProfile = useCreatorProfile()

  return (
    <AccountShell
      title="Profile"
      description="Your public creator profile. Fields with a creator facet are only editable while you hold the creator grant."
    >
      <Suspense fallback={null}>
        <ProfileEditor
          sessionUser={sessionUser}
          creatorProfile={creatorProfile}
        />
      </Suspense>
    </AccountShell>
  )
}
