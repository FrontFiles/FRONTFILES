'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ═══════════════════════════════════════════════
// FRONTFILES HOMEPAGE
// ═══════════════════════════════════════════════

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f7f6f3] flex flex-col selection:bg-black selection:text-white">
      <Nav />
      <main className="flex-1">
        <Hero />
        <ValueStrip />
        <Manifesto />
        <Audience />
        <TrustClarification />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

// ── NAV ───────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#f7f6f3]/95 backdrop-blur-sm border-b border-black/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="text-[13px] font-semibold tracking-[0.15em] uppercase text-black">
          Frontfiles
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {[
            ['Manifesto', '#manifesto'],
            ['For Journalists', '#journalists'],
            ['For Buyers', '#buyers'],
            ['How it Works', '#how'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-[11px] tracking-[0.08em] uppercase text-black/45 hover:text-black transition-colors"
            >
              {label}
            </a>
          ))}
          <Link
            href="/search"
            className="text-[11px] tracking-[0.08em] uppercase text-black/45 hover:text-black transition-colors ml-4 border-l border-black/10 pl-6"
          >
            Sign In
          </Link>
          <Link
            href="/onboarding"
            className="text-[11px] tracking-[0.08em] uppercase bg-black text-white px-4 py-2 hover:bg-black/85 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ── HERO ──────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-[94vh] flex flex-col justify-end pb-20 md:pb-28 pt-32">
      {/* Quiet documentary background */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/assets/2001_large.jpeg"
          alt=""
          className="w-full h-full object-cover object-[50%_25%] opacity-[0.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f7f6f3] via-[#f7f6f3]/70 to-[#f7f6f3]/20" />
      </div>

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 w-full">
        <div className="max-w-[760px]">
          <h1 className="text-[clamp(2.6rem,5.8vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.035em] text-black">
            Journalism needs<br />better infrastructure
          </h1>

          <p className="mt-8 text-[clamp(1.05rem,1.9vw,1.25rem)] leading-[1.6] text-black/60 max-w-[580px]">
            Frontfiles is a provenance-first marketplace for editorial work, built to keep authorship visible, licensing clear, and exchange fair.
          </p>

          <p className="mt-5 text-[14px] text-black/40">
            For journalists, editors, producers, and the institutions that rely on them.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/search"
              className="inline-flex items-center justify-center h-[52px] px-9 bg-black text-white text-[11px] font-medium tracking-[0.16em] uppercase hover:bg-black/85 transition-colors"
            >
              For journalists
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center h-[52px] px-9 border border-black/25 text-black text-[11px] font-medium tracking-[0.16em] uppercase hover:border-black hover:bg-black hover:text-white transition-all duration-300"
            >
              For buyers
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-black/10" />
    </section>
  )
}

// ── VALUE STRIP ──────────────────────────────

