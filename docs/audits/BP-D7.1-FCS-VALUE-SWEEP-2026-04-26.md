# BP-D7.1 — FCS Fixture Value Sweep

**Status:** DRAFT — pending founder ratification before sweep executes
**Date:** 2026-04-26 (same-day follow-up to BP-D7-IMPL)
**Scope:** Bulk rename of mock fixture hash prefixes `fcs-*` → `fff-*` in two files; defer field-name rename
**Supersedes:** the deferred "BP-D7.1 — extended copy audit" follow-up note from `BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`
**Reads underlying:** `BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md`, BP-D7-IMPL commit `68e294a`

---

## 1. What this brief is

A bounded follow-up to BP-D7-IMPL. Live UI verification on 2026-04-26 found that the `Hash: fcs-d1e4f7a3` string still renders on the buyer-facing checkout page (Step 2: Review Validation Declaration). The BP-D7 audit had explicitly flagged this kind of leak as a deferred sweep — this brief converts that "if needed" into a small, mechanical, value-only sweep across the two files that are the source of every leaked `fcs-` hash.

This brief is build-governing — once ratified, the sweep is mechanical and self-verifying. The brief is NOT a structural cleanup of the trust/certification model (that belongs to BP-D5/BP-D6/canonical spec).

---

## 2. Current-state read

### 2.1 What surfaced the issue

During the BP-D7 UI walkthrough on `feat/upload-rebuild-bcef`, the checkout page (`/checkout/asset-006`, Step 2) renders:

```
Hash: fcs-d1e4f7a3
```

This is a buyer-facing string adjacent to provenance / declaration acknowledgment language — semantically loaded, visible to every paying user.

### 2.2 Where the `fcs-` strings come from

Two sources:

**Source A — literal fixture values in `src/lib/mock-data.ts` (63 occurrences):**

```
mock-data.ts:85   certificationHash: 'fcs-a7b3e9f2',
mock-data.ts:103  certificationHash: 'fcs-c4d8e1a0',
mock-data.ts:121  certificationHash: 'fcs-e2f5a8b1',
... (60 more lines, one per asset fixture)
```

These are hard-coded per-asset hash strings. Every value starts with `fcs-`.

**Source B — template-literal generators in `src/data/creator-content.ts` (2 lines):**

```
creator-content.ts:43   certificationHash: `fcs-${a.id.replace('asset-', '')}`,
creator-content.ts:107  certificationHash: `fcs-art-${a.id.replace('article-', '')}`,
```

These programmatically generate `fcs-NNN` (asset variant) and `fcs-art-NNN` (article variant) hashes from id values.

Total: **65 lines across 2 files** that need the value-only rename.

### 2.3 Where the `fcs-` strings are rendered

Five consumer surfaces read these values and display them:

| Surface | File | Line |
|---|---|---|
| Checkout — Step 2 (declaration review) | `src/app/checkout/[assetId]/page.tsx` | 281 |
| Vault transactions — line item | `src/app/vault/transactions/page.tsx` | 103 |
| Vault detail drawer — provenance section | `src/components/platform/VaultDetailDrawer.tsx` | 74–77 |
| Assignment documents panel — entry footer | `src/components/assignment/DocumentsPanel.tsx` | 629–630 |
| (Indirect) — anywhere `asset.certificationHash` is rendered | various | various |

After the sweep, all five render `fff-*` instead of `fcs-*`. No consumer change is needed — they read the field as-is.

### 2.4 What the BP-D7 audit's H-2 did NOT cover

BP-D7 audit H-2 specifically targeted lines `1414` and `1435` of `mock-data.ts`. Those were event-description fields (different from these `certificationHash` fixtures). The 63 + 2 fixture-value entries were left out of BP-D7-IMPL by design — flagged as the "BP-D7.1 follow-up" to defer.

---

## 3. Locked decisions

