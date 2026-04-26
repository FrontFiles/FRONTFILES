// ═══════════════════════════════════════════════════════════════
// CounterComposerDialog — pure-helper + render tests (§R6-pure / §F10)
//
// 3 test cases per §F10: valid input / invalid input / round-limit
// warning. `validateCounterInput` is tested directly; the rendered
// HTML is asserted for structural + disabled-state behaviour.
// ═══════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'

import {
  CounterComposerDialog,
  validateCounterInput,
} from '../CounterComposerDialog'

const noop = (): void => {}

describe('validateCounterInput — valid input (AC7)', () => {
  it('accepts a positive numeric amount and keeps the note verbatim', () => {
    const result = validateCounterInput({
      amount: '150.50',
      note: 'Reframed for print-only scope.',
      roundLimitReached: false,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.amount).toBe(150.5)
      expect(result.note).toBe('Reframed for print-only scope.')
    }
  })
})

describe('validateCounterInput — invalid input (AC7 negative path)', () => {
  it('rejects zero, negative, non-numeric, and over-500-char note (bundled per IP-3)', () => {
    // Sub-assertion (a) — zero.
    const resultZero = validateCounterInput({
      amount: '0',
      note: '',
      roundLimitReached: false,
    })
    expect(resultZero.ok).toBe(false)
    if (!resultZero.ok) {
      expect(resultZero.error).toContain('greater than zero')
    }

    // Sub-assertion (b) — negative.
    const resultNegative = validateCounterInput({
      amount: '-5',
      note: '',
      roundLimitReached: false,
    })
    expect(resultNegative.ok).toBe(false)

    // Sub-assertion (c) — non-numeric.
    const resultNaN = validateCounterInput({
      amount: 'abc',
      note: '',
      roundLimitReached: false,
    })
    expect(resultNaN.ok).toBe(false)

    // Sub-assertion (d) — note length > 500 chars.
    const resultLongNote = validateCounterInput({
      amount: '100',
      note: 'x'.repeat(501),
      roundLimitReached: false,
    })
    expect(resultLongNote.ok).toBe(false)
    if (!resultLongNote.ok) {
      expect(resultLongNote.error).toContain('500 characters')
    }
  })
})

describe('CounterComposerDialog — round-limit warning render', () => {
  it('renders the warning copy and disables inputs + submit when roundLimitReached=true', () => {
    const html = renderToString(
      <CounterComposerDialog onSubmit={noop} roundLimitReached />,
    )

    // Warning copy — byte-match §SCOPE item 6 intent.
    expect(html).toContain('Counter-round limit reached')
    expect(html).toContain('no further counters')

    // Submit button exists and carries the disabled HTML attribute.
    expect(html).toContain('>Submit counter<')
    // React 19 renders boolean disabled as `disabled=""`; Tailwind
    // classes use `disabled:` with a colon (never `disabled=""`).
    expect(html).toContain('disabled=""')

    // validateCounterInput also refuses input when the flag is set,
    // so we confirm that path is consistent with the render behaviour.
    const guard = validateCounterInput({
      amount: '100',
      note: 'ok',
      roundLimitReached: true,
    })
    expect(guard.ok).toBe(false)
    if (!guard.ok) {
      expect(guard.error).toContain('Counter-round limit reached')
    }
  })
})
