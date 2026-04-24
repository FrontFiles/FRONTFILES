/**
 * Frontfiles — Newsroom P1 signup page (NR-D5a, F1)
 *
 * Served from `newsroom.frontfiles.com/start` via the proxy
 * rewrite in `src/proxy.ts`.
 *
 * Auth-guard model: the codebase's session lives in localStorage
 * via `src/lib/supabase/browser.ts`; server components cannot read
 * it. This file therefore stays a thin server-rendered shell, and
 * the signed-in gate runs inside the client form (see
 * `./_components/signup-form.tsx`). Unauthed visitors are
 * redirected client-side to `/signin?return=/start`. See NR-D5a
 * exit report §Decisions (IP-1).
 *
 * Layout inherits from `src/app/newsroom/layout.tsx` (NR-D3).
 * Minimal chrome — the PRD-level visual treatment lands with
 * NR-D6 / NR-D11.
 *
 * Copy is bound verbatim to PRD §5.1 P1.
 */

import { SignupForm } from './_components/signup-form'

export default function NewsroomSignupPage() {
  return (
    <main>
      <h1>Set up your newsroom</h1>
      <p>Your organisation becomes a verified source on Frontfiles.</p>
      <SignupForm />
    </main>
  )
}
