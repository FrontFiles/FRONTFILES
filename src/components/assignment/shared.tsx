'use client'

/**
 * Assignment Engine — Shared Building Blocks
 *
 * Extracted from existing components. Reused across buyer, creator, and staff screens.
 * Design canon: black + #0000ff + white. No radius. Hard borders. Dense typography.
 */

import { cn } from '@/lib/utils'
import type {
  AssignmentClass,
  AssignmentState,
  AssignmentSubState,
  MilestoneState,
  MilestoneType,
  ReviewDetermination,
  CCRState,
  EvidenceItem,
  EvidenceItemKind,
  BuyerCompanyRole,
  EscrowRecord,
} from '@/lib/types'
import {
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_SUB_STATE_LABELS,
  ASSIGNMENT_CLASS_LABELS,
  MILESTONE_STATE_LABELS,
  REVIEW_DETERMINATION_LABELS,
} from '@/lib/types'
import { centsToEur } from '@/lib/assignment/selectors'
import { FileText, Clock, MapPin, User, Upload, AlertTriangle } from 'lucide-react'

// ══════════════════════════════════════════════
// LABELS
// ══════════════════════════════════════════════

export function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">{label}</span>
      <div className="flex-1 border-b border-black/5" />
    </div>
  )
}

export function FieldLabel({ label }: { label: string }) {
  return <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-1.5">{label}</span>
}

// ══════════════════════════════════════════════
// BADGES
// ══════════════════════════════════════════════

export function ClassBadge({ cls, size = 'sm' }: { cls: AssignmentClass; size?: 'sm' | 'md' }) {
  return (
    <span className={cn(
      'font-bold uppercase tracking-[0.12em] border shrink-0',
      size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1',
      cls === 'service' ? 'border-[#0000ff] text-[#0000ff]' :
      cls === 'hybrid' ? 'border-black text-black bg-black/5' :
      'border-black text-black',
    )}>
      {ASSIGNMENT_CLASS_LABELS[cls]}
    </span>
  )
}

export function AssignmentStateBadge({ state, subState }: { state: AssignmentState; subState: AssignmentSubState }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-black border-2 border-black px-1.5 py-0.5">
        {ASSIGNMENT_STATE_LABELS[state] ?? state}
      </span>
      <span className="text-[8px] text-black/30">
        {ASSIGNMENT_SUB_STATE_LABELS[subState] ?? subState}
      </span>
    </div>
  )
}

export function MilestoneStateBadge({ state }: { state: MilestoneState }) {
  const label = MILESTONE_STATE_LABELS[state] ?? state
  const isComplete = state === 'accepted' || state === 'accepted_partial'
  const isDisputed = state === 'disputed'
  const isActive = state === 'active' || state === 'fulfilment_submitted' || state === 'review_open'
  return (
    <span className={cn(
      'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border shrink-0',
      isComplete ? 'bg-black text-white border-black' :
      isDisputed ? 'border-black text-black' :
      isActive ? 'border-[#0000ff] text-[#0000ff]' :
      'border-black/15 text-black/30',
    )}>
      {label}
    </span>
  )
}

export function MilestoneTypeBadge({ type }: { type: MilestoneType }) {
  return (
    <span className={cn(
      'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border shrink-0',
      type === 'service' ? 'border-[#0000ff] text-[#0000ff]' : 'border-black/20 text-black/40',
    )}>
      {type}
    </span>
  )
}

export function ReviewBadge({ determination }: { determination: ReviewDetermination }) {
  return (
    <span className={cn(
      'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
      determination === 'accepted' ? 'bg-black text-white border-black' :
      determination === 'rejected' || determination === 'dispute_opened' ? 'border-black text-black' :
      'border-black/30 text-black/60',
    )}>
      {REVIEW_DETERMINATION_LABELS[determination]}
    </span>
  )
}

export function CCRStateBadge({ state }: { state: CCRState }) {
  const labels: Record<CCRState, string> = {
    pending: 'Pending',
    approved: 'Approved',
    denied: 'Denied',
    auto_denied: 'Auto-denied',
    withdrawn: 'Withdrawn',
  }
  return (
    <span className={cn(
      'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
      state === 'pending' ? 'border-[#0000ff] text-[#0000ff]' :
      state === 'approved' ? 'bg-black text-white border-black' :
      'border-black/20 text-black/40',
    )}>
      {labels[state]}
    </span>
  )
}

export function RoleBadge({ role }: { role: BuyerCompanyRole | null }) {
  const label = role === null ? 'Individual buyer' :
    role === 'content_commit_holder' ? 'Content Commit Holder' :
    role === 'editor' ? 'Editor' : 'Admin'
  const canRelease = role === null || role === 'content_commit_holder'
  return (
    <span className={cn(
      'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 border',
      canRelease ? 'border-black text-black' : 'border-black/20 text-black/40',
    )}>
      {label}
    </span>
  )
}

// ══════════════════════════════════════════════
// EVIDENCE
// ══════════════════════════════════════════════

const EVIDENCE_ICONS: Record<string, typeof FileText> = {
  vault_asset: Upload,
  service_log: Clock,
  support_document: FileText,
  handoff_note: FileText,
  attendance_confirmation: User,
  time_location_record: MapPin,
}

