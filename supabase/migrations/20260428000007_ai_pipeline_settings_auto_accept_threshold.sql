-- ════════════════════════════════════════════════════════════════
-- FRONTFILES — E6: ai_pipeline_settings.auto_accept_threshold
--
-- Per E6-DIRECTIVE.md §9 + UX-SPEC-V4 §11.1 + IPV4-5.
--
-- Per-field auto-accept gate. When a field's confidence ≥ this
-- threshold at hydration, the editable field is auto-populated from
-- the proposal value. Below threshold, the inspector shows the
-- ghost + ✓ + ↻ pattern for explicit creator action.
--
-- Default 0.85 per UX-SPEC-V4 IPV4-5 lock. Founder-tunable.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE ai_pipeline_settings
  ADD COLUMN auto_accept_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.85
    CHECK (auto_accept_threshold >= 0 AND auto_accept_threshold <= 1);

COMMENT ON COLUMN ai_pipeline_settings.auto_accept_threshold IS
  'E6: per-field auto-accept threshold. UX-SPEC-V4 IPV4-5 lock = 0.85. Each per-field confidence (caption / keywords / tags) is compared individually — NOT a single overall confidence (per E6 §6.2 reconciliation).';
