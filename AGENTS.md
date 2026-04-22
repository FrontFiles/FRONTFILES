<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ui-design-gate -->
# UI/design gate

Start UI/design work on a surface only when all three are true:

1. The surface has a canonical name AND a locked one-line scope sentence.
2. A specific authority source governs it (doc + section), with no higher-authority contradiction.
3. Testable exit criteria are defined (verifiable outcome, not subjective).

If any of the three fail, the work to unblock is not design — it's naming (A.0 terminology lock / scope sentence), governance (spec or `PLATFORM_REVIEWS.md` decision lock), or criteria drafting. Do that first, then design.

This rule is a lightweight, in-session instance of the `FEATURE_APPROVAL_ROADMAP.md` §Phase A Track 1 template (scope sentence + evidence pack + open items + decision + sign-off). When the two diverge, the Feature Approval Roadmap wins.
<!-- END:ui-design-gate -->
