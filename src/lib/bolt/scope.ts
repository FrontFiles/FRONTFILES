// BOLT scope helpers — pure functions over DiscoveryScope.
// The main canonical search bar of each consumer owns the scope; these
// helpers adapt that consumer-native shape into the BOLT-facing DiscoveryScope.
//
//   Discovery   →  URL search params      → deriveScopeFromSearchParams
//   Composer    →  state.search reducer    → deriveScopeFromComposerSearch
//
// Both produce the IDENTICAL DiscoveryScope shape so `useBoltSession` and
// `BoltPanel` are completely consumer-agnostic.

import type { DiscoveryScope } from './types'

/** Subset of URLSearchParams that we actually use. Lets us accept both
 *  the real URLSearchParams and the ReadonlyURLSearchParams returned by
 *  `useSearchParams()`. */
interface ParamsLike {
  get(key: string): string | null
}

export function deriveScopeFromSearchParams(params: ParamsLike): DiscoveryScope {
  const rawQuery = (params.get('q') || '').trim()
  const query = rawQuery.length > 0 ? rawQuery : null
  const fmtParam = params.get('fmt')
  const formats = fmtParam
    ? fmtParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : []
  return Object.freeze({
    query,
    formats: Object.freeze(formats),
    sidebarOpen: false,
  })
}

/** Composer-side equivalent of `deriveScopeFromSearchParams`.
 *
 *  Composer's canonical search state lives in the `useComposer` reducer
 *  (`state.search`), not the URL. We accept the exact shape we need rather
 *  than importing `ComposerSearchState` directly so this module stays
 *  free of any Composer dependency.
 *
 *  `formatFilter` is a single value in Composer (`'all' | AssetFormat`),
 *  so we map it to a one-element formats array for parity with the
 *  Discovery shape. The 'all' sentinel collapses to `[]`. */
export function deriveScopeFromComposerSearch(search: {
  query: string
  formatFilter: string
}): DiscoveryScope {
  const rawQuery = (search.query || '').trim()
  const query = rawQuery.length > 0 ? rawQuery : null
  const fmt = (search.formatFilter || '').trim()
  const formats =
    fmt && fmt.toLowerCase() !== 'all' ? [fmt] : []
  return Object.freeze({
    query,
    formats: Object.freeze(formats),
    sidebarOpen: false,
  })
}

/** A scope is empty when there's nothing for BOLT to search against. */
export function scopeIsEmpty(scope: DiscoveryScope): boolean {
  if (scope.query && scope.query.trim().length > 0) return false
  const realFormats = scope.formats.filter(f => f && f !== 'All')
  if (realFormats.length > 0) return false
  return true
}

/** Stable, order-insensitive hash for session identity + change detection. */
export function scopeHash(scope: DiscoveryScope): string {
  const formats = [...scope.formats]
    .filter(f => f && f !== 'All')
    .sort()
    .join('|')
  return `q=${scope.query ?? ''};f=${formats}`
}

/** Human-readable one-line scope summary used in the panel header chip. */
export function summarizeScope(scope: DiscoveryScope): string {
  const parts: string[] = []
  if (scope.query) parts.push(`"${scope.query}"`)
  const realFormats = scope.formats.filter(f => f && f !== 'All')
  if (realFormats.length > 0) parts.push(realFormats.join(' · '))
  return parts.join(' · ') || 'Discovery scope'
}
