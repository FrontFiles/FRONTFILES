-- ════════════════════════════════════════════════════════════════
-- Migration: Watermark Profiles — Seed Data (6 Draft Profiles)
--
-- Seeds the initial 6 watermark profiles:
--   3 intrusion levels (light, standard, heavy) x 2 families (portrait, landscape)
--
-- ALL profiles start as 'draft'. Nothing processes until the
-- product owner approves each profile individually.
--
-- Position ratios derived from the PSD templates:
--   Landscape 1920x1080: bar at x=1773..1891 → x_ratio ≈ 0.924
--   Portrait 1080x1920:  bar at x=930..1049  → x_ratio ≈ 0.861
--
-- Standard and Heavy bars shifted inward per product direction
-- ("the horizontal must come a little more up").
--
-- Depends on: 20260417100002_watermark_profile_tables.sql
-- Rollback: DELETE FROM watermark_profiles WHERE version = 1
-- ════════════════════════════════════════════════════════════════

-- ── LIGHT: bar at edge, minimal disruption ──

INSERT INTO watermark_profiles (version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config)
VALUES (
  1, 'light', 'portrait',
  '{"xRatio": 0.92, "yRatio": 0.02, "anchor": "top-right"}'::jsonb,
  0.06,
  '{"heightRatio": 0.11}'::jsonb,
  '{"heightRatio": 0.49}'::jsonb,
  '{"heightRatio": 0.40}'::jsonb,
  NULL
);

INSERT INTO watermark_profiles (version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config)
VALUES (
  1, 'light', 'landscape',
  '{"xRatio": 0.92, "yRatio": 0.02, "anchor": "top-right"}'::jsonb,
  0.06,
  '{"heightRatio": 0.11}'::jsonb,
  '{"heightRatio": 0.49}'::jsonb,
  '{"heightRatio": 0.40}'::jsonb,
  NULL
);

-- ── STANDARD: bar shifted toward center ──

INSERT INTO watermark_profiles (version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config)
VALUES (
  1, 'standard', 'portrait',
  '{"xRatio": 0.86, "yRatio": 0.02, "anchor": "top-right"}'::jsonb,
  0.06,
  '{"heightRatio": 0.11}'::jsonb,
  '{"heightRatio": 0.49}'::jsonb,
  '{"heightRatio": 0.40}'::jsonb,
  NULL
);

INSERT INTO watermark_profiles (version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config)
VALUES (
  1, 'standard', 'landscape',
  '{"xRatio": 0.86, "yRatio": 0.015, "anchor": "top-right"}'::jsonb,
  0.06,
  '{"heightRatio": 0.11}'::jsonb,
  '{"heightRatio": 0.49}'::jsonb,
  '{"heightRatio": 0.40}'::jsonb,
  NULL
);

-- ── HEAVY: bar + scattered FF brand icons ──

INSERT INTO watermark_profiles (version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config)
VALUES (
  1, 'heavy', 'portrait',
  '{"xRatio": 0.86, "yRatio": 0.02, "anchor": "top-right"}'::jsonb,
  0.06,
  '{"heightRatio": 0.11}'::jsonb,
  '{"heightRatio": 0.49}'::jsonb,
  '{"heightRatio": 0.40}'::jsonb,
  '{"density": 8, "opacity": 0.10, "iconSizePx": 28}'::jsonb
);

INSERT INTO watermark_profiles (version, intrusion_level, template_family, bar_position, bar_width_ratio, brand_block, id_block, attribution_block, scatter_config)
VALUES (
  1, 'heavy', 'landscape',
  '{"xRatio": 0.86, "yRatio": 0.015, "anchor": "top-right"}'::jsonb,
  0.06,
  '{"heightRatio": 0.11}'::jsonb,
  '{"heightRatio": 0.49}'::jsonb,
  '{"heightRatio": 0.40}'::jsonb,
  '{"density": 8, "opacity": 0.10, "iconSizePx": 28}'::jsonb
);
