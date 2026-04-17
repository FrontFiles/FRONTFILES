/**
 * Identity drawer + prompt — scenario-aware copy matrix.
 *
 * Phase D refinement: the drawer used to render a single
 * generic "legal identity" experience. It is now scenario-
 * aware so account-side, creator-payouts, and buyer-trust
 * launches read as distinct, specific flows — while sharing
 * the same underlying data model and Stripe boundary.
 *
 * This module is pure data. It does not render anything.
 * The drawer + prompt read from `resolveIdentityCopy` and
 * plug the strings into their existing structure.
 */

import type {
  IdentitySubjectType,
  IdentityVerificationStatus,
} from '@/lib/identity/types'

/**
 * The three UX scenarios we support today. New scenarios
 * can be added by appending to this union and extending
 * `SCENARIO_BASE` — the drawer and prompt do not need to
 * change.
 */
export type IdentityScenario =
  | 'account_setup'
  | 'creator_payouts'
  | 'buyer_trust'

/**
 * Everything the drawer + prompt need in order to render
 * a scenario. Every field is mandatory so we can guarantee
 * no blank placeholders leak into the UI.
 */
export interface IdentityCopy {
  // ── Prompt card (outside the drawer) ───────
  promptEyebrow: string
  promptTitle: string
  promptBody: string
  promptCtaFallback: string

  // ── Drawer header ──────────────────────────
  drawerEyebrow: string
  drawerTitle: string

  // ── Intro paragraph (above step 1) ─────────
  intro: string

  // ── "Why this is needed" block ─────────────
  whyTitle: string
  whyBullets: string[]

  // ── Step 1: identity/recipient/account type ──
  step1Title: string
  subjectQuestion: string
  subjectPersonLabel: string
  subjectPersonDescription: string
  subjectCompanyLabel: string
  subjectCompanyDescription: string

  // ── Step 2: legal details ──────────────────
  step2Title: string
  /** Section title shown above person fields. */
  personSectionTitle: string
  /** Section title shown above company fields. */
  companySectionTitle: string
  /** Section title shown above the company representative block. */
  companyRepSectionTitle: string
  companyRepNameLabel: string
  companyRepTitleLabel: string
  companyRepNamePlaceholder: string
  companyRepTitlePlaceholder: string

  // ── Step 3: review + submit ────────────────
  step3Title: string
  primaryCtaLabel: string
  requirementsDueCtaLabel: string
  draftCtaLabel: string

  // ── Non-editable state copy ─────────────────
  submittedTitle: string
  submittedBody: string
  verifiedTitle: string
  verifiedBody: string
  requirementsDueTitle: string
  requirementsDueBody: string
  rejectedIntro: string

  // ── "What happens next" block ──────────────
  whatNextTitle: string
  whatNextBullets: string[]

  // ── Legal footer ───────────────────────────
  footerNote: string
}

// ══════════════════════════════════════════════
// SCENARIO MATRICES
// ══════════════════════════════════════════════