| # | Decision | Locked answer |
|---|---|---|
| 1 | What gets renamed | **Values only** — every `fcs-*` literal/template literal becomes `fff-*` (preserving sub-family suffixes like `-art-`) |
| 2 | What does NOT get renamed | **Field name `certificationHash`** stays. Renaming the field cascades to 20+ files (`lib/types.ts` ×2, `lib/transaction/types.ts` ×2, `lib/documents/types.ts`, `lib/fulfilment/types.ts`, stores, reducers, components, tests). Out of scope. |
| 3 | What about the `certificationHashAtCart` / `certificationHashAtGrant` / `certificationHashAtIssue` aliases? | **Unaffected.** These are field-name aliases (transaction lifecycle stages), not value sources. Keep names; values flow from sources A + B and are renamed at source. |
| 4 | What about the `fcs-art-` sub-family? | **Renamed in parallel** to `fff-art-`. Preserves the asset/article distinction in the value while sweeping the prefix. |
| 5 | What about test fixtures using `'abc123'` (special-offer/helpers.ts:24)? | **Unaffected.** Neutral test value, no `fcs-` semantics. |
| 6 | Do consumers need any change? | **No.** All consumers render `asset.certificationHash` as-is. Post-sweep, they auto-render `fff-*`. |
| 7 | Should we also rename the value generator's prefix in any future asset fixture? | **Yes** — by virtue of editing the template literal in `creator-content.ts`, all future generated assets pick up `fff-` automatically. |

---

## 4. Sweep specification

### 4.1 Exact transformations

**File 1: `src/lib/mock-data.ts`**

```
sed -E -i '' "s/certificationHash: 'fcs-/certificationHash: 'fff-/g" src/lib/mock-data.ts
```

Affects: 63 lines. Each replaces the prefix `'fcs-` with `'fff-` inside `certificationHash:` field assignments. The 8-character hash suffix after the prefix is unchanged.

**File 2: `src/data/creator-content.ts`**

```
sed -E -i '' "s/certificationHash: \`fcs-/certificationHash: \`fff-/g" src/data/creator-content.ts
```

Affects: 2 lines (43, 107). Replaces the prefix inside template literals. The `${a.id.replace(...)}` interpolation and the `art-` sub-prefix on line 107 are preserved.

After sed: line 43 reads `certificationHash: \`fff-${a.id.replace('asset-', '')}\`,` and line 107 reads `certificationHash: \`fff-art-${a.id.replace('article-', '')}\`,`.

### 4.2 Sequence

1. Run File 1 sed.
2. Run File 2 sed.
3. `git diff --stat` — expect 2 files changed, ~65 line touches.
4. `git diff src/lib/mock-data.ts | head -20` — visually verify the prefix change is the ONLY change (no accidental match elsewhere).
5. `git diff src/data/creator-content.ts` — visually verify lines 43 and 107 only.
6. `bun run test` — full vitest suite. No tests should fail (none assert on the literal `fcs-` string per the BP-D7 audit verification of the 1656-test pass).
7. Stage both files; commit with message specified in §6.

### 4.3 What's allowed to differ from the sed plan

If any line surfaces a `'fcs-` outside a `certificationHash:` field (e.g., a comment, an unrelated identifier), STOP, surface to founder, do not auto-rewrite. The sed pattern is intentionally specific to `certificationHash:` to avoid collateral renames.

---

## 5. Out of scope

| Item | Reason for deferral |
|---|---|
| Field-name rename `certificationHash` → something model-neutral (e.g., `provenanceHash`, `recordHash`) | Touches 20+ files (types, stores, reducers, components, tests). Belongs in a structural pass, likely BP-D6 territory. |
| Field-name aliases (`certificationHashAtCart`, `certificationHashAtGrant`, `certificationHashAtIssue`) | Same rationale — field-rename cascade. |
| `'fcs_layer_complete'` event type identifier in mock-data.ts (machine-readable) | Per BP-D7 audit's "follow-up flagged but NOT applied" note. Belongs in a dedicated event-type cleanup pass. |
| Email templates (`src/lib/email/templates/`) | Per BP-D7 audit. Needs a dedicated email copy audit; off-DOM surface. |
| Legal pages (terms, privacy, AI processing, creator agreement) | Per BP-D7 audit. Needs counsel-led revision. |
| Marketing site / landing page / public docs | Out of `src/`. Separate workstream. |

