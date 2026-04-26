'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrustBadge } from './TrustBadge'
import { StateBadge } from './StateBadge'
import { Avatar } from '@/components/discovery/Avatar'
import { ConnectionStats } from '@/components/social/ConnectionStats'
import type { CreatorProfile, ConnectionState } from '@/lib/types'

interface ProfileLeftRailProps {
  profile: CreatorProfile
  connectionState?: ConnectionState
}

export function ProfileLeftRail({ profile, connectionState }: ProfileLeftRailProps) {
  const verifiedDate = profile.lastVerifiedAt
    ? new Date(profile.lastVerifiedAt).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  const mergedCoverageAndSpecs = [...new Set([...(profile.coverageAreas ?? []), ...(profile.specialisations ?? [])])]

  return (
    <aside className="w-80 border-r border-slate-200 bg-white shrink-0 overflow-y-auto">
      {/* Name + title + location — above the photo */}
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center gap-2 mb-0.5">
          {/* Verified + Founding Member icons before name */}
          <div className="relative group/verified shrink-0">
            <div className="w-5 h-5 bg-[#0000ff] flex items-center justify-center">
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-white">
                <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/verified:opacity-100 transition-opacity pointer-events-none">
              Frontfiles Creator
            </div>
          </div>
          {profile.foundingMember && (
            <div className="relative group/fm shrink-0">
              <div className="w-5 h-5 bg-black flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">FM</span>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap opacity-0 group-hover/fm:opacity-100 transition-opacity pointer-events-none">
                Founding Member
              </div>
            </div>
          )}
          <h1 className="text-xl font-bold text-black tracking-tight">{profile.displayName}</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">{profile.professionalTitle}</p>
        {profile.locationBase && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-sm text-black">{profile.locationBase}</span>
          </div>
        )}
      </div>

      {/* Square profile photo with blue triangle */}
      {profile.avatarUrl && (
        <div className="w-full aspect-square overflow-hidden bg-slate-100 relative">
          <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover object-[center_20%]" />
          {/* Blue triangle — upper-right corner */}
          <div className="absolute top-0 right-0 w-0 h-0" style={{ borderLeft: '48px solid transparent', borderTop: '48px solid #0000ff' }} />
        </div>
      )}

      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Biography */}
        {profile.biography && (
          <RailSection label="Biography">
            <RailExpandableBio text={profile.biography} />
          </RailSection>
        )}

        {/* Buttons: View Frontfolio, View posts, Assign me to, Message, Connect */}
        <div className="flex flex-col gap-2">
          <Link
            href={`/creator/${profile.username}/frontfolio`}
            className="w-full h-10 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-2 border-[#0000ff] bg-[#0000ff] text-white hover:bg-[#003fd1] hover:border-[#003fd1]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            View Frontfolio
          </Link>
          <Link
            href={`/creator/${profile.username}/posts`}
            className="w-full h-10 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-2 border-black bg-white text-black hover:bg-black hover:text-white"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            View posts
          </Link>
          <RailAssignButton creatorName={profile.displayName} />
          <a
            href={`/messages?to=${profile.username}`}
            className="w-full h-10 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-2 border-black bg-white text-black hover:bg-black hover:text-white"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Message
          </a>
          {connectionState && <ConnectionStats initialState={connectionState} />}
        </div>

        {/* 12. Also me — social icons + website */}
        {((profile.alsoMeLinks?.length ?? 0) > 0 || profile.websiteUrl) && (
          <RailSection label="Also me">
            <div className="flex flex-col gap-3">
              {/* Social icons row */}
              {(profile.alsoMeLinks?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  {profile.alsoMeLinks.map((link, i) => {
                    const platform = detectPlatform(link)
                    return (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 border border-slate-200 flex items-center justify-center hover:border-black transition-colors group"
                        title={platform.name}
                      >
                        <platform.Icon className="w-4 h-4 text-slate-400 group-hover:text-black transition-colors" />
                      </a>
                    )
                  })}
                </div>
              )}
              {/* Website */}
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 group"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0000ff] transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-xs text-[#0000ff] font-medium hover:underline truncate">
                    {profile.websiteUrl.replace(/^https?:\/\//, '')}
                  </span>
                </a>
              )}
            </div>
          </RailSection>
        )}

        {/* 13. Skill pool */}
        {profile.skills.length > 0 && (
          <RailSection label="Skill pool">
            <ChipList items={profile.skills} />
          </RailSection>
        )}

        {/* 14. Coverage & specializations (merged) */}
        {mergedCoverageAndSpecs.length > 0 && (
          <RailSection label="Coverage & specializations">
            <ChipList items={mergedCoverageAndSpecs} />
          </RailSection>
        )}

        {/* 15. Media affiliations */}
        {profile.mediaAffiliations.length > 0 && (
          <RailSection label="Media affiliations">
            <ValueList items={profile.mediaAffiliations} />
          </RailSection>
        )}

        {/* 16. Press accreditations */}
        {profile.pressAccreditations.length > 0 && (
          <RailSection label="Press accreditations">
            <ValueList items={profile.pressAccreditations} />
          </RailSection>
        )}

        {/* 17. Published works (with real previews) */}
        {profile.publishedIn.length > 0 && (
        <RailSection label="Published works">
          <div className="flex flex-col gap-3">
            {profile.publishedIn.map((pub, i) => {
              const meta = RAIL_PUB_META[pub] || { type: 'Publication', logo: null }
              return (
                <a key={i} href="#" className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {meta.logo ? (
                      <img src={meta.logo} alt={pub} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight leading-none text-center">{pub.slice(0, 4)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-black font-medium group-hover:text-[#0000ff] transition-colors">{pub}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">{meta.type}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </RailSection>
        )}

        {/* Last verified — bottom of rail */}
        {verifiedDate && (
          <div className="border-t border-slate-200 pt-4">
            <span className="font-mono text-[10px] text-slate-400">
              Last verified: {verifiedDate}
            </span>
          </div>
        )}

        {/* Validation disclaimer */}
        {verifiedDate && (
          <div className="border border-slate-200 px-3 py-2 mt-2">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              This certification attests to identity and provenance, not to the accuracy or truthfulness of published content.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

// ══════════════════════════════════════════════
// HELPER COMPONENTS
// ══════════════════════════════════════════════

function RailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
        {label}
      </span>
      {children}
    </div>
  )
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center bg-slate-100 border border-slate-300 text-black text-xs font-medium px-2.5 py-1"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function ValueList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => (
        <span key={i} className="text-sm text-black font-medium">{item}</span>
      ))}
    </div>
  )
}

function RailAssignButton({ creatorName }: { creatorName: string }) {
  const [assigned, setAssigned] = useState(false)
  return (
    <button
      onClick={() => setAssigned(a => !a)}
      className={`w-full h-10 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-2 ${
        assigned
          ? 'bg-[#0000ff] text-white border-[#0000ff] hover:bg-[#0000cc]'
          : 'bg-white text-black border-black hover:bg-black hover:text-white'
      }`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        {assigned ? <path d="M9 14l2 2 4-4" /> : <><path d="M12 11v6" /><path d="M9 14h6" /></>}
      </svg>
      {assigned ? 'Assigned' : 'Assign me to'}
    </button>
  )
}

function RailExpandableBio({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 160

  return (
    <div>
      <p
        className="text-sm text-black leading-relaxed"
        style={!expanded && isLong ? { WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:text-[#0000cc] mt-1.5 transition-colors"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// SOCIAL PLATFORM DETECTION + ICONS
// ══════════════════════════════════════════════

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function IconYouTube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function detectPlatform(url: string): { name: string; Icon: React.FC<{ className?: string }> } {
  const lower = url.toLowerCase()
  if (lower.includes('linkedin')) return { name: 'LinkedIn', Icon: IconLinkedIn }
  if (lower.includes('twitter') || lower.includes('x.com')) return { name: 'X / Twitter', Icon: IconX }
  if (lower.includes('instagram')) return { name: 'Instagram', Icon: IconInstagram }
  if (lower.includes('youtube')) return { name: 'YouTube', Icon: IconYouTube }
  return { name: 'Link', Icon: IconLink }
}

// ══════════════════════════════════════════════
// PUBLISHED WORKS METADATA
// ══════════════════════════════════════════════

const RAIL_PUB_META: Record<string, { type: string; logo: string | null }> = {
  'Reuters': { type: 'Wire service', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Reuters_Logo.svg/200px-Reuters_Logo.svg.png' },
  'South China Morning Post': { type: 'Newspaper', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/South_China_Morning_Post_Logo.svg/200px-South_China_Morning_Post_Logo.svg.png' },
  'Foreign Policy': { type: 'Magazine', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Foreign_Policy_logo.svg/200px-Foreign_Policy_logo.svg.png' },
  'The Guardian': { type: 'Newspaper', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/The_Guardian.svg/200px-The_Guardian.svg.png' },
  'Al Jazeera': { type: 'Broadcast', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Aljazeera.svg/200px-Aljazeera.svg.png' },
  'BBC': { type: 'Broadcast', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/BBC_Logo_2021.svg/200px-BBC_Logo_2021.svg.png' },
  'The New York Times': { type: 'Newspaper', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/New_York_Times_logo_variation.jpg/200px-New_York_Times_logo_variation.jpg' },
  'Associated Press': { type: 'Wire service', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Associated_Press_logo_2012.svg/200px-Associated_Press_logo_2012.svg.png' },
}
