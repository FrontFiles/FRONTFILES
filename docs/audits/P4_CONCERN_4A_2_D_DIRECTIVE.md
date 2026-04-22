# P4 Concern 4A.2.D — Offer auto-expire + auto-cancel cron (pg_cron)

**Status:** DRAFT 1, 2026-04-22 — awaiting founder verdict at Gate 0
**Branch:** `feat/p4-offers-d-cron` (to be cut from `main` at Gate 0 approval)
**Predecessor:** P4 Concern 4A.2.B1 (F-RPC catalogue — `rpc_expire_offer` shipped) — closed implicitly at B1 merge; B1 directive L834 documents the deferral of cron wiring to D.
**Peer concerns (parallel):** 4A.2.C1 (list UI), 4A.2.C2 (detail + mutation UI)
**Successor:** 4A.2.C — legacy `/api/special-offer/*` retirement (directive: `P4_UI_DEPRECATION_AUDIT.md` Draft 2, Gate 3 approved 2026-04-22).

---

## §CONTEXT

Part B1 (4A.2.B1) shipped the `rpc_expire_offer` PL/pgSQL RPC alongside the accept/counter/reject/cancel/create RPCs, but deliberately deferred cron wiring to a separate concern — see `P4_CONCERN_4A_2_B1_DIRECTIVE.md` §scope item 4 ("cron deferred to Part D"). Part B1 directive L834 also deferred `GET /api/offers` list endpoint to C1. `PLATFORM_REVIEWS.md` §D-SO1 locks the cron authority: *"Supabase `pg_cron` job transitions expired offers."* The cron job is the single non-UI moving part needed for offer-surface completeness before the 4A.2.C retirement.

**What D owns.** The pg_cron schedule definition. The wrapper function that invokes `rpc_expire_offer` on the right cadence. Idempotency + backfill + observability hooks. A backstop scheduled worker contract for auto-cancel on asset-state change (per `ECONOMIC_FLOW_v1.md` §7.7 auto-cancel triggers). A ledger-events sanity check that confirms cron-driven state transitions emit the correct `offer.expired` and `offer.auto_cancelled` events.

**What D does NOT own.** Any UI affordance — list surface (**C1**), detail surface (**C2**). User-initiated expiry (does not exist — expiry is system-driven). Stripe capture scheduling (follows accept, not expire). Assignment or dispute cron — **4A.3 / 4A.4**. The `FFF_AUTH_WIRED` / `FFF_ECONOMIC_V1_UI` flags — cron runs regardless of UI-facing flag state because expired offers must terminate for data-integrity reasons even if no UI is visible (see §D5).

**Governance anchors.**
- `ECONOMIC_FLOW_v1.md` §4 (offer state machine — `expired` and `auto_cancelled` terminals), §4.3 (terminal-state event ordering), §7.7 (auto-cancel triggers on underlying-asset state change — privacy flip, declaration retirement, exclusive lock, pricing change), §F16 (platform-fee rate-lock — separate from auto-expire but relevant to RPC idempotency).
- `SPECIAL_OFFER_SPEC.md` §3 (response-window default + ceiling), §11 (cancellation mechanics).
- `PLATFORM_REVIEWS.md` §D-SO1 — cron authority lock.
- `P4_CONCERN_4A_2_B1_DIRECTIVE.md` (RPC body for `rpc_expire_offer` + the UNIQUE prev-hash index that serves as the ledger-chain retry primitive).
- `P4_CONCERN_4A_2_DIRECTIVE.md` §D12 (cron scope deferral to D), L120 ("cron for `offer.expired` is deferred to the Part D directive"), L1219 (founder gate on D14).

---

## §SCOPE

In scope:

