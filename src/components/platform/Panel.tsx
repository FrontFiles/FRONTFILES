import { cn } from '@/lib/utils'

interface PanelProps {
  title?: string
  headerStyle?: 'black' | 'blue' | 'none'
  borderStyle?: 'emphasis' | 'standard' | 'dashed' | 'blue'
  children: React.ReactNode
  className?: string
}

export function Panel({
  title,
  headerStyle = 'none',
  borderStyle = 'emphasis',
  children,
  className,
}: PanelProps) {
  const borderClass = {
    emphasis: 'border-2 border-black',
    standard: 'border border-slate-200',
    dashed: 'border-2 border-dashed border-black',
    blue: 'border-2 border-[#0000ff]',
  }[borderStyle]

  return (
    <div className={cn(borderClass, className)}>
      {title && headerStyle === 'black' && (
        <div className="px-6 py-3 border-b-2 border-black bg-black">
          <span className="text-sm font-bold text-white uppercase tracking-wide">{title}</span>
        </div>
      )}
      {title && headerStyle === 'blue' && (
        <div className="px-6 py-3 border-b-2 border-[#0000ff] bg-[#0000ff]">
          <span className="text-sm font-bold text-white uppercase tracking-wide">{title}</span>
        </div>
      )}
      {title && headerStyle === 'none' && (
        <div className="px-6 py-3 border-b border-slate-200">
          <span className="text-sm font-bold text-black uppercase tracking-wide">{title}</span>
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  )
}

export function EmptyPanel({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="border-2 border-dashed border-black px-6 py-8 flex flex-col items-center justify-center text-center">
      <p className="text-sm text-slate-400">{message}</p>
      {detail && <p className="text-xs text-slate-300 mt-1">{detail}</p>}
    </div>
  )
}
