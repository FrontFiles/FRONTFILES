'use client'

/**
 * TopNav — Platform header (authenticated creator/buyer views)
 *
 * Same visual structure as DiscoveryNav but re-exported here
 * so platform pages can import from their local domain.
 * When auth context exists, swap the avatar/role display.
 */

export { DiscoveryNav as TopNav } from '@/components/discovery/DiscoveryNav'
