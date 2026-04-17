'use client'

import { ComposerProvider } from '@/lib/composer/context'
import { ComposerShell } from '@/components/composer/ComposerShell'
import { CreatorGate } from '@/components/platform/CreatorGate'

export default function ComposerPage() {
  return (
    <CreatorGate tool="Composer">
      <ComposerProvider>
        <ComposerShell />
      </ComposerProvider>
    </CreatorGate>
  )
}
