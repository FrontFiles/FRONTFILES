"use client"

/**
 * Onboarding — checklist slot.
 *
 * A small UI-only checklist that surfaces 0–3 compact cards
 * nudging the session user through the next step(s) of their
 * account setup. Entirely driven by the activation flags
 * returned by `useOnboardingCompletion()` plus a `surface`
 * tag that tells the slot where it is rendering.
 *
 * ── What this component is NOT ────────────────────────────
 *
 * This file owns BOTH the UI and the task-visibility logic.
 * It is intentionally NOT a state machine — it performs no
 * mutations, fires no network requests, and holds no local
 * "dismissed" state. Cards become visible or invisible purely
 * as a pure function of the flags. The CTAs link out to the
 * existing editor pages (`/account/profile`, `/account/buyer`)
 * where the real wiring lives.
 *
 * Concentrating every task decision here means the shells
 * that host the slot (`AccountShell`, the creator frontfolio
 * page) stay untouched as the list grows or changes — adding
 * a new task is a one-entry change to the `TASKS` array below.
 *
 * ── Render rules ──────────────────────────────────────────
 *
 *   1. A task is a candidate when its `appliesTo(surface,
 *      flags)` predicate returns true — this single function
 *      folds together "does this task belong on this surface"
 *      and "is the task still incomplete".
 *   2. Candidates are clipped to at most `MAX_VISIBLE_TASKS`
 *      cards, so the slot can never balloon past a compact
 *      three-card strip even if `TASKS` grows.
 *   3. The slot renders nothing when the candidate set is
 *      empty. Under normal flag states this happens exactly
 *      when `flags.anyActivated` is true AND no incomplete
 *      role-specific task applies to the current surface —
 *      that is the "quiet" post-onboarding state for users
 *      who have already finished setup.
 *
 * ── Surface tag ───────────────────────────────────────────
 *
 *   "account" : generic shell for `/account/*` routes. May
 *               surface either activation prompt — a pristine
 *               user sees both, a half-activated user sees
 *               whichever prompt is still relevant.
 *   "creator" : self-view of a creator's frontfolio page.
 *               Shows only the creator activation prompt so
 *               buyer-details nags never leak into the
 *               creator workspace.
 *   "buyer"   : reserved for a future buyer-only workspace
 *               separate from `AccountShell`. Today it
 *               behaves symmetrically to "creator" but
 *               surfaces only the buyer prompt.
 *
 * ── Extending this component ──────────────────────────────
 *
 * Adding a task is a one-entry change to the `TASKS` array.
 * Each task carries its own predicate so the render path has
 * no surface-specific branches — the component stays linear
 * and every new task lands in a single obvious place.
 */

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { OnboardingCompletionFlags } from "@/hooks/useOnboardingCompletion"

export type OnboardingChecklistSurface = "account" | "creator" | "buyer"

interface OnboardingChecklistSlotProps {
  flags: OnboardingCompletionFlags
  surface: OnboardingChecklistSurface
}

/**
 * Internal shape of a single checklist task.
 *
 * Not exported — consumers only ever see the rendered slot,
 * never the task list. Keep every field serializable so this
 * module stays client-safe and tree-shakable.
 */
interface ChecklistTask {
  /** Stable key — used as the React list key. */
  key: string
  /** Short headline rendered in bold uppercase caps. */
  title: string
  /** One-sentence rationale shown under the title. */
  description: string
  /** Call-to-action that links to the existing editor page. */
  cta: { label: string; href: string }
  /**
   * Predicate that decides whether the task should be shown.
   * Returns true when the task is BOTH applicable to the
   * current surface AND not yet complete per the flags.
   */
  appliesTo: (
    surface: OnboardingChecklistSurface,
    flags: OnboardingCompletionFlags,
  ) => boolean
}

/**
 * The full task registry. Order here IS the render order.
 *
 * Adding a new task later means extending this array — the
 * render path below is already surface-agnostic.
 */
const TASKS: ChecklistTask[] = [
  {
    key: "creator-profile",
    title: "Set up your creator profile",
    description:
      "Add the basics so your frontfolio and creator workspace are ready to use.",
    cta: { label: "Finish creator setup", href: "/account/profile" },
    appliesTo: (surface, flags) =>
      !flags.isCreatorActivated &&
      (surface === "account" || surface === "creator"),
  },
  {
    key: "buyer-details",
    title: "Set up your buyer account",
    description:
      "Add your buyer details so you can use buyer tools and manage requests cleanly.",
    cta: { label: "Finish buyer setup", href: "/account/buyer" },
    appliesTo: (surface, flags) =>
      !flags.isBuyerActivated &&
      (surface === "account" || surface === "buyer"),
  },
]

/**
 * Hard ceiling on visible cards. Keeps the slot compact even
 * if the `TASKS` array later grows past three entries — the
 * overflow simply does not render.
 */
const MAX_VISIBLE_TASKS = 3

export function OnboardingChecklistSlot({
  flags,
  surface,
}: OnboardingChecklistSlotProps) {
  const visibleTasks = TASKS.filter((task) =>
    task.appliesTo(surface, flags),
  ).slice(0, MAX_VISIBLE_TASKS)

  // Quiet state — nothing to prompt on. Under normal flag
  // states this branch is taken exactly when `flags.anyActivated`
  // is true AND no role-specific task applies on this surface.
  // Also covers the unreachable edge case of an unknown surface
  // producing an empty candidate set.
  if (visibleTasks.length === 0) {
    return null
  }

  return (
    <section
      aria-label="Onboarding next steps"
      className={cn(
        "flex flex-col gap-2",
        // The creator surface renders inside a raw `<main>`
        // above the hero strip, so the slot carries its own
        // horizontal inset and a bit of top padding. The
        // account surface already lives inside a padded
        // content column, so it only needs a bottom margin
        // to separate itself from the page body.
        surface === "creator" ? "px-8 pt-5 pb-1" : "mb-6",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        Next steps
      </div>
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {visibleTasks.map((task) => (
          <li key={task.key}>
            <ChecklistCard task={task} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ChecklistCard({ task }: { task: ChecklistTask }) {
  return (
    <div className="border-2 border-black bg-white px-4 py-3 flex items-center gap-4">
      {/* Visual indicator — always an empty box because the
          slot only ever renders incomplete tasks. Marked
          aria-hidden so screen readers fall straight to the
          title and CTA. */}
      <div
        className="w-4 h-4 border-2 border-black shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">
          {task.title}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
          {task.description}
        </div>
      </div>
      <Link
        href={task.cta.href}
        className="text-[10px] font-bold uppercase tracking-widest text-[#0000ff] hover:text-[#00008b] shrink-0 whitespace-nowrap"
      >
        {task.cta.label} →
      </Link>
    </div>
  )
}
