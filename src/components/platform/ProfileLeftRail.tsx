'use client'

import { useState } from 'react'
import { TrustBadge } from './TrustBadge'
import { StateBadge } from './StateBadge'
import { FollowStats } from '@/components/social/FollowStats'
import type { CreatorProfile, FollowState } from '@/lib/types'

interface ProfileLeftRailProps {
  profile: CreatorProfile
  followState?: FollowState
}

export function ProfileLeftRail({ profile, followState }: ProfileLeftRailProps) {
  const verifiedDate = new Date(profile.lastVerifiedAt).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <aside className="w-80 border-r border-slate-200 bg-white shrink-0 overflow-y-auto">
      <div className="px-6 py-8 flex flex-col gap-6">
        {/* Avatar */}
        <div className="w-32 h-32 border-2 border-black bg-slate-100 flex items-center justify-center">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-slate-400">
              {profile.displayName.split(' ').map(n => n[0]).join('')}
            </span>
          )}
        </div>

        {/* Name + title */}
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">{profile.displayName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{profile.professionalTitle}</p>
        </div>

        {/* Trust badge + founding member */}
        <div className="flex flex-col gap-2">
          <TrustBadge tier={profile.trustTier} badge={profile.trustBadge} />
          {profile.foundingMember && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-black flex items-center justify-center shrink-0">
                <span className="text-white text-[9px] font-bold">FM</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-black">
                Founding Member
              </span>
            </div>
          )}
          <span className="font-mono text-[10px] text-slate-400">
            Last verified: {verifiedDate}
          </span>
        </div>

        {/* Follow */}
        {followState && (
          <div className="border-t border-slate-200 pt-4">
            <FollowStats initialState={followState} />
          </div>
        )}

        {/* Identity verified */}
        <RailSection label="Identity verified">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white">
                <path d="M4 12L9 17L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-black">Identity verification complete</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                Government ID verified and cross-referenced against public records.
              </p>
            </div>
          </div>
        </RailSection>

        {/* Cross-check */}
        <RailSection label="Cross-check complete">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Professional credentials cross-referenced against public sources. Validation record available.
          </p>
        </RailSection>

        {profile.verificationStatus === 'pending_reverification' && (
          <div className="border border-dashed border-slate-300 px-3 py-2">
            <StateBadge variant="under_review" />
            <p className="text-[10px] text-slate-500 mt-1">
              Periodic re-verification due. Verified status remains valid until review.
            </p>
          </div>
        )}

        {/* Validation disclaimer */}
        <div className="border border-slate-200 px-3 py-2">
          <p className="text-[9px] text-slate-400 leading-relaxed">
            This certification attests to identity and provenance, not to the accuracy or truthfulness of published content.
          </p>
        </div>

        {/* Licensing */}
        <RailSection label="Licensing">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {profile.licensing.available && <StateBadge variant="public" className="!text-[10px]" />}
              <span className="text-xs font-bold text-black">
                {profile.licensing.available ? 'Available for licensing' : 'Not available'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <MiniStat label="Assets" count={profile.stats.totalAssets} />
              <MiniStat label="Stories" count={profile.stats.totalStories} />
              <MiniStat label="Articles" count={profile.stats.totalArticles} />
              <MiniStat label="Collections" count={profile.stats.totalCollections} />
            </div>
            {profile.licensing.available && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Licence types</span>
                <div className="flex flex-wrap gap-1">
                  {profile.licensing.licenceTypes.map((lt, i) => (
                    <span key={i} className="text-[10px] text-black font-medium">{lt}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[9px] text-slate-400 italic border border-slate-200 px-2 py-1">
              Sign in as buyer to view licensing terms
            </p>
          </div>
        </RailSection>

        {/* Biography */}
        <RailSection label="Biography">
          <RailExpandableBio text={profile.biography} />
        </RailSection>

        {/* Coverage areas */}
        <RailSection label="Coverage areas">
          <ChipList items={profile.coverageAreas} />
        </RailSection>

        {/* Specialisations */}
        <RailSection label="Specialisations">
          <ChipList items={profile.specialisations} />
        </RailSection>

        {/* Media affiliations */}
        <RailSection label="Media affiliations">
          <ValueList items={profile.mediaAffiliations} />
        </RailSection>

        {/* Press accreditations */}
        <RailSection label="Press accreditations">
          <ValueList items={profile.pressAccreditations} />
        </RailSection>

        {/* Published works */}
        <RailSection label="Published works">
          <div className="flex flex-col gap-2">
            {profile.publishedIn.map((pub, i) => {
              const meta = RAIL_PUB_META[pub] || { type: 'Publication', color: 'bg-slate-50' }
              return (
                <div key={i} className="flex items-center gap-2.5 group cursor-pointer">
                  <div className={`w-7 h-9 ${meta.color} border border-slate-200 flex items-center justify-center shrink-0`}>
                    <span className="text-[5px] font-black text-slate-400 uppercase tracking-tight">{pub.slice(0, 3)}</span>
                  </div>
                  <div>
                    <p className="text-sm text-black font-medium group-hover:text-blue-600 transition-colors">{pub}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">{meta.type}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </RailSection>

        {/* Skill pool */}
        <RailSection label="Skill pool">
          <ChipList items={profile.skills} />
        </RailSection>

        {/* Also me */}
        {profile.alsoMeLinks.length > 0 && (
          <RailSection label="Also me">
            <div className="flex flex-col gap-1">
              {profile.alsoMeLinks.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 font-medium hover:underline truncate"
                >
                  {link.replace(/^https?:\/\//, '')}
                </a>
              ))}
            </div>
          </RailSection>
        )}
      </div>
    </aside>
  )
}

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

function MiniStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-sm font-bold text-black font-mono">{count}</span>
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

const RAIL_PUB_META: Record<string, { type: string; color: string }> = {
  'Reuters': { type: 'Wire service', color: 'bg-orange-50' },
  'South China Morning Post': { type: 'Newspaper', color: 'bg-yellow-50' },
  'Foreign Policy': { type: 'Magazine', color: 'bg-blue-50' },
  'The Guardian': { type: 'Newspaper', color: 'bg-indigo-50' },
  'Al Jazeera': { type: 'Broadcast', color: 'bg-amber-50' },
  'BBC': { type: 'Broadcast', color: 'bg-red-50' },
  'The New York Times': { type: 'Newspaper', color: 'bg-slate-100' },
  'Associated Press': { type: 'Wire service', color: 'bg-red-50' },
}

function RailFollowButton() {
  const [following, setFollowing] = useState(false)
  return (
    <button
      onClick={() => setFollowing(f => !f)}
      className={`w-full mt-3 h-9 text-[10px] font-bold uppercase tracking-widest transition-colors border-2 ${
        following
          ? 'bg-black text-white border-black hover:bg-black/80'
          : 'bg-white text-black border-black hover:bg-black hover:text-white'
      }`}
    >
      {following ? 'Following' : 'Follow'}
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
          className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 mt-1.5 transition-colors"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}