const ACCOUNT_SETUP: IdentityCopy = {
  // Prompt
  promptEyebrow: 'Trust & verification',
  promptTitle: 'Complete your legal identity',
  promptBody:
    'Frontfiles uses legal identity details to confirm who is behind the account for trust-sensitive activity and future payments.',
  promptCtaFallback: 'Start verification',

  // Drawer header
  drawerEyebrow: 'Trust & verification',
  drawerTitle: 'Legal identity verification',

  // Intro
  intro:
    'We use legal identity details to confirm who is behind the account for trust-sensitive activity and future payments. You can save a draft and finish later at any time.',

  // Why
  whyTitle: 'Why this is needed',
  whyBullets: [
    'Used to confirm who is behind the account',
    'Kept separate from your public profile',
    'You can save a draft and return later',
  ],

  // Step 1
  step1Title: 'Account type',
  subjectQuestion: 'Who is this account for?',
  subjectPersonLabel: 'Individual',
  subjectPersonDescription:
    'You are the legal entity. We verify you as a person.',
  subjectCompanyLabel: 'Company',
  subjectCompanyDescription:
    'A legal entity separate from you. You act as its representative.',

  // Step 2
  step2Title: 'Legal details',
  personSectionTitle: 'Individual',
  companySectionTitle: 'Company',
  companyRepSectionTitle: 'Authorised representative',
  companyRepNameLabel: 'Full name',
  companyRepTitleLabel: 'Title',
  companyRepNamePlaceholder: 'Person signing on behalf of the company',
  companyRepTitlePlaceholder: 'Director, CFO, Sole Proprietor, …',

  // Step 3
  step3Title: 'Review and submit',
  primaryCtaLabel: 'Submit for verification',
  requirementsDueCtaLabel: 'Resubmit',
  draftCtaLabel: 'Save and finish later',

  // Non-editable state copy
  submittedTitle: 'Submitted for review',
  submittedBody:
    'Your details have been sent for verification. You cannot edit them while this is in review.',
  verifiedTitle: 'Verified',
  verifiedBody: 'Your legal identity has been verified.',
  requirementsDueTitle: "More details needed to confirm this account",
  requirementsDueBody:
    "We’ve highlighted the fields that require updates. Review them and submit again when you’re ready.",
  rejectedIntro:
    'Verification was rejected. The reason below comes from the provider. Contact support to reopen your case.',

  // What next
  whatNextTitle: 'What happens next',
  whatNextBullets: [
    'We review the submitted details with Stripe.',
    'If anything is missing we will surface it here.',
    'You will see this panel update automatically.',
  ],

  // Footer
  footerNote:
    'Frontfiles verifies legal identity for regulated actions such as licensing contracts, assignment funding, and future payouts. Information you provide here may be shared with Stripe, our default verification and payments provider.',
}

const CREATOR_PAYOUTS: IdentityCopy = {
  // Prompt
  promptEyebrow: 'Payouts',
  promptTitle: 'Verify before your first payout',
  promptBody:
    'To receive funds through Frontfiles, we need the legal details Stripe requires for payout verification.',
  promptCtaFallback: 'Set up payouts',

  // Drawer header
  drawerEyebrow: 'Payouts',
  drawerTitle: 'Set up legal identity for payouts',

  // Intro
  intro:
    'This information is used to verify the person or company that will receive funds. You can save a draft and return later.',

  // Why
  whyTitle: 'Why this is needed',
  whyBullets: [
    'Required before payouts can be enabled',
    'Used to verify the payout recipient',
    'You can save a draft and return later',
  ],

  // Step 1 — payout-specific framing
  step1Title: 'Payout recipient',
  subjectQuestion: 'Who will receive payouts?',
  subjectPersonLabel: 'Me as an individual',
  subjectPersonDescription:
    'Funds are paid to you personally. We verify you as the recipient.',
  subjectCompanyLabel: 'My company',
  subjectCompanyDescription:
    'Funds are paid to a legal entity you represent. We verify the company and you as its representative.',

  // Step 2
  step2Title: 'Legal details',
  personSectionTitle: 'About you',
  companySectionTitle: 'Company',
  companyRepSectionTitle: 'Authorised representative',
  companyRepNameLabel: 'Full name',
  companyRepTitleLabel: 'Title',
  companyRepNamePlaceholder: 'Person signing on behalf of the company',
  companyRepTitlePlaceholder: 'Director, CFO, Sole Proprietor, …',

  // Step 3
  step3Title: 'Review and submit',
  primaryCtaLabel: 'Submit for verification',
  requirementsDueCtaLabel: 'Resubmit for payouts',
  draftCtaLabel: 'Save and finish later',

  // Non-editable state copy
  submittedTitle: 'Identity submitted',
  submittedBody:
    'We’ll review this with Stripe and let you know if anything else is needed before payouts are enabled.',
  verifiedTitle: 'Ready for payouts',
  verifiedBody:
    'Your identity is verified. Payouts will route through Stripe once they are enabled for your account.',
  requirementsDueTitle: "Stripe needs more details for payouts",
  requirementsDueBody:
    "We’ve highlighted the fields Stripe flagged below. Update them and submit again to continue toward payouts.",
  rejectedIntro:
    'Payout verification was rejected. The reason below comes from Stripe. Contact support to reopen your case.',

  // What next
  whatNextTitle: 'What happens next',
  whatNextBullets: [
    'Stripe reviews the payout recipient details.',
    'If anything is missing we will surface it here.',
    'Once verified, payouts can be enabled for your account.',
  ],

  // Footer
  footerNote:
    'Payouts on Frontfiles route through Stripe, our default payments provider. The details you submit here are used to verify the payout recipient.',
}

