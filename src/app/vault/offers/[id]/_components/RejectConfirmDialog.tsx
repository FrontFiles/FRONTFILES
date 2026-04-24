// ═══════════════════════════════════════════════════════════════
// Frontfiles — RejectConfirmDialog (P4 concern 4A.2.C2 Prompt 5 / §F6)
//
// Native <dialog> confirmation prompt for offer rejection. Symmetric
// in structure to CounterComposerDialog (§F5) — ref-forwarded
// show() / close() methods, parent controls visibility.
//
// ─── Contents (§SCOPE item 7) ───────────────────────────────────
//
// Copy: "Reject this offer? This is terminal."
// Buttons: Cancel (closes dialog) / Confirm reject (fires onConfirm).
//
// ─── Styling (§F9 / Canon §4.1–§4.3) ────────────────────────────
//
// Plain <dialog> + <button>. Black borders, no rounded corners.
// Destructive maps to black per §D7 — no red anywhere.
// ═══════════════════════════════════════════════════════════════

'use client'

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactElement,
} from 'react'

// ─── Ref handle ─────────────────────────────────────────────────

export interface RejectConfirmDialogHandle {
  show(): void
  close(): void
}

export interface RejectConfirmDialogProps {
  /** Fired when the user clicks the confirm button. */
  onConfirm: () => void
}

// ─── Pure confirm-handler factory (testable via vitest) ─────────
//
// Keeps the callback wiring tiny + explicit so the "confirm fires
// onConfirm" unit test (§F10 / AC9) can exercise the handler path
// directly without jsdom. The component wires this into the
// <button onClick={...}> attribute.

export function buildRejectConfirmHandler(params: {
  onConfirm: () => void
  close: () => void
}): () => void {
  return () => {
    params.onConfirm()
    params.close()
  }
}

// ─── Component ──────────────────────────────────────────────────

const BUTTON_CLASS = [
  'border border-black px-4 py-2',
  'text-[10px] font-bold uppercase tracking-widest text-black',
  'hover:bg-black hover:text-white transition-colors',
].join(' ')

export const RejectConfirmDialog = forwardRef<
  RejectConfirmDialogHandle,
  RejectConfirmDialogProps
>(function RejectConfirmDialog(props, ref): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      show() {
        dialogRef.current?.showModal()
      },
      close() {
        dialogRef.current?.close()
      },
    }),
    [],
  )

  const handleConfirm = buildRejectConfirmHandler({
    onConfirm: props.onConfirm,
    close: () => dialogRef.current?.close(),
  })

  return (
    <dialog
      ref={dialogRef}
      className="border border-black bg-white p-6 max-w-lg"
    >
      <h2 className="text-sm font-bold uppercase tracking-widest text-black mb-4">
        Reject offer?
      </h2>
      <p className="text-black text-sm mb-6">
        Reject this offer? This is terminal.
      </p>
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
          onClick={handleConfirm}
          className={BUTTON_CLASS}
        >
          Confirm reject
        </button>
      </div>
    </dialog>
  )
})