function ValueStrip() {
  const items = [
    { title: 'Provenance', body: 'A visible record of origin and chain of custody.' },
    { title: 'Authorship', body: 'A durable link between the work and the person who made it.' },
    { title: 'Fair exchange', body: 'Clear rights, creator-set pricing, and accountable licensing.' },
  ]

  return (
    <section className="border-t border-black/10">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className={`py-14 md:py-16 ${
                i < items.length - 1 ? 'md:border-r border-b md:border-b-0 border-black/10' : ''
              } ${i > 0 ? 'md:pl-10' : ''} ${i < items.length - 1 ? 'md:pr-10' : ''}`}
            >
              <h3 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-black/40">
                {item.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.65] text-black/65">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── MANIFESTO ────────────────────────────────

function Manifesto() {
  return (
    <section id="manifesto" className="border-t border-black/10">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-28 md:py-40">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-3">
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-black/35">
              Why Frontfiles exists
            </span>
          </div>

          <div className="md:col-span-7">
            <div className="space-y-7">
              <p className="text-[clamp(1.2rem,2.2vw,1.5rem)] leading-[1.5] text-black tracking-[-0.01em]">
                Journalism is not content. It is evidence, memory, and public record.
              </p>
              <p className="text-[clamp(1.05rem,1.7vw,1.2rem)] leading-[1.65] text-black/55">
                The systems around it have not treated it that way. They have rewarded speed over rigour, volume over authorship, and convenience over fairness.
              </p>
              <p className="text-[clamp(1.05rem,1.7vw,1.2rem)] leading-[1.65] text-black/55">
                Frontfiles exists to build a better market around the work.
              </p>
              <p className="text-[clamp(1.05rem,1.7vw,1.2rem)] leading-[1.65] text-black/55">
                For creators, that means ownership, clarity, and control. For buyers, it means provenance, rights, and a more responsible way to source editorial assets.
              </p>
              <p className="text-[clamp(1.05rem,1.7vw,1.2rem)] leading-[1.65] text-black/55">
                Frontfiles does not decide what is true. It establishes origin, chain of custody, and transaction clarity, so journalism can move on stronger ground.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── AUDIENCE SECTION ─────────────────────────

function Audience() {
  return (
    <section id="journalists" className="border-t border-black/10 bg-white">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-28 md:py-40">
        <div className="mb-20">
          <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-black/35">
            Built for both sides of the work
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Journalists */}
          <div className="relative pb-16 md:pb-0 md:pr-16 border-b md:border-b-0 md:border-r border-black/10">
            <div className="flex gap-[6px] mb-10 h-[150px] overflow-hidden">
              <div className="flex-1 overflow-hidden bg-neutral-200">
                <img src="/assets/1843_large.jpeg" alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              </div>
              <div className="flex-1 overflow-hidden bg-neutral-200">
                <img src="/assets/529_large.jpeg" alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              </div>
              <div className="flex-1 overflow-hidden bg-neutral-200 hidden lg:block">
                <img src="/assets/3289_large.jpeg" alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              </div>
            </div>

            <h3 className="text-[clamp(1.6rem,3.2vw,2.2rem)] font-bold tracking-[-0.025em] text-black leading-[1.1]">
              For journalists
            </h3>
            <p className="mt-5 text-[15px] leading-[1.7] text-black/55 max-w-[380px]">
              Protect your authorship, organise work at speed, and licence it in a market designed for professional practice.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center mt-8 text-[11px] font-semibold tracking-[0.14em] uppercase text-black hover:text-black/50 transition-colors group"
            >
              Join as creator
              <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Buyers */}
          <div id="buyers" className="pt-16 md:pt-0 md:pl-16">
            <div className="flex gap-[6px] mb-10 h-[150px] overflow-hidden">
              <div className="flex-1 overflow-hidden bg-neutral-200">
                <img src="/assets/8300_large.jpeg" alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              </div>
              <div className="flex-1 overflow-hidden bg-neutral-200">
                <img src="/assets/5066_large.jpeg" alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              </div>
              <div className="flex-1 overflow-hidden bg-neutral-200 hidden lg:block">
                <img src="/assets/7608_large.jpeg" alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
              </div>
            </div>

            <h3 className="text-[clamp(1.6rem,3.2vw,2.2rem)] font-bold tracking-[-0.025em] text-black leading-[1.1]">
              For buyers
            </h3>
            <p className="mt-5 text-[15px] leading-[1.7] text-black/55 max-w-[380px]">
              Source work with clearer provenance, clearer rights, and fewer hidden risks.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center mt-8 text-[11px] font-semibold tracking-[0.14em] uppercase text-black hover:text-black/50 transition-colors group"
            >
              Explore as buyer
              <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── TRUST CLARIFICATION ─────────────────────

function TrustClarification() {
  return (
    <section id="how" className="border-t border-black/10 bg-[#f7f6f3]">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-3">
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-black/35">
              Clear about what we do
            </span>
          </div>
          <div className="md:col-span-7">
            <p className="text-[clamp(1.1rem,1.9vw,1.3rem)] leading-[1.6] text-black/60">
              Frontfiles certifies provenance and file history. It does not verify factual accuracy or act as an editorial truth authority.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FINAL CTA ────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-[#0a0a0a] text-white">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-32 md:py-44">
        <div className="max-w-[620px]">
          <h2 className="text-[clamp(2rem,4.2vw,3.2rem)] font-bold leading-[1.08] tracking-[-0.03em]">
            Protect the work.<br />Strengthen the record.
          </h2>
          <p className="mt-7 text-[15px] leading-[1.7] text-white/50 max-w-[460px]">
            A platform for journalism workers, responsible buyers, and the public value of trustworthy provenance.
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/search"
              className="inline-flex items-center justify-center h-[52px] px-9 bg-white text-black text-[11px] font-medium tracking-[0.16em] uppercase hover:bg-white/90 transition-colors"
            >
              Join as creator
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center h-[52px] px-9 border border-white/20 text-white text-[11px] font-medium tracking-[0.16em] uppercase hover:border-white/50 transition-colors"
            >
              Explore as buyer
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ───────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white/35 border-t border-white/8">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10">
        <p className="text-[11px] leading-[1.75] max-w-[660px]">
          Frontfiles is a provenance-verified editorial licensing platform for professional journalism. It does not certify factual truth, editorial accuracy, or legal fitness of content.
        </p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.1em] uppercase text-white/20">
            &copy; 2026 Frontfiles
          </span>
          <div className="flex items-center gap-6 text-[10px] tracking-[0.1em] uppercase text-white/20">
            <span className="hover:text-white/40 transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-white/40 transition-colors cursor-pointer">Terms</span>
            <span className="hover:text-white/40 transition-colors cursor-pointer">Support</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
