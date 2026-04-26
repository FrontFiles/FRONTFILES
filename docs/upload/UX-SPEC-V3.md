# Vault Upload — UX Spec v3 (Phase C C1)

**Status:** DRAFT — awaiting founder ratification before C2 (new shell + state) composes
**Date:** 2026-04-26
**Predecessor:** `docs/upload/UX-BRIEF.md` v3 (locks the model); `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 (locks the price field source)
**Scope:** Concrete component specification for the new single-screen `/vault/upload` UI. Defines layout, component shapes, interaction patterns, AI proposal surfacing, exception model, and density-mode transitions at sufficient depth to govern C2–C6 implementation directives without further architectural decisions.
**Aesthetic:** Per CLAUDE.md item 13 — brutalist-leaning black / Frontfiles blue (#0000FF) / white. Strong graphic clarity. Minimal fluff. No generic SaaS gradients, no decorative noise. Restraint is the design principle.

---

## 1. What this spec is

This document is the implementation-governing specification for Phase C of the upload rebuild. It assumes UX-BRIEF v3 §4 (the UI model) is ratified and translates that model into concrete components, layouts, and interactions at the level of detail required for engineering composition.

It does NOT cover:
- The data layer (lives in `v2-types.ts`; preserved per UX-BRIEF v3 §4.7)
- The reducer action set (defined in C2 directive, derived from this spec's interactions)
- The AI suggestion pipeline shape (governed by Phase E architecture brief, not yet drafted)
- The price engine internals (governed by `PRICE-ENGINE-BRIEF.md` v3; this spec specifies the price field's UI behavior, not the engine's calculation)
- Visual design at the pixel level (Tailwind classes are illustrative; the actual visual treatment is determined during C2–C6 by referring to FF Design Canon)

If a later directive proposes a structure that contradicts §3 (layout) or §6 (density modes) or §8 (AI proposal surfacing) or §10 (exception model), the directive is wrong, not the spec. Drift requires an explicit revision pass on this doc.

---

## 2. Layout — single screen, three regions

`/vault/upload` is one screen. No wizard. No stages. Three regions stack vertically; all are present from first interaction:

```
┌─────────────────────────────────────────────────────────┐
│  REGION 1 — DROP ZONE                                   │  Always visible.
│  • Drop / browse + session defaults header bar          │  Accepts files at any time
│  • Density-collapses to a thin "+ add files" affordance │  in the session.
│    once first file is added                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  REGION 2 — ASSET LIST                                  │  Shape adapts to density
│  • Flat list (Linear/Compact mode)                      │  mode (§6). Side detail
│  • + Bulk operations bar (Batch/Archive mode)           │  panel slides in from
│  • + Story groups overlay (when toggle on)              │  the right when row is
│  • + AI proposal banners (when overlay on)              │  expanded.
│                                                         │
├─────────────────────────────────────────────────────────┤
│  REGION 3 — COMMIT BAR                                  │  Sticky bottom.
│  • Ready/total counter                                  │  Always visible.
│  • Blocking-exception summary in plain language         │  Primary CTA disabled
│  • Primary commit CTA                                   │  until all blocking
│                                                         │  exceptions resolve.
└─────────────────────────────────────────────────────────┘
```

**No tabs. No modal stages. No "next" buttons.** The flow is: drop → review inline → commit. The three regions are the entirety of the surface.

### 2.1 Region 1 — Drop zone (detailed)

**Pre-first-file state:**

```
┌─ Drop files or click to browse ─────────────────────┐
│                                                      │
│              Drop files here                         │
│              or click to browse                      │
│                                                      │
│  Defaults: Privacy [Private ▼]  Licences [None ▼]   │
│            Tags (optional, comma-separated)         │
└──────────────────────────────────────────────────────┘
```

- 1px black border, 100% width of content area, ~240px tall
- Drop area accepts any number of files via drag-drop OR click-to-browse
- Defaults form below the drop target — sets the initial values for new assets (creator can override per-asset later)
- `Privacy` dropdown: `Private | Restricted | Public`
- `Licences` dropdown: multi-select from `LICENCE_TYPE_LABELS` (per `src/lib/types.ts`)
- `Tags` field: free-text, comma-separated; applied to each new asset's tag list

**Post-first-file state (collapsed):**

```
┌─ + Add more files ──────────────────────  Defaults: ▼ ┐
└────────────────────────────────────────────────────────┘
```

- ~48px tall thin bar
- "+ Add more files" affordance — clicking opens browse dialog OR drop is accepted into the bar
- "Defaults: ▼" — click to expand the defaults form back into a panel; collapses on save or click-away

The transition between expanded (pre-first-file) and collapsed (post-first-file) is instant on first file drop. No animation.

### 2.2 Region 3 — Commit bar (detailed)

```
┌────────────────────────────────────────────────────────────┐
│  ●●●●●○○ 5/7 ready  •  2 need price set                    │
│                                            [ COMMIT 5 ]    │
└────────────────────────────────────────────────────────────┘
```

- Sticky at viewport bottom; ~64px tall
- Left side:
  - **Status dots** — one per asset, color-coded by exception state (§10): green=ready, yellow=needs-info, orange=duplicate, gray=advisory, blue=processing. ~8px diameter, 4px gap. Caps at ~30 dots; if more, shows aggregate "30+ assets" with hover-summary.
  - **Ready/total counter** — "5/7 ready"
  - **Blocking summary** — plain language, single line. Examples: "2 need price set" / "1 needs duplicate resolution" / "3 need privacy set" / nothing if all ready
- Right side:
  - **Primary CTA** — `COMMIT N` where N is the ready count. Disabled if N=0 or any blocking exception remains. On click: inline expand to commit summary (see §11 commit flow).
  - When excluded assets exist: secondary text "(M excluded)" next to CTA

---

## 3. Asset list — Linear mode (1–5 files)

Default mode for small sessions. Each row shows full per-row detail with all primary metadata fields visible and inline-editable.

### 3.1 Row anatomy (Linear mode)

```
┌──────────────────────────────────────────────────────────────┐
│  [thumb]  filename.jpg                       [✕ Exclude]    │
│           ──────────────────────────────────                 │
│           Title:    [______________________________]         │
│           Caption:  [_AI suggestion (italic)__________]  [✓] │
│           Tags:     [[tag1] [tag2] [+ AI: portrait]___]      │
│           Price:    €[___] ghost: €240 [Why?]            [✓] │
│           Privacy:  [Private ▼]   Licences: [None ▼]         │
│           Geo:      [______________________________]         │
└──────────────────────────────────────────────────────────────┘
```

- **Thumbnail:** ~96×96 px, left-edge of row. Black 1px border. Generated client-side from File object until backend derivative is ready.
- **Filename:** small caps tracked text, `text-[10px] font-bold uppercase tracking-widest text-slate-400`. Read-only.
- **Exclude affordance:** top-right; ✕ icon + "Exclude" label. Click toggles `included` boolean on the asset. Excluded rows are visually de-emphasized (opacity 0.4) and don't count toward ready/total in the commit bar.
- **Editable fields** (each on its own line in Linear mode):
  - **Title** — plain text input, single line. Required for commit.
  - **Caption** — plain text input. AI-suggested values render italic + muted; one-click accept (✓) commits to creator-authored.
  - **Tags** — chip input. Existing tags appear as chips; AI suggestions appear as ghost chips with prefix "AI:". Click to add. Free-text input at end for new tags.
  - **Price** — currency input. Engine recommendation renders as ghost text inside the input ("€240"). "Why?" link expands the basis breakdown panel inline below the input.
  - **Privacy** — dropdown: `Private | Restricted | Public`. Defaults to session default.
  - **Licences** — multi-select dropdown. Defaults to session default.
  - **Geo** — plain text input.
- **Row spacing:** 16px vertical gap between rows. 1px black border around each row.

### 3.2 AI proposal visual treatment (Linear mode)

For any field with an AI suggestion not yet accepted:
- Ghost text rendered in `text-slate-400 italic`
- "✓" accept button to the right of the field
- Editing the field auto-commits (the ghost text disappears and the typed value becomes creator-authored)
- Single-asset bulk action: "Accept all suggestions" link at the bottom of the row, accepts caption + tags + keywords (NOT price — per `PRICE-ENGINE-BRIEF.md` v3 §11.16)

### 3.3 Field validation (Linear mode)

- Title: required (commit-blocking if empty)
- Privacy: required (defaults from session; commit-blocking only if explicitly cleared)
- Price: required if Privacy = Public OR Restricted (commit-blocking; not required for Private per existing selector logic)
- Licences: required if Privacy = Public OR Restricted (same rule as Price)
- Caption / Tags / Geo: optional

Validation messages render as inline `text-[10px] text-yellow-700` below the affected field. Yellow chip on the row indicates "needs-info" (§10).

---

## 4. Asset list — Compact mode (6–19 files)

Density transition occurs at file count = 6. Rows compress; full detail moves to a side panel revealed on row click.

### 4.1 Row anatomy (Compact mode)

```
┌──────────────────────────────────────────────────────────────┐
│  [thumb]  filename.jpg     ▢ Photo  •  €240 [✓]  •  ●●○      │
│           Caption text wraps here, AI italic if not accepted │
└──────────────────────────────────────────────────────────────┘
```

- ~64px tall row
- **Thumbnail:** ~48×48 px
- **Filename + format chip:** filename in regular weight; format chip in `text-[8px] uppercase` next to it
- **Price summary:** inline `€240 [✓]` — ghost+accept, same accept pattern as Linear
- **Status chips:** small chip cluster on the right indicating exception state(s) — one chip per blocking issue, max 3 visible (tooltip for more)
- **Caption preview:** below filename, single line, truncates with ellipsis. Italic if AI-suggested unaccepted.
- **Click anywhere on row:** opens side detail panel (§7) showing all fields like Linear mode
- **Multi-select:** click row's left edge (a small unmarked clickable area) to toggle selection; selected rows get a 4px Frontfiles-blue left border

### 4.2 Bulk operations bar (Compact mode)

Hidden by default in Compact mode. Toggleable via a "Show bulk tools" link at top of the asset list. When shown:

```
┌──────────────────────────────────────────────────────────────┐
│  3 selected  •  Set price: [____]  Set privacy: [Private ▼] │
│  Apply to selected: [Caption] [Tags] [Geo]    [Clear]        │
└──────────────────────────────────────────────────────────────┘
```

- Sticky below the drop zone, above the list
- Bulk operations: set price (single number applied to all selected), set privacy, "apply to selected" expansions for caption/tags/geo (opens a quick-edit popover)
- "Clear" deselects all

---

## 5. Asset list — Batch mode (20–99 files)

Bulk operations bar is **always visible**. Density same as Compact for individual rows. Filters added.

### 5.1 Filters (Batch mode)

Filter bar appears between the bulk operations bar and the list:

```
┌──────────────────────────────────────────────────────────────┐
│  Filter: [All] [Needs info] [Duplicates] [Ready] [Excluded] │
│  Sort: [File order ▼]    Search: [____________________]      │
└──────────────────────────────────────────────────────────────┘
```

- Filter chips reflect §10 exception categories
- Sort: file order (default), filename A→Z, file size, format
- Search: filename + caption full-text

### 5.2 AI group proposals (Batch mode)

When AI clusters detect a group with sufficient confidence (per `AI-PIPELINE-BRIEF.md`, TBD), a banner appears above the asset list:

```
┌──────────────────────────────────────────────────────────────┐
│  ◇ 5 assets appear to be from one shoot — accept as a group?│
│  [Accept] [Dismiss] [See details]                            │
└──────────────────────────────────────────────────────────────┘
```

- Banner uses Frontfiles blue accent on left edge (4px)
- "Accept" creates the Story group with the proposed assets, reflows them into an accordion section
- "Dismiss" hides the banner; doesn't recur for this session
- "See details" expands the banner to show the proposed group's thumbnails + clustering rationale

Multiple banners stack if multiple clusters detected. Each independently accept/dismissable.

---

## 6. Asset list — Archive mode (100–~2,000 files)

The shift mode. Per UX-BRIEF v3 §4.2: primary review unit shifts from per-asset to per-cluster. The asset list becomes accordion-grouped by AI-proposed clusters.

### 6.1 Accordion shape (Archive mode)

```
┌──────────────────────────────────────────────────────────────┐
│  ▼ Cluster 1: Carnaval 2026 — 47 assets — 41 ready  ●●●●●○  │
│    [Accept all suggestions] [Bulk-edit caption] [Set price] │
│    ┌──────────────────────────────────────────────────────┐ │
│    │  [thumb] filename.jpg ▢ €240 ●  caption preview...   │ │
│    │  [thumb] filename.jpg ▢ €240 ●  caption preview...   │ │
│    │  ... (virtualized)                                   │ │
│    └──────────────────────────────────────────────────────┘ │
│                                                              │
│  ▶ Cluster 2: Beach assignment 2025 — 12 assets — all ready │
│  ▶ Ungrouped — 8 assets — needs review                       │
└──────────────────────────────────────────────────────────────┘
```

- Each cluster header shows: cluster name (AI-suggested, editable), asset count, ready count, status dot summary
- Cluster-level bulk actions: Accept all suggestions (caption/tags/keywords across all assets in cluster); Bulk-edit caption (template-style); Set price (applies to all assets in cluster)
- Click cluster header to collapse/expand
- Inside each cluster: virtualized scroll list of compact rows
- "Ungrouped" section always at bottom, contains assets the AI clustering didn't assign — creator can drag them into clusters or commit them ungrouped

### 6.2 Per-asset review in Archive mode

Click row → side detail panel reveals (same as Compact/Batch). The panel becomes the per-asset focus surface; the list serves as a navigator.

### 6.3 Density-mode threshold behavior

Thresholds are **guidelines, not gates**. The mode auto-selects on file count change:

- 1–5: Linear (full per-row)
- 6–19: Compact (collapsed rows + side panel)
- 20–99: Batch (Compact + bulk bar visible by default + filters)
- 100+: Archive (cluster-grouped accordion + per-cluster bulk actions)

**Override:** "View as flat list" link in the asset list header allows manual override to flat (non-grouped) Compact in Archive mode. Useful for spot-checking. Doesn't change the mode permanently — re-enables on session reload.

---

## 7. Side detail panel (revealed on row click)

Shown in Compact/Batch/Archive modes. Slides in from the right edge; ~480px wide; 100% viewport height; pushes the asset list to the left (NOT overlay — overlay would obscure context for multi-row workflows).

### 7.1 Side panel anatomy

```
┌───────────────────────────────────┐
│  filename.jpg              [✕]   │  Header: filename + close
├───────────────────────────────────┤
│  [───── Thumbnail (large) ─────]  │  ~400px square
├───────────────────────────────────┤
│  Title:    [_________________]    │  All Linear-mode fields,
│  Caption:  [_________________]    │  vertical layout. AI
│  Tags:     [_________________]    │  suggestions with same
│  Price:    €[___] ghost €240 [✓] │  visual treatment.
│  Privacy:  [Private ▼]            │
│  Licences: [None ▼]               │
│  Geo:      [_________________]    │
├───────────────────────────────────┤
│  EXCEPTIONS                       │  Section: lists active
│  • Needs price set                │  exceptions for this asset
│  • Duplicate of asset-X (resolve) │  with resolve affordances
├───────────────────────────────────┤
│  AI PROPOSAL DETAIL               │  Section: collapsible
│  ▶ Caption rationale              │  Expanded basis breakdown
│  ▶ Price basis                    │  per field
│  ▶ Tag confidence                 │
└───────────────────────────────────┘
```

- Close (`✕`) hides the panel; row stays selected
- Edits in the panel sync immediately to the row in the asset list (no save button)
- Keyboard: `Esc` closes panel; `J/K` navigates to previous/next asset; selection follows

### 7.2 Duplicate resolution (in side panel)

When asset has a duplicate exception:

```
┌───────────────────────────────────┐
│  EXCEPTIONS                       │
│  ⚠ Possible duplicate of:         │
│    [thumb] filename-other.jpg     │
│    Captured 2026-03-15            │
│                                   │
│    [Keep both]  [Mark this one    │
│                  as duplicate of  │
│                  that one]        │
└───────────────────────────────────┘
```

- Side-by-side thumbnail comparison
- "Keep both" sets `duplicate_status = 'none'` (creator confirms they're distinct)
- "Mark this one as duplicate of that one" sets `duplicate_status = 'confirmed_duplicate'` and `duplicate_of_id` to the other asset; the marked asset is excluded from commit (DB CHECK constraint enforces)

---

## 8. Story groups overlay (opt-in)

Per UX-BRIEF v3 §4.3: optional UI overlay; off by default in Linear/Compact; AI-proposed in Batch/Archive.

### 8.1 Toggle behavior

- "Group by story" toggle in the asset list header (icon + label)
- Off by default in Linear and Compact modes
- On by default in Batch and Archive modes (because AI clusters become valuable)
- Toggle state persists per-session (resets on new session)

### 8.2 When ON in Linear/Compact modes

Asset list shows a "+ New group" affordance at top. Clicking selected assets and choosing "Group selected" creates a Story group. Groups appear as accordion sections (same shape as Archive mode §6.1) above an "Ungrouped" section.

### 8.3 When ON in Batch/Archive modes

AI proposal banners (§5.2) become primary. One-click accept creates groups. Manual create still available via "+ New group" affordance.

### 8.4 Group operations

- Rename: click cluster name to edit inline
- Reassign: drag asset row from one cluster to another (within the asset list scroll)
- Split: select multiple assets in a cluster, "Split into new group" action
- Merge: select two clusters, "Merge clusters" action
- Delete (group only): removes the cluster but keeps the assets (they move to Ungrouped)

---

## 9. AI proposal surfacing — visual + interaction patterns

Per UX-BRIEF v3 §4.4 + `PRICE-ENGINE-BRIEF.md` v3 §5.1.

### 9.1 Visual treatment (consistent across modes + fields)

| State | Visual |
|---|---|
| AI-suggested, not accepted | Italic + `text-slate-500` (muted); ✓ accept icon to right of field |
| Creator-edited (auto-commit on edit) | Regular weight + `text-black`; no accept icon |
| Creator-accepted | Same as edited — visually identical to creator-authored |
| Not generated yet (AI processing in progress) | Subtle spinner in the field; field disabled |
| AI generation failed | Field empty; muted "AI suggestion unavailable" placeholder; no error noise |

### 9.2 Per-field accept rules

| Field | Bulk-accept allowed? | Notes |
|---|---|---|
| Caption | ✅ Yes | Per-row, per-cluster, per-selection |
| Keywords | ✅ Yes | Same scopes |
| Tags | ✅ Yes | Same scopes |
| Price | ❌ **NO** | Per-asset explicit acceptance only. Per `PRICE-ENGINE-BRIEF.md` v3 §11.16 — never bulk-accept prices. Each price acceptance is its own creator action. |

### 9.3 "Why this price?" affordance

Per `PRICE-ENGINE-BRIEF.md` v3 §5.1, every price recommendation is drillable. UI:

```
Price: €[___] ghost €240 [Why?] [✓]

  ↓ click "Why?"

  ┌─────────────────────────────────────────────┐
  │  Recommended €240. Based on:                │
  │                                             │
  │  • Your past sales (7 sales, median €230)  │
  │    weight: 50%                              │
  │                                             │
  │  • Frontfiles comparables                   │
  │    [v2 only — visible from v2]              │
  │                                             │
  │  • Frontfiles standard rate for editorial  │
  │    photo at standard intrusion              │
  │    weight: 20%                              │
  │                                             │
  │  Confidence: 78%                            │
  └─────────────────────────────────────────────┘
