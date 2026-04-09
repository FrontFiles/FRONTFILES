import { cn } from '@/lib/utils'

interface AvatarProps {
  src: string | null | undefined
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[7px]',
  sm: 'w-7 h-7 text-[8px]',
  md: 'w-9 h-9 text-[10px]',
  lg: 'w-12 h-12 text-xs',
} as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Avatar({ src, name, size = 'sm', className }: AvatarProps) {
  const sizeClass = SIZE_MAP[size]

  if (src) {
    return (
      <div className={cn(sizeClass, 'shrink-0 overflow-hidden border border-black/15 bg-slate-100', className)}>
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Replace broken image with initials fallback
            const target = e.currentTarget
            const parent = target.parentElement
            if (parent) {
              parent.innerHTML = ''
              parent.className = cn(sizeClass, 'shrink-0 flex items-center justify-center bg-black text-white font-bold uppercase tracking-wide select-none', className ?? '')
              parent.textContent = getInitials(name)
              parent.setAttribute('aria-label', name)
            }
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(sizeClass, 'shrink-0 flex items-center justify-center bg-black text-white font-bold uppercase tracking-wide select-none', className)}
      aria-label={name}
      role="img"
    >
      {getInitials(name)}
    </div>
  )
}
