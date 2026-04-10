'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from './Avatar'

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
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

function IconMail({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
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

function IconClipboard({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  )
}

export function DiscoveryNav() {
  const pathname = usePathname()
  const onExplore = pathname === '/search' || pathname.startsWith('/search/')
  const onAssignments = pathname === '/assignments' || pathname.startsWith('/assignments/')

  return (
    <header className="h-14 bg-white border-b-2 border-black flex items-center shrink-0">
      {/* ── Logo ── */}
      <Link href="/" className="text-lg font-black tracking-tight leading-none px-6 shrink-0">
        <span className="text-black">FRONT</span><span className="text-[#0000ff]">FILES</span>
      </Link>

      {/* ── Explore ── */}
      <Link
        href="/search"
        className={`h-full flex items-center px-5 text-[12px] font-bold uppercase tracking-wider border-l border-black/10 transition-colors shrink-0 ${
          onExplore ? 'text-black' : 'text-black/40 hover:text-black'
        }`}
      >
        Explore
      </Link>

      {/* ── Assignments ── */}
      <Link
        href="/assignments"
        className="h-full flex items-center px-4 text-[12px] font-bold uppercase tracking-wider border-l border-black/10 transition-colors shrink-0 text-[#0000ff] hover:text-[#0000cc]"
      >
        Assignments
      </Link>

      {/* ── Composer ── */}
      <Link
        href="/vault/composer"
        className={`h-full flex items-center px-4 border-l border-black/10 text-[12px] font-bold uppercase tracking-wider transition-colors shrink-0 ${
          pathname === '/vault/composer' ? 'text-black' : 'text-black/40 hover:text-black'
        }`}
      >
        Composer
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
          className="w-7 h-7 flex items-center justify-center bg-white text-[#0000ff] border-2 border-[#0000ff] shrink-0 hover:bg-[#0000ff] hover:text-white transition-colors"
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
        className="h-full flex items-center px-6 bg-[#0000ff] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#0000cc] transition-colors shrink-0"
      >
        Upload
      </Link>

      {/* ── Lightbox ── */}
      <Link
        href="/lightbox"
        className="h-full flex items-center px-4 border-l border-black/10 text-[10px] font-bold uppercase tracking-wider text-[#0000ff] hover:text-[#0000cc] transition-colors shrink-0"
      >
        Lightbox
      </Link>

      <NavIconButton href="/messages" label="Messages">
        <IconMail className="w-[18px] h-[18px]" />
      </NavIconButton>

      <NavIconButton href="/account" label="Settings">
        <IconSettings className="w-[18px] h-[18px]" />
      </NavIconButton>

      {/* ── Avatar ── */}
      <Link
        href="/creator/sarahchen/frontfolio"
        className="w-10 h-10 border-l border-black/10 flex items-center justify-center shrink-0"
        aria-label="Frontfolio"
      >
        <Avatar src="/assets/avatars/pexels-anete-lusina-4793183.jpg" name="Sarah Chen" size="sm" className="border-0" />
      </Link>

      {/* ── Language ── */}
      <button className="h-full flex items-center gap-1 px-4 border-l border-black/10 text-[10px] font-bold uppercase tracking-wider text-black/40 hover:text-black transition-colors shrink-0">
        EN
        <IconChevronDown className="w-3 h-3" />
      </button>
    </header>
  )
}
