# Frontfiles Special Offer — PM/UX Product Specification

**Version**: 1.0
**Authority**: Canonical Specification v1.1 — Spec 6.5, 6.6, 7.4, 8.7, 9.6, 10.1, 10.4, 10.5
**Backlog refs**: FF-1100, FF-1101, FF-1102
**Route**: `/vault/offers` (creator), inline on `/asset/[id]` (buyer), handoff to `/checkout/[assetId]`

---

## A. Product Summary

Special Offer is a tightly bounded pricing decision flow for editorial licensing on Frontfiles.

It is **not** messaging. It is **not** open-ended bargaining. It is a structured mechanism that lets a buyer propose a below-listing price for a public asset, and lets the creator decide — accept, decline, or counter — within a fixed number of rounds and a fixed time window.

The entire interaction produces exactly one outcome: a negotiated price that feeds directly into the standard checkout flow, or a clean terminal state (declined, expired, cancelled).

**One sentence**: Special Offer lets a buyer and creator agree on a price in three rounds or fewer, then complete the transaction through checkout.

### What Special Offer is

- A price decision tool adjacent to the transaction
- A compact negotiation with hard limits
- A feature of the catalogue licensing flow

### What Special Offer is not

- A chat thread (Talk To Me exists for that)
- A generic inbox conversation
- An auction or bidding system
- A resale haggling interface

---

## B. Experience Principles

### B.1 One live number at a time

At any point in a Special Offer thread, there is exactly one price on the table. The UI must make this number dominant — large, unambiguous, and clearly attributed to whoever proposed it.

The listed price appears as reference context. The live offer is the thing the user must act on.

### B.2 One clear next action at a time

Every non-terminal state has exactly one party who must act. The other party waits. The acting party sees their options immediately. The waiting party sees a status and a countdown.

There is never a state where both parties can act, or where the next step is unclear.

### B.3 No chat-first experience

Special Offer threads do not look like message threads. There is no text input for freeform messages, no "typing..." indicator, no profile pictures in a conversation layout.

The timeline is a compact audit log of price events — not a conversation history.

### B.4 Acceptance flows directly to checkout

When an offer is accepted, the buyer sees a single CTA that takes them into the standard 5-step checkout flow with the negotiated amount pre-loaded. There is no intermediate "you've agreed on a price, now what?" screen.

### B.5 Terminal states are explicit

Declined, expired, auto-cancelled, and completed threads display their terminal state clearly and permanently. They cannot be reopened. A buyer who wants to try again creates a new thread.

### B.6 The user always knows

At all times, the user can see:

| What | Where |
|---|---|
| Current offer amount | Dominant number on thread card |
| Listed price | Reference line beneath |
| Whose turn it is | Status badge + thread border color |
| Time remaining | Countdown next to status |
| What happens next | Action buttons (if their turn) or status label (if waiting) |
| What round they're in | "Round X/3" indicator |

---

## C. Core Interaction Model

### C.1 Eligibility

An asset is eligible for Special Offer only when **all** conditions are true:

| Condition | Source |
|---|---|
| Privacy is `PUBLIC` | Spec 6.5 |
| Declaration state is transactable (`fully_validated`, `provenance_pending`, `corroborated`, `under_review`) | Spec 7.4 |
| No active exclusive licence lock | Spec 10.5 |
| Listed price is set and greater than zero | Spec 10.1 |
| At least one licence type is enabled | Spec 10.1 |
| Buyer is not the asset creator | Business rule |

If any condition is false, the "Make an Offer" entry point does not appear.

### C.2 Thread identity

One active Special Offer thread is permitted per unique combination of:

- Buyer
- Asset
- Licence type

A buyer may have concurrent threads for the same asset under different licence types, or for different assets. They may not have two threads for the same asset and licence type simultaneously.

A terminated thread (declined, expired, auto-cancelled) releases the slot. The buyer may start a new thread.

### C.3 Round model

A "round" is one price submission by either party. The system permits a maximum of **3 rounds total**.

| Round | Actor | Status after |
|---|---|---|
| 1 | Buyer submits initial offer | `buyer_offer_pending_creator` |
| 2 | Creator counters | `creator_counter_pending_buyer` |
| 3 | Buyer counters | `buyer_counter_pending_creator` |

After round 3, the creator may only **accept** or **decline**. No further counters.