export function EvidenceItemRow({ item }: { item: EvidenceItem }) {
  const Icon = EVIDENCE_ICONS[item.kind] ?? FileText
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={10} className="text-black/20 shrink-0" />
      <span className={cn(
        'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border shrink-0',
        item.kind === 'vault_asset' ? 'border-black/20 text-black/40' : 'border-[#0000ff]/30 text-[#0000ff]/60',
      )}>
        {item.kind.replace(/_/g, ' ')}
      </span>
      <span className="text-[9px] text-black truncate">{item.label}</span>
      {item.fileName && (
        <span className="text-[8px] font-mono text-black/20 shrink-0">{item.fileName}</span>
      )}
      {item.serviceLog && (
        <span className="text-[8px] font-mono text-black/20 shrink-0">{item.serviceLog.location} · {item.serviceLog.date}</span>
      )}
    </div>
  )
}

export function EvidenceGrouped({ items }: { items: EvidenceItem[] }) {
  const grouped = items.reduce<Record<string, EvidenceItem[]>>((acc, item) => {
    const key = item.kind
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(grouped).map(([kind, items]) => (
        <div key={kind}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 border',
              kind === 'vault_asset' ? 'border-black/20 text-black/40' : 'border-[#0000ff]/30 text-[#0000ff]/60',
            )}>
              {kind.replace(/_/g, ' ')}
            </span>
            <span className="text-[8px] font-mono text-black/20">{items.length}</span>
          </div>
          <div className="flex flex-col gap-0.5 pl-2 border-l border-black/10">
            {items.map(item => (
              <EvidenceItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════
// ESCROW PANEL
// ══════════════════════════════════════════════

export function EscrowPanel({ escrow, className }: { escrow: EscrowRecord; className?: string }) {
  const balance = escrow.totalCapturedCents - escrow.totalReleasedCents - escrow.totalRefundedCents - escrow.totalFrozenCents
  return (
    <div className={cn('border-2 border-black p-3', className)}>
      <div className="text-[9px] font-mono text-black/40 flex flex-col gap-1">
        <div className="flex justify-between"><span>Captured</span><span className="font-bold text-black">{centsToEur(escrow.totalCapturedCents)}</span></div>
        <div className="flex justify-between"><span>Released</span><span>{centsToEur(escrow.totalReleasedCents)}</span></div>
        <div className="flex justify-between"><span>Refunded</span><span>{centsToEur(escrow.totalRefundedCents)}</span></div>
        {escrow.totalFrozenCents > 0 && (
          <div className="flex justify-between"><span>Frozen</span><span className="font-bold text-black">{centsToEur(escrow.totalFrozenCents)}</span></div>
        )}
        <div className="border-t border-black/10 pt-1 mt-1 flex justify-between">
          <span className="font-bold text-black">Remaining</span>
          <span className="font-bold text-black">{centsToEur(balance)}</span>
        </div>
        {escrow.stripePaymentIntentId && (
          <div className="border-t border-black/5 pt-1 mt-1">
            <span className="text-[7px] text-black/20">Stripe PI: {escrow.stripePaymentIntentId}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ACTION BAR
// ══════════════════════════════════════════════

export interface ActionBarItem {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  disabledReason?: string
}

export function ActionBar({ actions, className }: { actions: ActionBarItem[]; className?: string }) {
  if (actions.length === 0) return null
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {actions.map((action, i) => (
        <div key={i} className="relative group">
          <button
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-4 py-2 border-2 transition-colors',
              action.variant === 'primary' ? 'bg-black text-white border-black hover:bg-black/90 disabled:bg-black/20 disabled:border-black/20 disabled:text-black/40' :
              action.variant === 'danger' ? 'bg-white text-black border-black hover:bg-black/5 disabled:border-black/20 disabled:text-black/30' :
              'bg-white text-black border-black/30 hover:border-black disabled:border-black/10 disabled:text-black/20',
            )}
          >
            {action.label}
          </button>
          {action.disabled && action.disabledReason && (
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
              <div className="bg-black text-white text-[8px] px-2 py-1 whitespace-nowrap max-w-[200px]">
                {action.disabledReason}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════
// PERMISSION NOTICE
// ══════════════════════════════════════════════

export function PermissionNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border border-black/10 p-3 mt-2">
      <AlertTriangle size={12} className="text-black/30 mt-0.5 shrink-0" />
      <p className="text-[9px] text-black/40 leading-relaxed">{children}</p>
    </div>
  )
}

// ══════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════

export function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="border-2 border-dashed border-black/15 py-8 text-center">
      <p className="text-[10px] text-black/25 uppercase tracking-widest">{message}</p>
      {detail && <p className="text-[9px] text-black/15 mt-1">{detail}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════
// META CHIP (for milestone details)
// ══════════════════════════════════════════════

export function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[7px] font-bold uppercase tracking-widest text-black/20 block">{label}</span>
      <span className="text-[9px] text-black/50">{value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════
// DATE HELPERS
// ══════════════════════════════════════════════

export function ShortDate({ iso }: { iso: string }) {
  return (
    <span className="text-[8px] font-mono text-black/25">
      {new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
    </span>
  )
}

export function RelativeDeadline({ iso }: { iso: string }) {
  const now = Date.now()
  const target = new Date(iso).getTime()
  const hours = Math.floor((target - now) / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (hours < 0) {
    return <span className="text-[8px] font-mono font-bold text-black">Overdue by {Math.abs(days)}d</span>
  }
  if (days === 0) {
    return <span className="text-[8px] font-mono text-black/50">{hours}h remaining</span>
  }
  return <span className="text-[8px] font-mono text-black/50">{days}d {hours % 24}h remaining</span>
}
