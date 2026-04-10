'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CreatorProfileDraft, IdentityAnchor } from '@/lib/onboarding/types'

interface Phase3Props {
  vaultId: string
  profileDraft: CreatorProfileDraft
  identityAnchor: IdentityAnchor
  username: string | null
}

export function Phase3Launch({ vaultId, profileDraft, identityAnchor, username }: Phase3Props) {
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  async function handleCopyVaultId() {
    try {
      await navigator.clipboard.writeText(vaultId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }

  const firstName = identityAnchor.fullName.split(' ')[0]

  return (
    <div
      className={cn(
        'flex flex-col gap-8 max-w-2xl transition-all duration-500',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {/* Hero */}
      <div className="flex flex-col items-start gap-6">
        <div className="w-16 h-16 bg-[#0000ff] flex items-center justify-center">
          <svg viewBox="0 0 32 32" fill="none" className="w-9 h-9 text-white">
            <path
              d="M16 3L6 7.5v8c0 6.075 4.25 11.75 10 13.5C21.75 27.25 26 21.575 26 15.5v-8L16 3z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="currentColor"
              fillOpacity="0.2"
            />
            <path
              d="M11 16l3.5 3.5L21 12"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold tracking-[0.14em] uppercase bg-[#0000ff] text-white mb-3">
            Vault activated
          </span>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
            Your Vault is ready.
          </h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-lg">
            Welcome to Frontfiles, {firstName}. Your Vault has been created and is ready for uploads. You can start publishing your work immediately.
          </p>
        </div>
      </div>

      {/* Username URL card */}
      {username && (
        <div className="border-2 border-[#0000ff] px-6 py-4">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#0000ff] font-bold mb-1 block">Your profile</span>
          <div className="font-mono text-black text-lg tracking-wide">frontfiles.com/{username}</div>
        </div>
      )}

      {/* Vault ID card */}
      <div className="bg-black text-white px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">Vault ID</span>
          <button
            onClick={handleCopyVaultId}
            className="text-xs text-white/40 hover:text-white transition-colors uppercase tracking-[0.12em] font-bold"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="font-mono text-white text-xl tracking-[0.15em]">{vaultId}</div>
        <p className="text-xs text-white/30 mt-2">
          Your account creation has been logged as a timestamped entry in the Certification Event Log.
        </p>
      </div>

      {/* Account summary */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Account summary</h2>
        <div className="grid grid-cols-2 gap-3 border-2 border-black p-4">
          <SummaryItem label="Name" value={profileDraft.fullName.value} />
          <SummaryItem label="Title" value={profileDraft.professionalTitle.value} />
          <SummaryItem
            label="Affiliations"
            value={profileDraft.mediaAffiliations.slice(0, 2).map(e => e.value).join(', ')}
          />
          <SummaryItem
            label="Coverage"
            value={profileDraft.geographicCoverageAreas.slice(0, 3).map(e => e.value).join(', ')}
          />
        </div>
      </div>

      {/* Next steps */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Next steps</h2>
        <div className="flex flex-col gap-0 border-2 border-black divide-y divide-slate-200">
          <NextStepRow
            number="1"
            title="Upload your first file"
            description="Add images, documents, or video to your Vault. All uploads are cryptographically signed."
          />
          <NextStepRow
            number="2"
            title="Complete your profile"
            description="Add any remaining information to maximise discoverability."
          />
          <NextStepRow
            number="3"
            title="Share your Vault link"
            description="Your public Vault page is available immediately."
          />
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-3 pb-8">
        <Button
          onClick={() => window.location.href = username ? `/${username}/frontfolio` : '/creator/sarahchen/frontfolio'}
          className="h-12 px-8 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-[13px] rounded-none uppercase tracking-[0.12em]"
        >
          Go to Frontfolio
        </Button>
        <Button
          variant="ghost"
          onClick={() => window.location.href = '/vault/profile'}
          className="h-12 px-5 text-slate-500 hover:text-black hover:bg-slate-50 text-sm rounded-none font-bold"
        >
          Complete profile now
        </Button>
      </div>

      {/* Footer note */}
      <div className="border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          Your account is in good standing. Files you upload will be publicly accessible unless you mark them as private.
          Frontfiles does not guarantee editorial placement. Vault verification is a credential of authenticity, not a commissioning relationship.
        </p>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-bold">{label}</span>
      <span className="text-sm text-black font-medium truncate">{value || '·'}</span>
    </div>
  )
}

function NextStepRow({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px] text-white font-mono font-bold">{number}</span>
      </div>
      <div>
        <div className="text-sm text-black font-bold">{title}</div>
        <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{description}</div>
      </div>
    </div>
  )
}