1. **Supabase `pg_cron` extension enablement.** Migration that enables the `pg_cron` extension on the target database if not already present. Guarded with `CREATE EXTENSION IF NOT EXISTS pg_cron;` + a guard block that no-ops if `pg_cron` is already installed.
2. **`cron.offer_expire_tick` wrapper function.** New PL/pgSQL function that enumerates offers with `state IN ('pending', 'countered') AND expires_at < now()` and invokes `rpc_expire_offer` for each. Written as a thin orchestrator so the retry + hash-chain concerns live inside `rpc_expire_offer` (B1 contract), not duplicated here.
3. **`cron.offer_expire_tick` schedule.** A `SELECT cron.schedule(...)` migration that runs the tick every **60 seconds**. Rationale: offers carry `expires_at` at minute-precision; a 60s cadence is the tightest schedule that preserves observable-timeliness without pg_cron queue contention. Adjustable post-launch via a single migration.
4. **`cron.offer_auto_cancel_tick` wrapper function.** New PL/pgSQL function driven by *triggers on asset privacy / declaration / exclusive / price change* per `ECONOMIC_FLOW_v1.md` §7.7. On a qualifying asset mutation, enumerate all `state IN ('pending', 'countered')` offers for that asset and invoke `rpc_cancel_offer` with `reason = 'auto_cancelled'`. This is **trigger-driven**, not scheduled — the function is installed, but fires from ASSET_UPDATE row triggers, not a cron schedule. Including it under D because the auto-cancel event-emission logic mirrors auto-expire and the two should ship together.
5. **Idempotency proofs.** Both wrapper functions are written to be re-entrant — if two cron ticks land on the same offer within the same second (extreme edge), the second one is a no-op because `rpc_expire_offer` hard-gates on `state NOT IN ('expired', 'cancelled', 'auto_cancelled', 'accepted', 'rejected')` inside a `FOR UPDATE` row lock. Migration includes a regression test that asserts this.
6. **Backfill migration.** A one-time `SELECT cron.offer_expire_tick();` invocation inside the same migration that creates the schedule — catches any offers that expired between Part B1 deploy and the cron schedule activation. Called **after** the schedule is installed so late arrivals are not missed by the backfill.
7. **Ledger observability.** Both wrappers write a single `ledger_events` row per state transition via `rpc_expire_offer` / `rpc_cancel_offer` — no new ledger rows from the wrappers themselves. Verification test reads `ledger_events` post-tick and asserts event shape matches `ECONOMIC_FLOW_v1.md` §8.1 for `offer.expired` / `offer.auto_cancelled`.
8. **Operational readout function.** `cron.offer_expire_readout()` — read-only function returning the last 24 hours of tick timestamps + number of rows processed per tick. Serves as a basic oncall surface while Sentry/PostHog (per `INTEGRATION_READINESS.md` D3/D4) is still being wired up.
9. **Tests.** Migration tests (pg-embedded Vitest harness per repo convention — `src/lib/db/__tests__/migrations/`). ~12 new cases across two new test files.

Out of scope (enforced at review):

- UI affordances showing "expiring soon" / "expired" — C1 / C2 render these from the state-enum chip. D does not touch the UI.
- Stripe refund orchestration on cancel — cancellation refund flow is a separate concern; `rpc_cancel_offer` emits the event but the refund execution belongs to a checkout-UI / payment-ops concern.
- Cross-concern auto-cancel rules (e.g., pending assignment cancels a related offer) — **4A.3 / 4A.4**.
- Dispute-triggered auto-cancel — **4A.4**.
- Retry-on-failure for the cron wrappers themselves — `pg_cron` already retries failed job runs; the B1 RPCs handle row-level retry via the UNIQUE prev-hash advisory pattern.
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

---

## §REVISIONS

(None yet — directive is Draft 1.)

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
  v_count INTEGER := 0;
BEGIN
  FOR v_offer_id IN
    SELECT id FROM public.offers
    WHERE state IN ('pending', 'countered')
      AND expires_at < now()
    ORDER BY expires_at ASC
    LIMIT 500  -- cap per tick to bound lock duration
  LOOP
    PERFORM public.rpc_expire_offer(v_offer_id);
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
- Per-row `PERFORM rpc_expire_offer(v_offer_id)` — not batched. B1's `rpc_expire_offer` already gates on state + row lock; we honor that contract.

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

### §F4 — `cron.offer_auto_cancel_for_asset(v_asset_id UUID)` wrapper

**File:** `supabase/migrations/20260423000003_offer_auto_cancel.sql` (new).

```sql
CREATE OR REPLACE FUNCTION cron.offer_auto_cancel_for_asset(v_asset_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_offer_id IN
    SELECT o.id FROM public.offers o
    JOIN public.offer_assets oa ON oa.offer_id = o.id
    WHERE oa.asset_id = v_asset_id
      AND o.state IN ('pending', 'countered')
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    PERFORM public.rpc_cancel_offer(v_offer_id, 'auto_cancelled');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Trigger: privacy flip on asset
CREATE OR REPLACE FUNCTION cron.trg_offer_auto_cancel_on_asset_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.privacy IS DISTINCT FROM OLD.privacy
      OR NEW.declaration_state IS DISTINCT FROM OLD.declaration_state
      OR NEW.exclusive_tier IS DISTINCT FROM OLD.exclusive_tier
      OR NEW.creator_price IS DISTINCT FROM OLD.creator_price) THEN
    PERFORM cron.offer_auto_cancel_for_asset(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER offers_auto_cancel_on_asset_update
AFTER UPDATE ON public.vault_assets
FOR EACH ROW
EXECUTE FUNCTION cron.trg_offer_auto_cancel_on_asset_change();
```

