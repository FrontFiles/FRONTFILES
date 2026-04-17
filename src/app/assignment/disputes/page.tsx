'use client'

import Link from 'next/link'
import { StaffDisputeQueue } from '@/components/assignment/StaffDisputeQueue'

export default function DisputeQueuePage() {
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="border-b border-black/10">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/assignment" className="text-[9px] text-black/30 hover:text-black transition-colors">
            ← Assignments
          </Link>
          <span className="text-[9px] text-black/15">·</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Staff</span>
        </div>
      </div>
      <StaffDisputeQueue />
    </div>
  )
}
