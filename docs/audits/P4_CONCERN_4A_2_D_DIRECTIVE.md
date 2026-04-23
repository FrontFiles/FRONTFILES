# P4 Concern 4A.2.D — Offer auto-expire cron (pg_cron)

**Change history:** see §REVISIONS.

**Status:** DRAFT 3.2, 2026-04-23 — Batch 5 closeout (structural trio + 4 polish) + Batch 6 §OPEN-Q ratifications (#2-#7 ACCEPT); Gate 0 closed 2026-04-23 (E4 + E5 satisfied; E1/E2/E3/E6/E7 forward-deferred to Prompts 1/7).
**Branch:** `feat/p4-offers-d-cron` (to be cut from `main` at Gate 0 approval)
**Predecessor:** P4 Concern 4A.2.B1 (F-RPC catalogue — `rpc_expire_offer` shipped) — closed implicitly at B1 merge; B1 directive L834 documents the deferral of cron wiring to D.
**Peer concerns (parallel):** 4A.2.C1 (list UI), 4A.2.C2 (detail + mutation UI)
**Successor:** 4A.2.C — legacy `/api/special-offer/*` retirement (directive: `P4_UI_DEPRECATION_AUDIT.md` Draft 2, Gate 3 approved 2026-04-22).

---

## §CONTEXT

Part B1 (4A.2.B1) shipped the `rpc_expire_offer` PL/pgSQL RPC alongside the accept/counter/reject/cancel/create RPCs, but deliberately deferred cron wiring to a separate concern — see `P4_CONCERN_4A_2_B1_DIRECTIVE.md` §scope item 4 ("cron deferred to Part D"). Part B1 directive L834 also deferred `GET /api/offers` list endpoint to C1. `PLATFORM_REVIEWS.md` §D-SO1 locks the cron authority: *"Supabase `pg_cron` job transitions expired offers."* The cron job is the single non-UI moving part needed for offer-surface completeness before the 4A.2.C retirement.

**What D owns.** The pg_cron schedule definition. The wrapper function that invokes `rpc_expire_offer` on the right cadence. Idempotency + backfill + observability hooks. A ledger-events sanity check that confirms cron-driven state transitions emit the correct `offer.expired` events.

**What D does NOT own.** Any UI affordance — list surface (**C1**), detail surface (**C2**). User-initiated expiry (does not exist — expiry is system-driven). Stripe capture scheduling (follows accept, not expire). Assignment or dispute cron — **4A.3 / 4A.4**. The `FFF_AUTH_WIRED` / `FFF_ECONOMIC_V1_UI` flags — cron runs regardless of UI-facing flag state because expired offers must terminate for data-integrity reasons even if no UI is visible (see §D5).

**Governance anchors.**
- `ECONOMIC_FLOW_v1.md` §4 (offer state machine — `expired` terminal), §4.3 (terminal-state event ordering), §F16 (platform-fee rate-lock — separate from auto-expire but relevant to RPC idempotency).
- `docs/specs/SPECIAL_OFFER_SPEC.md` §3 (response-window default + ceiling), §11 (cancellation mechanics).
- `PLATFORM_REVIEWS.md` §D-SO1 — cron authority lock.
- `P4_CONCERN_4A_2_B1_DIRECTIVE.md` (RPC body for `rpc_expire_offer` + the UNIQUE prev-hash index that serves as the ledger-chain retry primitive).
- `P4_CONCERN_4A_2_DIRECTIVE.md` §D12 (cron scope deferral to D), L120 ("cron for `offer.expired` is deferred to the Part D directive"), L1219 (founder gate on D14).

---

## §SCOPE

In scope:

1. **Supabase `pg_cron` extension enablement.** Migration that enables the `pg_cron` extension on the target database if not already present. Guarded with `CREATE EXTENSION IF NOT EXISTS pg_cron;` + a guard block that no-ops if `pg_cron` is already installed.
2. **`cron.offer_expire_tick` wrapper function.** New PL/pgSQL function that enumerates offers with `state IN ('sent', 'countered') AND expires_at < now()` and invokes `rpc_expire_offer` for each. Written as a thin orchestrator so the retry + hash-chain concerns live inside `rpc_expire_offer` (B1 contract), not duplicated here.
3. **`cron.offer_expire_tick` schedule.** A `SELECT cron.schedule(...)` migration that runs the tick every **60 seconds**. Rationale: offers carry `expires_at` at minute-precision; a 60s cadence is the tightest schedule that preserves observable-timeliness without pg_cron queue contention. Adjustable post-launch via a single migration.
4. **Idempotency proofs.** The wrapper function is written to be re-entrant — if two cron ticks land on the same offer within the same second (extreme edge), the second one is a no-op because `rpc_expire_offer` hard-gates on `state NOT IN ('sent', 'countered')` inside a `FOR UPDATE` row lock. Migration includes a regression test that asserts this.
5. **Backfill migration.** A one-time `SELECT cron.offer_expire_tick();` invocation inside the same migration that creates the schedule — catches any offers that expired between Part B1 deploy and the cron schedule activation. Called **after** the schedule is installed so late arrivals are not missed by the backfill.
6. **Ledger observability.** The wrapper writes a single `ledger_events` row per state transition via `rpc_expire_offer` — no new ledger rows from the wrapper itself. Verification test reads `ledger_events` post-tick and asserts event shape matches `ECONOMIC_FLOW_v1.md` §8.1 for `offer.expired`.
7. **Operational readout function.** `cron.offer_expire_readout()` — read-only function returning the last 24 hours of tick timestamps + number of rows processed per tick. Serves as a basic oncall surface while Sentry/PostHog (per `INTEGRATION_READINESS.md` D3/D4) is still being wired up.
8. **Tests.** Migration tests (pg-embedded Vitest harness per repo convention — `src/lib/db/__tests__/migrations/`). 7 new cases in one new test file.

Out of scope (enforced at review):

- UI affordances showing "expiring soon" / "expired" — C1 / C2 render these from the state-enum chip. D does not touch the UI.
- Cross-concern auto-cancel rules (e.g., pending assignment cancels a related offer) — **4A.3 / 4A.4**.
- Dispute-triggered auto-cancel — **4A.4**.
- Retry-on-failure for the cron wrapper itself — `pg_cron` already retries failed job runs; the B1 RPCs handle row-level retry via the UNIQUE prev-hash advisory pattern.
- Lowering the tick cadence below 60s — v1 locks at 60s; post-launch load-test signal governs any change.
- Moving to an external scheduler (Vercel Cron, external worker) — the D-SO1 lock is explicit: pg_cron. Proposals to move belong in a separate architecture concern.

---

## §NON-SCOPE — explicit denials

| Request | Refusal reason |
|---|---|
| "Use Vercel Cron instead of pg_cron" | D-SO1 lock is explicit. Architecture change is a separate concern. |
| "Run the tick every 10 seconds" | 60s locked in v1. pg_cron has per-job queue overhead — tight schedules hurt. |
| "Add Sentry breadcrumbs inside the cron wrapper" | §D3 inherited: no new deps. Sentry wiring is INTEGRATION_READINESS D3 scope. |
| "Emit a Slack notification on expire-tick failure" | Out of scope; oncall observability is a separate concern. |
| "Auto-extend offers within 1h of expiry if both parties are active" | v2+ product feature; not in the v1 state machine. |
| "Pre-compute a materialised view of expiring offers" | Premature optimization. Current query hits a partial index on `(state, expires_at)`. |
| "Add a UI banner 'auto-expire ran at T+n'" | UI concern. D is backend-only. |
| "Handle timezone conversion for `expires_at`" | Stored as `timestamptz`; Postgres + `now()` handle TZ. No application-side conversion needed. |
| "Wrap per-row PERFORM in BEGIN/EXCEPTION/END to isolate races" | Accepted v1 behavior: per-row RAISE aborts LOOP; pg_cron next tick catches. Revisit only when schema adds DELETE or extend paths raising the P0003/P0007 probability above near-zero. |

---

## §REVISIONS

**Draft 2 — 2026-04-22**

- REC-3 closure: state-literal correction `state IN ('pending', 'countered')` → `state IN ('sent', 'countered')` across all occurrences. Canonical enum source: `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql` L37-44.
- DB-enum fabrication closure: file-wide `auto_cancelled` count = 0 (post-Batch-2 attestation).
- Plural-drift closure: file-wide `Both wrapper(s)` count = 0.
- NEW-B5 mooting note: column-name mismatch concern dissolved by F1-03 + F1-18; no audit drift. Documented here for traceability per session-state §4.

**Draft 3 — 2026-04-23**

- B1 re-verify outcome: `SPECIAL_OFFER_SPEC.md` governance surface unchanged post-REC-1; `rpc_cancel_offer` retained at migration `20260421000011_rpc_offer_business.sql` L710-714 under Path B1 ownership.
- B2 arity fix: 1-arg call `rpc_expire_offer(v_offer_id)` → 3-arg positional call `rpc_expire_offer(c_system_actor, v_offer_id, '{}'::jsonb)` at §F2 L115.
- DECLARE extension: `c_system_actor constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;` added at §F2 L105-L106 as byte-exact mirror of migration `20260421000011_rpc_offer_business.sql` L813-L814.
- Narrative abstraction: §F2 design-note bullet at L127 abstracted to `rpc_expire_offer(...)` (Option 2 chosen over arity-naming Option 1).
- Parameter-name discipline: positional call binds `c_system_actor` to RPC formal parameter `p_actor_ref` (migration L801) — NOT `p_actor_id`. Discipline applies to all forward audit prose.

**Draft 3.1 — 2026-04-23**

- B4-i L46 DROP: "Stripe refund orchestration on cancel" disown removed from §SCOPE Out-of-scope list. Rationale per FLAG-9a: REC-1 (Draft 3 §REVISIONS) affirmed D's narrow expire-only scope — cancellation refund mechanics belong to a separate checkout-UI / payment-ops concern, not D's out-of-scope surface. Listing it was off-topic clutter; the other disowns (L47 cross-concern auto-cancel, L48 dispute-triggered auto-cancel, L50-L51 cadence + external-scheduler) remain as genuinely-adjacent out-of-scope items.
- B4-ii L49 REWORD: "cron wrappers themselves" (plural) → "cron wrapper itself" (singular). Rationale per FLAG-9b: D ships exactly one scheduled wrapper (§F2 `cron.offer_expire_tick`); §F5 `cron.offer_expire_readout()` is read-only, unscheduled, and not subject to retry concerns. Plural form implied a wrapper catalog that doesn't exist.

**Draft 3.2 — 2026-04-23**

- Batch 5 S1: §PROMPT 1 PREREQUISITES authored (V1-V6 pre-flight gates + DB-domain baseline-capture protocol).
- Batch 5 S2: §EXIT CRITERIA authored (E1-E7 gate-closure criteria covering functional/mechanical/baseline/§OPEN-Q/carry-forwards/regression/exit-report).
- Batch 5 S3: §SELF-VERDICT authored (SV-1 through SV-6 discipline rubric; FLAG-26 bundled into SV-1, FLAG-27 + FLAG-29-redux bundled into SV-3).
- Batch 5 polish: test-count parity harmonized on 6 (then extended to 7 by FLAG-16); FLAG-15 Option B (per-row RAISE abort-mid-batch doc); FLAG-11 (wrapper `SELECT` unlocked rationale); FLAG-16 Option A (b)-switch (spec-compliant `last_active_actor_id` payload derived from `actor_ref` handle per pseudonymisation discipline).
- Batch 6: §OPEN-Q rows #2-#7 all ACCEPT-ratified per founder defaults (500 cap / 1/min cadence / inline backfill / `authenticated` readout grant / `20260423000000` timestamp / strict parallel with C1/C2; D merges before 4A.2.C). Gate 0 verdict pending. §AUDIT-1 deferred to Prompt 1 execution per §PROMPTS item 1 scope.

---

## §PROMPT 1 PREREQUISITES

Prompt 1 (pre-flight audit per §PROMPTS) is gated on six V-checks + one baseline capture. Hard-HALT gates (V1/V2/V3/V4/V5) block Prompt 2 entry on failure; soft-fail gate V6 re-scopes downstream work without HALT. Baseline capture records feed §AUDIT-1 (authoring deferred to Batch 5 S2).

**V1 — `pg_cron` extension availability on target Supabase.**

- **Purpose:** Confirm `pg_cron` is installed on the target Supabase project. D's core primitive depends on this extension; absence blocks the entire concern per `PLATFORM_REVIEWS.md` §D-SO1 lock.
- **Verification command:** `psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname = 'pg_cron'"`
- **Expected result:** One row returned with `extname = 'pg_cron'`.
- **Action on failure:** HARD HALT — escalate at §APPROVAL GATES Gate 1. External-worker fork scope re-evaluation required (D-SO1 assumes pg_cron availability).

**V2 — `rpc_expire_offer` 3-arg signature byte-exact on `main`.**

- **Purpose:** Confirm D's §F2 wrapper invokes the B1-source-of-truth signature unchanged. If B1 modified the signature post-merge, D's call-site arity would break.
- **Verification command:** `sed -n '800,804p' supabase/migrations/20260421000011_rpc_offer_business.sql`
- **Expected result:** Signature block at L800-804 reading `CREATE OR REPLACE FUNCTION public.rpc_expire_offer(` / `p_actor_ref uuid,` / `p_offer_id  uuid,` / `p_payload   jsonb` / `) RETURNS TABLE (event_id uuid, event_hash text)`.
- **Action on failure:** HARD HALT — coordinate with B1 owner; §F2 wrapper body cannot ship against a drifted RPC signature.

**V3 — `offer_state` enum terminal `'expired'` value present.**

- **Purpose:** Confirm the DDL enum includes `'expired'` as a terminal state. D's §F2 wrapper transitions offers to `'expired'` via `rpc_expire_offer`; absence would cascade RPC failures.
- **Verification command:** `grep -A7 "CREATE TYPE public.offer_state" supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
- **Expected result:** Six-value enum at L37-44 containing (in order) `'sent'`, `'countered'`, `'accepted'`, `'rejected'`, `'expired'`, `'cancelled'`.
- **Action on failure:** HARD HALT — DDL divergence; re-align with `ECONOMIC_FLOW_v1.md` §4 state machine.

**V4 — `offers` table `expires_at` + `state` columns present.**

- **Purpose:** D's §F2 wrapper SELECT depends on both columns (`WHERE state IN ('sent', 'countered') AND expires_at < now()`). Column rename/drop would break the tick query.
- **Verification command:** `grep -nE "^  (expires_at +timestamptz|state +public\.offer_state)" supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`
- **Expected result:** Two hits inside the `offers` table DDL block (type-specificity via `public.offer_state`, unique to offers) — `expires_at        timestamptz NOT NULL,` at L108 + `state             public.offer_state NOT NULL,` at L109.
- **Action on failure:** HARD HALT — DDL divergence; §F2 wrapper SELECT predicate must be re-anchored.

**V5 — Migration timestamp `20260423000000` collision-free.**

- **Purpose:** D's §F1 migration filename `20260423000000_enable_pg_cron.sql` must not collide with any pre-existing migration. Collision blocks Supabase deploy.
- **Verification command:** `ls supabase/migrations/20260423* 2>/dev/null | wc -l`
- **Expected result:** `0` (no pre-existing migration with a `20260423` prefix).
- **Action on failure:** HARD HALT — rename §F1 migration timestamp + update §F2/§F3/§F5 anchor sequence; re-release directive before Gate 1.

**V6 — B1 + B2 RPC catalogue echo (§CONTEXT chain integrity).**

- **Purpose:** D's §CONTEXT states B1 and B2 are merged predecessors. Confirm the 5 offer-mutation RPCs shipped (mirror of C2 V13 for §CONTEXT chain integrity). D does not invoke these directly but §CONTEXT cross-refs them.
- **Verification command:** `grep -nE "CREATE OR REPLACE FUNCTION public\.rpc_(accept|counter|reject|cancel)_offer\b" supabase/migrations/20260421000011_rpc_offer_business.sql` AND `grep -n "rpc_accept_offer_commit" supabase/migrations/20260421000012_offer_accept_stripe.sql`
- **Expected result:** Four RPCs at `20260421000011_rpc_offer_business.sql` (`rpc_accept_offer`, `rpc_counter_offer`, `rpc_reject_offer`, `rpc_cancel_offer`) + one `rpc_accept_offer_commit` at `20260421000012_offer_accept_stripe.sql`.
- **Action on failure:** SOFT — §CONTEXT wording may need amendment (B1/B2 not merged as claimed?) but does not block D-scope work. Flag for founder.

### Baseline capture (records deferred to Batch 5 S2 §AUDIT-1)

At Prompt 1 kickoff, post-V1-V6 pass:

1. Run `npm run test` — capture **passing count**. Feeds AC14 fresh-floor invariant (`baseline + 7 new cases, 0 failing`).
2. Run `npm run lint` — capture **error count**. Feeds AC16 lint-floor invariant (no new errors beyond this floor).
3. Tooling versions: Vitest (`bunx vitest --version`), Node (`node --version`), ESLint (`npx eslint --version`).
4. DB-domain captures (D is migration/cron-heavy; pin DB + extension + tooling versions for reproducibility audit-trail): Postgres version via `psql "$DATABASE_URL" -c "SELECT version()"`; `pg_cron` extension metadata via `psql "$DATABASE_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron'"`; Supabase CLI version via `supabase --version` (if used for deploy).
5. Records landed into §AUDIT-1 section per Batch 5 S2 authoring (deferred; not part of S1 scope).

---

## §F — Functional requirements

### §F1 — `pg_cron` extension migration

**File:** `supabase/migrations/20260423000000_enable_pg_cron.sql` (new).

```sql
-- Idempotent pg_cron enablement; safe to re-run.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant minimal privileges to service_role for the orchestrator function (below).
GRANT USAGE ON SCHEMA cron TO service_role;
```

No schedule definitions in this migration — the schedule lives with the wrapper function for change-auditability locality.

### §F2 — `cron.offer_expire_tick` wrapper

**File:** `supabase/migrations/20260423000001_offer_expire_tick.sql` (new).

```sql
CREATE OR REPLACE FUNCTION cron.offer_expire_tick()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer_id UUID;
  v_last_actor_ref UUID;
  v_count INTEGER := 0;
  c_system_actor constant uuid :=
    '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  FOR v_offer_id IN
    SELECT id FROM public.offers
    WHERE state IN ('sent', 'countered')
      AND expires_at < now()
    ORDER BY expires_at ASC
    LIMIT 500  -- cap per tick to bound lock duration
  LOOP
    -- Derive last_active_actor_id per spec §8.1: actor_ref (handle UUID)
    -- of the most recent non-system event on this offer's thread. Per
    -- pseudonymisation discipline (DDL §8.4 + L82-L83), event payloads
    -- reference parties via handle, not auth_user_id. Pattern mirrors
    -- by_actor_id convention at migration L1038 (rpc_counter_offer).
    SELECT actor_ref INTO v_last_actor_ref
    FROM public.ledger_events
    WHERE thread_type = 'offer'
      AND thread_id = v_offer_id
      AND actor_ref <> c_system_actor
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_last_actor_ref IS NULL THEN
      -- Unexpected: offer.created always has a non-system buyer actor_ref.
      -- Skip and let the next tick re-evaluate (see FLAG-15 abort-mid-batch
      -- principle: next scheduled tick re-enumerates missed offers).
      RAISE NOTICE 'offer_expire_tick: skipping offer % (no non-system actor found on thread)', v_offer_id;
      CONTINUE;
    END IF;

    PERFORM public.rpc_expire_offer(
      c_system_actor,
      v_offer_id,
      jsonb_build_object('v', 1, 'last_active_actor_id', v_last_actor_ref)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
```

**Design notes:**
- `SECURITY DEFINER` — runs as the migration owner so pg_cron can invoke it without per-user privilege surface.
- `LIMIT 500` per tick — bounds lock pressure even under pathological expiry cliffs (e.g., 10 000 offers expired simultaneously after a deploy gap). Next tick catches the remainder.
- `ORDER BY expires_at ASC` — oldest-first, deterministic; tiebreak by primary key implicit.
- Per-row `PERFORM rpc_expire_offer(...)` — not batched. B1's `rpc_expire_offer` already gates on state + row lock; we honor that contract.
- Per-row RAISE aborts the LOOP mid-batch. Acceptable per pg_cron per-tick retry semantics: the next scheduled tick (60s later) re-enumerates missed offers via `ORDER BY expires_at ASC` + `LIMIT 500`. Race-induced RAISEs are near-zero probability under v1 schema (no DELETE path → P0003 not_found ≈ 0; no extend path → P0007 not_yet_expired ≈ 0; P0003 invalid_state is low under typical load, user accept/counter/reject/cancel winning the SELECT→PERFORM race). Expiry-time drift bounded at 60s worst-case for offers trailing a raced-on offer in the aborted batch.
- Wrapper enumeration `SELECT` is unlocked — no `FOR UPDATE`, no `SKIP LOCKED`. Two safety nets justify this: (i) pg_cron does not run overlapping invocations of the same job, so concurrent-tick row contention is structurally impossible; (ii) per-row locking is delegated to `rpc_expire_offer`'s `SELECT … FOR UPDATE` at migration L828. Adding wrapper-level locking would either redundantly serialize or fight with the RPC's lock. The intra-LOOP `SELECT` against `ledger_events` for `last_active_actor_id` derivation is likewise unlocked — read-only, no contention.

**LoC budget:** ~40 LoC migration + ~180 LoC test.

### §F3 — `cron.offer_expire_tick` schedule

**File:** `supabase/migrations/20260423000002_schedule_offer_expire_tick.sql` (new).

```sql
SELECT cron.schedule(
  'offer-expire-tick',
  '*/1 * * * *',  -- every minute
  $$SELECT cron.offer_expire_tick();$$
);

-- One-shot backfill to catch anything between B1 deploy and schedule install.
SELECT cron.offer_expire_tick();
```

**LoC budget:** ~15 LoC.

### §F5 — `cron.offer_expire_readout()` operational function

**File:** `supabase/migrations/20260423000004_offer_expire_readout.sql` (new).

```sql
CREATE OR REPLACE FUNCTION cron.offer_expire_readout()
RETURNS TABLE(tick_at TIMESTAMPTZ, rows_processed INTEGER, ran_for_ms INTEGER)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    end_time AS tick_at,
    COALESCE(return_message::INTEGER, 0) AS rows_processed,
    EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER * 1000 AS ran_for_ms
  FROM cron.job_run_details jrd
  JOIN cron.job j ON j.jobid = jrd.jobid
  WHERE j.jobname = 'offer-expire-tick'
    AND jrd.start_time > now() - INTERVAL '24 hours'
  ORDER BY jrd.start_time DESC
  LIMIT 1440;  -- 24h worth at 1/min
$$;

GRANT EXECUTE ON FUNCTION cron.offer_expire_readout() TO authenticated;
```

**LoC budget:** ~25 LoC.

### §F6 — Migration tests

**Files:**
- `src/lib/db/__tests__/migrations/offer_expire_tick.test.ts` (new) — 7 cases:
  1. Tick with zero expired offers returns 0.
  2. Tick with N expired offers transitions all N to `expired` and returns N.
  3. Tick is idempotent: second invocation immediately after returns 0.
  4. Tick cap at 500 — more than 500 expired offers → first tick returns 500, second returns the remainder.
  5. Tick does not touch `state = 'accepted'` offers even if `expires_at < now()`.
  6. Each transition emits one `ledger_events` row with `event_type = 'offer.expired'`.
  7. `last_active_actor_id` in `offer.expired` payload equals the most recent non-system `actor_ref` (handle UUID per DDL §8.4 pseudonymisation) on the offer's ledger thread, per spec §8.1 + `OfferExpiredPayloadSchema` (`src/lib/ledger/schemas.ts`).

**Test baseline.** Prompt 1 captures post-SCAFFOLD + post-C1-if-merged + post-C2-if-merged baseline.

### §F7 — RLS + privilege audit

Both new functions are `SECURITY DEFINER` and run in the `cron` schema. §F1 grants `USAGE ON SCHEMA cron TO service_role`. `cron.offer_expire_readout()` is granted to `authenticated` (any signed-in user can read their own tick stats for debugging; the function reads only job metadata, not offer rows — no RLS leak). `cron.offer_expire_tick()` remains ungranted to non-admins.

---

## §AC — Acceptance criteria (for exit report)

| # | Criterion | Verification |
|---|---|---|
| AC1 | `pg_cron` extension is enabled | `SELECT * FROM pg_extension WHERE extname = 'pg_cron'` |
| AC2 | `cron.offer_expire_tick` function exists and returns INTEGER | `\df cron.offer_expire_tick` |
| AC3 | `offer-expire-tick` job is scheduled at 1/min | `SELECT * FROM cron.job WHERE jobname = 'offer-expire-tick'` |
| AC6 | `cron.offer_expire_readout` function exists and is grantable to `authenticated` | `\df cron.offer_expire_readout` |
| AC7 | Pending offers with `expires_at < now()` transition to `expired` after one tick | test |
| AC8 | Accepted offers with `expires_at < now()` remain `accepted` (no touch) | test |
| AC10 | Each auto-expire emits exactly one `offer.expired` ledger event | test |
| AC12 | Cap of 500 per tick honored | test |
| AC13 | Backfill one-shot invocation inside the schedule migration catches offers expired pre-schedule | test |
| AC14 | Vitest baseline ≥ floor + 7 new cases, 0 failing | `npm run test` |
| AC15 | `npm run build` clean | CI / local |
| AC16 | No new lint errors beyond the floor at C2 exit or C1 exit (whichever is higher) | `npm run lint` |
| AC17 | No UI file touched — `src/app/**` and `src/components/**` diff clean | git diff |
| AC18 | No `/api/special-offer/*` touched (4A.2.C owns) | git diff |
| AC19 | Tick cadence is 1/min (not 10s, not 5min) | grep schedule migration |
| AC20 | Both cron functions are `SECURITY DEFINER` | grep |

---

## §D — Directives

- **§D1.** **No pg_cron alternative.** The D-SO1 lock is authoritative — pg_cron only. Proposals to move to Vercel Cron or an external worker are out of scope.
- **§D2.** **60-second tick cadence.** Locked at 60s. Tightening requires a separate concern + load test evidence.
- **§D3.** **No new deps.** Same §D3 inherited from SCAFFOLD / C1 / C2.
- **§D4.** **RPC contracts are B1-authoritative.** D calls `rpc_expire_offer` but does not modify it. Any required change to that RPC is a B1 revision, not a D scope expansion.
- **§D5.** **Cron runs regardless of UI flag state.** `FFF_ECONOMIC_V1_UI` and `FFF_AUTH_WIRED` gate the UI; they do not gate data-integrity operations. An offer must expire on schedule even if the UI is flag-off. This is the explicit rationale for keeping cron scope separate from UI.
- **§D8.** **No UI touch.** Any file under `src/app/**` or `src/components/**` modified by D fails the exit gate. If UI reveals a cron bug, the fix lives in the backend.
- **§D9.** **Idempotency is migration-authoritative.** The wrapper can be re-run without side effect beyond the expected state transitions. Tests assert this; a new migration that breaks idempotency is a blocking regression.
- **§D10.** **Readout function is debug-grade, not production monitoring.** `cron.offer_expire_readout()` is the v1 oncall stub. Production monitoring wires through Sentry/PostHog per `INTEGRATION_READINESS.md` D3/D4 — that wiring is not D's scope.

---

## §PROMPTS — execution sequence

| # | Title | Output | LoC est. |
|---|---|---|---|
| 1 | **Pre-flight audit** — capture baseline; confirm `rpc_expire_offer` is present on `main`; confirm `pg_cron` availability on the target Supabase project. | `§AUDIT-1` appended. | 0 |
| 2 | **`pg_cron` enablement migration** | migration | ~10 |
| 3 | **`cron.offer_expire_tick` + test** | migration + test | ~220 |
| 4 | **Schedule + backfill migration** | migration | ~15 |
| 6 | **`cron.offer_expire_readout` + grant** | migration | ~25 |
| 7 | **Verification pass** — full test suite + migration replay on a fresh DB + `cron.job` inspection | text-only report | 0 |
| 8 | **Exit report** — mirror SCAFFOLD exit structure | new doc `P4_CONCERN_4A_2_D_EXIT_REPORT.md` | ~200 |

**Total LoC budget:** ~470 (migration-heavy).

**Total prompts:** 8. Wall-clock estimate: 2-3 days solo, verdicts within ~2 hours.

---

## §APPROVAL GATES

- **Gate 0 (now):** founder verdict on this directive.
- **Gate 1:** after Prompt 1 — if `pg_cron` is unavailable on the target Supabase project (Free tier limitation, for example), pause and escalate. `PLATFORM_REVIEWS.md` D-SO1 assumes availability; if that assumption breaks, the scope is re-evaluated against an external-worker fork that stays minimal.
- **Gate 3:** after Prompt 7 — verification pass on a fresh DB must show migrations apply cleanly, schedule installs, tick runs, and the 7 test cases pass.

---

## §OPEN-Q — founder decisions owed before Gate 0 closes

| # | Question | Options |
|---|---|---|
| 2 | Per-tick cap at 500 | Accept? Or tune lower (250) / higher (1000)? **Ratified 2026-04-23: Accept — 500 cap retained as v1 lock.** |
| 3 | Schedule cadence at 1/min | Accept? **Ratified 2026-04-23: Accept — 1/min cadence retained as v1 lock.** |
| 4 | Backfill inside the schedule migration vs separate one-shot | Inline backfill proposed per §F3; alternative is a separate migration file that can be replayed standalone. **Ratified 2026-04-23: Accept — inline backfill per §F3.** |
| 5 | Readout function grant to `authenticated` | Accept? Alternative is grant to `service_role` only. **Ratified 2026-04-23: Accept — `authenticated` grant retained; no RLS leak per §F7.** |
| 6 | Migration timestamp prefix | `20260423000000` proposed (after all pre-existing `20260421000xxx` B1 migrations). Accept? **Ratified 2026-04-23: Accept — `20260423000000` timestamp retained.** |
| 7 | Sequencing vs C1 / C2 / 4A.2.C | Propose: strict parallel with C1/C2 (disjoint file sets — D is backend-only); D merges before 4A.2.C so the legacy `/api/special-offer/*` retirement can assume the cron is authoritative for expiry. Accept? **Ratified 2026-04-23: Accept — strict parallel with C1/C2; D merges before 4A.2.C.** |

---

## §EXIT CRITERIA (Gate 0 → Gate 3)

Directive-level gate closure. Distinct from §AC (exit-report content the Claude Code agent proves at end of Prompt 7) — E-criteria are what founder verifies at Gates 1/2/3.

### E1 — §AC functional criteria green (AC1-AC3/AC6-AC8/AC10/AC12-AC14/AC19-AC20)

- **Criterion:** All 12 functional AC rows (AC1, AC2, AC3, AC6, AC7, AC8, AC10, AC12, AC13, AC14, AC19, AC20) pass at end of Prompt 7 verification.
- **Verification:** Prompt 7 report enumerates each AC with PASS / FAIL + evidence (live psql query result, test output, or mechanical grep of the schedule / `SECURITY DEFINER` sources).
- **Expected:** 12/12 PASS.
- **Action on failure:** HARD HALT at Gate 3 — any FAIL blocks exit-report publication until resolved in a corrective prompt.

### E2 — §AC mechanical criteria green (AC15-AC18)

- **Criterion:** All 4 mechanical AC rows (AC15, AC16, AC17, AC18) pass via CI/npm output and `git diff`.
- **Verification:** Prompt 7 report confirms `npm run build` clean (AC15), `npm run lint` no new errors beyond captured Prompt-1 floor (AC16), `git diff src/app/** src/components/**` clean (AC17), and `git diff src/app/api/special-offer/` clean (AC18).
- **Expected:** 4/4 PASS.
- **Action on failure:** HARD HALT at Gate 3 — mechanical failures block exit.

### E3 — §PROMPT 1 PREREQUISITES V1-V6 classified + baseline captured in §AUDIT-1

- **Criterion:** At Prompt 1 kickoff, V1-V6 complete with classifications recorded (HARD HALT gates V1-V5 all PASS; V6 SOFT outcome noted); baseline capture (test pass count + lint error count + tooling + DB-domain versions per §PROMPT 1 PREREQUISITES Baseline-capture sub-block) landed in §AUDIT-1 before Gate 1 closes.
- **Verification:** `grep -c "^## §PROMPT 1 PREREQUISITES" docs/audits/P4_CONCERN_4A_2_D_DIRECTIVE.md` returns **1** (section present) AND `grep -c "^## §AUDIT-1" docs/audits/P4_CONCERN_4A_2_D_DIRECTIVE.md` returns **1** (audit-trail landed per Batch 5 S3-or-later §AUDIT-1 authoring).
- **Expected:** §PROMPT 1 PREREQUISITES present (1 hit); §AUDIT-1 present at Gate 1 (1 hit).
- **Action on failure:** HARD HALT at Gate 1 — baseline-capture audit trail is a pre-Gate-1 obligation.

### E4 — §OPEN-Q closure at Gate 0

- **Criterion:** All 6 §OPEN-Q rows (#2-#7; gap at #1 preserved per POLICY UNIFICATION invariant) ratified with founder decisions recorded before Gate 0 verdict closes.
- **Verification:** `grep -cE "\*\*Ratified 202[0-9]-" docs/audits/P4_CONCERN_4A_2_D_DIRECTIVE.md` returns **6**; §REVISIONS entry notes Gate 0 closure.
- **Expected:** 6/6 §OPEN-Q rows show ratified decisions with date stamps.
- **Action on failure:** HARD HALT at Gate 0 — unratified §OPEN-Q items block execution.

### E5 — Explicit carry-forward items (downstream concerns)

- **Criterion:** The following items are EXPLICITLY OUT OF SCOPE for Draft 3.x and carry forward as downstream items:
  1. Production cron monitoring wiring (Sentry breadcrumbs + PostHog events for cron-tick observability) — deferred per §D10 and `INTEGRATION_READINESS.md` D3/D4 scope; D ships `cron.offer_expire_readout()` as the v1 debug-grade oncall stub only.
  2. pg_cron Free-tier availability conditional pivot — per §APPROVAL GATES Gate 1; if the target Supabase project is on a Free tier without pg_cron support, D-SO1's availability assumption breaks and an external-worker fork scope re-evaluation is required before Prompt 2 entry.
- **Verification:** n/a (documented carve-outs only).
- **Expected:** Items acknowledged; no Draft 3.x action required.
- **Action on failure:** N/A — this criterion cannot fail. Prevents these items from re-surfacing as blockers.

### E6 — No regression vs Prompt 1 baseline

- **Criterion:** Vitest test count at end of Prompt 7 ≥ captured Prompt-1 baseline + 7 new cases (0 failing) per AC14 fresh-floor invariant. Lint error count ≤ captured Prompt-1 lint floor (no new errors) per AC16.
- **Verification:** `npm run test` and `npm run lint` final Prompt 7 invocation. Deltas compared against §AUDIT-1 Prompt-1 baseline numbers.
- **Expected:** test count meets or exceeds baseline + 6; lint count equal to baseline floor (0 regressions).
- **Action on failure:** HARD HALT at Gate 3 — baseline regression blocks exit.

### E7 — Exit report published + Gate 3 verdict recorded

- **Criterion:** `docs/audits/P4_CONCERN_4A_2_D_EXIT_REPORT.md` committed to working tree per §PROMPTS item 8. Founder Gate 3 verdict recorded in §REVISIONS (or via a separate commit message / follow-up audit entry).
- **Verification:** `ls docs/audits/P4_CONCERN_4A_2_D_EXIT_REPORT.md` returns the file; §REVISIONS contains a Gate 3 closure entry.
- **Expected:** exit report file present; Gate 3 verdict logged.
- **Action on failure:** HARD HALT at Gate 3 — exit report is the closure deliverable.

---

## §SELF-VERDICT — Claude Code discipline rubric

Claude-Code-side discipline check (distinct from §EXIT CRITERIA, which is founder-owned). Each SV item must PASS before Prompt 7 verification report is submitted for founder Gate 3 verdict. Failure of any SV blocks exit-report publication.

**SV-1 — R-1 discipline (scope-expansion-as-proposal + byte-exact OVERRIDE apply).** Every composed edit was surfaced as an explicit proposal with interpretive choices flagged before application; zero silent composition. Byte-exact founder-prescribed text applied verbatim per FLAG-26 rigor floor — no reverse-engineering of ambiguous/missing verbatim.

- **Self-check:** Audit phase reports (Batch 3 through Batch 5 S3). Each composed-edit application preceded by a "proposal + HALT + ratification" cycle; byte-exact founder OVERRIDE clauses applied verbatim.
- **Pass/fail:** PASS if all composed edits (Batch 3 B1/B2/B13/B14, Batch 4 B4-i/B4-ii/B4-iii/B4-iv, Batch 5 S1 §PROMPT 1 PREREQUISITES, Batch 5 S2 §EXIT CRITERIA, Batch 5 S3 §SELF-VERDICT) followed propose-first discipline AND every byte-exact OVERRIDE was applied verbatim. FAIL if any composed edit slipstreamed without proposal OR any OVERRIDE was reverse-engineered. **Known historical failure caught and corrected:** FLAG-26 (Batch 4 B4-iii Status line — founder prescribed "the 129-byte text above" without providing verbatim text; agent iterated python candidates to hit the 129-byte target rather than HALTing for verbatim prescription). Corrective discipline: when prescribed text is ambiguous/missing, HALT for founder pivot; never reverse-engineer alternatives.

**SV-2 — R-2 discipline (HALT on count/location/content mismatch).** Pre-edit verbatim reads matched expected state at every phase; any mismatch HALTed for ratification before proceeding.

- **Self-check:** Audit pre-edit read outputs across Batches 3-5. Mismatches (e.g., Batch 5 S2 dispatch truncation mid-5a, §OPEN-Q row-count expectations, insertion-point blank-line counts) surfaced explicitly, not silently accommodated.
- **Pass/fail:** PASS if every mismatch produced a HALT + ratification. FAIL if any mismatch was silently worked around.

**SV-3 — R-2* discipline (line-number-backed-by-grep + verification-command bash-validation + attestation machine-extraction).** Every line-number assertion backed by current-state grep, not memory; every bash-runnable verification command bash-validated against current file state pre-lock (FLAG-27); bash-validation attestations machine-extracted from directive via sed|grep|eval pipeline, never re-typed — especially whitespace-anchored regex (FLAG-29-redux).

- **Self-check:** Audit line-number citations + bash-validation attestations across phase reports. Each line-number anchored by grep; each verification command pre-validated; each post-apply attestation command extracted via sed|grep from the directive file.
- **Pass/fail:** PASS if all line numbers grep-verified at execute-time, all verification commands bash-validated pre-lock, all attestations machine-extracted. FAIL if any claim relied on stale anchor OR any command locked without bash-validation OR any attestation was re-typed. **Known historical failures caught and corrected:** FLAG-17 (Batch 3 B2 dispatch predicted DECLARE extension at L103-L104; actual L105-L106 post-v_count line); FLAG-22 (Batch 3 B14 dispatch labelled Branch/Predecessor/Peer-concerns at L7/L8/L9; actual L6/L7/L8); FLAG-25 (Batch 4 B4-iv 4b diagram numbered closing `---` at L92 using B4-iv-only +5 shift; integrated post-all-4-edits places `---` at L91 per 4d); FLAG-27 (Batch 5 S1 V4 command pre-lock bash-validation caught 4-hit form, narrowed to 2-hit type-specific regex); FLAG-29-redux (S1 post-verify V4 attestation re-typed `^  ` 2-space anchor as `^ ` 1-space — third occurrence of whitespace-normalization pattern; corrective discipline adopted at Batch 5 S2 onward: sed|grep|eval pipeline for all bash-val reports).

**SV-4 — Per-finding-HALT discipline.** Each finding received its own mini-report (pre-edit read + edit + post-edit extraction + R-3 byte-compare); phase-level HALT batched all mini-reports.

- **Self-check:** Audit phase reports for per-finding structure. Each finding has a mini-report section; phase-level HALT at end.
- **Pass/fail:** PASS if all findings got mini-reports. FAIL if any finding was bundled without individual traceability.

**SV-5 — Phase-closure residual sweep.** Each phase closed with grep-based retirement-target verification (0 hits on retired patterns).

- **Self-check:** Audit each phase's closure report for residual sweep section. Retired patterns (e.g., Batch 3 `Both wrapper(s)` plural drift, Batch 3 `auto_cancelled` DB-enum fabrication, Batch 4 `cron wrappers themselves` plural, Batch 4 `Stripe refund orchestration on cancel —` em-dash-suffixed form in §SCOPE) all returned 0 hits post-phase.
- **Pass/fail:** PASS if every phase closed residual sweep with 0 hits on retired targets. FAIL if any residual leaked past its retirement phase.

**SV-6 — R-3 byte-exact content fidelity.** Every edit's post-apply extraction byte-compared against the dispatch-ratified spec text (not against the Edit call's own `new_string` parameter per R-3 calibration lock).

- **Self-check:** Audit phase reports for R-3 byte-compare results. Each edit extraction byte-matches ratified spec.
- **Pass/fail:** PASS if all edits byte-match. FAIL if any edit drifted. **Discipline affirmed:** Batch 4 B4-iv pre-verify Draft 3.1 body draft proposed undefined term "Path α" (Phase 1 catch; re-composed to ground cross-refs in file-internal anchors only — REC-1 / §F2 / §F5). Not a post-apply drift; reaffirmed R-3 discipline that cross-ref anchors must resolve to file-defined terms.

---

**End of directive.**