```

- Inline expansion below the price field
- Click "Why?" again to collapse
- Comparables drill-down (v2): click a contribution to see the underlying anonymized comparables

### 9.4 Re-generate suggestion

Per-field "Regenerate" affordance (small ↻ icon next to ✓):
- Useful when the creator has edited the asset's metadata in a way that should refresh the suggestion (e.g., edited the caption, wants the price to re-recommend based on new context)
- Calls the engine / AI pipeline anew; replaces the ghost text
- Only available for fields the AI generated (not for purely creator-authored fields)

---

## 10. Exception model — chip styling + commit-bar text

Per UX-BRIEF v3 §4.5 — collapsed to 5 user-facing categories.

### 10.1 Chip styling

| Category | Internal types | Chip color | Chip text | Blocking? |
|---|---|---|---|---|
| **Processing** | `analysing`, `suggesting`, `derivative-pending` | Gray with subtle spinner | "Processing" | No |
| **Needs info** | `needs_privacy`, `needs_price`, `needs_licences`, `manifest_invalid` | Yellow | "Needs price" / "Needs licences" / etc. | Yes (when PUBLIC/RESTRICTED) |
| **Duplicate** | `duplicate_unresolved` | Orange | "Duplicate?" | Yes (until resolved) |
| **Low confidence** | `low_confidence`, `provenance_pending` | Light gray | "Provenance pending" | No |
| **Ready** | (no exceptions, all required fields present) | Green | "Ready" | — |

Chip dimensions: ~16px tall, ~64px wide max, `text-[8px] font-bold uppercase tracking-widest`. Filled solid background. No icons inside chips except for "Processing" (small spinner).

### 10.2 Commit-bar summary text

The commit-bar's blocking-exception summary is plain language, single line:

| Conditions | Text |
|---|---|
| All ready | (no text; just CTA) |
| 1 of one type | "1 needs price set" |
| N of one type | "3 need price set" |
| Multiple types | "5 issues to resolve" |
| Critical (>50% blocking) | "Most assets need attention" |

The CTA button:
- Disabled if N=0 or any blocking exception remains
- Enabled state: "COMMIT N" where N = ready count
- Disabled state: same text, opacity 0.4, no hover state

---

## 11. Commit flow

No separate "Commit" stage. The commit happens inline.

### 11.1 Pre-commit summary (inline expand from CTA)

Click `COMMIT N` → the bar expands upward into a summary panel:

```
┌────────────────────────────────────────────────────────────┐
│  COMMIT 5 ASSETS TO VAULT                                  │
│                                                            │
│  Privacy distribution:                                     │
│    Public:     2  •  Restricted: 0  •  Private: 3         │
│                                                            │
│  Total listed value: €1,200.00                             │
│                                                            │
│  Story groups:                                             │
│    "Carnaval 2026" (3 assets)                              │
│    Ungrouped (2 assets)                                    │
│                                                            │
│  [BACK]                                  [CONFIRM COMMIT]  │
└────────────────────────────────────────────────────────────┘
```

- Replaces the bottom region in place
- "BACK" cancels and returns to the asset list
- "CONFIRM COMMIT" fires the actual commit (calls `/api/v2/batch/[id]/commit` after each per-asset upload completes — wired in PR 5)

### 11.2 Commit progress

During commit (after CONFIRM):

```
┌────────────────────────────────────────────────────────────┐
│  COMMITTING — uploading 3 of 5...                          │
│  ████████████░░░░░░░░░░░░░░░  60%                          │
└────────────────────────────────────────────────────────────┘
```

Per-asset upload progress; aggregate progress bar.

### 11.3 Post-commit success

```
┌────────────────────────────────────────────────────────────┐
│  ✓ 5 ASSETS COMMITTED                                      │
│                                                            │
│  Carnaval 2026 → "Story / Carnaval 2026"                   │
│  3 assets in vault                                         │
│                                                            │
│  Total listed: €1,200.00                                   │
│  Story group: View                                         │
│                                                            │
│  [UPLOAD MORE]              [GO TO VAULT]                  │
└────────────────────────────────────────────────────────────┘
```

- Replaces the entire screen body in place (drop zone, asset list, commit bar all hide)
- "UPLOAD MORE" returns to a fresh empty drop-zone state
- "GO TO VAULT" navigates to `/vault`

### 11.4 Commit error

If commit fails partway:

```
┌────────────────────────────────────────────────────────────┐
│  ⚠ COMMIT INCOMPLETE                                       │
│                                                            │
│  3 of 5 assets committed.                                  │
│  2 failed:                                                 │
│    asset-X.jpg — Storage write failed                      │
│    asset-Y.jpg — Idempotency conflict                      │
│                                                            │
│  [RETRY FAILED]                  [CONTINUE TO VAULT]       │
└────────────────────────────────────────────────────────────┘
```

- Failed assets remain in the asset list with their error chip
- "RETRY FAILED" re-attempts only the failed ones
- "CONTINUE TO VAULT" accepts partial commit and goes to vault

---

## 12. Empty / loading / error states

| State | Visual |
|---|---|
| Empty (no files dropped) | Drop zone in expanded state per §2.1; asset list section says "Drop files above to begin"; commit bar hidden |
| Loading (initial AI processing) | Asset list shows rows with subtle row-level spinner overlays; commit bar shows "Processing..." |
| Backend unreachable | Banner above drop zone: "Connection lost. Your work is saved locally; commit will retry when reconnected." |
| Validation profile unavailable (per `WM-D1`) | Asset rows show watermark-related fields with explanatory caption: "Watermark previews unavailable until profile approval" |
| Quota exceeded | Drop zone shows "Upload paused — you've reached this month's quota. Manage in [account]." |

All error states use the same chip/banner styling — no modal dialogs, no toast notifications.

---

## 13. Accessibility + keyboard

### 13.1 Keyboard shortcuts

| Key | Action |
|---|---|
| `J` | Next asset (move selection / focus down) |
| `K` | Previous asset |
| `Space` | Toggle selection of focused asset |
| `Enter` | Open side detail panel for focused asset |
| `Esc` | Close side detail panel |
| `Cmd/Ctrl+A` | Select all visible (within current filter) |
| `Cmd/Ctrl+I` | Toggle exclude on focused asset |
| `?` | Show keyboard shortcuts overlay |
| `/` | Focus search input |
| `B` | Toggle bulk operations bar |
| `G` | Toggle Story groups overlay |

### 13.2 Accessibility

- All interactive elements keyboard-reachable via tab order
- ARIA labels on icon-only buttons (✕, ✓, ↻)
- Focus visible: 2px Frontfiles-blue outline on focused element
- Screen reader: chip status text read aloud (e.g., "Ready", "Needs price set")
- Color is not the only distinguishing channel for chips — text labels carry the same information
- Drop zone announces "File X added" on each drop (live region)
- Commit bar status changes announced ("5 of 7 ready, 2 need price set")
- Min target size 44×44 px for touch (commit bar buttons, accept ✓ icons)

### 13.3 Reduced motion

- No animations beyond opacity transitions ≤ 200ms
- Side panel slide-in respects `prefers-reduced-motion: reduce` (instant appear instead)

---

## 14. Open IPs (require founder ratification before C2)

### IP-C1 — Cluster name source

When AI proposes a Story group cluster, the cluster name comes from where?
- (a) AI auto-generates a descriptive name (e.g., "Carnaval 2026" inferred from EXIF dates + visual content)
- (b) Auto-named by date range only (e.g., "Mar 14–16, 2026")
- (c) Unnamed by default; creator names on accept

**Recommendation: (a).** AI naming from content is cleaner UX. Falls back to (b) if confidence is low. (c) makes archive uploads tedious.

### IP-C2 — Excluded asset visual treatment

Excluded rows: opacity 0.4 (per §3.1) is the proposed treatment. Alternatives:
- Strikethrough text + faded thumbnail
- Collapsed to single line ("excluded — click to restore")
- Hidden entirely (with "show N excluded" affordance)

**Recommendation: opacity 0.4 (current proposal).** Visible enough to remember they exist, faded enough to not visually compete.

### IP-C3 — Caption length cap

Caption field — should there be a character limit?
- (a) No cap (creator's call)
- (b) Soft cap at 200 chars with counter
- (c) Hard cap at 500 chars

**Recommendation: (b) 200-char soft cap.** Captions are editorial; long captions degrade in cards / search results. Soft limit guides without restricting.

### IP-C4 — "Apply to selected" expansion behavior

Bulk operations "Apply to selected: [Caption] [Tags] [Geo]" — how does it work?
- (a) Click opens an inline popover with a single input that overwrites the selected assets' field
- (b) Click opens a side panel "bulk edit" mode that shows the selected assets' current values and allows bulk-set / find-replace

**Recommendation: (a) inline popover.** Simpler. (b) is over-engineered for v1.

### IP-C5 — Story group max size warning

Per UX-BRIEF v3 §3.1 (Known Limitations): "No group size warnings for groups >15 files." Should the new spec add this?
- (a) Yes — warn at 15+ assets per group ("Large group — consider splitting?")
- (b) No — trust the creator; archive groups can legitimately have hundreds

**Recommendation: (b).** Archive mode legitimately has 100+ asset clusters. Warnings would be noise.

### IP-C6 — Visual asset for the empty drop zone

Pre-first-file state has a 240px drop zone. Does it need an illustration / icon?
- (a) Plain text only ("Drop files here")
- (b) Subtle dashed outline + small upload icon
- (c) Frontfiles brand visual mark

**Recommendation: (b).** Per design canon (brutalist-leaning, restraint), minimum visual but enough to communicate "this is the drop target."

### IP-C7 — Mobile / tablet handling

This spec assumes desktop. Mobile/tablet behavior:
- (a) Out of scope for v1 — `/vault/upload` is desktop-only
- (b) Responsive — collapse to single-column at <768px; adjust touch targets
- (c) Mobile-specific surface — separate route

**Recommendation: (a) out of scope for v1.** Vault upload is a creator workflow that's primarily desktop. Mobile asset capture flows are a different problem (camera APIs, etc.) and out of scope here. If creators want mobile upload, that's a future workstream.

---

## 15. Approval gate

Before any C2 (new shell + state) directive composes, the founder ratifies this spec.

Ratification means: the layout in §2 stands, the component shapes in §3–§9 are the target, the exception model in §10 is locked, the commit flow in §11 is the design, the IPs in §14 are resolved (defaults stand or overridden).

Recommended path: read end-to-end, flag specific lines, push corrections back. I revise. We approve. Phase C C2 kicks off.

After C2 ships: C3 (asset list + inline edit), C4 (bulk operations + filters), C5 (Story groups overlay), C6 (exception simplification + commit bar polish). Five directives total in Phase C per UX-BRIEF v3 §6.

---

## 16. References

- UX brief: `docs/upload/UX-BRIEF.md` v3 §4 (the model this spec implements)
- Price engine brief: `docs/pricing/PRICE-ENGINE-BRIEF.md` v3 §5.1 (price field source) + §11 (no-bulk-accept rule)
- Existing UI surface map: `src/components/upload-v2/README.md` (the v2 wizard being replaced)
- Asset data model: `src/lib/upload/v2-types.ts` (preserved per UX-BRIEF v3 §4.7)
- Backend pipeline: `src/lib/processing/IMPLEMENTATION-PLAN.md` (PRs 1–4 shipped)
- Design canon: per CLAUDE.md item 13 + `PLATFORM_BUILD.md` design references
- BP/Watermark audit: `docs/audits/BLUE-PROTOCOL-WATERMARK-AUDIT-2026-04-26.md` (informs trust-language treatment in chips/exceptions)
- Trust-language defensive fixes: `docs/audits/BLUE-PROTOCOL-USER-FACING-COPY-AUDIT-2026-04-26.md` (constrains what verb/adjective choices are safe in proposal copy)

---

End of UX spec v3.
