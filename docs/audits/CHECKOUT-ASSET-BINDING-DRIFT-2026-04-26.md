# Checkout Asset-Binding Drift — Triage Note

**Status:** Surfaced; not yet triaged. Logged separately so it doesn't muddle the BP-D7 trust-language workstream.
**Date:** 2026-04-26 (surfaced during BP-D7 UI walkthrough)
**Scope:** Single-route bug in `/checkout/[assetId]`. NOT BP-D7 / brand-protocol scope.
**Severity:** Unknown — needs reproduction + root-cause investigation. Worst case: routing layer ignores URL param entirely; best case: a stale fixture in dev mode only.

---

## 1. What surfaced

During the BP-D7 UI verification walkthrough on `feat/upload-rebuild-bcef`, navigated to `http://localhost:3000/checkout/asset-006`. The URL contains `asset-006` (Ana Sousa's "Assembleia da República floor during confidence vote roll call" parliament photo, confirmed via the asset detail page at `/asset/asset-006` immediately before).

The checkout page renders:

> **Taiwan strait patrol, naval vessels**
> by Sarah Chen

That's a different asset entirely (different creator, different format/content, possibly hardcoded fixture).

## 2. Hypothesis (untested)

The `/checkout/[assetId]/page.tsx` route does not read the URL `assetId` param when constructing the order summary — instead it falls back to a hardcoded mock asset (Sarah Chen's Taiwan-strait fixture). This is consistent with a dev-time scaffold where the layout was prototyped against one specific asset and the URL-binding wiring was never completed.

Other interpretations to rule out:
- Multi-step wizard caches the first asset clicked and ignores subsequent URL changes
- Mock data lookup uses a default fallback when a real asset isn't found in the cart
- The component wires through cart state, not URL state — and cart state is empty so it renders a default

Need to read `src/app/checkout/[assetId]/page.tsx` and trace where the asset shown comes from (URL params? cart context? hardcoded fixture? cart fallback?).

## 3. Why it matters

In production, this would mean:
- Buyer clicks "BUY" on asset X
- Buyer arrives at checkout for asset Y
- Buyer signs declaration for asset Y
- Buyer pays for asset Y when they thought they were buying X

That's a contract-formation defect. Severity: P1 if reproducible in production. P3 if dev-only.

## 4. Why this is NOT a BP-D7 issue

BP-D7 is a copy/labels pass. This is a routing/data-binding bug. The fact that it surfaced during a BP-D7 walkthrough is coincidental — checkout was the BP-D7 C-1 surface I needed to verify, and the title mismatch was caught while inspecting the page.

Conflating this with BP-D7 would inflate the trust-language workstream's apparent failure rate. They're orthogonal.

## 5. Triage queue placement (recommendation)

- **Reproduce on the deployed environment** (Vercel preview from `feat/upload-rebuild-bcef` branch) — confirm dev-only vs prod-leaking
- **Check git blame** on `src/app/checkout/[assetId]/page.tsx` — when did this route last change? Is the URL param binding present in the page handler?
- **Decide priority** — P1 if prod, P3 if dev-fixture-only
- If P1: cut a small directive (e.g., "CHECKOUT-ASSET-BINDING-FIX") and ship before the next paying-buyer interaction
- If P3: backlog it; include in the next checkout-flow review pass (likely Phase D's PR 5 cutover review since checkout reads from the upload pipeline's outputs)

## 6. Owner / next action

Founder triage call. Recommended action: 30-minute investigation pass to confirm reproduction + check whether the bug exists in production. If yes → priority decision. If no → dev-only note to fix opportunistically.

---

End of checkout drift triage note.