const BUYER_TRUST: IdentityCopy = {
  // Prompt
  promptEyebrow: 'Trust & verification',
  promptTitle: 'Verify identity for trusted buyer access',
  promptBody:
    'Some buyer actions require us to confirm who is acting on this account or company.',
  promptCtaFallback: 'Verify identity',

  // Drawer header — final title is subject-type aware
  drawerEyebrow: 'Trust & verification',
  drawerTitle: 'Verify your legal identity',

  // Intro — intro body is subject-type aware, resolved later
  intro:
    'We use this information to confirm who is using the account for trust-sensitive activity.',

  // Why
  whyTitle: 'Why this is needed',
  whyBullets: [
    'Used for trust-sensitive buyer actions',
    'Helps confirm account or company ownership',
    'You can save a draft and return later',
  ],

  // Step 1
  step1Title: 'Account type',
  subjectQuestion: 'Who is acting on the account?',
  subjectPersonLabel: 'Me as an individual',
  subjectPersonDescription:
    'You are the legal entity behind the buyer account.',
  subjectCompanyLabel: 'A company I represent',
  subjectCompanyDescription:
    'A legal entity separate from you. You act as its authorised representative.',

  // Step 2
  step2Title: 'Legal details',
  personSectionTitle: 'About you',
  companySectionTitle: 'Company',
  companyRepSectionTitle: 'Authorised representative',
  // Buyer-trust company field label refinement
  companyRepNameLabel: 'Authorized representative',
  companyRepTitleLabel: 'Role at company',
  companyRepNamePlaceholder: 'Name of the person acting on behalf of the company',
  companyRepTitlePlaceholder: 'Role at company (e.g. Director, Head of…)',

  // Step 3
  step3Title: 'Review and submit',
  primaryCtaLabel: 'Submit details',
  requirementsDueCtaLabel: 'Resubmit details',
  draftCtaLabel: 'Save and finish later',

  // Non-editable state copy
  submittedTitle: 'Details submitted',
  submittedBody:
    'Verification has been submitted. You can keep using Frontfiles while review is in progress.',
  verifiedTitle: 'Verified',
  verifiedBody: 'This buyer identity is verified for trust-sensitive actions.',
  requirementsDueTitle: "Stripe needs more details for this account",
  requirementsDueBody:
    "We’ve highlighted the fields that need updates. Make your changes and submit again to confirm this account.",
  rejectedIntro:
    'Verification was rejected. The reason below comes from the provider. Contact support to reopen your case.',

  // What next
  whatNextTitle: 'What happens next',
  whatNextBullets: [
    'We review the submitted details with Stripe.',
    'Trust-sensitive buyer actions unlock once review passes.',
    'You can keep using Frontfiles while review is in progress.',
  ],

  // Footer
  footerNote:
    'Frontfiles verifies buyer legal identity for trust-sensitive actions such as high-value licensing and assignment funding. Information you provide here may be shared with Stripe.',
}

