"use client"

/**
 * Phase — role picker.
 *
 * The single top-level entry into the onboarding wizard. Renders
 * three options (creator, buyer, reader) and, on selection,
 * dispatches `SET_ROLE` and advances into the existing per-role
 * path via `onComplete`.
 *
 * ── Grant write is NOT done here ──────────────────────────────
 *
 * The DB-level grant row is written later by
 * `createOnboardingAccount` during Phase 0
 * (`src/lib/onboarding/account-creation.ts`), which needs a real
 * `user_id` from `createUser`. Picking a role here only updates
 * `state.role` so Phase 0's eventual `grantUserType` call writes
 * the correct grant type. Keeping the mutation seam untouched
 * means the picker introduces no new failure modes — the DB
 * write path is the same one Phase 0 already exercised before
 * the picker existed.
 *
 * ── Resume semantics ──────────────────────────────────────────
 *
 * The `useOnboardingFlow` hydration replay dispatches `SET_ROLE`
 * and `SET_STEP` back to the persisted mid-wizard step, so a
 * returning user who already created an account never lands on
 * the picker — they resume on their in-progress step. Persistence
 * is gated on `createdUserId`, which can only exist after a
 * successful Phase 0 submit, which in turn requires a role. So
 * any hydrated state is guaranteed to carry a role and a
 * post-picker step, and the picker is reached only by truly
 * fresh flows. This is also why the picker does not need to
 * guard against being shown to a user who already holds grants:
 * the shell never routes there in that case.
 *
 * ── goNext and closure staleness ──────────────────────────────
 *
 * `goNext` in the flow hook is memoised against
 * `state.role` + `state.currentStep`. When the picker dispatches
 * `SET_ROLE` then calls `onComplete` (which maps to `goNext`) in
 * the same event handler, the memoised closure still sees the
 * pre-dispatch `state.role = null`. React batches both dispatches
 * into a single commit, so by the time the next render happens
 * the role is set — but the step advance has to work against the
 * stale closure. It does, because every step sequence —
 * `DEFAULT_STEP_SEQUENCE` and every entry in `ROLE_STEP_SEQUENCES`
 * — starts with the same two keys, `role-picker` then `account`.
 * So "advance past `role-picker`" always means "go to `account`"
 * regardless of whether the closure sees a role or not.
 */

import { cn } from "@/lib/utils"
import type { OnboardingAction } from "@/lib/onboarding/reducer"
import type {
  OnboardingFlowState,
  OnboardingRole,
} from "@/lib/onboarding/types"

interface PhaseRolePickerProps {
  state: OnboardingFlowState
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

/**
 * Single option row in the picker.
 *
 * Copy is owned locally rather than pulled from the shared
 * `ROLE_LABELS` / `ROLE_DESCRIPTIONS` maps in `constants.ts`.
 * Those maps drive the Phase 0 role section and use a different
 * voice ("Publish certified work. Licence…"). The picker wants
 * the terser "Role — verb phrase." format, and keeping the two
 * sources separate avoids accidental cross-surface copy drift
 * when either place gets tuned later.
 */
interface RoleOption {
  role: OnboardingRole
  /** Single-line option text in the form "Role — verb phrase." */
  title: string
  /** CTA hint shown on the right side of the card. */
  cta: string
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "creator",
    title: "Creator — Upload and publish work.",
    cta: "Continue as creator",
  },
  {
    role: "buyer",
    title: "Buyer — Save, request, and manage work.",
    cta: "Continue as buyer",
  },
  {
    role: "reader",
    title: "Reader — Browse now. Upgrade to buyer later.",
    cta: "Continue as reader",
  },
]

export function PhaseRolePicker({
  state,
  dispatch,
  onComplete,
}: PhaseRolePickerProps) {
  function handlePick(role: OnboardingRole) {
    dispatch({ type: "SET_ROLE", payload: role })
    onComplete()
  }

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-black tracking-tight leading-[1.05] mb-3">
          Choose how you want to use Frontfiles
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-xl">
          You can set up a creator, buyer, or reader account now. You can
          add another role later.
        </p>
      </div>

      {/* Role options */}
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {ROLE_OPTIONS.map((option) => {
          const selected = state.role === option.role
          return (
            <li key={option.role}>
              <button
                type="button"
                onClick={() => handlePick(option.role)}
                className={cn(
                  "w-full text-left border-2 px-5 py-5 flex items-center gap-4 transition-colors",
                  selected
                    ? "border-[#0000ff] bg-[#f0f0ff]"
                    : "border-black bg-white hover:bg-slate-50",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm font-bold leading-snug",
                      selected ? "text-[#0000ff]" : "text-black",
                    )}
                  >
                    {option.title}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 whitespace-nowrap text-[#0000ff]">
                  {option.cta} →
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
