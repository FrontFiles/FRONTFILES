'use client'

import Link from 'next/link'

/**
 * SiteHeader — home-page header.
 *
 * The earlier version animated its height on scroll (140px → 56px)
 * and lived inside a `snap-y snap-mandatory` scroll container. That
 * combination was the flicker source:
 *
 *   1. Header shrinks → layout shifts → snap container sees a
 *      scroll event → scroll state re-evaluates → potential
 *      oscillation across the 50px threshold.
 *   2. `sticky top-0` inside a scroll-snap container is already
 *      fragile on Chrome — layout changes inside a sticky
 *      element compound the problem.
 *   3. `scrollPaddingTop: '56px'` on the outer container assumes
 *      the header is always 56px, which was only true once the
 *      user had scrolled.
 *
 * The fix is to stop animating the header entirely. It is now a
 * fixed 64-px sticky bar. All four primary surfaces (logo,
 * Log in, Create account, Enter) are always visible at stable
 * sizes. No `useEffect`, no scroll listener, no state — there
 * is simply nothing left to flicker.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-14 bg-white border-b border-slate-200">
      <div className="w-[min(calc(100%-2rem),1080px)] h-full mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-[0.04em] uppercase text-[#0b1220] leading-none shrink-0"
        >
          <span>Front</span>
          <span className="text-[#0000ff]">files</span>
        </Link>

        {/* Right cluster — Log in, Create account, Enter */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/signin"
            className="hidden sm:flex h-9 px-4 items-center justify-center border-2 border-[#0b1220] text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b1220] hover:bg-[#0b1220] hover:text-white transition-colors"
          >
            Log in
          </Link>

          <Link
            href="/onboarding"
            className="hidden md:flex h-9 px-4 items-center justify-center bg-[#0b1220] text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#0000ff] transition-colors"
          >
            Create account
          </Link>

          <Link
            href="/search"
            className="group flex items-center justify-center h-9 px-6 bg-[#0000ff] hover:bg-[#0000cc] transition-colors"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white group-hover:tracking-[0.18em] transition-all">
              Enter
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
