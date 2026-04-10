'use client'

import { usePathname } from 'next/navigation'
import { DiscoveryNav } from '@/components/discovery/DiscoveryNav'

/** Pages where the global nav is hidden (they have their own chrome). */
const HIDDEN_ON = ['/', '/onboarding', '/signin']

export function GlobalNav() {
  const pathname = usePathname()
  if (HIDDEN_ON.includes(pathname)) return null
  return <DiscoveryNav />
}