At any point, the party whose turn it is may accept the current offer instead of countering. The buyer cannot decline — only the creator can explicitly decline.

### C.4 Offer constraints

- The initial buyer offer must be **strictly below** the listed price
- Counter-offers must be **strictly below** the listed price
- Counter-offers must **differ** from the current offer amount
- All amounts are in EUR cents (integers)
- The offer amount is fixed at the moment of submission — no edits

### C.5 Response window

Each offer or counter-offer starts a response timer.

| Parameter | Value |
|---|---|
| Default | 4 hours (240 minutes) |
| Minimum | 30 minutes |
| Maximum | 24 hours (1,440 minutes) |

The response window is set by the buyer at thread creation and applies to all rounds in the thread. If the responding party does not act before the timer expires, the thread transitions to `expired`.

### C.6 Expiry behavior

When the response window expires:

1. Thread status transitions to `expired`
2. An `expired` event is appended to the timeline
3. Both parties see the expired state
4. The thread cannot be reopened
5. The buyer may create a new thread if desired

Expiry is evaluated server-side. The UI shows a countdown but does not autonomously transition — the server is authoritative.

### C.7 Auto-cancel behavior

Active Special Offer threads auto-cancel immediately when the underlying asset becomes non-transactable. Triggers:

| Trigger | Reason code |
|---|---|
| Asset privacy changes from `PUBLIC` | `privacy_changed` |
| Declaration state enters non-transactable set (`manifest_invalid`, `disputed`, `invalidated`) | `declaration_non_transactable` |
| An exclusive licence is activated on the asset | `exclusive_activated` |
| Listed price is removed or set to zero | `asset_delisted` |

Auto-cancel is **centralized**: one check evaluates all active threads for an asset, not per-thread logic.

When auto-cancelled:
- Thread status becomes `auto_cancelled`
- `autoCancelReason` is recorded
- Both buyer and creator see the reason
- No party can take further action

### C.8 Acceptance and checkout handoff

When either party accepts:

1. The accepted amount is locked on the thread (`acceptedAmount`)
2. A `OfferCheckoutIntent` is created:
   - `negotiatedAmount` = the accepted offer
   - `licenceType` = the agreed licence
   - `assetId`, `buyerId`, `creatorId` = from thread
3. Thread status becomes `accepted_pending_checkout`
4. The buyer is presented with a checkout CTA

The checkout CTA links to:

```
/checkout/{assetId}?offerAmount={cents}&licence={type}&threadId={id}
```

In checkout, when these params are present:

- Licence selection step is **skipped** (already agreed)
- Declaration review begins as step 1
- Price confirmation shows:
  - ~~Listed price~~ (struck through)
  - **Negotiated price** (bold, dominant)
  - Platform fee (20% of negotiated price)
  - **You pay** (negotiated + fee)
  - Savings from negotiation
- Payment capture uses the negotiated economics

After successful payment:
- Thread transitions to `completed`
- Standard Certified Package is generated

### C.9 Transaction economics

Special Offer transactions use the same fee structure as direct catalogue purchases, applied to the **negotiated** amount:

| Line | Calculation |
|---|---|
| Negotiated price | Accepted offer amount |
| Buyer markup | +20% of negotiated price |
| **Buyer pays** | Negotiated + markup |
| Creator fee | -20% of negotiated price |
| **Creator receives** | Negotiated - fee (= 80% of negotiated) |
| **Platform earns** | Buyer markup + creator fee (= 40% of negotiated) |

Example: Listed €200, negotiated €150

| | Amount |
|---|---|
| Negotiated | €150.00 |
| Buyer pays | €180.00 |
| Creator receives | €120.00 |
| Platform earns | €60.00 |
| Buyer saves vs listing | €40.00 (vs €240 at full price) |

---

## D. Screen Requirements

### D.1 Asset Page Entry Point

**Location**: Asset detail sidebar, "Rights & Licensing" module, below the "License this asset" button.

**Visibility rule**: Only render when `checkAssetEligibility` returns `{ eligible: true }`. When the asset is ineligible, the button does not appear — no disabled state, no tooltip, no explanation. The absence is the communication.

**Button**:
- Label: **MAKE AN OFFER**
- Style: Black border, black text, white fill. Hover: black fill, white text.
- Position: Full width, immediately below the blue "License this asset" CTA
- The two buttons form a clear hierarchy: blue = full price (primary), black outline = negotiate (secondary)

