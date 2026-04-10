'use client'

import { cn } from '@/lib/utils'
import type { PrivacyState } from '@/lib/types'

export type VaultSection = 'all' | 'stories' | 'articles' | 'collections' | 'uploads' | 'analytics'

interface VaultLeftRailProps {
  activeSection: VaultSection
  onSectionChange: (section: VaultSection) => void
  privacyFilter: PrivacyState | 'ALL'
  onPrivacyFilterChange: (filter: PrivacyState | 'ALL') => void
  onUploadClick: () => void
}

const sections: { key: VaultSection; label: string }[] = [
  { key: 'all', label: 'All assets' },
  { key: 'stories', label: 'Stories' },
  { key: 'articles', label: 'Articles' },
  { key: 'collections', label: 'Collections' },
  { key: 'uploads', label: 'Uploads' },
  { key: 'analytics', label: 'Analytics' },
]

export function VaultLeftRail({
  activeSection,
  onSectionChange,
  privacyFilter,
  onPrivacyFilterChange,
  onUploadClick,
}: VaultLeftRailProps) {
  return (
    <aside className="w-56 border-r border-slate-200 bg-white shrink-0 flex flex-col">
      <div className="px-5 py-5 flex-1">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 block mb-6">
          Vault
        </span>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5">
          {sections.map(section => (
            <button
              key={section.key}
              onClick={() => onSectionChange(section.key)}
              className={cn(
                'text-left px-3 py-2 text-sm font-bold transition-colors',
                activeSection === section.key
                  ? 'border-l-2 border-[#0000ff] bg-[#0000ff]/5 text-black'
                  : 'text-slate-500 hover:text-black hover:bg-slate-50 border-l-2 border-transparent'
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>

        {/* Privacy filter */}
        <div className="mt-8 border-t border-slate-200 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
            Filter by privacy
          </span>
          <select
            value={privacyFilter}
            onChange={e => onPrivacyFilterChange(e.target.value as PrivacyState | 'ALL')}
            className="w-full h-8 border border-slate-300 bg-white text-xs text-black px-2 font-bold uppercase tracking-wide"
          >
            <option value="ALL">All</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
            <option value="RESTRICTED">Restricted</option>
          </select>
        </div>
      </div>

      {/* Upload button */}
      <div className="px-5 py-4 border-t border-slate-200">
        <a
          href="/vault/upload"
          className="block w-full h-10 bg-[#0000ff] text-white font-bold text-sm uppercase tracking-wide hover:bg-[#0000cc] transition-colors text-center leading-10"
        >
          Upload
        </a>
      </div>
    </aside>
  )
}
