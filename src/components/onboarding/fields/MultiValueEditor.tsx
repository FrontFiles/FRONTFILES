'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MultiValueEntry } from '@/lib/onboarding/types'

interface MultiValueEditorProps {
  label: string
  entries: MultiValueEntry[]
  onChange: (entries: MultiValueEntry[]) => void
  placeholder?: string
  className?: string
}

export function MultiValueEditor({ label, entries, onChange, placeholder, className }: MultiValueEditorProps) {
  const [inputValue, setInputValue] = useState('')

  function handleAdd() {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    const newEntry: MultiValueEntry = {
      id: Math.random().toString(36).slice(2),
      value: trimmed,
      source: 'user',
      confirmed: true,
    }
    onChange([...entries, newEntry])
    setInputValue('')
  }

  function handleRemove(id: string) {
    onChange(entries.filter(e => e.id !== id))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
        {label}
      </label>

      {/* Entry list */}
      <div className="flex flex-wrap gap-1.5 min-h-8">
        {entries.length === 0 && (
          <span className="text-xs text-slate-300 italic">No entries yet</span>
        )}
        {entries.map(entry => (
          <EntryChip
            key={entry.id}
            entry={entry}
            onRemove={() => handleRemove(entry.id)}
          />
        ))}
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          className="h-8 bg-white border border-slate-300 text-black placeholder:text-slate-300 text-sm rounded-none focus-visible:border-[#0000ff] focus-visible:ring-0"
        />
        <Button
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          variant="outline"
          size="default"
          className="h-8 px-3 border-2 border-black bg-white text-black hover:bg-black hover:text-white text-xs rounded-none shrink-0 font-bold uppercase tracking-wide"
        >
          Add
        </Button>
      </div>
    </div>
  )
}

function EntryChip({ entry, onRemove }: { entry: MultiValueEntry; onRemove: () => void }) {
  const isAi = entry.source === 'ai-cross-check'
  const isIdentity = entry.source === 'identity'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 text-xs font-medium border transition-colors',
        isAi && 'bg-white text-black border-black',
        isIdentity && 'bg-[#0000ff] border-[#0000ff] text-white',
        !isAi && !isIdentity && 'bg-slate-100 border-slate-300 text-black'
      )}
    >
      {isAi && (
        <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">AI</span>
      )}
      {isIdentity && (
        <span className="text-[9px] font-bold tracking-widest text-white/60 uppercase">ID</span>
      )}
      <span>{entry.value}</span>
      <button
        onClick={onRemove}
        className={cn(
          'ml-0.5 flex items-center justify-center w-4 h-4 transition-colors text-[10px]',
          isIdentity && 'text-white/60 hover:text-white',
          !isIdentity && 'text-slate-400 hover:text-black'
        )}
        aria-label={`Remove ${entry.value}`}
      >
        ×
      </button>
    </div>
  )
}
