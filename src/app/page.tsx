'use client'

import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'

// ═══════════════════════════════════════════════
// FRONTFILES HOMEPAGE
// ═══════════════════════════════════════════════

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-[#0000ff] selection:text-white">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Pillars />
        <Audiences />
        <Missions />
        <FooterCTA />
      </main>
      <Footer />
    </div>
  )
}

// ── HERO ─────────────────────────────────────

function Hero() {
  return (
    <section className="border-b border-[#cad3e0]">
      {/* Hero */}
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto pt-20 pb-16">
        <h1 className="text-[clamp(2.5rem,1rem+4vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.05em] uppercase text-[#0b1220] max-w-[16ch]">
          The <span className="text-[#0000ff]">infrastructure</span> for real <span className="text-[#0000ff]">journalism</span> and the <span className="text-[#0000ff]">people</span> who make it.
        </h1>
        <p className="mt-6 text-[clamp(1.125rem,1rem+0.75vw,1.5rem)] text-[#4d5a70] max-w-[38ch]">
          Track origin, preserve authorship, and license with clearer rights.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0000ff] rounded-full text-sm font-bold bg-[#0000ff] text-white hover:bg-[#003fd1] hover:border-[#003fd1] transition-all duration-200"
          >
            Join
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0b1220] rounded-full text-sm font-bold bg-white text-[#0b1220] hover:bg-[#0b1220] hover:text-white transition-all duration-200"
          >
            Explore
          </Link>
        </div>
      </div>

      {/* Built for strip */}
      <div className="border-t border-[#cad3e0]">
        <div className="w-[min(calc(100%-2rem),1080px)] mx-auto py-10 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 items-baseline">
          <p className="text-[clamp(1rem,0.85rem+0.5vw,1.25rem)] font-semibold leading-[1.3] tracking-[-0.01em] text-[#0b1220]">
            Built for journalists, freelancers, creators, editors, producers, and responsible content buyers.
          </p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#0000ff] mb-2">Origin</span>
              <p className="text-sm text-[#4d5a70] leading-relaxed">Record the source and chain of custody.</p>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#0000ff] mb-2">Maker</span>
              <p className="text-sm text-[#4d5a70] leading-relaxed">Keep authorship attached to every asset.</p>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#0000ff] mb-2">Rights</span>
              <p className="text-sm text-[#4d5a70] leading-relaxed">Make licensing terms and pricing explicit.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border border-[#cad3e0] p-4 min-h-[108px]">
      <strong className="block text-xs uppercase tracking-[0.08em] text-[#6e7a8f] mb-3">{title}</strong>
      <span className="text-sm text-[#0b1220]">{body}</span>
    </div>
  )
}

// ── PILLARS ──────────────────────────────────

function Pillars() {
  const items = [
    {
      label: 'Provenance',
      heading: 'Record origin.',
      body: 'Record origin and chain of custody so the asset carries a usable history from upload to transaction.',
    },
    {
      label: 'Authorship',
      heading: 'Keep the maker attached.',
      body: 'Keep the work attached to its maker so authorship stays visible through storage, discovery, and licensing.',
    },
    {
      label: 'Licensing',
      heading: 'Make rights explicit.',
      body: 'Make rights and pricing explicit so licensing decisions are clearer for both creators and buyers.',
    },
  ]

  return (
    <section id="product" className="py-16 border-b border-[#cad3e0]">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(item => (
          <article key={item.label} className="p-6 border-2 border-[#0b1220] bg-white min-h-[200px]">
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#6e7a8f] mb-3">{item.label}</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4">{item.heading}</h2>
            <p className="text-[#4d5a70] max-w-[50ch]">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ── AUDIENCES ────────────────────────────────

function Audiences() {
  return (
    <section className="py-16 border-b border-[#cad3e0]">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Creators */}
        <article id="creators" className="bg-[#f4f7fb] border-2 border-[#0b1220] p-8 flex flex-col gap-5">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#6e7a8f] mb-3">For creators and freelancers</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4">
              Store, validate, categorize, display, and license your work.
            </h2>
            <p className="text-[#4d5a70] max-w-[50ch]">
              Build a searchable body of work with clearer provenance, clearer authorship, and clearer rights. Get assigned to special missions when buyers need specific coverage.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {[
              'Store your work in one system of record.',
              'Validate provenance and preserve authorship.',
              'Categorize and display work for discovery.',
              'License assets with explicit pricing and rights.',
              'Get assigned to special missions.',
            ].map(item => (
              <li key={item} className="pt-3 border-t border-[#cad3e0] text-sm text-[#0b1220]">{item}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 mt-auto">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0000ff] rounded-full text-sm font-bold bg-[#0000ff] text-white hover:bg-[#003fd1] hover:border-[#003fd1] transition-all duration-200"
            >
              Join
            </Link>
          </div>
        </article>

        {/* Buyers */}
        <article id="buyers" className="bg-[#f4f7fb] border-2 border-[#0b1220] p-8 flex flex-col gap-5">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#6e7a8f] mb-3">For content buyers</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4">
              Source validated assets with clearer origin and fewer rights risks.
            </h2>
            <p className="text-[#4d5a70] max-w-[50ch]">
              Find content with stronger provenance records, clearer licensing terms, and lower rights ambiguity. Assign freelancers to special missions when coverage needs are specific.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {[
              'Source validated assets with clearer origin.',
              'Reduce rights risk with explicit licensing terms.',
              'Review authorship and provenance before use.',
              'Assign freelancers to special missions.',
            ].map(item => (
              <li key={item} className="pt-3 border-t border-[#cad3e0] text-sm text-[#0b1220]">{item}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 mt-auto">
            <Link
              href="/search"
              className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0b1220] rounded-full text-sm font-bold bg-white text-[#0b1220] hover:bg-[#0b1220] hover:text-white transition-all duration-200"
            >
              Explore
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}

// ── MISSIONS ────────────────────────────────

function Missions() {
  return (
    <section id="missions" className="py-16 border-b border-[#cad3e0]">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto">
        <div className="bg-[#0b1220] text-white rounded-lg p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-white/60 mb-3">Missions</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase mb-4">
              Special missions for urgent, local, and targeted coverage.
            </h2>
            <p className="text-white/[0.78] max-w-[50ch]">
              Buyers can assign specific reporting, capture, or production needs. Creators and freelancers can opt into relevant missions and deliver work through the same rights-aware system.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/assignments"
              className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0b1220] rounded-full text-sm font-bold bg-white text-[#0b1220] hover:bg-white/90 transition-all duration-200"
            >
              Post a mission
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0000ff] rounded-full text-sm font-bold bg-[#0000ff] text-white hover:bg-[#003fd1] hover:border-[#003fd1] transition-all duration-200"
            >
              Join
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER CTA ──────────────────────────────

function FooterCTA() {
  return (
    <section className="py-16 pb-20">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto">
        <div className="border-2 border-[#0b1220] bg-[#eef3f9] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#6e7a8f] mb-3">Frontfiles</span>
            <h2 className="text-[clamp(2rem,1.2rem+2.5vw,3.5rem)] leading-[1.05] tracking-[-0.04em] uppercase text-[#0b1220] max-w-[12ch]">
              Built for journalists, freelancers, creators, editors, producers, and responsible content buyers.
            </h2>
          </div>
          <div className="flex flex-col gap-4 items-start">
            <p className="text-[#4d5a70] max-w-[50ch]">
              Source-verified licensing infrastructure for the people who make journalism and the people who need to use it responsibly.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0000ff] rounded-full text-sm font-bold bg-[#0000ff] text-white hover:bg-[#003fd1] hover:border-[#003fd1] transition-all duration-200"
              >
                Join
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center justify-center min-h-[46px] px-5 border-2 border-[#0b1220] rounded-full text-sm font-bold bg-white text-[#0b1220] hover:bg-[#0b1220] hover:text-white transition-all duration-200"
              >
                Explore
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ──────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[#cad3e0] bg-white">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto py-10">
        <p className="text-xs text-[#6e7a8f] max-w-[660px] leading-[1.75]">
          Frontfiles is a provenance-verified editorial licensing platform for professional journalism. It does not certify factual truth, editorial accuracy, or legal fitness of content.
        </p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.1em] uppercase text-[#cad3e0]">
            &copy; 2026 Frontfiles
          </span>
          <div className="flex items-center gap-6 text-[10px] tracking-[0.1em] uppercase text-[#cad3e0]">
            <span className="hover:text-[#4d5a70] transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-[#4d5a70] transition-colors cursor-pointer">Terms</span>
            <span className="hover:text-[#4d5a70] transition-colors cursor-pointer">Support</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
