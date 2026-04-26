// ═══════════════════════════════════════════════════════════════
// Frontfiles — CounterComposerDialog (P4 concern 4A.2.C2 Prompt 5 / §F5)
//
// Native <dialog> modal for submitting a counter-offer. The parent
// component controls visibility via ref-forwarded `show()` / `close()`
// methods (no `open` prop — the native <dialog>.showModal() is the
// authoritative visibility trigger, and the parent owns it).
//
// ─── Layout ─────────────────────────────────────────────────────
//
//   - Amount input (numeric, required, > 0).
//   - Note textarea (optional, ≤ 500 chars per §SCOPE item 6).
//   - Cancel + Submit buttons.
//   - Round-limit warning + disabled submit when roundLimitReached.
//
// ─── Validation (§SCOPE item 6) ─────────────────────────────────
//
// Client-side: amount > 0, note ≤ 500 chars, counter-round cap.
// Server-side `rpc_counter_offer` is the authoritative validator
// per §D9 — these client checks are UX courtesy.
//
// Spec is silent on same-amount counters (§E5 carry-forward).
// Client accepts them as valid-but-pointless; server may reject.
//
// ─── Styling (§F9 / Canon §4.1–§4.3) ────────────────────────────
//
// Plain <dialog> + <input> + <textarea> + <button>. Black borders,
// no rounded corners, three-colour palette. Destructive maps to
// black per §D7 — no red anywhere in this file.
// ═══════════════════════════════════════════════════════════════

'use client'

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
} from 'react'

// ─── Ref handle ─────────────────────────────────────────────────

export interface CounterComposerDialogHandle {
  show(): void
  close(): void
}

export interface CounterComposerDialogProps {
  /** Fired when the user submits a valid counter. */
  onSubmit: (amount: number, note: string | null) => void
  /**
   * When `true`, the dialog shows a round-limit warning and
   * disables the submit button. The parent is the authority on
   * round count (derived from the events list).
   */
  roundLimitReached?: boolean
}

// ─── Pure validation helper (testable via vitest) ───────────────

export type CounterValidation =
  | { ok: true; amount: number; note: string | null }
  | { ok: false; error: string }

export function validateCounterInput(params: {
  amount: string
  note: string
  roundLimitReached: boolean
}): CounterValidation {
  if (params.roundLimitReached) {
    return {
      ok: false,
      error: 'Counter-round limit reached. Accept or reject.',
    }
  }
  const parsed = Number.parseFloat(params.amount)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      ok: false,
      error: 'Enter a counter amount greater than zero.',
    }
  }
  if (params.note.length > 500) {
    return {
      ok: false,
      error: 'Note must be 500 characters or fewer.',
    }
  }
  return {
    ok: true,
    amount: parsed,
    note: params.note.trim().length > 0 ? params.note : null,
  }
}

// ─── Component ──────────────────────────────────────────────────

const BUTTON_CLASS = [
  'border border-black px-4 py-2',
  'text-[10px] font-bold uppercase tracking-widest text-black',
  'hover:bg-black hover:text-white transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black',
].join(' ')

const INPUT_CLASS =
  'border border-black px-3 py-2 w-full font-mono text-sm text-black disabled:opacity-50'

const LABEL_CLASS =
  'block text-[10px] font-bold uppercase tracking-widest text-black mb-1'

export const CounterComposerDialog = forwardRef<
  CounterComposerDialogHandle,
  CounterComposerDialogProps
>(function CounterComposerDialog(props, ref): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const roundLimitReached = props.roundLimitReached ?? false

  useImperativeHandle(
    ref,
    () => ({
      show() {
        setAmount('')
        setNote('')
        setError(null)
        dialogRef.current?.showModal()
      },
      close() {
        dialogRef.current?.close()
      },
    }),
    [],
  )

  function handleSubmit(): void {
    const result = validateCounterInput({ amount, note, roundLimitReached })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    props.onSubmit(result.amount, result.note)
  }

  return (
    <dialog
      ref={dialogRef}
      className="border border-black bg-white p-6 max-w-lg"
    >
      <h2 className="text-sm font-bold uppercase tracking-widest text-black mb-4">
        Counter offer
      </h2>

      {roundLimitReached && (
        <p className="text-black text-sm font-bold mb-4">
          Counter-round limit reached. You must accept or reject — no further counters.
        </p>
      )}

      <label className="block mb-3">
        <span className={LABEL_CLASS}>Amount</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={roundLimitReached}
          className={INPUT_CLASS}
        />
      </label>

      <label className="block mb-3">
        <span className={LABEL_CLASS}>Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={roundLimitReached}
          maxLength={500}
          rows={3}
          className={`${INPUT_CLASS} font-sans`}
        />
        <span className="block text-[10px] text-black mt-1">
          {note.length} / 500
        </span>
      </label>

      {error !== null && (
        <p className="text-black text-sm font-bold mb-4">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className={BUTTON_CLASS}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={roundLimitReached}
          className={BUTTON_CLASS}
        >
          Submit counter
        </button>
      </div>
    </dialog>
  )
})
