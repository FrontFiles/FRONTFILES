# FONT_LOADING_CONCERN — Neue Haas Grotesk loading + licensing

**Status:** DRAFT 1, 2026-04-24. Registered from C2 Prompt 6 Q3 gate (Option A ratified — inherit current `font-sans → Inter` stack; defer NHG wiring here).
**Owner:** platform-wide (not scoped to any P4 concern).
**Blocks:** `§UI_DESIGN_GATE` criterion 7 typography sub-clause across every UI concern that inherits Design Canon.

---

## §CONTEXT

The Frontfiles Design Canon (`PLATFORM_BUILD.md` L14, `AGENTS.md` §Design Canon, `.claude/agents/frontfiles-context.md` L83, `docs/audits/DESIGN_LAYOUT_SESSION_PROMPT.md` L152) mandates **Neue Haas Grotesk Display / Text** as the single allowed display/text font. The `P4_CONCERN_4A_2_C2_DIRECTIVE.md §UI_DESIGN_GATE` criterion 7 explicitly names the "Neue Haas font stack" as a binding requirement for `/vault/offers/[id]`.

Current repo state diverges:

- `src/app/globals.css:10` — `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
- Zero `Neue Haas` / `neue-haas` hits in any `.ts` / `.tsx` / `.css` source file.
- No `@font-face` declaration for Neue Haas anywhere in the repo.
- No `next/font/local` loader wired up in `src/app/layout.tsx`.

Every UI surface that uses `className="font-sans"` (list, detail, composer, dialogs, OfferActions — every offer surface + every other platform surface) today renders in **Inter**, not Neue Haas.

This drift is **pre-existing** — `git blame -L 10,10 src/app/globals.css` attributes the Inter stack to the initial `globals.css` commit. It predates the offers workstream. No P4 concern created it; no P4 concern can close it without a dedicated licensing + wiring pass.

## §SCOPE

In scope:

1. **License procurement.** Neue Haas Grotesk Display + Text (weights needed: 400, 500, 600, 700 at minimum; confirm during Phase 0). Sources: Linotype / Monotype direct, or equivalent licensed channel. Self-hosted license required (no CDN-only terms — `next/font/local` needs static files).
2. **Font asset check-in.** `.woff2` / `.woff` variants committed under `src/app/fonts/` (or equivalent). Licence file committed alongside, cross-linked from `PLATFORM_BUILD.md`.
3. **`next/font/local` wiring.** Register the faces in `src/app/layout.tsx`. Bind the loader's CSS variable to `--font-sans` in `src/app/globals.css` (replace the Inter-first stack).
4. **Fallback discipline.** The native-font fallback chain should keep the x-height close to NHG's (e.g., `Arial, Helvetica` — NOT `Georgia`). Specify the fallback stack explicitly in the `src/app/globals.css` declaration.
5. **Mono + heading cleanup.** `--font-mono` currently points at `'SF Mono', 'Fira Code', 'Fira Mono'`. Confirm whether Frontfiles ships a paired mono face (Canon doesn't specify one) or whether `font-mono` should stay on the current stack. `--font-heading` currently aliases `--font-sans` — validate this is still the intent post-NHG.
6. **Grep sweep.** Every `className="font-sans"` / `font-heading` usage inherits the change automatically once `--font-sans` is re-bound. No per-component edits needed. Sanity-grep to confirm.
7. **Design Canon re-lock.** Once landed, amend `PLATFORM_BUILD.md` § Design System Lock to point at the bound faces; close the §UI_DESIGN_GATE criterion 7 typography sub-clause platform-wide.

Out of scope:

- Per-surface typography overrides (Canon denies bespoke fonts).
- Display-variant specifics (headlines-vs-body — unless NHG licensing requires separating Display + Text faces, which it typically does).
- Migrating existing surfaces away from `font-sans` (they inherit the change).

## §NON-SCOPE — explicit denials

| Request | Refusal reason |
|---|---|
| "Use Google Fonts' Inter as the platform font" | Canon denies Inter. Inter is the pre-existing drift this concern closes. |
| "Host NHG on a CDN and load via `@font-face` URL" | Licensing typically forbids CDN distribution. Self-host. |
| "Add a per-surface font override for a specific component" | Canon is single-font. Overrides are not a resolution path. |

## §AC — Acceptance criteria

| # | Criterion | Verification |
|---|---|---|
| AC1 | NHG licence committed + cross-linked from `PLATFORM_BUILD.md` | `ls src/app/fonts/LICENSE*` returns non-empty AND `grep -n "fonts/LICENSE" PLATFORM_BUILD.md` returns at least one hit |
| AC2 | NHG `.woff2` files committed under `src/app/fonts/` | `ls src/app/fonts/*.woff2` non-empty |
| AC3 | `next/font/local` wired in `src/app/layout.tsx` | `grep -n "next/font/local" src/app/layout.tsx` returns a hit |
| AC4 | `--font-sans` bound to the NHG variable | `grep -n "Neue Haas" src/app/globals.css` returns a hit AND `grep -nE "^\\s*--font-sans:" src/app/globals.css` shows the bound variable, not the Inter-first literal |
| AC5 | No source file references `Inter` as the primary font | `grep -rnE "Inter['\"]" src/app/globals.css src/app/layout.tsx` returns zero |
| AC6 | Build clean + test suite unchanged + no visual regressions on a manual check of 3 canonical surfaces (feed / offer detail / composer) | CI + manual QA |
| AC7 | `PLATFORM_BUILD.md` Design System Lock amended to reference the shipped loader path | `grep -n "src/app/fonts" PLATFORM_BUILD.md` non-empty |
| AC8 | §UI_DESIGN_GATE criterion 7 typography sub-clause closed platform-wide | Amendment line in each directive that cites Canon typography, OR a single doc declaring closure |

## §PROMPTS — execution sequence

| # | Title | Output | LoC est. |
|---|---|---|---|
| 0 | **Licensing scope** — confirm weights, count of faces (Display + Text × weights), licence type (self-host perpetual OR subscription), budget | founder decision memo | 0 |
| 1 | **Asset check-in** — add licensed `.woff2` files + `LICENSE` + any `.woff` fallback under `src/app/fonts/` | commit w/ binary files | ~0 LoC code |
| 2 | **Loader wiring** — `next/font/local` in `layout.tsx` + `--font-sans` bind in `globals.css` | code edits | ~40 LoC |
| 3 | **Verify** — `bun run build` + visual QA on feed / offer detail / composer / asset detail | exit report | 0 |
| 4 | **Canon amendment** — update `PLATFORM_BUILD.md` Design System Lock + close §UI_DESIGN_GATE criterion 7 typography sub-clause in affected directives | doc edits | ~30 LoC |

## §APPROVAL GATES

- **Gate 0 (now):** founder decision on licensing source + budget. Until Gate 0 closes, this concern sits in DRAFT 1 status and cannot be scheduled.
- **Gate 1:** after Prompt 1 — asset check-in verified (files present, licence legitimate).
- **Gate 2:** after Prompt 3 — visual QA confirms NHG rendering on canonical surfaces; no regressions.
- **Gate 3:** after Prompt 4 — Canon amendments complete; concern closable.

## §OPEN-Q — founder decisions owed before Gate 0 closes

| # | Question | Options |
|---|---|---|
| 1 | Licence source | Linotype direct / Monotype direct / reseller / alternate channel |
| 2 | Variant count | Display + Text both? Or Display only (current Canon wording ambiguous — `.claude/agents/frontfiles-context.md` L83 says "Display / Text" implying both) |
| 3 | Weights | 400 / 500 / 600 / 700 as baseline — plus italic? |
| 4 | Fallback stack | Arial / Helvetica / system-ui — need to match NHG x-height closely |
| 5 | Mono face | Keep `SF Mono, Fira Code, Fira Mono` (current), or adopt a licensed mono paired with NHG? |
| 6 | Budget cap | Licensing budget ceiling (informs #1) |

## §REFERENCES

- `PLATFORM_BUILD.md` §Design System Lock — typography binding.
- `AGENTS.md` §Design Canon — Canon reference.
- `.claude/agents/frontfiles-context.md` L83 — typography note.
- `docs/audits/DESIGN_LAYOUT_SESSION_PROMPT.md` L152 — Canon restatement.
- `docs/audits/P4_CONCERN_4A_2_C2_DIRECTIVE.md` §UI_DESIGN_GATE criterion 7 — typography sub-clause (currently yellow).
- `src/app/globals.css:10` — current Inter-first `--font-sans` drift.
- Next.js `next/font/local` API — <https://nextjs.org/docs/app/api-reference/components/font>

---

**Registered:** 2026-04-24 from P4 C2 Prompt 6 Q3 gate ratification (Option A).
**End of directive.**
