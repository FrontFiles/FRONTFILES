'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export const FORMATS = ['All', 'Frontfilers', 'Article', 'Story', 'Collection', 'Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

/** Entity-type filters (first group) */
export const ENTITY_FILTERS = ['All', 'Frontfilers', 'Article', 'Story', 'Collection'] as const
/** Asset-format filters (second group) */
export const FORMAT_FILTERS = ['Photo', 'Video', 'Audio', 'Text', 'Infographic', 'Illustration', 'Vector'] as const

/** Attached context file for agent queries */
export interface AttachedFile {
  name: string
  size: number
  type: string
  /** Preview text (first ~200 chars) for documents */
  preview: string | null
}

export function AssistantInput({ initialQuery }: {
  initialQuery: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/search')
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  // ─── File attachment ───────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result.slice(0, 200) : null
        setAttachments(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          preview: text,
        }])
      }
      if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/pdf') {
        reader.readAsText(file.slice(0, 200))
      } else {
        setAttachments(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          preview: null,
        }])
      }
    })
    // Reset input so the same file can be re-attached
    e.target.value = ''
  }, [])

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Voice input ───────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      setQuery(prev => {
        const base = prev.trimEnd()
        return base ? base + ' ' + transcript : transcript
      })
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }, [isListening])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      {/* Attachments strip */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border border-b-0 border-[#0000ff]/30 bg-[#0000ff]/[0.03] overflow-x-auto scrollbar-none">
          {attachments.map((file, i) => (
            <span key={i} className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-[#0000ff]/20 text-[8px] font-semibold text-black/50">
              <svg className="w-2.5 h-2.5 text-[#0000ff]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="max-w-[80px] truncate">{file.name}</span>
              <span className="text-black/25">{formatSize(file.size)}</span>
              <button type="button" onClick={() => removeAttachment(i)} className="text-black/20 hover:text-red-500 ml-0.5">&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-stretch border border-[#0000ff]/70 bg-white" style={{ minHeight: 52 }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.doc,.docx,.csv,.json,.md,.rtf,image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text input */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Describe the asset, story, coverage or help required."
            className="w-full bg-transparent outline-none resize-none font-normal text-black placeholder:text-[#0000ff]/30 text-[12px] leading-relaxed py-2.5 pl-3 pr-1"
          />
        </div>

        {/* Right icons: attach + mic */}
        <div className="flex items-center gap-0.5 pr-1 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-7 h-7 inline-flex items-center justify-center text-[#0000ff]/35 hover:text-[#0000ff] transition-colors"
            title="Attach document for context"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-7 h-7 inline-flex items-center justify-center transition-colors ${
              isListening
                ? 'text-red-500 animate-pulse'
                : 'text-[#0000ff]/35 hover:text-[#0000ff]'
            }`}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        </div>

        {/* AI search submit */}
        <button
          type="submit"
          className="bg-white border border-[#0000ff] text-[#0000ff] hover:bg-[#0000ff] hover:text-white transition-colors shrink-0 flex items-center justify-center self-stretch w-[48px]"
          aria-label="Search vault with AI"
          title="Search vault with AI"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="13" cy="14" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" />
            <line x1="20.5" y1="20.5" x2="27" y2="27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <text x="13" y="17.5" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif" fill="currentColor">AI</text>
            <path d="M23 3 L24 6.5 L27.5 7.5 L24 8.5 L23 12 L22 8.5 L18.5 7.5 L22 6.5 Z" fill="currentColor" />
            <path d="M28 11 L28.4 12.4 L29.8 12.8 L28.4 13.2 L28 14.6 L27.6 13.2 L26.2 12.8 L27.6 12.4 Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </form>
  )
}
