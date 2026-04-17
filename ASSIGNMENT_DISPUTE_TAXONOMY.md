# Frontfiles — Assignment Dispute Taxonomy

**Status:** draft v1 · **Date:** 2026-04-17 · **Owner:** João Nuno Martins
**Governs:** Decision D-A3 in `PLATFORM_REVIEWS.md` (per-dispute-type refund + revocation policy).
**Downstream:** Phase 5.C of `INTEGRATION_READINESS.md` (Stripe Connect refund flows) cannot ship without this taxonomy locked.

## Purpose

Every dispute raised on a Frontfiles assignment or licence transaction must be classified into exactly one of five types. Classification determines the refund mechanism, licence-grant consequence, creator-side impact, and required evidence. This document is the single source of truth for that classification and the rules that follow from it.

## Scope

**In scope:** disputes arising from (a) assignment lifecycle events (brief → fund → deliver → confirm), and (b) direct licence purchases on vault assets.

**Out of scope:** payment-processor disputes (Stripe chargebacks) that arrive without an internal dispute — those are handled by the Stripe Radar + chargeback response playbook. A Stripe chargeback with a matching internal dispute uses this taxonomy.

## The five dispute types

| # | Type | One-line definition |
|---|---|---|
| 1 | **Fraud** | The delivered work is not what the creator claims it is — fabricated provenance, stolen/plagiarised content, AI-generated without disclosure where disclosure was required. |
| 2 | **Quality** | The work is authentic but does not meet the technical or craft specification agreed in the brief. |
| 3 | **Scope** | Good-faith disagreement about what the brief actually required. Both parties acted reasonably on different interpretations. |
| 4 | **Delivery** | Non-delivery, late delivery past the agreed cutoff, or delivered in wrong format/medium/resolution. |
| 5 | **Rights violation** | The creator did not hold the rights they claimed (model release missing, location permission missing, third-party IP unclear, syndication conflict). |

The five types are mutually exclusive by policy. If multiple patterns are present, the highest-severity type wins, ordered: Fraud > Rights violation > Delivery > Quality > Scope.

---

## Per-type rules

### 1. Fraud

**Definition.** Creator misrepresented the origin, authorship, or nature of the delivered work. Examples: submitting another photographer's photo as their own; presenting AI-generated imagery as captured reality when disclosure was required; claiming on-scene presence they did not have; doctored metadata / manufactured provenance signals.

**Evidence standard.** Buyer must present at least one of: (a) reverse-image-search match to prior publication pre-dating the submission; (b) contradictory metadata (EXIF/sensor) that breaks the creator's provenance claim; (c) independent source confirming the creator was not present at the claimed time/place; (d) technical analysis showing AI generation.

**Decision authority.** Frontfiles staff review (initial), with escalation to external mediation if contested. Founder sign-off required on any Fraud finding in v1.

**Outcome on "upheld":**

- Buyer receives **full refund** via Stripe (original payment + platform fee).
- Platform fee absorbed by Frontfiles — creator forfeits their share.
- Licence grant **revoked**; signed-URL delivery disabled immediately.
- Asset **removed** from all surfaces (vault, frontfolio, feed, search).
- Creator account flagged. Second upheld Fraud finding → account suspension (staff review required to reinstate).
- CEL (Certification Event Log) records the finding permanently against the asset.
- All related assets by the same creator move to `under_review` state pending audit.

**Outcome on "not upheld":** No refund. No platform-side penalty. Dispute is logged as dismissed; no visibility cost to the creator.

**Timeline.** 5-business-day initial review (per D-A2), up to 14 days for full resolution.

---

### 2. Quality

**Definition.** The delivered work is authentic but fails to meet the technical/craft spec in the brief. Examples: resolution below requested minimum; wrong aspect ratio; insufficient coverage of the subject; missing mandatory shots specified in the brief; audio quality below broadcast standard.

**Evidence standard.** Buyer must cite the specific brief clause the work fails, and present the delivered artifact. Creator may present mitigation: revised work, alternative deliverables, or a good-faith argument that the spec was met.

**Decision authority.** Frontfiles staff review. External editorial reviewer may be consulted where technical judgment is disputed.

**Outcome on "upheld":**

- **Partial refund**, split proportional to severity — default: 50% buyer refund; 50% retained by creator; platform fee prorated accordingly.
- Or: creator offers **revised delivery** (one opportunity), buyer accepts → no refund, original terms apply.
- Licence grant **remains active** (buyer paid for something and is keeping at least part of it).
- Asset stays listed.
- No creator-account flag; CEL records the event as "quality_adjustment".

**Outcome on "not upheld":** No refund; creator is paid in full.

**Timeline.** 5-business-day review; 10-day resolution.

---

### 3. Scope

**Definition.** Both parties acted in good faith and diverge on what the brief required. Example: buyer expected rights to syndicate, creator delivered assuming editorial-only; buyer expected vertical format, brief ambiguous; buyer assumed minimum asset count, brief didn't specify.

**Evidence standard.** Both parties submit their interpretation of the brief text. The brief itself is the primary evidence; secondary evidence is prior messages in the assignment thread.

**Decision authority.** Mediation, not adjudication. Staff acts as mediator, not judge. If mediation fails, escalate to external mediator (flat fee, split by parties).

**Outcome on "resolved via mediation":**

- Terms re-negotiated. Outcomes include: partial refund with licence adjustment; additional deliverables; scope-clarified continuation; mutual release with a fractional refund.
- Default fallback if neither party moves: **50/50 split** of the contested amount.
- Licence grant **adjusted to match resolved scope** (e.g. editorial-only if full syndication was contested).
- No creator-account flag.
- CEL records the scope resolution.

