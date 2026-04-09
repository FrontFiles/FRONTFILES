interface DiscoveryReasonTagProps {
  reason: string
  variant?: 'default' | 'blue'
}

export function DiscoveryReasonTag({ reason, variant = 'default' }: DiscoveryReasonTagProps) {
  if (variant === 'blue') {
    return (
      <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-blue-600 border border-blue-600 px-2 py-0.5">
        {reason}
      </span>
    )
  }
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-300 px-2 py-0.5">
      {reason}
    </span>
  )
}
