// ═══════════════════════════════════════════════════════════════
// RejectConfirmDialog — pure-helper + render tests (§R6-pure / §F10)
//
// 1 test case per §F10 / AC9: confirm fires onConfirm. The handler
// factory `buildRejectConfirmHandler` is exported so the callback
// wiring can be unit-tested directly without jsdom; the render
// assertions confirm the structural integrity (copy + button).
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

import {
  RejectConfirmDialog,
  buildRejectConfirmHandler,
} from '../RejectConfirmDialog'

describe('RejectConfirmDialog — confirm fires handler (AC9)', () => {
  it('renders the §SCOPE-7 copy and buttons, and the handler factory forwards to onConfirm + close (bundled)', () => {
    // Sub-assertion (a) — structural render.
    const html = renderToString(<RejectConfirmDialog onConfirm={() => {}} />)
    expect(html).toContain('Reject this offer? This is terminal.')
    expect(html).toContain('>Cancel<')
    expect(html).toContain('>Confirm reject<')

    // Sub-assertion (b) — handler factory wires onConfirm + close
    // in that order. This is the AC9 "confirm click before firing"
    // behaviour — tested at the pure-helper layer per §R6.
    const onConfirm = vi.fn()
    const close = vi.fn()
    const handler = buildRejectConfirmHandler({ onConfirm, close })

    // Pre-invocation — neither fn has been called.
    expect(onConfirm).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()

    handler()

    // Post-invocation — both called exactly once, onConfirm first.
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    // Ordering: onConfirm invoked before close.
    const onConfirmCallOrder = onConfirm.mock.invocationCallOrder[0]
    const closeCallOrder = close.mock.invocationCallOrder[0]
    expect(onConfirmCallOrder).toBeLessThan(closeCallOrder)
  })
})