const SCENARIO_BASE: Record<IdentityScenario, IdentityCopy> = {
  account_setup: ACCOUNT_SETUP,
  creator_payouts: CREATOR_PAYOUTS,
  buyer_trust: BUYER_TRUST,
}

// ══════════════════════════════════════════════
// STATUS + SUBJECT-TYPE OVERLAYS
// ══════════════════════════════════════════════

/**
 * Resolve the full copy pack for a scenario, then apply
 * small subject-type and status overlays so the drawer
 * renders the right specific phrasing per launch.
 *
 * Only strings that genuinely depend on subject_type / status
 * are overlaid here — everything else stays in the scenario
 * base block so the override map is small and auditable.
 */
export function resolveIdentityCopy(
  scenario: IdentityScenario | null | undefined,
  status: IdentityVerificationStatus,
  subjectType: IdentitySubjectType,
): IdentityCopy {
  const base = SCENARIO_BASE[scenario ?? 'account_setup']
  const copy: IdentityCopy = { ...base }

  // Buyer-trust: drawer title + intro body swap on subject type.
  if (scenario === 'buyer_trust') {
    if (subjectType === 'company') {
      copy.drawerTitle = 'Verify company legal details'
      copy.intro =
        'We use this information to confirm the legal company and its authorised representative.'
    } else {
      copy.drawerTitle = 'Verify your legal identity'
      copy.intro =
        'We use this information to confirm who is using the account for trust-sensitive activity.'
    }
  }

  // Account-setup: prompt heading changes slightly when the
  // user already has a draft vs has not started.
  if (scenario === 'account_setup') {
    if (status === 'draft') {
      copy.promptTitle = 'Finish your legal identity'
      copy.promptBody =
        'You have a saved draft. Finish the details and submit when you are ready.'
    } else if (status === 'verified') {
      copy.promptTitle = 'Legal identity verified'
      copy.promptBody =
        'Your legal identity has been verified. We will surface updates here if anything changes.'
    } else if (
      status === 'requirements_due' ||
      status === 'needs_resubmission'
    ) {
      copy.promptTitle = 'Legal identity needs your attention'
      copy.promptBody =
        'Verification needs a few more details before it can complete.'
    }
  }

  // Creator-payouts: prompt heading shifts by status.
  if (scenario === 'creator_payouts') {
    if (status === 'verified') {
      copy.promptTitle = 'Ready for payouts'
      copy.promptBody =
        'Your identity is verified. Payouts will route through Stripe once they are enabled for your account.'
    } else if (
      status === 'requirements_due' ||
      status === 'needs_resubmission'
    ) {
      copy.promptTitle = 'Resolve identity requirements to unlock payouts'
      copy.promptBody =
        'Stripe needs a few more details before payouts can be enabled.'
    } else if (status === 'submitted' || status === 'in_review') {
      copy.promptTitle = 'Payout identity under review'
      copy.promptBody =
        'We’ll let you know if anything else is needed before payouts are enabled.'
    } else if (status === 'draft') {
      copy.promptTitle = 'Finish setting up payouts'
      copy.promptBody =
        'You have a saved draft. Finish the details and submit so Stripe can enable payouts.'
    }
  }

  // Buyer-trust: prompt headline shifts by status.
  if (scenario === 'buyer_trust') {
    if (status === 'verified') {
      copy.promptTitle = 'Buyer identity verified'
      copy.promptBody =
        'This buyer identity is verified for trust-sensitive actions.'
    } else if (
      status === 'requirements_due' ||
      status === 'needs_resubmission'
    ) {
      copy.promptTitle = 'Action required to keep buying'
      copy.promptBody =
        'A few more details are needed to confirm this account.'
    } else if (status === 'submitted' || status === 'in_review') {
      copy.promptTitle = 'Buyer identity under review'
      copy.promptBody =
        'You can keep using Frontfiles while review is in progress.'
    }
  }

  return copy
}
