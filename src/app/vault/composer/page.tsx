'use client'

import { ComposerProvider } from '@/lib/composer/context'
import { ComposerShell } from '@/components/composer/ComposerShell'

export default function ComposerPage() {
  return (
    <ComposerProvider>
      <ComposerShell />
    </ComposerProvider>
  )
}
