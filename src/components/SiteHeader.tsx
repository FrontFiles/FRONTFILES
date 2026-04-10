'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/92 backdrop-blur-[10px] border-b border-[#cad3e0]'
          : 'bg-white border-b border-[#cad3e0]'
      }`}
    >
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto flex items-center justify-between gap-4 min-h-[76px]">
        {/* Brand */}
        <Link href="/" className="text-lg font-extrabold tracking-[0.04em] uppercase text-[#0b1220]">
          <span>Front</span><span className="text-[#0000ff]">files</span>
        </Link>

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-5 text-sm text-[#4d5a70]">
          <a href="/#product" className="hover:text-[#0b1220] transition-colors">Product</a>
          <a href="/#creators" className="hover:text-[#0b1220] transition-colors">For Creators</a>
          <a href="/#buyers" className="hover:text-[#0b1220] transition-colors">For Buyers</a>
          <a href="/#missions" className="hover:text-[#0b1220] transition-colors">Missions</a>
          <Link href="/creator/sarahchen/frontfolio" className="hover:text-[#0b1220] transition-colors">Log in</Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0b1220] rounded-full text-sm font-bold bg-white text-[#0b1220] hover:bg-[#0b1220] hover:text-white transition-all duration-200"
          >
            Explore
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0000ff] rounded-full text-sm font-bold bg-[#0000ff] text-white hover:bg-[#003fd1] hover:border-[#003fd1] transition-all duration-200"
          >
            Join
          </Link>
        </div>
      </div>
    </header>
  )
}
