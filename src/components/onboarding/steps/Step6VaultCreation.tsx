'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CreatorProfileDraft, IdentityAnchor } from '@/lib/onboarding/types'

interface Step6Props {
  vaultId: string
  profileDraft: CreatorProfileDraft
  identityAnchor: IdentityAnchor
}

export function Step6VaultCreation({ vaultId, profileDraft, identityAnchor }: Step6Props) {
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

  return (
    <div
      className={cn(
        'flex flex-col gap-8 max-w-2xl transition-all duration-500',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {/* Hero success block */}
      <div className="flex flex-col items-start gap-6">
        {/* Shield icon */}
        <div className="w-20 h-20 bg-blue-600 flex items-center justify-center">
          <svg viewBox="0 0 32 32" fill="none" className="w-11 h-11 text-white">
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
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold tracking-widest uppercase bg-blue-600 text-white">
              Vault activated
            </span>
          </div>
          <h1 className="text-4xl font-bold text-black tracking-tight mb-3">
            Your Vault is live.
          </h1>
          <p className="text-slate-600 text-base leading-relaxed max-w-lg">
            Welcome to Frontfiles, {identityAnchor.fullName.split(' ')[0]}. Your Vault has been created and is ready for uploads. You can start publishing your work immediately.
          </p>
        </div>
      </div>

      {/* Vault ID card */}
      <div className="bg-black text-white px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Vault ID</span>
          <button
            onClick={handleCopyVaultId}
            className="text-xs text-white/40 hover:text-white transition-colors uppercase tracking-wider font-bold"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="font-mono text-white text-xl tracking-[0.15em]">{vaultId}</div>
        <p className="text-xs text-white/30 mt-2">
          Keep this ID for your records. Your account creation has been logged as a timestamped entry in the Certification Event Log (CEL).
        </p>
      </div>

      {/* Account summary */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Account summary</h2>
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
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next steps</h2>
        <div className="flex flex-col gap-0 border-2 border-black divide-y divide-slate-200">
          <NextStepRow
            number="1"
            title="Upload your first file"
            description="Add images, documents, or video to your Vault. All uploads are cryptographically signed and logged in the Certification Event Log."
          />
          <NextStepRow
            number="2"
            title="Complete your profile"
            description="Add any remaining information to maximise discoverability on the Frontfiles network."
          />
          <NextStepRow
            number="3"
            title="Share your Vault link"
            description="Your public Vault page is available immediately. Share it with editors and organisations."
          />
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => window.location.href = '/vault'}
          className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
        >
          Go to Vault
        </Button>
        <Button
          variant="ghost"
          onClick={() => window.location.href = '/vault/profile'}
          className="h-11 px-5 text-slate-500 hover:text-black hover:bg-slate-50 text-sm rounded-none font-bold"
        >
          Complete profile later
        </Button>
      </div>

      {/* Footer note */}
      <div className="border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          Your account is in good standing. Files you upload will be publicly accessible unless you mark them as private.
          Frontfiles does not guarantee editorial placement — Vault verification is a credential of authenticity, not a commissioning relationship.
        </p>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</span>
      <span className="text-sm text-black font-medium truncate">{value || '—'}</span>
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
