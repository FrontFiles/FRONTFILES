import Link from 'next/link'

interface ContinueSearchCardProps {
  query?: string
  label?: string
}

export function ContinueSearchCard({ query, label }: ContinueSearchCardProps) {
  const href = query ? `/search?q=${encodeURIComponent(query)}` : '/search'
  return (
    <Link
      href={href}
      className="block border-2 border-black p-6 hover:bg-black hover:text-white transition-colors group"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 group-hover:text-blue-300">Continue discovery</span>
      <p className="mt-2 text-sm font-bold">{label || 'Open FrontSearch'}</p>
      <p className="mt-1 text-xs text-slate-500 group-hover:text-slate-300">Search the full vault by subject, geography, format, or creator.</p>
    </Link>
  )
}