**Design notes:**
- `SKIP LOCKED` — if another txn is already cancelling an offer on the same asset, skip and move on; avoids double-cancel attempts and deadlocks.
- Four trigger dimensions match `ECONOMIC_FLOW_v1.md` §7.7 exactly: privacy, declaration state, exclusive tier, pricing.
- Trigger lives in the `cron` schema for colocation with the wrapper; could also live in `public` — §OPEN-Q1 captures this.

**LoC budget:** ~80 LoC migration + ~250 LoC test.

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
- `src/lib/db/__tests__/migrations/offer_expire_tick.test.ts` (new) — ~6 cases:
  1. Tick with zero expired offers returns 0.
  2. Tick with N expired offers transitions all N to `expired` and returns N.
  3. Tick is idempotent: second invocation immediately after returns 0.
  4. Tick cap at 500 — more than 500 expired offers → first tick returns 500, second returns the remainder.
  5. Tick does not touch `state = 'accepted'` offers even if `expires_at < now()`.
  6. Each transition emits one `ledger_events` row with `event_type = 'offer.expired'`.
- `src/lib/db/__tests__/migrations/offer_auto_cancel.test.ts` (new) — ~6 cases:
  1. Privacy flip PUBLIC → PRIVATE cancels pending offers on that asset.
  2. Declaration retirement cancels pending offers.
  3. Exclusive tier change cancels pending offers.
  4. Pricing change cancels pending offers.
  5. Accepted offers are not cancelled.
  6. Each cancel emits one `ledger_events` row with `event_type = 'offer.auto_cancelled'` and `reason = 'auto_cancelled'`.

**Test baseline.** Prompt 1 captures post-SCAFFOLD + post-C1-if-merged + post-C2-if-merged baseline.

### §F7 — RLS + privilege audit

Both new functions are `SECURITY DEFINER` and run in the `cron` schema. §F1 grants `USAGE ON SCHEMA cron TO service_role`. `cron.offer_expire_readout()` is granted to `authenticated` (any signed-in user can read their own tick stats for debugging; the function reads only job metadata, not offer rows — no RLS leak). `cron.offer_expire_tick()` and `cron.offer_auto_cancel_for_asset()` remain ungranted to non-admins.

---

## §AC — Acceptance criteria (for exit report)

| # | Criterion | Verification |
|---|---|---|
| AC1 | `pg_cron` extension is enabled | `SELECT * FROM pg_extension WHERE extname = 'pg_cron'` |
| AC2 | `cron.offer_expire_tick` function exists and returns INTEGER | `\df cron.offer_expire_tick` |
| AC3 | `offer-expire-tick` job is scheduled at 1/min | `SELECT * FROM cron.job WHERE jobname = 'offer-expire-tick'` |
| AC4 | `cron.offer_auto_cancel_for_asset` function exists | `\df cron.offer_auto_cancel_for_asset` |
| AC5 | `offers_auto_cancel_on_asset_update` trigger exists on `vault_assets` | `\d vault_assets` trigger section |
| AC6 | `cron.offer_expire_readout` function exists and is grantable to `authenticated` | `\df cron.offer_expire_readout` |
| AC7 | Pending offers with `expires_at < now()` transition to `expired` after one tick | test |
| AC8 | Accepted offers with `expires_at < now()` remain `accepted` (no touch) | test |
| AC9 | Privacy / declaration / exclusive / price change cancels pending offers on that asset | test |
| AC10 | Each auto-expire emits exactly one `offer.expired` ledger event | test |
| AC11 | Each auto-cancel emits exactly one `offer.auto_cancelled` ledger event | test |
| AC12 | Cap of 500 per tick honored | test |
| AC13 | Backfill one-shot invocation inside the schedule migration catches offers expired pre-schedule | test |
| AC14 | Vitest baseline ≥ floor + 12 new cases, 0 failing | `npm run test` |
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
- **§D4.** **RPC contracts are B1-authoritative.** D calls `rpc_expire_offer` and `rpc_cancel_offer` but does not modify them. Any required change to those RPCs is a B1 revision, not a D scope expansion.
- **§D5.** **Cron runs regardless of UI flag state.** `FFF_ECONOMIC_V1_UI` and `FFF_AUTH_WIRED` gate the UI; they do not gate data-integrity operations. An offer must expire on schedule even if the UI is flag-off. This is the explicit rationale for keeping cron scope separate from UI.
- **§D6.** **Trigger-driven auto-cancel, not scheduled.** The asset-change trigger fires inline with the asset mutation txn. Scheduling a separate cron to enumerate all assets and check for change-out-of-band is wasteful and racy; trigger wins.
- **§D7.** **SKIP LOCKED on the auto-cancel loop.** Explicit; prevents deadlocks when an asset is being mutated concurrently with an offer being accepted.
- **§D8.** **No UI touch.** Any file under `src/app/**` or `src/components/**` modified by D fails the exit gate. If UI reveals a cron bug, the fix lives in the backend.
- **§D9.** **Idempotency is migration-authoritative.** Both wrappers can be re-run without side effect beyond the expected state transitions. Tests assert this; a new migration that breaks idempotency is a blocking regression.
- **§D10.** **Readout function is debug-grade, not production monitoring.** `cron.offer_expire_readout()` is the v1 oncall stub. Production monitoring wires through Sentry/PostHog per `INTEGRATION_READINESS.md` D3/D4 — that wiring is not D's scope.

