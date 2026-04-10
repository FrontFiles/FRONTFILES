import Link from 'next/link'

interface SectionHeaderProps {
  label: string
  sublabel?: string
  href?: string
  linkText?: string
}

export function SectionHeader({ label, sublabel, href, linkText }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-black pb-2 mb-6">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-black">{label}</h2>
        {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
      </div>
      {href && (
        <Link href={href} className="text-xs font-bold uppercase tracking-wider text-[#0000ff] hover:text-black transition-colors">
          {linkText || 'View all'} &rarr;
        </Link>
      )}
    </div>
  )
}
