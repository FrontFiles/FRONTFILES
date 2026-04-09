'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CommandSearchBarProps {
  size?: 'default' | 'large'
  placeholder?: string
  initialQuery?: string
  className?: string
}

export function CommandSearchBar({ size = 'default', placeholder, initialQuery = '', className = '' }: CommandSearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/search')
    }
  }

  const isLarge = size === 'large'

  return (
    <form onSubmit={handleSubmit} className={`flex border-2 border-black bg-white ${className}`}>
      <div className={`flex items-center ${isLarge ? 'px-4' : 'px-3'}`}>
        <svg className={`${isLarge ? 'w-5 h-5' : 'w-4 h-4'} text-black`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="square" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder || 'Find a photographer in Lisbon, conflict footage from 2024, or ask anything\u2026'}
        className={`flex-1 bg-transparent outline-none font-normal text-black placeholder:text-slate-400 ${isLarge ? 'py-4 text-base' : 'py-2.5 text-sm'}`}
      />
      <button
        type="submit"
        className={`bg-black text-white font-bold uppercase tracking-wider hover:bg-black/80 transition-colors shrink-0 flex items-center justify-center ${isLarge ? 'px-6 text-sm gap-2' : 'px-4 text-xs gap-1.5'}`}
        aria-label="Send search"
      >
        Send
        <svg className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>
    </form>
  )
}
