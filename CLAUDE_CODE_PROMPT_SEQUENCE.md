# Frontfiles — Claude Code Implementation Sequence

**Status:** v1 · **Date:** 2026-04-17 · **Owner:** João Nuno Martins
**Reads from:** `INTEGRATION_READINESS.md`, `PLATFORM_REVIEWS.md`, `ASSIGNMENT_DISPUTE_TAXONOMY.md`, `.claude/agents/*.md`, `PLATFORM_BUILD.md`, `CLAUDE.md`

## How to use this document

This document is a **sequenced set of prompts** you paste into Claude Code sessions, in order. Each prompt is copy-paste ready, governs a bounded piece of work, and ends with verification + approval gates. You don't need to paraphrase or re-brief; the prompt is sufficient as-is.

### Rules of engagement

1. **One prompt per Claude Code session.** Do not bundle prompts. Big sessions drift.
2. **Run prompts in order.** Earlier work is a hard dependency for later work.
3. **Do not skip human prerequisites (H1–H8).** Claude Code cannot do these.
4. **At each gate, wait for verification before moving on.** If verification fails, fix — don't proceed.
5. **Every prompt references the agents.** The agents enforce standards; don't bypass them.
6. **If Claude Code refuses or flags a blocker, surface it to you.** Do not override the refusal without reading why.

### Notation used inside prompts

- `@agent-name` → summon the named sub-agent (e.g. `@frontfiles-context`)
- `[Task #N]` → Cowork task reference
- `→ VERIFY:` → the commands / checks that prove done
- `→ GATE:` → what must be true before moving to next prompt

---

## Dependency graph (one-page summary)

```
H1 Rotate PAT ──┐
H2 Google project + legal pages URLs ──────┐
H3 Stripe account + Connect app ──┐        │
H4 Apple Developer account ──┐    │        │
H5 Resend account ──┐        │    │        │
H6 Waterdog clone ──┐        │    │        │
H7 Sentry project ─┐│        │    │        │
H8 PostHog project ┘│        │    │        │
                    │        │    │        │
                    ▼        ▼    ▼        ▼
[CCP 1 — Preflight + commits + prerender]
                    ▼
[CCP 2 — Supabase foundation + RLS]
                    ▼
[CCP 3 — pgvector + ai_analysis + audit + env-schema]
                    ▼
[CCP 4 — Flip mocks to real dual-mode]
                    ▼
[CCP 5 — Sentry + pino + env-secret isolation]     ◄─── H7
                    ▼
[CCP 6 — Resend + React Email templates]           ◄─── H5
                    ▼
[CCP 7 — Vertex AI wrapper + per-region routing]
                    ▼
[CCP 8 — Google OAuth + Apple + magic-link]        ◄─── H2, H4
                    ▼
[CCP 9 — Vision API + upload enqueue]
                    ▼
[CCP 10 — Stripe buyer checkout (Payment Intents)] ◄─── H3
                    ▼
[CCP 11 — Connect Express creator onboarding]
                    ▼
[CCP 12 — Webhooks + ledger + reconciliation]
                    ▼
[CCP 13 — Stripe Tax + subscriptions + invoicing]
                    ▼
[CCP 14 — Upload flow improvements + real AI clustering]
                    ▼
[CCP 15 — Area 2/3/4/5 parallelisable product reviews]
                    ▼
[CCP 16 — Waterdog audit + BETA_SCHEMA_MAPPING.md] ◄─── H6
                    ▼
[CCP 17 — Import scripts + asset migration + cutover]
                    ▼
[CCP 18 — Launch hardening: legal, support, E2E, security review]
```

---

# Part 1 — Human prerequisites (you do these, not Claude Code)

These happen outside Claude Code. Most take minutes to hours; verification can complete in parallel with early CCP prompts.

### H1 — Rotate leaked GitHub PAT

**Why:** The token `ghp_u372fo...` is embedded in `.git/config` and has push access to `FrontFiles/FRONTFILES`.

**Steps:**

1. Open https://github.com/settings/tokens
2. Delete the token starting `ghp_u372fo...`
3. In terminal:

   ```bash
   cd "/Users/jnmartins/Desktop/PROJECT ORGANISM/frontfiles"
   git remote set-url origin git@github.com:FrontFiles/FRONTFILES.git
   git remote -v   # expect no ghp_ substring anywhere
   ```

**Gate:** `git remote -v` shows no PAT.

---

### H2 — Google Cloud Console project + legal pages

**Why:** Google OAuth verification + Vertex AI + Vision need a GCP project with billing, and Google requires your Terms / Privacy / AI-Disclosure URLs live *before* they verify your OAuth app.

**Steps:**

