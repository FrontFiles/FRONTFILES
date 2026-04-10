'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ProposedField } from '@/lib/onboarding/types'

interface ProposedFieldEditorProps {
  label: string
  field: ProposedField
  onChange: (field: ProposedField) => void
  multiline?: boolean
  readOnly?: boolean
  className?: string
}

export function ProposedFieldEditor({ label, field, onChange, multiline = false, readOnly = false, className }: ProposedFieldEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.value)

  const confidencePct = field.confidence !== null ? Math.round(field.confidence * 100) : null
  const lowConfidence = confidencePct !== null && confidencePct < 90
  const isIdentity = field.source === 'identity'
  const isAi = field.source === 'ai-cross-check'
  const isUser = field.source === 'user'

  function handleEdit() {
    setDraft(field.value)
    setEditing(true)
  }

  function handleSave() {
    onChange({ ...field, value: draft, edited: draft !== field.value, confirmed: true })
    setEditing(false)
  }

  function handleConfirm() {
    onChange({ ...field, confirmed: true })
  }

  function handleCancel() {
    setDraft(field.value)
    setEditing(false)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          {isAi && (
            <span className="text-[9px] font-bold tracking-widest text-black uppercase border border-black px-1.5 py-0.5">
              AI
            </span>
          )}
          {isIdentity && (
            <span className="text-[9px] font-bold tracking-widest text-[#0000ff] uppercase border border-[#0000ff] px-1.5 py-0.5">
              ID Anchor
            </span>
          )}
          {isUser && !isAi && !isIdentity && (
            <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase border border-slate-300 px-1.5 py-0.5">
              User
            </span>
          )}
          {field.edited && (
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">edited</span>
          )}
          {field.confirmed && !editing && (
            <div className="flex items-center gap-1">
              <div className="w-3.5 h-3.5 bg-black flex items-center justify-center">
                <svg viewBox="0 0 10 10" fill="none" className="w-2 h-2 text-white">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-[9px] text-black font-bold uppercase tracking-widest">confirmed</span>
            </div>
          )}
        </div>
      </div>

      {/* Confidence indicator */}
      {lowConfidence && confidencePct !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-[#0000ff] transition-all"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">
            {confidencePct}%
          </span>
        </div>
      )}

      {/* Value display / editor */}
      {editing ? (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="bg-white border-2 border-black text-black placeholder:text-slate-300 text-sm rounded-none focus-visible:border-[#0000ff] focus-visible:ring-0 min-h-24 resize-none"
              autoFocus
            />
          ) : (
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="h-9 bg-white border-2 border-black text-black placeholder:text-slate-300 text-sm rounded-none focus-visible:border-[#0000ff] focus-visible:ring-0"
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              size="sm"
              className="h-7 px-3 bg-[#0000ff] text-white hover:bg-[#0000cc] font-bold text-xs rounded-none uppercase tracking-wide"
            >
              Save
            </Button>
            <Button
              onClick={handleCancel}
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-slate-400 hover:text-black hover:bg-slate-50 text-xs rounded-none"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'group relative border px-3 py-2.5 transition-colors',
            field.confirmed
              ? 'bg-white border-2 border-[#0000ff]'
              : isAi
              ? 'bg-slate-50 border border-dashed border-slate-400'
              : isIdentity
              ? 'bg-white border border-[#0000ff]/30'
              : 'bg-white border border-slate-200'
          )}
        >
          <p
            className={cn(
              'text-sm leading-relaxed text-black'
            )}
          >
            {field.value}
          </p>

          {!readOnly && (
            <div className="mt-2 flex items-center gap-2">
              {!field.confirmed && (
                <Button
                  onClick={handleConfirm}
                  size="xs"
                  className="h-6 px-2 bg-[#0000ff] hover:bg-[#0000cc] text-white font-bold text-xs rounded-none uppercase tracking-wide"
                >
                  Confirm
                </Button>
              )}
              <Button
                onClick={handleEdit}
                size="xs"
                variant="ghost"
                className="h-6 px-2 text-slate-400 hover:text-black hover:bg-slate-50 text-xs rounded-none"
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
