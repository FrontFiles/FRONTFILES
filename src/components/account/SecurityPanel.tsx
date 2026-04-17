'use client'

import { Panel } from '@/components/platform/Panel'
import type { SessionUser } from '@/lib/user-context'

interface SecurityPanelProps {
  sessionUser: SessionUser
}

/**
 * Phase C — Security panel.
 *
 * There is no real auth provider wired yet (Phase B's signin
 * page is a visual mockup; Phase 0 collects a password but
 * does not persist it). A "Change password" or "Manage 2FA"
 * button here would either do nothing or lie about what it
 * does — both are worse than saying so clearly.
 *
 * So this panel tells the truth: it surfaces the bits that
 * the identity store actually knows (account id, account
 * state, granted types) and explicitly names the sections
 * that are waiting on a dedicated auth pass.
 */
export function SecurityPanel({ sessionUser }: SecurityPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Session" headerStyle="black">
        <div className="grid grid-cols-2 gap-4">
          <KeyValue label="User id" value={sessionUser.id} mono />
          <KeyValue label="Username" value={sessionUser.username} mono />
          <KeyValue label="Email" value={sessionUser.email} />
          <KeyValue
            label="Account state"
            value={sessionUser.accountState}
            capitalize
          />
        </div>
      </Panel>

      <Panel title="Authentication" borderStyle="standard">
        <ul className="flex flex-col gap-3 text-xs text-slate-500 leading-relaxed">
          <li className="flex flex-col gap-0.5">
            <span className="font-bold text-black uppercase tracking-widest text-[10px]">
              Password
            </span>
            <span>
              Not yet wired. The signin page is a visual-only mockup and
              Phase 0 does not persist passwords. A dedicated auth pass
              will replace this with a real &quot;Change password&quot;
              flow once the backend is in place.
            </span>
          </li>
          <li className="flex flex-col gap-0.5">
            <span className="font-bold text-black uppercase tracking-widest text-[10px]">
              Two-factor authentication
            </span>
            <span>
              Waiting on the same auth pass. No 2FA is enforced today.
            </span>
          </li>
          <li className="flex flex-col gap-0.5">
            <span className="font-bold text-black uppercase tracking-widest text-[10px]">
              Active sessions
            </span>
            <span>
              Not tracked yet. Will appear once the auth layer writes
              real session rows.
            </span>
          </li>
        </ul>
      </Panel>

      <Panel title="Identity verification" borderStyle="standard">
        <p className="text-xs text-slate-500 leading-relaxed">
          Creator KYC, legal party identity, and re-verification live
          under the Phase D IdentityDrawer — they do not belong here.
          When the drawer ships, a summary of your verification
          status will appear in this panel as read-only information.
        </p>
      </Panel>
    </div>
  )
}

function KeyValue({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string
  value: string
  mono?: boolean
  capitalize?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span
        className={`text-sm text-black ${mono ? 'font-mono' : ''} ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
