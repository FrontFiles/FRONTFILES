'use client'

import { ProfileLeftRail } from '@/components/platform/ProfileLeftRail'
import { ProfileContent } from '@/components/platform/ProfileContent'
import {
  mockCreatorProfile,
  mockCertificationEvents,
  mockFollowState,
  mockVaultAssets,
  mockStories,
  mockArticles,
  mockCollections,
} from '@/lib/mock-data'

export default function CreatorProfilePage() {
  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">
        <ProfileLeftRail profile={mockCreatorProfile} followState={mockFollowState} />
        <ProfileContent
          profile={mockCreatorProfile}
          events={mockCertificationEvents}
          assets={mockVaultAssets}
          stories={mockStories}
          articles={mockArticles}
          collections={mockCollections}
        />
      </div>
    </div>
  )
}
