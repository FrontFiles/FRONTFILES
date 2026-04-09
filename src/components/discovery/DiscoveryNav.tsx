'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ══════════════════════════════════════════════
// ICONS (inline SVG — no external dependency)
// ══════════════════════════════════════════════

function IconSearch({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function IconCart({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function IconBell({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function IconBookmark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  )
}

function IconSettings({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconChevronDown({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

// ══════════════════════════════════════════════
// HEADER
// ══════════════════════════════════════════════

function NavIconButton({ href, children, label }: { href: string; children: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="w-10 h-10 border-l border-black/10 flex items-center justify-center text-black/40 hover:text-black transition-colors"
      aria-label={label}
    >
      {children}
    </Link>
  )
}

export function DiscoveryNav() {
  const pathname = usePathname()
  const onExplore = pathname === '/search' || pathname.startsWith('/search/')

  return (
    <header className="h-14 bg-white border-b-2 border-black flex items-center shrink-0">
      {/* ── Logo ── */}
      <Link href="/" className="text-lg font-black tracking-tight leading-none px-6 shrink-0">
        <span className="text-black">FRONT</span><span className="text-blue-600">FILES</span>
      </Link>

      {/* ── Explore ── */}
      <Link
        href="/search"
        className={`h-full flex items-center px-5 text-[13px] font-bold uppercase tracking-wider border-l border-black/10 transition-colors ${
          onExplore ? 'text-black' : 'text-black/40 hover:text-black'
        }`}
      >
        Explore
      </Link>

      {/* ── Search bar ── */}
      <div className="flex-1 h-full flex items-center border-l border-black/10 px-4 gap-3">
        <IconSearch className="w-4 h-4 text-black/30 shrink-0" />
        <input
          type="text"
          placeholder="Find a photographer in Lisbon, conflict footage from 2024, or ask anything..."
          className="flex-1 bg-transparent text-[12px] text-black placeholder:text-black/30 outline-none"
        />
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center bg-black text-white shrink-0 hover:bg-black/80 transition-colors"
          aria-label="Send search"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Upload CTA ── */}
      <Link
        href="/vault/upload"
        className="h-full flex items-center px-6 bg-blue-600 text-white text-[12px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors shrink-0"
      >
        Upload
      </Link>

      {/* ── Icon actions ── */}
      <NavIconButton href="/checkout" label="Cart">
        <IconCart className="w-[18px] h-[18px]" />
      </NavIconButton>

      <NavIconButton href="/account" label="Notifications">
        <IconBell className="w-[18px] h-[18px]" />
      </NavIconButton>

      <NavIconButton href="/lightbox" label="Saved">
        <IconBookmark className="w-[18px] h-[18px]" />
      </NavIconButton>

      <NavIconButton href="/account" label="Settings">
        <IconSettings className="w-[18px] h-[18px]" />
      </NavIconButton>

      {/* ── Avatar ── */}
      <Link
        href="/account"
        className="w-10 h-10 border-l border-black/10 flex items-center justify-center shrink-0"
        aria-label="Profile"
      >
        <div className="w-7 h-7 bg-black flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">SC</span>
        </div>
      </Link>

      {/* ── Language ── */}
      <button className="h-full flex items-center gap-1 px-4 border-l border-black/10 text-[10px] font-bold uppercase tracking-wider text-black/40 hover:text-black transition-colors shrink-0">
        EN
        <IconChevronDown className="w-3 h-3" />
      </button>
    </header>
  )
}
