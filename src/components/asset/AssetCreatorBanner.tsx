import Link from 'next/link'
import { Avatar } from '@/components/discovery/Avatar'
import { ConnectButton } from '@/components/social/ConnectButton'
import type { Creator } from '@/data'

interface AssetCreatorBannerProps {
  creator: Creator
}

export function AssetCreatorBanner({ creator }: AssetCreatorBannerProps) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/creator/${creator.slug}/frontfolio`} className="shrink-0">
        <Avatar src={creator.avatarRef} name={creator.name} size="lg" slug={creator.slug} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/creator/${creator.slug}/frontfolio`} className="group">
          <span className="text-sm font-bold text-black group-hover:text-[#0000ff] transition-colors block truncate">
            {creator.name}
          </span>
          <span className="text-[11px] text-slate-400 block truncate">{creator.locationBase}</span>
        </Link>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href="/messages"
          className="h-9 px-3 flex items-center justify-center border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
          title="Message"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>
        <ConnectButton />
      </div>
    </div>
  )
}
