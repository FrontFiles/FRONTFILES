'use client'

import { useState } from 'react'
import { Panel } from '@/components/platform/Panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updateUserCore } from '@/lib/identity/store'
import type { SessionUser } from '@/lib/user-context'

interface PersonalInfoEditorProps {
  sessionUser: SessionUser
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Phase C — Personal information editor.
 *
 * Owns:
 *   • users.email   (via updateUserCore)
 *
 * Language, timezone, phone, and notification preferences are
 * intentionally omitted: they are not in the current `users`
 * schema. A later phase can add them behind a schema extension.
 */
export function PersonalInfoEditor({ sessionUser }: PersonalInfoEditorProps) {
  const [email, setEmail] = useState<string>(sessionUser.email)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const dirty = email.trim() !== sessionUser.email
  const canSave = emailValid && dirty && status !== 'saving'

  async function handleSave() {
    if (!canSave) return
    setStatus('saving')
    setError(null)
    try {
      await updateUserCore(sessionUser.id, { email: email.trim() })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Contact" headerStyle="black">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 text-sm font-mono border-2 border-black bg-white text-black placeholder:text-slate-300 focus:outline-none focus:border-[#0000ff]"
            />
            {!emailValid && email.trim().length > 0 && (
              <span className="text-[11px] text-red-600">
                Enter a valid email address
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              Used for account correspondence and legal notifications.
              Email uniqueness is enforced at the DB level.
            </span>
          </label>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'h-10 px-5 font-bold text-[11px] rounded-none uppercase tracking-[0.12em]',
                canSave
                  ? 'bg-[#0000ff] text-white hover:bg-[#0000cc]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed',
              )}
            >
              {status === 'saving' ? 'Saving…' : 'Save email'}
            </Button>
            {status === 'saved' && (
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0000ff]">
                ✓ Saved
              </span>
            )}
            {error && <span className="text-[11px] text-red-600">{error}</span>}
          </div>
        </div>
      </Panel>

      <Panel title="Coming later" borderStyle="standard">
        <ul className="flex flex-col gap-2 text-xs text-slate-400 leading-relaxed">
          <li>
            <span className="font-bold text-black">Phone, language, timezone</span> —
            these are not on the current `users` schema. A later phase will
            add the columns and expose the fields here.
          </li>
          <li>
            <span className="font-bold text-black">Notification preferences</span> —
            same status. They land alongside the schema extension.
          </li>
        </ul>
      </Panel>
    </div>
  )
}