**What happens on click**: Opens the Offer Modal (D.2).

### D.2 Buyer Offer Modal

A focused overlay for submitting a below-listing offer. Not a panel, not a sidebar — a modal that commands attention and closes when done.

**Header bar**: Black background, white text. "MAKE AN OFFER" left-aligned. Close (×) icon right-aligned.

**Content**:

1. **Asset identity**
   - Asset title (truncated if long)
   - Listed price: "Listed price: €{amount}" — always visible as reference

2. **Offer input**
   - Label: "YOUR OFFER (€)" — 9px bold uppercase tracking-widest slate-400
   - Input: Large numeric field (h-12), font-mono, border-2, autofocus
   - Constraints: `min="0.01"`, `max="{listedPrice - 0.01}"`, `step="0.01"`
   - Validation error (below input, red-500): "Offer must be between €0.01 and €{max}"

3. **Savings preview** (appears when valid amount entered)
   - Dashed border box
   - "Saving" label + "€{savings} ({percent}%)" — font-mono bold

4. **Context line**
   - "Must be below €{listed}. Creator has 4 hours to respond."
   - This is the only mention of the response window — do not add a configurator in v1.

5. **Submit button**
   - Label: **SUBMIT OFFER**
   - Style: Full-width, blue (#0000ff), white text
   - Disabled state: slate-200 bg, slate-400 text (when input empty or invalid)

6. **Post-submit confirmation** (replaces form content):
   - Blue checkmark icon (w-10 h-10)
   - "Offer submitted" — bold
   - "€{amount} — The creator has been notified." — slate-400
   - "DONE" button (black outline) — closes modal

**What the modal does NOT include**:
- Licence type selector (v1: always uses the first enabled licence; future: let buyer choose)
- Response window configurator
- Message/rationale text field
- Terms and conditions checkbox
- Preview of counter-offer scenarios

### D.3 Creator Decision Card

**Location**: `/vault/offers` page, within the "Active" section.

Each active thread renders as a **ThreadCard** — a bordered, expandable card.

**Collapsed state** (always visible):

| Element | Position | Detail |
|---|---|---|
| Status badge | Top-left | SPECIAL_OFFER_STATUS_LABELS, styled per status |
| Round indicator | Next to badge | "Round X/3" — 10px slate-400 |
| Time remaining | Next to round | "Xh Ym remaining" or "Expired" — font-mono 10px |
| Asset title | Below badges | Bold, truncated |
| Context line | Below title | "{Licence type} · Listed: €{listed}" — 10px slate-400 |
| Current offer | Right column | Large font-mono bold €-amount |
| Attribution | Below amount | "Buyer offer" or "Your counter" — 10px slate-400 |

**Border color**: Blue (#0000ff) when it's the creator's turn to act. Black otherwise.

**Expanded state** (on card click):

1. **Timeline** — Compact event log
   - Section label: "TIMELINE" — 9px bold uppercase
   - Each event: `{date} {time} | {event label} | €{amount}`
   - Chronological order (oldest first)
   - Event labels: "Buyer submitted offer", "Creator countered", "Buyer countered", "Creator accepted", "Buyer accepted", "Creator declined", "Offer expired", "Auto-cancelled", "Checkout started", "Transaction completed"

2. **Action row** (only when `isCreatorTurn` = true):
   - **Accept button**: "Accept €{amount}" — blue bg, white text. This is the primary action.
   - **Counter input + button** (only when `roundCount < 3`):
     - Label: "COUNTER (€)" — 9px bold uppercase
     - Numeric input (w-28, font-mono)
     - "COUNTER" button — black border
   - **Decline button**: "DECLINE" — slate border, slate text, right-aligned. Lowest visual priority.
   - **Round limit message** (when `roundCount >= 3`): "Maximum 3 negotiation rounds reached. Accept or decline." — 10px slate-400

3. **Terminal state displays**:
   - **Accepted**: "Accepted at €{amount}" + "Awaiting buyer checkout" — no actions
   - **Completed**: Checkmark + "Completed — €{amount}"
   - **Auto-cancelled**: "Auto-cancelled: {reason}" — reason with underscores replaced by spaces
   - **Declined/Expired**: Status badge only, no additional message needed

### D.4 Buyer Negotiation Status

The buyer sees their active and resolved offer threads. In v1, this is surfaced through:

- The offer modal's post-submit confirmation (immediate)
- A future `/account/offers` page (buyer-side thread list, mirrors creator's vault/offers)

**Buyer thread card** follows the same structure as D.3 but with buyer-specific actions:

| Status | Buyer sees | Buyer can do |
|---|---|---|
| `buyer_offer_pending_creator` | "Awaiting Creator" + countdown | Wait |
| `creator_counter_pending_buyer` | Creator's counter amount | Accept or Counter |
| `buyer_counter_pending_creator` | "Awaiting Creator" + countdown | Wait |
| `accepted_pending_checkout` | "Accepted" + checkout CTA | Proceed to checkout |
| `declined` | "Declined" | Start new thread |
| `expired` | "Expired" | Start new thread |
| `auto_cancelled` | "Cancelled" + reason | Start new thread (if still eligible) |
| `completed` | "Completed" | View transaction |

When the buyer's turn (`creator_counter_pending_buyer`):
- **Accept button**: "Accept €{counter}" — blue bg
- **Counter input + button** (if rounds remain)
- No decline option for buyer — they simply let it expire if uninterested

### D.5 Acceptance to Checkout

When the buyer sees `accepted_pending_checkout`:

**CTA**: "Proceed to Checkout — €{amount}" — full-width blue button

This links to:
```
/checkout/{assetId}?offerAmount={cents}&licence={type}&threadId={id}
```

**Checkout page shows**:
- Banner: "Negotiated price accepted" with blue border and checkmark
- Sub-line: "Offer: €{negotiated} (listed: €{listed}) · {Licence type}"
- Steps renumbered (licence selection omitted)
- Price confirmation shows struck-through listed price, bold negotiated price, savings line

---

## E. States and Transitions

### E.1 State diagram

```
                              ┌─────────────────────────┐
                              │                         │
     ┌─────────────────┐      │   ┌──────────────────┐  │
     │ buyer_offer_     │──────┼──▶│ creator_counter_  │  │
     │ pending_creator  │      │   │ pending_buyer     │  │
     └────────┬─────────┘      │   └────────┬──────────┘  │
              │                │            │             │
              │ accept         │            │ accept      │
              │ decline        │            │             │
              │ expire         │  ┌─────────▼──────────┐  │
              │ auto_cancel    │  │ buyer_counter_      │──┘
              │                │  │ pending_creator     │
              │                │  └────────┬────────────┘
              │                │           │
              │                │           │ accept
              │                │           │ decline
              │                │           │ expire
              │                │           │ auto_cancel
              ▼                ▼           ▼
     ┌─────────────────────────────────────────────┐
     │           accepted_pending_checkout          │
     └──────────────────────┬──────────────────────┘
                            │ complete
                            ▼
     ┌─────────────────────────────────────────────┐
     │                 completed                    │
     └─────────────────────────────────────────────┘

     Terminal: declined | expired | auto_cancelled | completed
```

### E.2 Status definitions

| Status | Whose turn | Actions available |
|---|---|---|
| `buyer_offer_pending_creator` | Creator | Accept, Counter (if rounds remain), Decline |
| `creator_counter_pending_buyer` | Buyer | Accept, Counter (if rounds remain) |
| `buyer_counter_pending_creator` | Creator | Accept, Counter (if rounds remain), Decline |
| `accepted_pending_checkout` | Buyer (checkout) | Proceed to checkout |
| `declined` | Nobody | Terminal |
| `expired` | Nobody | Terminal |
| `auto_cancelled` | Nobody | Terminal |
| `completed` | Nobody | Terminal |

### E.3 Event types

| Event | Actor | Carries amount |
|---|---|---|
| `buyer_offer` | Buyer | Yes |
| `creator_counter` | Creator | Yes |
| `buyer_counter` | Buyer | Yes |
| `creator_accept` | Creator | Yes (accepted amount) |
| `buyer_accept` | Buyer | Yes (accepted amount) |
| `creator_decline` | Creator | No |
| `expired` | System | No |
| `auto_cancelled` | System | No (reason in metadata) |
| `checkout_started` | Buyer | No |
| `completed` | System | No |

---

## F. UX Copy Guidance

### F.1 Tone

Special Offer copy should feel like professional price negotiation between media organizations — not marketplace haggling, not casual chat, not legalese.

- **Direct**: "Accept €110.00" not "Would you like to accept this offer?"
- **Precise**: Always show exact amounts with two decimal places
- **Neutral**: No persuasion, no urgency theatrics, no "Great offer!" framing
- **Professional**: "Declined" not "Rejected." "Awaiting Creator" not "Waiting for response..."

### F.2 Number formatting

- Always EUR: €{amount}
- Always two decimal places: €110.00, not €110
- Always derived from cents internally: `(cents / 100).toFixed(2)`
- Listed price as context, never as competing emphasis

### F.3 Time formatting

- Hours + minutes: "2h 45m remaining"
- Minutes only when under 1 hour: "45m remaining"
- Past expiry: "Expired" (red-500)
- No seconds. No "about" or "approximately."

### F.4 Status labels

| Status | Label | Context |
|---|---|---|
| `buyer_offer_pending_creator` | Awaiting Creator | Buyer is waiting |
| `creator_counter_pending_buyer` | Counter-offer | Buyer must respond |
| `buyer_counter_pending_creator` | Awaiting Creator | Buyer is waiting |
| `accepted_pending_checkout` | Accepted | Proceed to checkout |
| `declined` | Declined | Terminal |
| `expired` | Expired | Terminal |
| `auto_cancelled` | Cancelled | Terminal, reason shown separately |
| `completed` | Completed | Terminal |

### F.5 Action labels

| Action | Label | Style |
|---|---|---|
| Creator accepts | Accept €{amount} | Blue solid |
| Buyer accepts | Accept €{amount} | Blue solid |
| Creator counters | Counter | Black outline |
| Buyer counters | Counter | Black outline |
| Creator declines | Decline | Slate outline |
| Submit initial offer | Submit offer | Blue solid |
| Proceed to checkout | Proceed to Checkout — €{amount} | Blue solid |

### F.6 Copy strings to avoid

- "Negotiate" — too open-ended
- "Bargain" / "Haggle" — wrong register
- "Chat" / "Message" / "Reply" — this is not messaging
- "Best offer" / "Final offer" — no special round semantics
- "Hurry" / "Act now" / "Don't miss out" — no urgency theatre
- "Offer rejected" — use "Declined" (softer, professional)

---

## G. Edge Cases

### G.1 Buyer offers exactly the listed price

Blocked at submission. Error: "Offer must be below the listed price. Use standard checkout for full-price purchases."

The checkout CTA is always visible alongside "Make an Offer." A buyer who wants the listed price should use checkout.

### G.2 Asset becomes ineligible during active offer

All active threads for that asset auto-cancel immediately. Both parties see "Cancelled" with the reason (privacy changed, declaration non-transactable, exclusive activated, or asset delisted).

### G.3 Creator does not respond within window

Thread expires. Buyer sees "Expired." Can create a new thread. No penalty to creator.

### G.4 Buyer does not respond to counter within window

Same behavior. Thread expires. Creator sees "Expired."

### G.5 Maximum rounds reached

After round 3, the creator's action row shows only Accept and Decline — the counter input and button are removed. A text line explains: "Maximum 3 negotiation rounds reached. Accept or decline."

### G.6 Buyer tries to create duplicate thread

Blocked at creation. Error: "An active offer already exists for this buyer, asset, and licence type." The buyer must wait for the existing thread to resolve before creating a new one.

### G.7 Buyer tries to make offer on own asset

Blocked. "Make an Offer" button does not appear on assets where the viewer is the creator. Server enforces this independently.

### G.8 Offer accepted but buyer does not complete checkout

Thread remains in `accepted_pending_checkout`. The accepted amount is locked. The buyer can return to checkout at any time via the CTA.

The thread does **not** expire in this state — the acceptance is a commitment. If the asset becomes ineligible during this window, the thread auto-cancels.

### G.9 Concurrent threads for different licence types

Permitted. A buyer can have an active editorial offer and an active commercial offer for the same asset simultaneously. Each is a separate thread.

### G.10 Listed price changes after offer creation

The thread's `listedPriceAtOpen` is a snapshot at creation time. If the creator changes the listed price, existing threads continue using the original snapshot. The creator can always decline if they want to reset.

If the listed price drops to zero, the auto-cancel trigger fires (`asset_delisted`).

### G.11 Counter amount equal to current offer

Blocked. "Counter must differ from the current offer." Forces genuine negotiation movement.

---

## H. Implementation Notes for Design/Dev Handoff

### H.1 Server authority

All state transitions are validated server-side. The frontend renders state received from the server and dispatches actions to the API. The frontend does not compute next states, validate turns, or determine eligibility on its own — except for gating UI visibility (e.g., hiding "Make an Offer" for ineligible assets using the same logic the server uses).

### H.2 API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/special-offer` | POST | Create new offer thread |
| `/api/special-offer` | GET | List threads (filter by buyerId, creatorId, assetId) |
| `/api/special-offer/[id]/counter` | POST | Submit counter-offer |
| `/api/special-offer/[id]/accept` | POST | Accept current offer |
| `/api/special-offer/[id]/decline` | POST | Creator declines |

### H.3 Checkout handoff mechanism

Acceptance produces an `OfferCheckoutIntent` with a locked negotiated amount. The buyer is directed to:

```
/checkout/{assetId}?offerAmount={cents}&licence={type}&threadId={id}
```

The checkout page detects these params and:
- Skips licence selection (already agreed)
- Uses negotiated amount for all economics
- Shows the offer context banner

### H.4 Auto-cancel integration point

When any service modifies an asset's privacy, declaration state, exclusive lock, or pricing, it must call `autoCancelAllForAsset` to cancel all active Special Offer threads for that asset. This is a single centralized function — not per-feature logic.

### H.5 Notification hooks (future)

The implementation creates events for every state change. Notification delivery (email, in-app, push) should subscribe to these events:

| Event | Notify |
|---|---|
| `buyer_offer` | Creator |
| `creator_counter` | Buyer |
| `buyer_counter` | Creator |
| `creator_accept` | Buyer (with checkout CTA) |
| `buyer_accept` | Creator |
| `creator_decline` | Buyer |
| `expired` | Both |
| `auto_cancelled` | Both (with reason) |
| `completed` | Both |

### H.6 Design system alignment

| Element | Treatment |
|---|---|
| Active thread border | Blue (#0000ff) when creator's turn, black otherwise |
| Status badges | 9px bold uppercase tracking-widest, border colored per status |
| Offer amount | font-mono, text-lg, font-bold |
| Section headers | 10px bold uppercase tracking-widest slate-400 |
| Primary action | bg-[#0000ff] text-white |
| Secondary action | border-black text-black |
| Tertiary action | border-slate-200 text-slate-400 |
| Terminal thread | Reduced contrast (slate-200/300) |

### H.7 Data model

**SpecialOfferThread**: id, assetId, buyerId, creatorId, licenceType, listedPriceAtOpen, currentOfferAmount, currentOfferBy, roundCount, creatorResponseWindowMinutes, expiresAt, status, acceptedAmount, checkoutIntentId, autoCancelReason, createdAt, updatedAt, resolvedAt.

**SpecialOfferEvent**: id, threadId, type, actorId, amount, metadata, createdAt.

**OfferCheckoutIntent**: id, threadId, assetId, buyerId, creatorId, licenceType, negotiatedAmount, createdAt.

### H.8 Success metrics

| Metric | Definition | Target signal |
|---|---|---|
| Offer conversion rate | Threads reaching `completed` / threads created | Higher = feature works |
| Rounds to resolution | Average roundCount at terminal state | Lower = efficient |
| Time to first response | Creator response time on initial offer | Lower = engaged |
| Acceptance rate | Accepted threads / (accepted + declined) | Baseline to track |
| Checkout completion | Completed / accepted_pending_checkout | Higher = clean handoff |
| Expiry rate | Expired / all terminal threads | Lower = responsive users |
| Auto-cancel rate | Auto-cancelled / all terminal threads | Monitor for asset churn |
| Average discount | (listedPrice - acceptedAmount) / listedPrice | Understand pricing dynamics |
| Offer-driven revenue | Total platform earnings from Special Offer transactions | Growth metric |
| Repeat offer buyers | Buyers who create 2+ threads | Retention signal |

---

*This spec defines the complete Special Offer product for Frontfiles. Implementation should follow the canonical types in `src/lib/types.ts`, the domain engine in `src/lib/special-offer/`, and the API routes in `src/app/api/special-offer/`. Design should follow the Frontfiles design system lock (black, blue-600, white, zero radius, Neue Haas Grotesk).*