**Outcome on "fails to resolve":** External mediator binding decision; fee split per initial agreement.

**Timeline.** 7-day mediation window, then 7-day external-mediation window if needed.

---

### 4. Delivery

**Definition.** Creator did not deliver, or delivered substantially late, or delivered in the wrong format/medium/resolution such that the work is unusable. Distinct from Quality: a Delivery failure is a binary fail (it isn't there, or it's in the wrong format entirely); Quality is a gradient.

**Evidence standard.** Timestamp evidence (delivery attempts), format mismatch vs brief spec, or creator's own non-response past the cutoff.

**Decision authority.** Automated + staff review. The assignment-engine state machine already tracks `delivered_at` against the brief cutoff; automation can classify "late by X" without staff. Wrong-format cases need human review.

**Outcome on "upheld":**

- **Full refund** to buyer via Stripe.
- Platform fee returned to buyer (Frontfiles absorbs).
- No licence grant minted (or if minted prematurely, revoked).
- Creator account receives a **delivery-reliability flag** (visible to buyers for 90 days).
- Three delivery flags in a rolling 180-day window → creator cannot accept new assignments for 30 days.
- CEL records the event.

**Outcome on "not upheld":** No refund; creator delivery confirmed as adequate.

**Timeline.** 3-business-day review (faster than other types — fact-based).

---

### 5. Rights violation

**Definition.** Creator lacks the rights or permissions they claimed. Examples: no model release for a recognisable person in the image; no property/location permission where required; third-party IP in the frame without clearance; syndication conflict with a prior buyer; creator does not hold the copyright they asserted.

**Evidence standard.** Buyer or third-party presents evidence of the missing right (a claim from a model, a DMCA notice, a conflicting licence, public IP that the creator did not have the right to capture).

**Decision authority.** Frontfiles legal/staff review. External legal counsel consulted for contested IP claims. Founder sign-off required for v1.

**Outcome on "upheld":**

- Buyer receives **full refund** via Stripe.
- Platform fee absorbed by Frontfiles; creator forfeits their share.
- Licence grant **revoked**; signed-URL delivery disabled.
- Asset **removed** from vault, frontfolio, feed, search, and any public surface.
- Asset's `validationDeclaration` moves to `invalidated` (post-Blue-Protocol-drift resolution) or `disputed` pending that fix.
- Creator account flagged; the specific right-class that failed is recorded (model-release / property / IP / syndication).
- If the rights violation exposes Frontfiles to third-party claim (e.g. model sues Frontfiles), creator is contractually liable per the Creator Agreement.
- CEL records the finding permanently.

**Outcome on "not upheld":** No refund; asset stays listed; dispute logged as dismissed.

**Timeline.** 5-business-day initial review; up to 21 days for rights investigations requiring third-party contact.

---

## State-machine integration

The assignment dispute state machine (per `PLATFORM_BUILD.md`, Spec S13) is: `filed → under_review → upheld | not_upheld | escalated_external`.

This taxonomy adds an orthogonal classification at `filed`:

```
filed
  ├── type: Fraud
  ├── type: Quality
  ├── type: Scope
  ├── type: Delivery
  └── type: Rights_Violation
```

Type is set by the buyer at filing; creator can counter-classify during `under_review` (e.g. "this is Scope, not Quality"); staff reviewer sets the final binding type before outcome is decided.

## Schema impact

A new table or schema extension:

```
disputes
  id, assignment_id | licence_grant_id, buyer_user_id, creator_user_id,
  type: enum('fraud','quality','scope','delivery','rights_violation'),
  filed_at, filed_by_role, claim_text, evidence_refs[],
  creator_response_text, creator_response_at,
  state: enum('filed','under_review','upheld','not_upheld','escalated_external','resolved_via_mediation'),
  staff_reviewer_id, resolved_at, outcome_text,
  refund_amount_cents, platform_fee_absorbed_cents, licence_revoked: boolean,
  creator_flag_type: nullable,
  cel_event_ref
```

Schema lives in a new migration: `20260418XXXXXX_dispute_taxonomy.sql`.

## Appeal path

Any upheld Fraud or Rights-Violation finding can be appealed **once** by the creator within 14 days. Appeal is reviewed by an independent party (external mediator or non-involved staff member). Quality / Delivery / Scope outcomes are final after the resolution window closes.

## Sign-off gates before this taxonomy ships

| Gate | Requires |
|---|---|
| G-T1 | Legal review of the Creator Agreement language for rights-violation liability clause |
| G-T2 | External mediator contracted (for Scope + appeal escalations) |
| G-T3 | Schema migration + dispute console UI + API endpoints built |
| G-T4 | Staff playbook written for each of the 5 types |

## Open items

| # | Question |
|---|---|
| T1 | Should "delivery-reliability flag" be public to all potential buyers, or only visible to the platform side and shown as an aggregate trust score? |
| T2 | What's the exact quality-reduction percentage table? Default "50% split" is a starting point; real data may want sub-tiers (25/50/75). |
| T3 | Should the Creator Agreement grant Frontfiles a right of recovery against the creator for third-party settlement costs on Rights-Violation disputes? |
| T4 | For Scope disputes, who pays the external-mediator fee split when the parties can't agree? Default 50/50. |

## Next step

1. Resolve the 4 open items (T1–T4) with legal / product input.
2. Lock this taxonomy at v2 once resolved.
3. Build the dispute schema migration + API endpoints + staff console UI (Phase 5.C and Area 2 work items in the governance documents).

---

*End of document — v1 draft. Must be v2-locked before Phase 5.C Stripe refund flows ship.*