1. Create GCP project `frontfiles-prod` at https://console.cloud.google.com/
2. Enable billing.
3. Enable APIs: Identity-Aware Proxy, Vertex AI, Cloud Vision, Places, Drive, Gmail, Calendar (latter three can wait if Workspace scopes aren't v1).
4. Create OAuth 2.0 client (Web application).
5. Draft + publish 5 legal pages to live URLs under `frontfiles.news/legal/`:
   - `/terms`
   - `/privacy`
   - `/creator-agreement`
   - `/buyer-licence`
   - `/ai-processing-disclosure`
6. Register these URLs on the Google OAuth consent screen.
7. Submit for verification (takes 4–7 business days typically).
8. Create service account with `Vertex AI User`, `Cloud Vision User` roles; download JSON key; store in 1Password (not git).

**Gate:** OAuth consent screen shows "In production" (post-verification); service-account JSON exists in 1Password with a retrieval note.

---

### H3 — Stripe account + Connect application

**Why:** D5 lock = Connect Express. You cannot build CCP 10+ until accounts exist.

**Steps:**

1. Create Stripe account for Frontfiles at https://dashboard.stripe.com/register
2. Complete platform profile (business type, country, tax info).
3. Apply for Connect → request Express.
4. Configure platform branding: logo, primary colour = Frontfiles blue, name = "Frontfiles."
5. Create restricted API keys per environment (preview = test, prod = live). Never the secret key in code.
6. Enable Stripe Tax in Dashboard.
7. Configure Radar (enable + accept defaults for v1; rules land in CCP 12).

**Gate:** Stripe dashboard shows Connect application approved; test-mode keys in hand.

---

### H4 — Apple Developer account

**Why:** D10 lock adds Apple Sign In.

**Steps:**

1. Enrol in Apple Developer Program ($99/yr) at https://developer.apple.com/programs/enroll/
2. After approval (1–2 business days), create a Service ID under `frontfiles.news`.
3. Configure Sign In with Apple capability on the Service ID.
4. Create private key for server-side JWT client secret generation; store in 1Password.

**Gate:** Apple Developer dashboard shows active membership; Service ID configured.

---

### H5 — Resend account

**Why:** D2 lock = Resend for transactional email.

**Steps:**

1. Sign up at https://resend.com with the `frontfiles.news` domain.
2. Add DNS records (SPF, DKIM, DMARC) in your DNS provider.
3. Verify domain (wait for propagation).
4. Create two API keys: `transactional` + `marketing` (D12 lock — separation).
5. Store keys in 1Password.

**Gate:** Resend dashboard shows domain verified; two keys issued.

---

### H6 — Clone Waterdog beta repos

**Why:** Phase 6 migration cannot be planned without seeing the beta code.

**Steps:**

1. At https://bitbucket.org/account/settings/app-passwords/, create app password `frontfiles-migration` with `Repositories: Read`, `Account: Read`, `Projects: Read`.
2. In terminal:

   ```bash
   mkdir -p ~/Desktop/frontfiles-beta
   cd ~/Desktop/frontfiles-beta
   git clone https://YOUR_BB_USERNAME@bitbucket.org/waterdog/frontfiles-backend.git
   ```

3. Repeat for any frontend, mobile, or admin repos you see in the Waterdog workspace (`bitbucket.org/waterdog/workspace/repositories`).
4. In Cowork, mount `~/Desktop/frontfiles-beta` via the folder-picker so Claude agents can read it.

**Gate:** `~/Desktop/frontfiles-beta/frontfiles-backend/` and companion repos exist and are mounted in Cowork.

---

### H7 — Sentry project

**Why:** D3 lock; CCP 5 wires it.

**Steps:**

1. Create Sentry org + project `frontfiles-web` at https://sentry.io
2. Platform: Next.js.
3. Get DSN; store in 1Password.

**Gate:** DSN in hand.

---

### H8 — PostHog project

**Why:** D4 lock; analytics + feature flags.

**Steps:**

1. Sign up at https://posthog.com (cloud) or self-host.
2. Create project `frontfiles`.
3. Get project API key; store in 1Password.

**Gate:** API key in hand.

---

# Part 2 — Claude Code prompts (sequential, copy-paste ready)

Every prompt follows the same structure: context load → objective → scope → constraints → verification → gate. Paste the entire block into a fresh Claude Code session.

---

## CCP 1 — Preflight: commit tonight's work + fix prerender

**Task refs:** P0.1, P0.2, P0.4 (Cowork tasks #1, #2, #4)

**Paste into Claude Code:**

```
Load these into context and summon agents:

- Read: CLAUDE.md, AGENTS.md, INTEGRATION_READINESS.md, PLATFORM_REVIEWS.md
- Summon: @frontfiles-context

Objective:
  Close out the 2026-04-17 recovery session cleanly. Three things land in one
  commit: (a) the 4 tsc fixes already in the working tree, (b) the governance
  documents produced tonight, (c) a minimal prerender fix so `next build`
  compiles.

Scope — lands in this PR:

  1. Stage and commit these files:
     - src/lib/bolt/cross-ref.ts
     - src/lib/asset/visibility.ts
     - src/lib/processing/pipeline.ts
     - src/types/speech.d.ts
     - INTEGRATION_READINESS.md
     - PLATFORM_REVIEWS.md
     - ASSIGNMENT_DISPUTE_TAXONOMY.md
     - CLAUDE_CODE_PROMPT_SEQUENCE.md
     - .claude/agents/frontfiles-context.md
     - .claude/agents/frontfiles-onboarding.md
     - .claude/agents/frontfiles-upload.md
     - .claude/agents/frontfiles-blue-protocol.md
     - .claude/agents/frontfiles-discovery.md

  2. Add `export const dynamic = 'force-dynamic'` at the top of:
     - src/app/search/page.tsx
     - src/app/checkout/[assetId]/page.tsx

  3. Clean up filesystem hygiene:
     - Remove .next/dev 2/ .next/build-manifest 2.json .next/fallback-build-manifest 2.json
     - rm -f .git/index.lock if present
     - git worktree prune

  4. Tag current HEAD as checkpoint/preflight-green-YYYYMMDD.

Scope — does NOT land in this PR:

  - No other code changes. No mock-to-real flips. No new features.
  - Do not rewrite the governance documents.
  - Do not touch v2-state.ts (D-U1 lock says that splits in Area 1).

Constraints (non-negotiable):

  - Commit message must follow the template in PLATFORM_REVIEWS.md + my
    CLAUDE.md conventions: imperative mood, concrete list of changes.
  - No new deps. No lint config changes. No tsconfig changes.
  - Do not merge PR #4 or close PR 1.3 work (that's task #5, a separate
    decision).

Verification:

  git status                                # clean after commit
  ./node_modules/.bin/tsc --noEmit          # exit 0, no output
  rm -rf .next && bun run build             # completes cleanly
  git tag -l "checkpoint/preflight-green*"  # tag exists

Gate before moving to CCP 2:

  - bun run build succeeds
  - main is on a clean commit
  - backup/pre-filter/* tags exist
  - task #1, #2, #4 marked completed in Cowork

If anything in verification fails, STOP and report the exact output; do not
attempt fix-forward without approval.
```

---

## CCP 2 — Supabase foundation + RLS policies

**Task ref:** Phase 1 foundation (Cowork task #6)

**Prerequisites:** H1 done. CCP 1 green. You have Supabase URL + anon key + service role key.

**Paste into Claude Code:**

```
Load context and summon agents:

- Read: INTEGRATION_READINESS.md (Phase 1), PLATFORM_BUILD.md (state machines), CLAUDE.md
- Summon: @frontfiles-context

Objective:
  Wire real Supabase across dev/preview/prod and ship Row-Level Security
  policies on every user-owned table. Non-negotiable gate for everything
  downstream — nothing in Phases 2-6 can ship over mock data.

Scope — lands in this PR:

  1. Env variables in .env.local (dev), Vercel preview, Vercel prod:
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
     SUPABASE_SERVICE_ROLE_KEY
     NEXT_PUBLIC_APP_URL

  2. Verify src/lib/db/client.ts dual-mode path activates when env vars present
     (isSupabaseConfigured returns true in real env).

  3. Write RLS migration: supabase/migrations/YYYYMMDDHHMMSS_rls_all_tables.sql
     Policies per table, per role (anon | authenticated | service_role):
       - users                   (SELF read/write; public read of public fields only)
       - vault_assets            (creator RW own; anon R public+published only)
       - asset_media             (follows vault_assets policy via FK join)
       - upload_batches          (creator RW own only)
       - licence_grants          (buyer R own; creator R own; service_role write)
       - transactions            (SELF R only; service_role write)
       - messages                (participant R; participant write own)
       - posts                   (creator RW own; anon R published public only)
       - companies, memberships  (member R; admin RW)
       - assignment_*            (buyer + creator participants RW; staff R)
       - direct_offer            (buyer + creator participants RW)
       - download_events         (SELF R; service_role write)
       - watermark_profiles      (creator RW own)

  4. Write test file verifying RLS via service_role vs anon access, 5+ cases.

Scope — does NOT land in this PR:

  - No mock-to-real flips of app modules (that's CCP 4).
  - No signed-URL delivery changes (that's Area 3).
  - No auth provider wiring (that's CCP 8).

Constraints (non-negotiable):

  - Every user-owned table gets a policy. If a table doesn't have one, add
    an explicit "deny all" policy and TODO comment.
  - Do not disable RLS on any existing table to "simplify testing."
  - Service role key NEVER reaches the client. Audit uses; add a lint rule.
  - Migration must be idempotent (`CREATE POLICY IF NOT EXISTS` pattern).

Verification:

  npx supabase db push              # applies migration
  npx supabase test db              # if a test harness exists; else manual check
  grep -r "SUPABASE_SERVICE_ROLE_KEY" src/app/ src/components/  # should find 0
  ./node_modules/.bin/tsc --noEmit
  bun run build

Gate before CCP 3:

  - Migration applied on dev Supabase, no errors.
  - 5+ RLS tests pass.
  - Service role key never referenced from client components.
  - task #6 marked completed.

If a table's RLS policy needs a product decision (e.g. "can staff see
private assets?"), STOP and surface — do not guess.
```

---

## CCP 3 — pgvector + ai_analysis + audit log + env-schema

**Task refs:** Cowork tasks #7, #8, #9

**Prerequisites:** CCP 2 green.

**Paste into Claude Code:**

```
Load context and summon:

- Read: INTEGRATION_READINESS.md sections 1.7–1.10, 2.x
- Summon: @frontfiles-context, @frontfiles-discovery, @frontfiles-upload

Objective:
  Ship the three remaining Phase 1 infrastructural primitives that downstream
  prompts depend on: pgvector + asset_embeddings (for search + D-U2 story
  clustering), ai_analysis cache (for Vertex/Vision read-through), audit_log
  (for Stripe/AI/auth forensics), and env-schema validation (fail-fast on boot).

Scope — lands in this PR:

  1. Migration: enable pgvector extension; create asset_embeddings table
     (asset_id uuid PK FK vault_assets.id, embedding vector(768), model_version
     text, created_at timestamptz). HNSW index on embedding.

  2. Migration: create ai_analysis table
     (id uuid PK, subject_type text CHECK IN ('asset','story','query','brief'),
     subject_id uuid, model text, model_version text, region text,
     input_hash text, output jsonb, created_at timestamptz,
     UNIQUE (subject_type, subject_id, model, model_version, input_hash))
     Index on (subject_type, subject_id).

  3. Migration: create audit_log table
     (id uuid PK, event_type text, actor_id uuid nullable, target_type text,
     target_id text, metadata jsonb, trace_id text, created_at timestamptz)
     Index on (event_type, created_at desc); (actor_id, created_at desc).

  4. src/lib/env.ts — Zod schema for process.env. Fails on module import if
     any required var is missing, with clear error listing all missing keys.
     Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
     SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL.
     Optional: STRIPE_SECRET_KEY, GOOGLE_OAUTH_CLIENT_ID, etc.
     Import env once from src/lib/env.ts — not process.env — elsewhere.

Scope — does NOT land:

  - No embedding generation logic (CCP 7 provides it).
  - No audit events written yet (CCP 5 pipes them).
  - No code that queries ai_analysis (CCP 7+ does it).

Constraints:

  - Vector dimension 768 matches Vertex `text-embedding-004` (D7 lock).
  - RLS on all three new tables: asset_embeddings follows vault_assets;
    ai_analysis service_role-only write, authenticated read where
    subject owner; audit_log service_role-only write, staff read.
  - Migrations idempotent.
  - Zod env schema must be imported before any other module that reads env.
    If that requires an app bootstrap wrapper, add it.

Verification:

  npx supabase db push
  grep -r "process.env" src/ | grep -v "src/lib/env.ts" | head -20  # near zero
  ./node_modules/.bin/tsc --noEmit
  bun run build

Gate before CCP 4:

  - Three migrations applied.
  - src/lib/env.ts present, fail-fast on missing vars verified (unset a var,
    run build, confirm fails with clear error).
  - Tasks #7, #8, #9 marked completed.
```

---

## CCP 4 — Flip mocked modules to real dual-mode

**Task ref:** Phase 1 (covered by Cowork task #6 description + follow-up)

**Prerequisites:** CCP 2 + CCP 3 green. Real Supabase data for at least `users` table exists (can be empty).

**Paste into Claude Code:**

```
Summon: @frontfiles-context, @frontfiles-onboarding, @frontfiles-upload,
       @frontfiles-blue-protocol, @frontfiles-discovery

Read: src/lib/auth/provider.ts, src/lib/post/store.ts, src/lib/providers/store.ts,
      src/lib/media/asset-media-repo.ts, src/lib/processing/profiles.ts

Objective:
  Complete the dual-mode contract so every mock module now has a working
  real Supabase path behind the isSupabaseConfigured() toggle. Mock remains
  for tests + dev-without-Supabase.

Scope — per module:

  1. src/lib/auth/provider.ts — Supabase Auth real path (session, user,
     signin, signout, magic-link). Mock path stays unchanged.

  2. src/lib/post/store.ts — Supabase read/write for posts + reposts.

  3. src/lib/providers/store.ts — Supabase read/write for provider connections.

  4. src/lib/media/asset-media-repo.ts — Supabase read/write for asset_media
     (consumed by the processing pipeline + delivery).

  5. src/lib/processing/profiles.ts — Supabase read/write for watermark_profiles
     (mock seed stays only for dev harnesses).

  Each module: implement the real path if not already; exercise via unit
  tests in __tests__/.

Constraints:

  - Never remove the mock path. Tests rely on it.
  - isSupabaseConfigured() is the single toggle — do not introduce a second.
  - Every write goes through a Zod-validated shape (lift schemas from types).
  - Service-role usage only inside /api routes + server actions, never in
    client components.
  - RLS is the primary boundary — do not re-implement row filters in code;
    rely on Supabase returning only rows the caller can see.

Verification:

  bun x vitest run                    # all existing tests still pass
  ./node_modules/.bin/tsc --noEmit
  bun run build
  # Manual: signin flow (using supabase.auth locally) returns a session

Gate before CCP 5:

  - All 5 modules have real paths exercised.
  - No test regressions.
  - Task #6 fully closed.
```

---

## CCP 5 — Sentry + pino + env-secret isolation

**Task ref:** Cowork task #10 (Phase 2)

**Prerequisites:** H7 done. CCP 4 green.

**Paste into Claude Code:**

```
Summon: @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 2

Objective:
  Ship observability substrate before any Stripe or Google integration lands.
  Sentry for errors; pino for structured server logs; strict env-secret
  isolation between preview and prod.

Scope:

  1. Install and configure Sentry Next.js SDK (server + client + edge).
     SENTRY_DSN from env. Tunnel via /api/monitoring to bypass ad-blockers.
     Source maps uploaded on build.

  2. Create src/lib/logger.ts wrapping pino. JSON output. Fields: time, level,
     msg, trace_id (request-scoped), route, actor_id where available.
     Every /api route logs entry + exit + error with trace_id.

  3. Wire audit_log writes from src/lib/logger.ts when the event type is
     in a canonical audit set: 'auth.signin', 'auth.signup', 'asset.commit',
     'licence.minted', 'stripe.webhook', 'ai.call', 'kyc.update',
     'dispute.filed', 'dispute.resolved', etc.

  4. Vercel env config: preview = Stripe test + test Supabase + Sentry test
     env; prod = live keys. Document in INTEGRATION_READINESS.md section 2.3.
     Cannot mix — enforce in CI if possible (check ENVIRONMENT vs key prefix).

  5. Add /api/health that returns { status: 'ok', commit: GIT_SHA } with
     Sentry set up to monitor uptime.

Constraints:

  - Never log PII (email addresses, payment details, tokens) in Sentry or pino.
  - Never log Supabase service-role key, Stripe secret key, Resend key.
  - trace_id propagates through every log line + every Sentry event.
  - Mock mode must not silently send events to prod Sentry.

Verification:

  curl $APP_URL/api/health       # returns 200 + JSON
  # Trigger a test error on a dev route → appears in Sentry
  # Check logs contain trace_id, no PII
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - Sentry receives events from dev.
  - pino logs include trace_id.
  - Vercel preview + prod env configs audited and locked.
  - Task #10 completed.
```

---

## CCP 6 — Resend + React Email template system

**Task refs:** Cowork tasks #11, #12 (Phase 3)

**Prerequisites:** H5 done. CCP 5 green.

**Paste into Claude Code:**

```
Summon: @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 3, CLAUDE.md (Frontfiles editorial voice)

Objective:
  Stand up transactional email. No Stripe webhook or auth flow ships without
  this — they need to send receipts + confirmations.

Scope:

  1. Install resend + @react-email/components + @react-email/render.
  2. src/lib/email/resend.ts — wrapped client with retry, trace_id passthrough.
  3. src/lib/email/templates/ — shared React Email layout component
     (editorial tone, Design Canon: black/Frontfiles-blue/white, 0 radius,
     NHG font, 10px bold uppercase tracking-widest labels).
  4. Draft v1 templates (React Email .tsx files):
     - AuthMagicLink
     - AuthWelcome
     - LicenceDelivered
     - AssignmentInvited
     - AssignmentFunded
     - AssignmentDelivered
     - AssignmentConfirmed
     - DisputeFiled
     - PayoutNotification
     - RefundIssued
     - CreatorKycStatus
     - SpecialOfferMade / Countered / Accepted / Rejected / Expired
     (15 templates — combine into shared subcomponents where possible)
  5. Domain setup in Resend: transactional (mail.frontfiles.news) + marketing
     (news.frontfiles.news). Two API keys per D12 lock.
  6. Unsubscribe + preferences page at /account/email-preferences.

Constraints:

  - Editorial tone, not marketing. No exclamation points. No emoji.
  - Never send marketing content from the transactional domain.
  - Every send logs an audit_log event (see CCP 5).
  - Templates are plain, disciplined, black/white/blue.

Verification:

  # Preview each template via bun x react-email dev
  # Send test to your own address via Resend dashboard
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - 15 templates compiled, previewed, and look on-brand.
  - Resend domains verified.
  - Tasks #11, #12 completed.
```

---

## CCP 7 — Vertex AI wrapper + per-region routing

**Task ref:** Cowork task #15 (Phase 4.B)

**Prerequisites:** H2 done. CCP 3 + CCP 4 + CCP 5 green.

**Paste into Claude Code:**

```
Summon: @frontfiles-context, @frontfiles-discovery, @frontfiles-blue-protocol
Read: INTEGRATION_READINESS.md Phase 4.B, D8, D9

Objective:
  Stand up the Vertex AI client layer that downstream AI features will consume.
  Per-creator region routing per D8; data-out-of-training posture per D9;
  ai_analysis cache read-through per D-U2.

Scope:

  1. src/lib/ai/google.ts — typed client wrapper:
     - getClient(region) factory; caches instances per region
     - generateText(prompt, options) → uses Gemini Flash by default,
       Gemini Pro when options.model = 'pro'
     - generateEmbedding(text, region) → text-embedding-004
     - analyseImage(imageBytes, region) → Vision API (companion wrapper in
       src/lib/ai/vision.ts, CCP 9)
  2. Per-creator region routing:
     users.ai_region field (enum 'eu' | 'us'), default 'eu' for new users
     outside US. Set during onboarding.
  3. Read-through cache layer: every call checks ai_analysis first keyed on
     (subject_type, subject_id, model, model_version, input_hash). If hit,
     return cached. If miss, call Vertex, write cache, return.
  4. Cost metering: log token counts + estimated cost per call via pino.
  5. ToS + onboarding consent: update /onboarding phase 3 declarations to
     include AI Processing Disclosure + per-region note.
  6. Error handling: exponential backoff, circuit breaker per region,
     fallback to EU if US unhealthy.

Constraints:

  - Never instantiate Vertex client on the client (browser). Server-side only.
  - Never send PII (user email, payment details) as part of a prompt or
    embedding input. Audit the input-sanitisation path.
  - D9 lock: use Vertex AI endpoint (not Gemini Developer API) to keep data
    out of training.
  - Cache is source of truth for repeatable queries — don't bypass it.

Verification:

  # Unit test: cache hit returns fast; cache miss calls Vertex; cache miss
  # persists to ai_analysis.
  # Manual: call generateText('hello') from a /api test route.
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - ai_analysis rows appear after cache-miss calls.
  - Per-region routing verified by unsetting users.ai_region and observing
    the default fallback.
  - Task #15 completed.
```

---

## CCP 8 — Google OAuth + Apple + magic-link + signin rewrite

**Task refs:** Cowork tasks #13, #14 (Phase 4.A)

**Prerequisites:** H2 + H4 done. CCP 7 optional (not a hard dependency, but onboarding's AI features are next).

**Paste into Claude Code:**

```
Summon: @frontfiles-onboarding, @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 4.A, D10

Objective:
  Three-method authentication live: Google OAuth + Apple Sign In + email
  magic-link. Signin page rewritten from mockup. Post-signin identity bridge
  to the Frontfiles users table.

Scope:

  1. Configure Supabase Auth providers (Dashboard): Google (client from H2),
     Apple (Service ID from H4), Email (magic-link).
  2. Rewrite src/app/signin/page.tsx:
     - Three buttons (Google, Apple, Continue with email)
     - Email flow → Supabase magic-link
     - OAuth flows → supabase.auth.signInWithOAuth(...)
     - Post-signin redirect to /onboarding if new, /feed if returning
  3. Post-signin identity bridge in /app/auth/callback/route.ts:
     - On first signin, create users row (creator_or_buyer default 'buyer';
       upgradeable to 'creator' during onboarding phase 2)
     - On returning signin, update last_seen_at
     - Emit audit_log 'auth.signin' event
  4. Session management via Supabase SSR helpers (@supabase/ssr). Server
     components read session from cookies; client components via hook.
  5. Auth-guard HOC for gated routes (/vault/*, /account/*).
  6. Account linking flow: if a user signs in with Apple after having used
     Google, detect by email match and offer to link.

Constraints:

  - Never expose Supabase service-role key to the client. All user-creation
    logic is in /api or server actions.
  - Session cookies httpOnly, secure, sameSite=lax.
  - Never mark a user activated just from signin — activation requires
    onboarding completion (@frontfiles-onboarding rules).
  - Respect RLS from CCP 2 — do not read users via service role when
    authenticated context is available.

Verification:

  # E2E: sign in with each of Google / Apple / magic-link from a clean state.
  # Each produces a users row; subsequent signin reuses it.
  # Linked accounts work (sign in with Google, link Apple, sign in with
  # Apple → same users row).
  # Gated routes redirect unauthenticated to /signin with returnTo param.
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - Three signin flows work end-to-end on preview.
  - No PAT / service-role leaks to client (audit diff).
  - Tasks #13, #14 completed.
```

---

## CCP 9 — Vision API + upload-pipeline enqueue

**Task ref:** Cowork task #16 (Phase 4.C)

**Prerequisites:** CCP 7 green. Upload PR 2 shipped (it already is).

**Paste into Claude Code:**

```
Summon: @frontfiles-upload, @frontfiles-blue-protocol, @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 4.C, src/lib/processing/ARCHITECTURE-BRIEF.md

Objective:
  Wire Google Vision into the upload commit pipeline. Every committed image
  asset triggers Vision analysis (OCR + labels + safe-search + landmarks +
  faces). Results land in ai_analysis and fuel caption suggestions, geo/tag
  suggestions, moderation flags, and consent-required flags.

Scope:

  1. src/lib/ai/vision.ts — typed wrapper around Cloud Vision API.
     Methods: analyseImage(imageBytes, opts) → { ocr, labels, safeSearch,
     landmarks, faces }. Region follows the asset's creator's ai_region.
  2. Dispatch hook in src/lib/processing/dispatcher.ts — after original
     row is ready, enqueue Vision analysis job alongside derivative jobs.
  3. Writer: analysis result persisted to ai_analysis
     (subject_type='asset', subject_id=asset.id, model='vision',
     model_version='2025-XX', input_hash=asset.content_hash).
  4. Downstream hooks:
     - OCR text → composer caption-draft candidates (exposed via an
       asset-metadata read API, not auto-saved)
     - Landmarks / location labels → geography + tag suggestion
     - Safe-search: adult/violence flags → moderation_required=true
       (asset stays in under_review until staff clears)
     - Face count > 0 → consent_required flag (surfaces a checkbox in
       /vault/upload for creator to confirm they have consent)
  5. Every Vision call logs audit event 'ai.vision.analyse' with trace_id.

Constraints:

  - Vision runs server-side only.
  - Never log image bytes or return them in responses.
  - If Vision fails, asset commit does NOT fail — analysis is async, job
    retries on a separate worker loop.
  - Respect @frontfiles-blue-protocol: Vision signals are AI-flagged, never
    AI-verified. Language in UI must reflect this.

Verification:

  # Upload a test image with recognisable text and a face.
  # Confirm: ai_analysis row appears; OCR text populates caption suggestion
  # panel; face_count > 0 → consent_required checkbox surfaces.
  # Upload an inappropriate test image (e.g., explicit sample) → moderation
  # flag raised; asset not listable.
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - 3+ test images demonstrate full pipeline (text, face, moderation).
  - Task #16 completed.
```

---

## CCP 10 — Stripe buyer checkout (Payment Intents)

**Task ref:** Cowork task #18 (Phase 5.A/B)

**Prerequisites:** H3 done. CCP 5 + CCP 6 green (observability + email live).

**Paste into Claude Code:**

```
Summon: @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 5.A, 5.B, D5, D11

Objective:
  Ship buyer-side Stripe: embedded Payment Intents on /checkout/[assetId]
  and /checkout/review. On success, mint licence_grant + deliver licence
  email + enable signed-URL download. Refund + dispute hooks wired.

Scope:

  1. src/lib/stripe/client.ts — server-side Stripe client factory (test
     key in preview, live in prod, enforced by env-schema).
  2. src/app/api/checkout/intent/route.ts — creates Payment Intent from
     cart payload; platform fee and transfer_data.destination set for
     marketplace routing (deferred until CCP 11 creator onboarding — for
     now route funds to Frontfiles platform account).
  3. /checkout/[assetId]/page.tsx rewrite — Stripe Elements embedded
     (not Checkout redirect). Respect D11: test-mode keys in preview.
  4. /checkout/review/page.tsx → cart-total + tax preview → pay button
     → redirect to /checkout/success on intent confirmed.
  5. src/app/api/stripe/webhook/route.ts — Stripe webhook handler with
     signature verification. Handle:
       - payment_intent.succeeded → mint licence_grant, send licence email
       - payment_intent.payment_failed → log + email the buyer
       - charge.refunded → revoke licence_grant, disable signed URLs
       - charge.dispute.* → mark grant under_dispute, notify staff
  6. Persist Stripe customer_id on users table; map on first checkout.

Constraints:

  - Never expose Stripe secret key. Only restricted keys (at most) client-side.
  - Webhook signature verified on every event; unverified = 400.
  - Idempotency: webhook handlers are idempotent (check grant existence
    before minting).
  - Defer Connect routing until CCP 11 — initial v1 sends all funds to
    platform balance; redistributed to creators once Connect is live.

Verification:

  # Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhook
  # Run a test checkout; confirm:
  #   - Payment Intent succeeds
  #   - licence_grant row appears in DB
  #   - email received (via Resend test dashboard)
  #   - signed URL for /api/media/[id] now returns 200
  # Trigger a refund via Stripe dashboard; confirm grant revoked.
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - Full buyer flow works end-to-end on preview (test mode).
  - Webhook handler idempotent (replay same event → no double-mint).
  - Task #18 completed.
```

---

## CCP 11 — Connect Express creator onboarding + KYC

**Task ref:** Cowork task #19 (Phase 5.C)

**Prerequisites:** CCP 10 green.

**Paste into Claude Code:**

```
Summon: @frontfiles-onboarding, @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 5.C, D5

Objective:
  Creators complete Stripe Connect Express KYC during onboarding phase 2.
  Payouts are gated on payout_ready flag (set by account.updated webhook).

Scope:

  1. /onboarding phase 2 Connect step: call
     stripe.accounts.create({ type: 'express', country, email })
     then stripe.accountLinks.create(...) → redirect to Stripe hosted onboarding.
  2. Return URL: /onboarding/connect-return → poll account.status via webhook.
  3. users.stripe_connect_id + users.payout_ready fields.
  4. Webhook: account.updated → set payout_ready = true when
     details_submitted && charges_enabled && payouts_enabled.
  5. /vault/settlements + /vault/transactions: real data from ledger
     (created in CCP 12) filtered to creator's own Connect account.
  6. Express dashboard login link in /vault/settlements → account link
     for self-service Stripe surface.
  7. Gate asset-listing: creator cannot set price > 0 on vault_assets
     unless payout_ready = true.
  8. Back-fill: existing /checkout flow (CCP 10) now routes funds via
     transfer_data.destination to creator's Connect account, with a
     platform_fee_amount based on economics table (Direct 20/20,
     Plugin 10/10, Commissioned 10% markup, Bulk 0%).

Constraints:

  - Creator onboarding is blocking for payout but not for uploading
     (unpriced / PRIVATE assets can be uploaded without Connect).
  - Sensitive fields (SSN, tax info) NEVER touch Frontfiles servers —
     Stripe hosts KYC.
  - Economics constants from a single shared module; do not hard-code
     splits in checkout flow.

Verification:

  # Fresh creator → onboarding phase 2 → Stripe hosted KYC → return.
  # account.updated webhook fires → payout_ready=true.
  # Asset with price > 0 can be published.
  # Test purchase by buyer → transfer_data routes; creator's Stripe
  # dashboard shows pending payout.

Gate:

  - Full creator-onboarding flow green on preview.
  - Economics constants centralised.
  - Task #19 completed.
```

---

## CCP 12 — Webhook coverage + ledger + reconciliation

**Task ref:** Cowork task #20

**Prerequisites:** CCP 11 green.

**Paste into Claude Code:**

```
Summon: @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 5.F, ASSIGNMENT_DISPUTE_TAXONOMY.md

Objective:
  Full Stripe webhook coverage + mirrored ledger in Supabase for audit and
  reconciliation. Daily job verifies Stripe balance matches ledger.

Scope:

  1. Webhook handlers expanded to cover:
     payment_intent.*, charge.*, account.*, payout.*, charge.dispute.*,
     radar.early_fraud_warning.created.
  2. Migration: ledger_entries table (id, type, amount_cents, currency,
     stripe_event_id, stripe_object_type, stripe_object_id, related_user_id,
     related_licence_id, related_assignment_id, metadata jsonb, created_at).
     Index on (stripe_event_id) UNIQUE; (related_user_id, created_at).
  3. Every webhook event writes 1..N ledger_entries rows depending on type.
  4. Daily cron (Supabase Edge Function or Vercel cron): reconcile Stripe
     balance vs ledger sum; alert on drift via Sentry.
  5. Dispute handling linked to ASSIGNMENT_DISPUTE_TAXONOMY.md: when a
     Stripe dispute arrives, classify if possible (Fraud keyword in
     claim_text → type=fraud); otherwise flag for staff review.
  6. Refund automation: upheld dispute on an internal taxonomy row →
     stripe.refunds.create if refund policy of that type calls for it.

Constraints:

  - Every webhook verified via signature; replay idempotency preserved.
  - Ledger writes in same transaction as the primary state mutation when
     feasible (e.g., licence_grant mint + ledger entry).
  - Reconciliation alerts are LOUD — Sentry error level, not warning.

Verification:

  # Trigger refund on preview → ledger_entries row appears.
  # Daily recon runs, logs "all green" or specific drift amount.
  ./node_modules/.bin/tsc --noEmit && bun run build

Gate:

  - 48h of webhook events on preview with zero drift.
  - Task #20 completed.
```

---

## CCP 13 — Stripe Tax + subscriptions + invoicing

**Task ref:** Cowork task #21 (Phase 5.D/E)

**Prerequisites:** CCP 12 green. Product decision: paid tier at launch?

**Paste into Claude Code:**

```
PRODUCT DECISION GATE: confirm with the founder whether any paid tier
(Plus / Enterprise / Plugin-Premium) ships at launch. If NO, skip
subscription work below and only implement tax + invoicing.

Summon: @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 5.D, 5.E

Scope (if paid tier = YES):

  1. Stripe Products + Prices for each tier.
  2. Subscription flow via Stripe Billing.
  3. Customer Portal for self-service.
  4. Companies/memberships → seat-based subscription binding.
  5. Invoicing for enterprise assignments.

Scope (always):

  1. Stripe Tax enabled across Connect accounts.
  2. US 1099/1042-S auto-filing via Connect Express.
  3. EU VAT / OSS registration + tax rate configuration.
  4. Creator tax-preference: inclusive vs exclusive pricing setting.

Verification:

  # Test purchase shows correct tax line.
  # Test creator in France sees VAT-inclusive pricing.
  # Test creator in US sees tax-exclusive with Connect Tax.

Gate:

  - Task #21 completed.
```

---

## CCP 14 — Upload flow improvements + real AI clustering

**Task ref:** Cowork task #27 (Area 1), includes D-U2 hard launch gate

**Prerequisites:** CCP 7 + CCP 9 green (AI infra live).

**Paste into Claude Code:**

```
Summon: @frontfiles-upload, @frontfiles-discovery, @frontfiles-context
Read: PLATFORM_REVIEWS.md Area 1, INTEGRATION_READINESS.md Phase 4.B

Objective:
  Close Area 1 improvements: v2-state.ts split per D-U1; error taxonomy;
  idempotency UX; Composer boundary; real AI story clustering (D-U2 hard
  gate); PR 1.3 landing.

Scope (in order):

  1. Split src/lib/upload/v2-state.ts per D-U1:
     state.ts / selectors.ts / simulation.ts / verification.ts.
     Preserve API surface exactly. Tests must pass byte-identical.

  2. Land PR 1.3: batch-aware /api/upload with X-Batch-Id header, extended
     CommitUploadRequest, widened InsertDraftAndOriginalInput to 21 RPC args.
     Strictly follow src/lib/upload/PR-1.1-PLAN.md semantics.

  3. Error taxonomy: every throw in upload path labelled with error_code
     (string enum); map user-facing messages per code.

  4. CommitScreen idempotency UX: distinguish replay-success from real
     failure; stop "stuck" perception.

  5. Composer/Upload boundary per D-U6: Composer starts AFTER commit.
     If any code draft-composes during upload, remove or defer.

  6. Real AI story clustering per D-U2 (HARD LAUNCH GATE):
     - StoryProposalsBanner queries clustering endpoint
     - /api/upload/cluster-suggestions route: for a batch's uploaded assets,
       compute pairwise embedding similarity via Vertex AI, group above
       threshold, surface as suggestions
     - UX: creator accepts / rejects / edits suggestions
     - Cache: embeddings persisted in asset_embeddings (CCP 3)

  7. E2E test: upload 5 assets → review → commit → licence-mintable path.

Constraints:

  - PR 1.3 stays within the substrate program rules (@frontfiles-upload
    guardrails apply in full).
  - Clustering threshold starts conservative (high-precision / low-recall);
    tuning is a v1.1 task.
  - Embedding calls respect ai_analysis cache (CCP 7).

Verification:

  bun x vitest run               # all pass
  ./node_modules/.bin/tsc --noEmit && bun run build
  # Manual: upload 6 images with 3 from one event; cluster suggestion
  # groups the 3 together with similarity score visible.

Gate:

  - Task #27 completed.
  - Clustering works end-to-end on preview.
```

---

## CCP 15 — Areas 2 / 3 / 4 / 5 review + improvements (parallelisable)

**Task refs:** Cowork tasks #28, #29, #30, #31

**Prerequisites:** CCP 11 + CCP 12 green (for Area 2 Stripe dependencies).

**Paste into Claude Code, ONE area per session:**

```
Summon appropriate agent:
  - Area 2 (Assignment): @frontfiles-context + engineer (no dedicated agent
    for assignment; use @frontfiles-blue-protocol for dispute-validation
    linkage)
  - Area 3 (Storage/Preview/Watermark): @frontfiles-context + @frontfiles-upload
  - Area 4 (FFF Broadcast v1): @frontfiles-context + @frontfiles-discovery
  - Area 5 (Special Offer): @frontfiles-context

Read: PLATFORM_REVIEWS.md for the specific Area you're working on

Objective: close the improvement items in that Area, respecting the locked
decisions (see PLATFORM_REVIEWS.md decision table at top).

Each Area's scope is enumerated in the governance document. Do NOT
re-derive; do NOT re-prioritise; execute the items as listed.

Constraints:

  - Area 2 depends on CCP 11 + CCP 12 (Stripe Connect + webhooks).
  - Area 3 depends on CCP 4 (real media repo) + CCP 9 (Vision for moderation).
  - Area 4 must respect D-F1: broadcast-in-v1 architecture, social-ready for v2.
    FFF_SHARING default=false until moderation ships (F.7).
  - Area 5 depends on CCP 10 (Stripe checkout for accept-flow payment).

Verification per Area: test each improvement item against its acceptance
criterion. Update the task's Cowork status to completed only when ALL
items in the area are green.

Gate per Area: the Area's Cowork task is completed.
```

---

## CCP 16 — Waterdog audit + BETA_SCHEMA_MAPPING.md

**Task ref:** Cowork task #23 (Phase 6)

**Prerequisites:** H6 done (Waterdog repos cloned and mounted).

**Paste into Claude Code:**

```
Summon: @frontfiles-context, @frontfiles-onboarding, @frontfiles-upload,
       @frontfiles-blue-protocol
Read: INTEGRATION_READINESS.md Phase 6, ASSIGNMENT_DISPUTE_TAXONOMY.md

Objective:
  Audit the Waterdog beta backend(s) and produce BETA_SCHEMA_MAPPING.md
  defining every entity → Frontfiles Supabase table mapping, field by field.
  This governs Phase 6 migration.

Scope:

  1. Read the cloned Waterdog repo(s) at ~/Desktop/frontfiles-beta/.
  2. Identify:
     - Backend framework + language
     - Database engine + ORM
     - Auth model
     - Storage provider for user-uploaded assets
     - All top-level entities and their schema
     - Business-logic specifics (dispute flow, payment flow, transactions)
  3. Produce BETA_SCHEMA_MAPPING.md at repo root:
     - Table-by-table mapping (beta → Frontfiles)
     - Per-field notes: preserved / transformed / dropped / augmented
     - Identifier-mapping strategy (beta_id ↔ new UUID)
     - Entities with no target (cannot import — flag + surface for decision)
     - Target entities with no source (new-in-Frontfiles — seed or leave empty)
  4. Row-count estimates per entity (from DB queries if accessible, or
     API enumeration).
  5. Risks + unknowns list at the end.

Constraints:

  - Do NOT modify anything in the Waterdog repo. Read-only.
  - Do NOT write import scripts yet (CCP 17).
  - Flag every field that could carry PII + how it maps to Frontfiles
    privacy posture.
  - Flag every creator-provided rights claim that needs re-affirmation
    post-migration (per @frontfiles-blue-protocol escalation rules).

Verification:

  # Founder reviews BETA_SCHEMA_MAPPING.md; no major gaps.
  # Unknowns + risks list is complete.

Gate:

  - Founder sign-off on the mapping doc.
  - Task #23 completed.
```

---

## CCP 17 — Import scripts + asset migration + cutover rehearsal

**Task ref:** Cowork task #24 (Phase 6)

**Prerequisites:** CCP 16 complete + founder sign-off on mapping.

**Paste into Claude Code:**

```
Summon: ALL agents
Read: BETA_SCHEMA_MAPPING.md, INTEGRATION_READINESS.md Phase 6

Objective:
  Build idempotent, dry-run-capable import scripts per entity. Rehearse on
  staging. Prepare cutover playbook.

Scope:

  1. scripts/migrate/ directory:
     - Per entity: migrate-<entity>.ts
     - Each supports --dry-run, --limit N, --batch-size M, --resume-from id.
     - Uses beta DB read-only; writes to Frontfiles Supabase.
     - Writes ID-mapping rows to id_map table (beta_id, frontfiles_id, entity_type).
  2. Asset file migration: stream from Waterdog storage → Supabase Storage;
     preserve original; trigger Vision + derivative pipeline (CCP 9).
  3. Auth migration: email match creates Supabase user with magic-link reset
     if password-based on beta. Existing Google-auth creators re-auth via
     Google; email-match bridges accounts.
  4. Stripe Customer recreation for imported buyers (preserves Customer IDs
     if they were in Stripe on beta; otherwise creates new).
  5. Creator Connect Express re-invitation: emailed to creators to complete
     KYC on the new platform; no old Stripe account carries over.
  6. URL redirect plan: map beta URLs to new URLs via Vercel rewrites +
     fall-back redirect table in Supabase.
  7. Dry-run rehearsal:
     - Spin up a staging Supabase from a snapshot.
     - Run every script with --dry-run then live.
     - Validate with referential-integrity checks + sample comparisons
       against the beta.
  8. Cutover playbook (in CUTOVER_PLAN.md):
     - Freeze window (beta read-only for 2h)
     - Final delta sync
     - DNS cutover
     - Post-cutover verification
     - Rollback criteria + procedure

Constraints:

  - Every import script is idempotent and resumable.
  - Nothing runs against prod Supabase until dry-run on staging is green.
  - Never delete from beta during migration.
  - Every creator earns a Rights-Attestation re-sign on first login
    post-migration (per @frontfiles-blue-protocol).

Verification:

  # Full rehearsal green on staging.
  # All referential-integrity checks pass.
  # Sample 10 random beta assets + verify they appear correctly in Frontfiles
  # post-import (including Vision derivatives).

Gate:

  - Founder sign-off on CUTOVER_PLAN.md.
  - Task #24 staged for cutover execution.
```

---

## CCP 18 — Launch hardening: legal, support, E2E, security review

**Task refs:** Cowork tasks #25, #26 (Phase 7)

**Prerequisites:** CCPs 1–15 green. H2 legal pages live. CCP 16/17 progress.

**Paste into Claude Code:**

```
Summon: @frontfiles-context
Read: INTEGRATION_READINESS.md Phase 7

Objective:
  Pre-launch hardening pass. Legal pages live. Customer support channel
  operational. E2E tests cover the 5 critical flows. Security review done.

Scope:

  1. Verify all 5 legal pages live: /legal/terms, /privacy, /creator-agreement,
     /buyer-licence, /ai-processing-disclosure. Cross-link from signin,
     onboarding phase 3, and account settings.
  2. Customer support channel (pick: Plain / Front / Intercom / email queue):
     wire contact form on /support; inbound email alias support@frontfiles.news;
     staff escalation for KYC + dispute + auth issues.
  3. E2E tests (Playwright) for 5 flows:
     - signin (Google + Apple + magic-link)
     - upload → review → commit → verify licence-grant path
     - buyer checkout → licence delivery → signed-URL download
     - creator onboarding → Connect KYC → payout_ready
     - dispute filed → classified → resolved (one of each taxonomy type)
  4. Security review checklist:
     - All user-owned tables have RLS
     - No SUPABASE_SERVICE_ROLE_KEY or STRIPE_SECRET_KEY reachable client-side
     - Webhook signature verification on every /api/*/webhook route
     - CSP headers configured
     - CORS policy restricted
     - Rate-limiting on auth + upload + checkout + webhook routes
     - Sentry not logging PII
     - Legal-pages review signed off by counsel

Constraints:

  - Every item must be green before launch.
  - E2E tests run in CI on every PR going forward.

Verification:

  # E2E suite passes on preview.
  # Security checklist 100% green.
  # Legal pages reviewed + live.

Gate:

  - Task #25, #26 completed.
  - PLATFORM is launch-ready.
```

---

# Part 3 — Meta prompts (useful across sessions)

### Session-start prompt (paste at the beginning of any new Claude Code session)

```
You are working in the Frontfiles repo. Before anything else:

1. Read CLAUDE.md for founder standing preferences.
2. Read AGENTS.md for Next.js-specific warnings.
3. Read INTEGRATION_READINESS.md (Decision Locks table at top).
4. Read PLATFORM_REVIEWS.md (Decision Locks table at top).
5. Read CLAUDE_CODE_PROMPT_SEQUENCE.md to know where the program stands.
6. Check Cowork task list via TaskList — work in order of task ID.

When I give you a prompt, it will summon specific agents. Load them. Follow
their guardrails exactly. Do not bypass or silently reinterpret.

If anything in this session would conflict with a decision in
INTEGRATION_READINESS.md, PLATFORM_REVIEWS.md, CLAUDE.md, or an agent spec,
STOP and surface. Do not decide unilaterally.

Acknowledge by summarising the current task (by ID), the agents you're
summoning, and the gate that will prove completion.
```

### Mid-session recalibration prompt (use if Claude Code drifts)

```
Halt. Check:

1. Are you inside the scope of the current CCP prompt? If you've touched
   anything outside "Scope — lands in this PR," revert.
2. Are you respecting the agent guardrails? (quote the rule you're following
   for your last decision)
3. Is verification still achievable from the current state? If not, roll
   back to the last known-good commit.

Then summarise what you were about to do and why.
```

### End-of-session close prompt

```
We're closing this session. Before I paste /compact or /exit:

1. Run verification commands listed in the current CCP prompt.
2. Paste the output.
3. If all green, update the relevant Cowork task via TaskUpdate to completed.
4. If NOT all green, update the task with a comment describing the remaining
   work, leave status in_progress.
5. Stage relevant changes; do not commit unless the current CCP prompt says so.
6. Summarise what shipped and what remains.
```

---

# Part 4 — Anti-patterns to refuse

Always refuse — and surface — the following in any Claude Code session:

1. "Just skip this test for now" → tests are gates, not decoration.
2. "Let's hard-code this one value" → economics constants live in one module.
3. "We'll add RLS later" → RLS is a hard gate for Phase 4/5.
4. "Run this in prod first" → never.
5. "Just silently reconcile this drift" → surface it; do not silently resolve.
6. "Use service-role key on the client for simplicity" → never.
7. "Let's combine these three PRs" → scope discipline is load-bearing.
8. "The agent guardrail is overkill here" → not your call; surface.

---

# Part 5 — Status tracking

As you execute, keep the Cowork task board current:

- Set a task to `in_progress` when you paste its CCP prompt.
- Set it to `completed` only when the Gate conditions are all green.
- Create follow-up tasks for anything surfaced mid-session that isn't in
  scope.

The task board + these governance documents + the agents are the **only**
sources of truth. If they disagree, the order of authority is:

1. CLAUDE.md (founder standing preferences) — wins everything
2. INTEGRATION_READINESS.md + PLATFORM_REVIEWS.md locked decisions
3. PLATFORM_BUILD.md state machines + economics
4. Agent guardrails (.claude/agents/*.md)
5. CLAUDE_CODE_PROMPT_SEQUENCE.md (this document) — sequencing hints
6. Cowork task descriptions

If Claude Code proposes to violate 1 or 2, refuse. If 3 or 4, surface.
If 5 or 6 — it's a sequencing suggestion, reconsidered per session.

---

*End of document — v1. Revise as execution reveals gaps. Every revision to
this document updates the sequence for future sessions; previous work stays
captured in git history.*
