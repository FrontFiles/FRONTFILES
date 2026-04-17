'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { creators, stories, spotlightRanked, assetMap, creatorMap, assets, publicAssets } from '@/data'
import { AssetCard } from '@/components/discovery/AssetCard'
import { StoryCard } from '@/components/discovery/StoryCard'
import { resolveProtectedUrl } from '@/lib/media/delivery-policy'
import { FrontfilerCard } from '@/components/preview/FrontfilerCard'

// ── SCROLL SLIDE ────────────────────────────────

function ScrollSlide({ children, className, bg }: { children: React.ReactNode; className?: string; bg?: string }) {
  return (
    <div className={`min-h-screen snap-start flex flex-col justify-center ${bg || 'bg-white'} ${className || ''}`}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════
// FRONTFILES HOMEPAGE
// ═══════════════════════════════════════════════

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth bg-white selection:bg-[#0000ff] selection:text-white" data-snap-container style={{ scrollPaddingTop: '56px' }}>
      <SiteHeader />
      <main>
        <ScrollSlide>
          <Hero />
        </ScrollSlide>

        <ScrollSlide>
          <FeaturedCoverage />
        </ScrollSlide>

        <ScrollSlide>
          <section className="w-[min(calc(100%-2rem),1080px)] mx-auto py-8">
            <div className="border-2 border-[#0b1220] bg-white relative">
              <div className="p-8 lg:pr-[440px]">
                <span className="block text-xs font-bold uppercase tracking-[0.12em] text-black mb-3">Frontfiles</span>
                <h2 className="text-[clamp(2rem,1.2rem+2.5vw,3.5rem)] leading-[1.05] tracking-[-0.04em] uppercase text-[#0b1220] max-w-[12ch]">
                  Built for <span className="text-[#0000ff]">journalists</span>, <span className="text-[#0000ff]">freelancers</span>, <span className="text-[#0000ff]">creators</span>, <span className="text-[#0000ff]">editors</span>, <span className="text-[#0000ff]">producers</span>, and responsible content <span className="text-[#0000ff]">buyers</span>.
                </h2>
              </div>
              <div className="hidden lg:flex lg:flex-col absolute top-0 right-0 bottom-0 w-[420px] border-l-2 border-[#0b1220]">
                <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0">
                  <span className="text-[clamp(1.25rem,1rem+1vw,1.75rem)] font-bold uppercase tracking-[-0.02em] text-[#0b1220] leading-tight"><span className="text-[#0000ff]">Discover</span> who is here.</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 min-h-0">
                  <div className="grid grid-cols-2 gap-3">
                    {creators.slice(0, 12).map(c => (
                      <FrontfilerCard
                        key={c.id}
                        creator={c}
                        size="sm"
                        featuredThumbnails={creatorThumbnails[c.id] || []}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ScrollSlide>

        <ScrollSlide>
          <Missions />
        </ScrollSlide>

        <ScrollSlide bg="bg-[#0b1220]">
          <ActiveStories />
        </ScrollSlide>

        <ScrollSlide>
          <NoMore />
        </ScrollSlide>

        <ScrollSlide>
          <section className="w-[min(calc(100%-2rem),1080px)] mx-auto py-8">
            <p className="text-[clamp(3rem,2rem+4vw,6rem)] font-light leading-[1.05] tracking-[-0.03em] text-[#0b1220]">
              Track provenance,<br />preserve authorship,<br />license fairly.
            </p>
          </section>
          <Audiences />
        </ScrollSlide>
      </main>
      <ScrollSlide>
        <Footer />
      </ScrollSlide>
    </div>
  )
}

// ── HERO ─────────────────────────────────────

function Hero() {
  return (
    <section>
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto pt-10 pb-16">
        <div className="flex gap-10 items-center">
          {/* Left: hero text */}
          <div className="flex-1">
            <h1 className="text-[clamp(2rem,1rem+3.5vw,4rem)] font-extrabold leading-[1.15] tracking-[-0.05em] uppercase text-[#0b1220]">
              <span className="block">The</span>
              <span className="block"><span className="text-[#0000ff]">infrastructure</span></span>
              <span className="block">for <span className="text-[#0000ff]">real</span></span>
              <span className="block"><span className="text-[#0000ff]">journalism</span> and</span>
              <span className="block">the <span className="text-[#0000ff]">people</span></span>
              <span className="block">who make it.</span>
            </h1>
          </div>

          {/* Right: Spotlight feed */}
          <div className="hidden lg:block w-[360px] shrink-0">
            <div className="border-2 border-[#0b1220]">
              <div className="px-3 py-2 flex items-center justify-between border-b-2 border-[#0b1220]">
                <div className="flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-[#0000ff] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span className="text-[14px] font-black uppercase tracking-widest text-[#0000ff] italic">Spotlight</span>
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                {stories.map(s => {
                  const hero = assetMap[s.heroAssetId]
                  const creator = creatorMap[s.creatorId]
                  return (
                    <Link
                      key={s.id}
                      href={`/story/${s.id}`}
                      className="flex gap-2.5 pr-3 hover:bg-black/[0.02] transition-colors group items-center"
                    >
                      <div className="w-24 aspect-video shrink-0 overflow-hidden bg-slate-100 rounded">
                        {hero?.id && (
                          <img src={resolveProtectedUrl(hero.id, 'thumbnail')} alt={s.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-2.5 flex flex-col justify-center">
                        <p className="text-[24px] font-normal font-serif italic text-black truncate whitespace-nowrap group-hover:text-[#0000ff] transition-colors">
                          {s.title}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest mt-1 truncate">
                          <span className="text-[#0000ff]">{creator?.name}</span>
                          <span className="text-black"> · {(s.primaryGeography || '').replace(/^geo-/, '')}</span>
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Enter button moved to SiteHeader */}
      </div>
    </section>
  )
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border border-black p-4 min-h-[108px]">
      <strong className="block text-xs uppercase tracking-[0.08em] text-black mb-3">{title}</strong>
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
    <section id="product" className="py-16">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(item => (
          <article key={item.label} className="p-6 border-2 border-[#0b1220] bg-white min-h-[200px]">
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-black mb-3">{item.label}</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4 font-light">{item.heading}</h2>
            <p className="text-black max-w-[50ch]">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ── AUDIENCES ────────────────────────────────

function Audiences() {
  return (
    <section className="py-16">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Creators */}
        <article id="creators" className="bg-white border-2 border-[#0b1220] p-8 flex flex-col gap-5">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-black mb-3">For creators and freelancers</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4 font-light">
              Store, validate, categorize, display, and license your work.
            </h2>
            <p className="text-black max-w-[50ch]">
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
              <li key={item} className="pt-3 border-t border-black text-sm text-[#0b1220]">{item}</li>
            ))}
          </ul>
        </article>

        {/* Buyers */}
        <article id="buyers" className="bg-white border-2 border-[#0b1220] p-8 flex flex-col gap-5">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-black mb-3">For content buyers</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4 font-light">
              Source validated assets with clearer origin and fewer rights risks.
            </h2>
            <p className="text-black max-w-[50ch]">
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
              <li key={item} className="pt-3 border-t border-black text-sm text-[#0b1220]">{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

// ── NO MORE ──────────────────────────────────

function StrikeRow({ label }: { label: string }) {
  return (
    <div className="relative flex items-center py-5">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-[#0000ff]" />
      <div className="relative mx-auto text-[clamp(1.5rem,1rem+2vw,2.5rem)] font-light uppercase tracking-widest text-black">
        {label}
      </div>
    </div>
  )
}

function NoMore() {
  return (
    <section className="py-20 overflow-hidden">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto text-center">
        <p className="text-[clamp(1.5rem,1rem+2vw,2.5rem)] font-light uppercase tracking-widest text-black mb-2">
          No more
        </p>
      </div>
      <div className="w-full">
        {['Middlemen', 'Abusive Contracts', 'Abusive Fees', 'Opacity'].map(label => (
          <StrikeRow key={label} label={label} />
        ))}
      </div>
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto text-center mt-10">
        <div className="text-[clamp(1.5rem,1rem+2vw,2.5rem)] text-black mb-8">↓</div>
        <p className="text-[clamp(2rem,1rem+4vw,4rem)] font-bold uppercase tracking-tight leading-[1] text-black">
          <span className="text-[#0000ff]">Your</span> work,<br /><span className="text-[#0000ff]">your</span> rules.
        </p>
      </div>
    </section>
  )
}

// ── Per-creator asset thumbnails (computed once) ──
const creatorThumbnails: Record<string, string[]> = {}
for (const c of creators) {
  creatorThumbnails[c.id] = assets
    .filter(a => a.creatorId === c.id && a.thumbnailRef)
    .slice(0, 5)
    .map(a => resolveProtectedUrl(a.id, 'thumbnail'))
}

// ── ACTIVE STORIES ──────────────────────────

function ActiveStories() {
  const topStories = [...stories].sort((a, b) => b.spotlightWeight - a.spotlightWeight).slice(0, 4)
  return (
    <section className="py-16 w-full">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <span className="block text-xs font-bold uppercase tracking-[0.12em] text-white mb-2">Real Stories</span>
          <h2 className="text-[clamp(1.25rem,1rem+1vw,1.75rem)] leading-none tracking-[-0.03em] uppercase text-white font-light">
            From every corner of the world.
          </h2>
        </div>

        {/* Story grid — same component as search results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topStories.map(s => (
            <StoryCard key={s.id} story={s} size="default" />
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <Link
            href="/search"
            className="text-[10px] font-bold uppercase tracking-[0.12em] bg-[#0000ff] text-white px-6 py-3 hover:bg-[#003fd1] transition-colors"
          >
            Browse all stories →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── FEATURED COVERAGE ───────────────────────

function FeaturedCoverage() {
  const [activeFormat, setActiveFormat] = useState<string | null>(null)

  // Format counts from public assets
  const formatCounts: Record<string, number> = {}
  for (const a of publicAssets) {
    formatCounts[a.format] = (formatCounts[a.format] || 0) + 1
  }
  const VAULT_FORMATS = ['Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

  // Spotlight-ranked assets (default view)
  const spotlightPool = spotlightRanked
    .filter(s => s.objectType === 'asset')
    .map(s => assetMap[s.objectId])
    .filter(Boolean)

  // When a format is selected, pull from all public assets of that format
  // Supplement spotlight with public assets if fewer than 12
  const spotlightIds = new Set(spotlightPool.map(a => a.id))
  const supplemental = publicAssets.filter(a => !spotlightIds.has(a.id))
  const fullPool = [...spotlightPool, ...supplemental]

  const displayAssets = activeFormat
    ? publicAssets.filter(a => a.format === activeFormat).slice(0, 12)
    : fullPool.slice(0, 12)

  return (
    <section className="py-16">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto">
        {/* Header */}
        <div className="mb-2">
          <span className="block text-xs font-bold uppercase tracking-[0.12em] text-black mb-2"><span className="text-[#0000ff]">Global</span> Watch</span>
          <h2 className="text-[clamp(1.25rem,1rem+1vw,1.75rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] font-light">
            All formats, all types, real work.
          </h2>
        </div>

        {/* Mini filter bar — same visual language as search GridToolbar */}
        <div className="flex items-center gap-1.5 mt-3 mb-4 pt-2 border-t border-slate-200 overflow-x-auto scrollbar-none">
          <svg className="w-4 h-4 text-[#0000ff] shrink-0 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          {VAULT_FORMATS.map(f => {
            const count = formatCounts[f] || 0
            if (count === 0) return null
            const isActive = activeFormat === f
            return (
              <button
                key={f}
                onClick={() => setActiveFormat(isActive ? null : f)}
                className={`h-6 px-2 inline-flex items-center justify-center text-[8px] font-semibold uppercase tracking-wider border transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#0000ff] text-white border-[#0000ff]'
                    : 'bg-white border-black/20 text-black/55 hover:bg-[#0000ff] hover:text-white hover:border-[#0000ff]'
                }`}
              >
                {f} {count}
              </button>
            )
          })}
        </div>

        {/* Asset grid — same component & layout as search results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {displayAssets.map(a => (
            <AssetCard key={a.id} asset={a} size="default" overlay="data" />
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <Link
            href="/search"
            className="text-[10px] font-bold uppercase tracking-[0.12em] bg-[#0000ff] text-white px-6 py-3 hover:bg-[#003fd1] transition-colors"
          >
            Explore the vault →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── MISSIONS ────────────────────────────────

function Missions() {
  return (
    <section id="missions" className="py-16">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto">
        <div className="bg-white border-2 border-[#0000ff] p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#0000ff] mb-3">Assignments</span>
            <h2 className="text-[clamp(1.5rem,1.2rem+1.25vw,2.25rem)] leading-none tracking-[-0.03em] uppercase text-[#0b1220] mb-4">
              Special <span className="text-[#0000ff]">missions</span> for urgent, <span className="text-[#0000ff]">local</span>, and targeted <span className="text-[#0000ff]">coverage</span>.
            </h2>
            <p className="text-xl text-[#0b1220]/70 max-w-[50ch]">
              Buyers assign specific tasks, <span className="text-[#0000ff]">reporting, content capture, or production help</span>. Creators and freelancers can opt into relevant missions and deliver work through the same rights-aware Frontfiles system.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ──────────────────────────────────

function Footer() {
  return (
    <footer className="bg-white">
      <div className="w-[min(calc(100%-2rem),1080px)] mx-auto py-10">
        <p className="text-xs text-black max-w-[660px] leading-[1.75]">
          Frontfiles is a provenance-verified editorial licensing platform for professional journalism. It does not certify factual truth, editorial accuracy, or legal fitness of content.
        </p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.1em] uppercase text-black">
            &copy; 2026 Frontfiles
          </span>
          <div className="flex items-center gap-6 text-[10px] tracking-[0.1em] uppercase text-black">
            <span className="hover:text-[#0000ff] transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-[#0000ff] transition-colors cursor-pointer">Terms</span>
            <span className="hover:text-[#0000ff] transition-colors cursor-pointer">Support</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
