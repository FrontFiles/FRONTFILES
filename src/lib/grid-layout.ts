/**
 * Frontfiles — Grid Layout Utility
 *
 * Canonical grid/list class mapping used by all grid-style views.
 * Ensures consistent column layout and gap spacing across
 * search, frontfolio, story, and collection surfaces.
 */

export type ViewMode = 'grid4' | 'grid2' | 'grid1' | 'list'

export function gridLayoutClass(viewMode: ViewMode): string {
  switch (viewMode) {
    case 'grid4': return 'grid grid-cols-4 gap-4'
    case 'grid2': return 'grid grid-cols-2 gap-4'
    case 'grid1': return 'grid grid-cols-1 gap-4'
    case 'list':  return 'flex flex-col gap-0'
  }
}
