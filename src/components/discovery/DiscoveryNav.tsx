'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/user-context'
import { useTransaction } from '@/lib/transaction/context'
import { useDraftStore } from '@/lib/post/draft-store'
import { isFffSharingEnabled } from '@/lib/flags'
import { AvatarMenu } from '@/components/platform/AvatarMenu'
import { type UserType } from '@/lib/types'

// ══════════════════════════════════════════════
// ICONS (inline SVG — no external dependency)
// ══════════════════════════════════════════════

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
      className="w-10 h-10 border-l border-black flex items-center justify-center text-black hover:text-[#0000ff] transition-colors"
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

// ══════════════════════════════════════════════
// USER TYPE SWITCHER — moved into AvatarMenu as a
// submenu in Phase C. The standalone chip is gone;
// role switching now lives behind the account avatar.
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// TOOLBAR VISIBILITY
// ══════════════════════════════════════════════

const SHOW_ASSIGNMENTS: Set<UserType> = new Set(['buyer'])
const SHOW_COMPOSER: Set<UserType>    = new Set(['creator'])
const SHOW_UPLOAD: Set<UserType>      = new Set(['creator'])
const SHOW_LIGHTBOX: Set<UserType>    = new Set(['creator', 'buyer'])

export function DiscoveryNav() {
  const pathname = usePathname()
  const { activeUserType } = useUser()
  const { openComposer } = useDraftStore()
  // Build-time constant. Hides every FFF Sharing affordance
  // (the FFF nav button + the Share trigger) when the flag is
  // off. The DraftStoreProvider stays mounted so `useDraftStore`
  // never throws — the pool is just empty.
  const fffEnabled = isFffSharingEnabled()
  const onExplore = pathname === '/search' || pathname.startsWith('/search/')
  const onAssignments = pathname === '/assignment' || pathname.startsWith('/assignment/')
  const onFeed = pathname === '/feed' || pathname.startsWith('/feed/')

  return (
    <header className="h-14 bg-white border-b border-black/15 flex items-center shrink-0">
      {/* ── Logo ── */}
      <Link href="/" className="text-lg font-black tracking-tight leading-none px-6 shrink-0">
        <span className="text-black">FRONT</span><span className="text-[#0000ff]">FILES</span>
      </Link>

      {/* ── Explore (all types) ──
          Single flex-1 button that spans the entire gap between the
          FRONTFILES logo and the avatar cluster. No side spacers, no
          left border — the whole cell is one continuous clickable
          surface with the "Explore" label centered inside. */}
      <Link
        href="/search"
        className={`h-full flex-1 min-w-[112px] flex items-center justify-center text-[12px] font-bold uppercase tracking-wider transition-colors ${
          onExplore ? 'text-black' : 'text-black hover:text-[#0000ff]'
        }`}
      >
        Explore
      </Link>

      {/* ── FFF (feed, all types) ──
          Compact fixed-width nav action routing to /feed. Visible
          across user types when FFF Sharing is enabled. Hidden
          entirely when the feature flag is off so the nav stays
          clean for users who don't see the feature yet. */}
      {fffEnabled && (
        <Link
          href="/feed"
          aria-label="Visit feed"
          title="Visit feed"
          className={`h-full w-20 flex items-center justify-center text-[12px] font-bold uppercase tracking-wider border-l border-black transition-colors shrink-0 ${
            onFeed ? 'text-[#0000ff]' : 'text-black hover:text-[#0000ff]'
          }`}
        >
          FFF
        </Link>
      )}

      {/* ── Share trigger (creators only, FFF flag on) ──
          Opens the global share composer overlay. The composer
          is mounted once in app/layout.tsx and lifted into the
          draft store so any nav button can fire it. */}
      {fffEnabled && SHOW_COMPOSER.has(activeUserType) && (
        <button
          type="button"
          onClick={() => openComposer()}
          aria-label="Share to Frontfiles feed"
          title="Share to feed"
          className="h-full w-20 flex items-center justify-center text-[12px] font-bold uppercase tracking-wider border-l border-black transition-colors shrink-0 text-black hover:text-[#0000ff]"
        >
          Share
        </button>
      )}

      {/* ── Assignments (buyer only) ── */}
      {SHOW_ASSIGNMENTS.has(activeUserType) && (
        <Link
          href="/assignment"
          className={`h-full w-28 flex items-center justify-center text-[12px] font-bold uppercase tracking-wider border-l border-black transition-colors shrink-0 ${
            onAssignments ? 'text-[#0000ff]' : 'text-black hover:text-[#0000ff]'
          }`}
        >
          Assignments
        </Link>
      )}

      {/* ── Avatar dropdown (centered) ──
          Phase C: the old "avatar is just a link" pattern was
          replaced with a facet-aware dropdown menu that anchors
          the whole account navigation (profile, personal info,
          buyer details, companies, security, role switch, sign
          out). Implementation lives in `AvatarMenu`. */}
      <AvatarMenu />

      {/* ── Right cluster — Upload / Lightbox / Composer ──
          These three buttons share the entire span between the avatar
          cluster and the cart icon. Each is `flex-1 min-w-[112px]` so
          they stretch evenly across the available width. No right
          spacer — the buttons themselves fill that role. */}

      {/* ── Upload CTA (creator only) ── */}
      {SHOW_UPLOAD.has(activeUserType) && (
        <Link
          href="/vault/upload"
          className="h-full flex-1 min-w-[112px] flex items-center justify-center bg-[#0000ff] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#0000cc] transition-colors"
        >
          Upload
        </Link>
      )}

      {/* ── Lightbox (creator + buyer) ── */}
      {SHOW_LIGHTBOX.has(activeUserType) && (
        <Link
          href="/lightbox"
          className="h-full flex-1 min-w-[112px] flex items-center justify-center border-l border-black text-[10px] font-bold uppercase tracking-wider text-[#0000ff] hover:text-[#0000cc] transition-colors"
        >
          Lightbox
        </Link>
      )}

      {/* ── Composer (creator only) ──
          Lives in the right-side cluster, immediately after Lightbox. */}
      {SHOW_COMPOSER.has(activeUserType) && (
        <Link
          href="/vault/composer"
          className={`h-full flex-1 min-w-[112px] flex items-center justify-center border-l border-black text-[12px] font-bold uppercase tracking-wider transition-colors ${
            pathname === '/vault/composer' ? 'text-[#0000ff]' : 'text-black hover:text-[#0000ff]'
          }`}
        >
          Composer
        </Link>
      )}

      <CartNavButton />

      <NavIconButton href="/messages" label="Messages">
        <IconMail className="w-[18px] h-[18px]" />
      </NavIconButton>

      <NavIconButton href="/account" label="Settings">
        <IconSettings className="w-[18px] h-[18px]" />
      </NavIconButton>

      {/* ── Language ── */}
      <button className="h-full w-28 flex items-center justify-center gap-1 border-l border-black text-[10px] font-bold uppercase tracking-wider text-black hover:text-[#0000ff] transition-colors shrink-0">
        EN
        <IconChevronDown className="w-3 h-3" />
      </button>
    </header>
  )
}

// ══════════════════════════════════════════════
// CART NAV BUTTON (with item count badge)
// ══════════════════════════════════════════════

function CartNavButton() {
  const { cartItemCount } = useTransaction()
  return (
    <Link
      href="/cart"
      className="w-10 h-10 border-l border-black flex items-center justify-center text-black hover:text-[#0000ff] transition-colors relative"
      aria-label="Cart"
    >
      <IconCart className="w-[18px] h-[18px]" />
      {cartItemCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-blue-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
          {cartItemCount}
        </span>
      )}
    </Link>
  )
}