---

## 6. Verification

### 6.1 Code-level

- `git grep "'fcs-"` — should return ZERO occurrences in source files (excluding docs/audits/, which is allowed to reference the historical name)
- `git grep "fcs-"` excluding `docs/audits/` — should return ZERO source occurrences
- `bun run test` — full suite passes with no regressions

### 6.2 Visual (founder-driven)

After commit, with dev server running on `localhost:3000`:

| Surface | Expected after sweep |
|---|---|
| `/checkout/[assetId]` Step 2 | `Hash: fff-*` instead of `fcs-*` |
| `/vault/transactions` line item | `Hash: fff-*` |
| `/vault/[handle]` detail drawer | `fff-*` in provenance section |
| Assignment documents panel | `fff-*` in entry footer |

(Same verification can be batched into the BP-D7 walkthrough that already happened; do once after this commit lands.)

---

## 7. Commit message (proposed)

```
chore(brand-protocol): BP-D7.1 — sweep fcs- fixture value prefixes to fff-

Follow-up to BP-D7-IMPL (commit 68e294a). UI verification on 2026-04-26
found Hash: fcs-d1e4f7a3 still rendering on the buyer-facing checkout
page (Step 2: Review Validation Declaration), adjacent to provenance
acknowledgment language.

Per BP-D7 audit's deferred "BP-D7.1 — extended copy audit" follow-up
note. Sweeps the 65 fixture-value sources of fcs-* hash strings to
fff-*. Renames are value-only — field name `certificationHash`
unchanged (rename cascades to 20+ files; deferred to BP-D6 territory).

Files affected:
- src/lib/mock-data.ts — 63 literal fcs-* values renamed
- src/data/creator-content.ts — 2 template literals (asset and
  article variants) renamed; 'fcs-art-' becomes 'fff-art-'

Consumers (checkout, vault transactions, vault detail drawer,
assignment documents panel) render the field as-is and pick up the
new prefix automatically. No consumer code change.

Tests: full vitest suite passes (1,656 tests, 30 skipped). No tests
assert on the literal 'fcs-' string.

Out of scope (per §5 of BP-D7.1 brief):
- Field-name rename (certificationHash → ...)
- Field-name aliases (certificationHashAt{Cart,Grant,Issue})
- 'fcs_layer_complete' event type identifier
- Email templates, legal pages, marketing site

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. Approval gate

Before sweep executes:
- §3 locked decisions stand
- §4 transformation is exactly as specified
- §5 out-of-scope items stay deferred
- §6 verification will run

If any of these is wrong, push corrections back. Otherwise reply `ratify BP-D7.1` and I run sweep + tests + commit.

---

## 9. Don't-do list

1. **Don't rename the field name** in this pass. Even if it looks like a one-line change, it cascades to 20+ files and breaks tests.
2. **Don't widen the regex** to match `fcs-` outside `certificationHash:`. The sed is intentionally specific. If a non-fixture `fcs-` exists elsewhere (e.g., a code comment, another identifier), surface it before renaming.
3. **Don't update consumer files** (checkout page, vault drawer, etc.) — they read the field as-is and don't need any code change.
4. **Don't rename the `_layer_complete` event identifier** — that's a separate event-type cleanup pass.
5. **Don't sweep the `'abc123'` test fixture** in `special-offer/__tests__/helpers.ts` — it's a neutral test value with no `fcs-` semantics.

---

End of BP-D7.1 brief.