---

## §PROMPTS — execution sequence

| # | Title | Output | LoC est. |
|---|---|---|---|
| 1 | **Pre-flight audit** — capture baseline; confirm `rpc_expire_offer` + `rpc_cancel_offer` are present on `main`; confirm `pg_cron` availability on the target Supabase project. | `§AUDIT-1` appended. | 0 |
| 2 | **`pg_cron` enablement migration** | migration | ~10 |
| 3 | **`cron.offer_expire_tick` + test** | migration + test | ~220 |
| 4 | **Schedule + backfill migration** | migration | ~15 |
| 5 | **`cron.offer_auto_cancel_for_asset` + trigger + test** | migration + test | ~330 |
| 6 | **`cron.offer_expire_readout` + grant** | migration | ~25 |
| 7 | **Verification pass** — full test suite + migration replay on a fresh DB + `cron.job` inspection | text-only report | 0 |
| 8 | **Exit report** — mirror SCAFFOLD exit structure | new doc `P4_CONCERN_4A_2_D_EXIT_REPORT.md` | ~200 |

**Total LoC budget:** ~800 (migration-heavy; test mass ~70 %).

**Total prompts:** 8. Wall-clock estimate: 2-3 days solo, verdicts within ~2 hours.

---

## §APPROVAL GATES

- **Gate 0 (now):** founder verdict on this directive.
- **Gate 1:** after Prompt 1 — if `pg_cron` is unavailable on the target Supabase project (Free tier limitation, for example), pause and escalate. `PLATFORM_REVIEWS.md` D-SO1 assumes availability; if that assumption breaks, the scope is re-evaluated against an external-worker fork that stays minimal.
- **Gate 2:** after Prompt 5 — if `vault_assets` table lacks the four columns referenced in the trigger (`privacy`, `declaration_state`, `exclusive_tier`, `creator_price`), pause and reconcile against the canonical schema at `supabase/migrations/20260421000004_economic_flow_v1_ddl.sql`. If names differ, the trigger body adapts — but column absence is a signal that the schema isn't fully landed and D should wait.
- **Gate 3:** after Prompt 7 — verification pass on a fresh DB must show migrations apply cleanly, schedule installs, tick runs, and the 12 test cases pass.

---

## §OPEN-Q — founder decisions owed before Gate 0 closes

| # | Question | Options |
|---|---|---|
| 1 | Trigger function schema location | `cron.trg_…` (colocated with wrappers) vs `public.trg_…` (colocated with the table). Propose: `cron` per §F4; alternative is `public`. |
| 2 | Per-tick cap at 500 | Accept? Or tune lower (250) / higher (1000)? |
| 3 | Schedule cadence at 1/min | Accept? |
| 4 | Backfill inside the schedule migration vs separate one-shot | Inline backfill proposed per §F3; alternative is a separate migration file that can be replayed standalone. |
| 5 | Readout function grant to `authenticated` | Accept? Alternative is grant to `service_role` only. |
| 6 | Migration timestamp prefix | `20260423000000` proposed (after all pre-existing `20260421000xxx` B1 migrations). Accept? |
| 7 | Sequencing vs C1 / C2 / 4A.2.C | Propose: strict parallel with C1/C2 (disjoint file sets — D is backend-only); D merges before 4A.2.C so the legacy `/api/special-offer/*` retirement can assume the cron is authoritative for expiry. Accept? |

---

**End of directive.**
