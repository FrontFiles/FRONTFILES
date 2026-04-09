-- ════════════════════════════════════════════════════════════════
-- Seed Data — Assignment Engine Dev Fixtures
--
-- Three canonical scenarios matching src/lib/assignment/mock-data.ts:
-- 1. Material — photo assignment, 2 milestones, first accepted, second in review
-- 2. Service — fixer/logistics, 3 milestones, in progress
-- 3. Hybrid — field coverage + packages, 2 milestones, with CCR history
--
-- Uses deterministic UUIDs for reproducibility.
-- Run with: supabase db reset (applies migrations + seed)
-- ════════════════════════════════════════════════════════════════

-- Deterministic UUID scheme:
-- Assignments: 1000000X-...
-- Milestones:  2000000X-...
-- Buyers:      3000000X-...
-- Creators:    4000000X-...
-- Fulfilments: 5000000X-...
-- Evidence:    6000000X-...
-- Reviews:     7000000X-...
-- CCRs:        8000000X-...
-- Rights:      9000000X-...
-- Escrow:      a000000X-...
-- Events:      b000000X-...

BEGIN;

-- ──────────────────────────────────────────────
-- 1. MATERIAL ASSIGNMENT — Porto Alegre flood coverage
-- ──────────────────────────────────────────────

INSERT INTO assignments (id, buyer_id, creator_id, assignment_class, state, sub_state,
  scope, deadline, acceptance_criteria, required_evidence_types, review_window_days, plan_notes,
  created_at, accepted_at)
VALUES (
  '10000001-0000-4000-a000-000000000001',
  '30000001-0000-4000-a000-000000000001', -- buyer-reuters
  '40000001-0000-4000-a000-000000000001', -- creator-marco
  'material', 'delivered', 'review_open',
  'Commissioned photo coverage of flood recovery operations in Porto Alegre metropolitan area. Minimum 25 editorial-quality photographs documenting relief efforts, temporary shelters, infrastructure damage assessment, and community recovery.',
  '2026-05-01T23:59:00Z',
  'Minimum 25 photographs at editorial resolution. Geographic metadata present. Subjects relevant to flood recovery scope. No staged or re-enacted scenes.',
  ARRAY['vault_asset'],
  5,
  'Creator has prior access to affected areas via press accreditation.',
  '2026-04-01T10:00:00Z',
  '2026-04-02T08:00:00Z'
);

INSERT INTO assignment_rights_records (id, assignment_id,
  asset_usage_rights, asset_exclusivity_terms, asset_duration, asset_territory, asset_publication_scope)
VALUES (
  '90000001-0000-4000-a000-000000000001',
  '10000001-0000-4000-a000-000000000001',
  'Non-exclusive editorial licence. Buyer may publish in all Reuters-distributed outlets.',
  '72-hour exclusivity window from delivery acceptance.',
  '2 years from acceptance.',
  'Worldwide',
  'Editorial use in news reporting context only.'
);

INSERT INTO escrow_records (id, assignment_id, stripe_payment_intent_id,
  total_captured_cents, total_released_cents, total_refunded_cents, total_frozen_cents, captured_at)
VALUES (
  'a0000001-0000-4000-a000-000000000001',
  '10000001-0000-4000-a000-000000000001',
  'pi_material_001_test',
  275000, 120000, 0, 0,
  '2026-04-02T09:00:00Z'
);

-- Milestone 1: Initial field coverage (ACCEPTED)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at, completed_at)
VALUES (
  '20000001-0000-4000-a000-000000000001',
  '10000001-0000-4000-a000-000000000001',
  1, 'Initial field coverage',
  'First batch: 12+ photographs from relief staging areas and temporary shelters.',
  'material', 'accepted',
  '2026-04-15T23:59:00Z',
  '12+ photos, geographic metadata, editorial quality.',
  ARRAY['vault_asset'],
  120000, false, 5,
  '2026-04-01T10:00:00Z',
  '2026-04-14T09:00:00Z'
);

-- Fulfilment submission for milestone 1
INSERT INTO fulfilment_submissions (id, milestone_id, fulfilment_type, creator_notes, submitted_at)
VALUES (
  '50000001-0000-4000-a000-000000000001',
  '20000001-0000-4000-a000-000000000001',
  'asset',
  'First batch of 12 images from the Porto Alegre metropolitan flood zone. All shot between April 10-13. GPS metadata embedded.',
  '2026-04-13T14:00:00Z'
);

-- Evidence items for milestone 1 (12 vault assets)
INSERT INTO evidence_items (id, fulfilment_submission_id, kind, label, vault_asset_id, created_at) VALUES
  ('60000001-0000-4000-a000-000000000001', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Flood relief staging area — aerial', '60000001-0000-4000-b000-000000000001', '2026-04-13T10:30:00Z'),
  ('60000001-0000-4000-a000-000000000002', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Temporary shelter interior — families', '60000001-0000-4000-b000-000000000002', '2026-04-13T10:31:00Z'),
  ('60000001-0000-4000-a000-000000000003', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Infrastructure damage — bridge collapse', '60000001-0000-4000-b000-000000000003', '2026-04-13T10:32:00Z'),
  ('60000001-0000-4000-a000-000000000004', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Relief workers — supply distribution', '60000001-0000-4000-b000-000000000004', '2026-04-13T10:33:00Z'),
  ('60000001-0000-4000-a000-000000000005', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Community volunteer effort', '60000001-0000-4000-b000-000000000005', '2026-04-13T10:34:00Z'),
  ('60000001-0000-4000-a000-000000000006', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Flooded residential street', '60000001-0000-4000-b000-000000000006', '2026-04-13T10:35:00Z'),
  ('60000001-0000-4000-a000-000000000007', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Emergency medical tent', '60000001-0000-4000-b000-000000000007', '2026-04-13T10:36:00Z'),
  ('60000001-0000-4000-a000-000000000008', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Aerial — extent of flooding', '60000001-0000-4000-b000-000000000008', '2026-04-13T10:37:00Z'),
  ('60000001-0000-4000-a000-000000000009', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Press briefing — municipal authorities', '60000001-0000-4000-b000-000000000009', '2026-04-13T10:38:00Z'),
  ('60000001-0000-4000-a000-000000000010', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Children at temporary school', '60000001-0000-4000-b000-000000000010', '2026-04-13T10:39:00Z'),
  ('60000001-0000-4000-a000-000000000011', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Water rescue operation', '60000001-0000-4000-b000-000000000011', '2026-04-13T10:40:00Z'),
  ('60000001-0000-4000-a000-000000000012', '50000001-0000-4000-a000-000000000001', 'vault_asset', 'Shelter exterior — night', '60000001-0000-4000-b000-000000000012', '2026-04-13T10:41:00Z');

-- Review record for milestone 1 (accepted)
INSERT INTO review_records (id, milestone_id, reviewer_id, reviewer_role, determination,
  notes, evidence_basis, created_at)
VALUES (
  '70000001-0000-4000-a000-000000000001',
  '20000001-0000-4000-a000-000000000001',
  '30000001-0000-4000-a000-000000000001', -- buyer-reuters reviewer
  'content_commit_holder', 'accepted',
  'All 12 images meet editorial quality standards. Geographic coverage is comprehensive for the staging area scope.',
  '12 Vault-linked assets reviewed. Geographic metadata verified. Subjects match scope.',
  '2026-04-14T09:00:00Z'
);

-- Milestone 2: Recovery and community impact (FULFILMENT_SUBMITTED)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at)
VALUES (
  '20000001-0000-4000-a000-000000000002',
  '10000001-0000-4000-a000-000000000001',
  2, 'Recovery and community impact',
  'Second batch: 13+ photographs documenting community recovery, infrastructure repair, and long-term impact.',
  'material', 'fulfilment_submitted',
  '2026-04-30T23:59:00Z',
  '13+ photos, recovery subjects, editorial quality.',
  ARRAY['vault_asset'],
  130000, true, 5,
  '2026-04-01T10:00:00Z'
);

-- Fulfilment submission for milestone 2 (partial, 3 of 13)
INSERT INTO fulfilment_submissions (id, milestone_id, fulfilment_type, creator_notes, submitted_at)
VALUES (
  '50000001-0000-4000-a000-000000000002',
  '20000001-0000-4000-a000-000000000002',
  'asset',
  'Initial submission for milestone 2. 3 of 13 complete. Remaining images due by April 30.',
  '2026-04-18T15:00:00Z'
);

INSERT INTO evidence_items (id, fulfilment_submission_id, kind, label, vault_asset_id, created_at) VALUES
  ('60000001-0000-4000-a000-000000000013', '50000001-0000-4000-a000-000000000002', 'vault_asset', 'Reconstruction — residential block', '60000001-0000-4000-b000-000000000013', '2026-04-18T14:00:00Z'),
  ('60000001-0000-4000-a000-000000000014', '50000001-0000-4000-a000-000000000002', 'vault_asset', 'Community kitchen — volunteers', '60000001-0000-4000-b000-000000000014', '2026-04-18T14:01:00Z'),
  ('60000001-0000-4000-a000-000000000015', '50000001-0000-4000-a000-000000000002', 'vault_asset', 'School reopening ceremony', '60000001-0000-4000-b000-000000000015', '2026-04-18T14:02:00Z');

-- ──────────────────────────────────────────────
-- 2. SERVICE ASSIGNMENT — Fixer/logistics for Greece border coverage
-- ──────────────────────────────────────────────

INSERT INTO assignments (id, buyer_id, creator_id, assignment_class, state, sub_state,
  scope, deadline, acceptance_criteria, required_evidence_types, review_window_days,
  created_at, accepted_at)
VALUES (
  '10000001-0000-4000-a000-000000000002',
  '30000001-0000-4000-a000-000000000002', -- buyer-guardian
  '40000001-0000-4000-a000-000000000002', -- creator-dimitris
  'service', 'in_progress', 'active',
  'Provide fixering, translation (Greek/English), and logistics coordination for Guardian correspondents covering the Evros border region. 5 field days.',
  '2026-04-25T23:59:00Z',
  'Daily service log submissions with location, hours, duties completed. Handoff notes for each field day.',
  ARRAY['service_log', 'handoff_note', 'support_document'],
  3,
  '2026-03-28T10:00:00Z',
  '2026-03-29T07:00:00Z'
);

INSERT INTO assignment_rights_records (id, assignment_id,
  service_scope_of_work, service_confidentiality, service_attendance_obligations,
  service_operational_restrictions, service_reimbursement_terms, service_liability_framing)
VALUES (
  '90000001-0000-4000-a000-000000000002',
  '10000001-0000-4000-a000-000000000002',
  'On-ground fixer services: local transport coordination, translation (Greek/English), source introduction, logistics.',
  'Content gathered during service may not be independently published without buyer consent.',
  'Available 07:00–19:00 local time on scheduled field days. Emergency on-call outside hours.',
  'No contact with sources outside agreed editorial scope. No recording of interviews without consent.',
  'Transport, meals, and accommodation pre-arranged by buyer. Incidental expenses reimbursed on receipt.',
  'Creator is an independent contractor. Standard journalistic liability framework applies.'
);

INSERT INTO escrow_records (id, assignment_id, stripe_payment_intent_id,
  total_captured_cents, total_released_cents, total_refunded_cents, total_frozen_cents, captured_at)
VALUES (
  'a0000001-0000-4000-a000-000000000002',
  '10000001-0000-4000-a000-000000000002',
  'pi_service_001_test',
  220000, 40000, 0, 0,
  '2026-03-29T08:00:00Z'
);

-- Service Milestone 1: Pre-trip logistics (ACCEPTED)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at, completed_at)
VALUES (
  '20000001-0000-4000-a000-000000000003',
  '10000001-0000-4000-a000-000000000002',
  1, 'Pre-trip logistics',
  'Coordinate travel, accommodation, source introductions, and safety briefing prior to field days.',
  'service', 'accepted',
  '2026-04-05T23:59:00Z',
  'Logistics plan submitted. Source list provided. Safety briefing completed.',
  ARRAY['support_document', 'handoff_note'],
  40000, false, 3,
  '2026-03-28T10:00:00Z',
  '2026-04-04T12:00:00Z'
);

INSERT INTO fulfilment_submissions (id, milestone_id, fulfilment_type, creator_notes, submitted_at)
VALUES (
  '50000001-0000-4000-a000-000000000003',
  '20000001-0000-4000-a000-000000000003',
  'service',
  'All logistics arranged. Hotel confirmed. Transport from Thessaloniki to Evros arranged. 4 sources confirmed for interviews.',
  '2026-04-03T18:00:00Z'
);

INSERT INTO evidence_items (id, fulfilment_submission_id, kind, label, description, file_ref, file_name, file_size_bytes, created_at) VALUES
  ('60000001-0000-4000-a000-000000000016', '50000001-0000-4000-a000-000000000003', 'support_document', 'Logistics plan', 'Full logistics plan for 5 field days', 'docs/logistics-plan-evros.pdf', 'logistics-plan-evros.pdf', 245000, '2026-04-03T17:00:00Z'),
  ('60000001-0000-4000-a000-000000000017', '50000001-0000-4000-a000-000000000003', 'handoff_note', 'Safety briefing notes', 'Safety and protocol briefing for Evros border region', 'docs/safety-briefing.pdf', 'safety-briefing.pdf', 89000, '2026-04-03T17:30:00Z');

INSERT INTO review_records (id, milestone_id, reviewer_id, reviewer_role, determination,
  notes, evidence_basis, created_at)
VALUES (
  '70000001-0000-4000-a000-000000000002',
  '20000001-0000-4000-a000-000000000003',
  '30000001-0000-4000-a000-000000000002',
  'editor', 'accepted',
  'Logistics plan is thorough. Sources are relevant. Safety briefing covers key risks.',
  'Reviewed logistics PDF and safety briefing. Source list verified.',
  '2026-04-04T12:00:00Z'
);

-- Service Milestone 2: Field days 1-3 (ACTIVE)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at)
VALUES (
  '20000001-0000-4000-a000-000000000004',
  '10000001-0000-4000-a000-000000000002',
  2, 'Field days 1-3',
  'On-ground fixering for first 3 field days. Translation, transport, source introductions.',
  'service', 'active',
  '2026-04-15T23:59:00Z',
  'Daily service logs with location, hours, and duties. Handoff notes after each day.',
  ARRAY['service_log', 'handoff_note'],
  100000, false, 3,
  '2026-03-28T10:00:00Z'
);

-- Service Milestone 3: Field days 4-5 + debrief (PENDING)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at)
VALUES (
  '20000001-0000-4000-a000-000000000005',
  '10000001-0000-4000-a000-000000000002',
  3, 'Field days 4-5 + debrief',
  'Final 2 field days plus post-trip debrief and handover.',
  'service', 'pending',
  '2026-04-25T23:59:00Z',
  'Daily service logs. Final debrief document. Source contact handover.',
  ARRAY['service_log', 'handoff_note', 'support_document'],
  80000, false, 3,
  '2026-03-28T10:00:00Z'
);

-- ──────────────────────────────────────────────
-- 3. HYBRID ASSIGNMENT — Lisbon housing crisis coverage
-- ──────────────────────────────────────────────

INSERT INTO assignments (id, buyer_id, creator_id, assignment_class, state, sub_state,
  scope, deadline, acceptance_criteria, required_evidence_types, review_window_days,
  created_at, accepted_at)
VALUES (
  '10000001-0000-4000-a000-000000000003',
  '30000001-0000-4000-a000-000000000003', -- buyer-dw
  '40000001-0000-4000-a000-000000000003', -- creator-ana
  'hybrid', 'in_progress', 'ccr_pending',
  'Coverage of Lisbon housing crisis: 3 days of field interviews (service) plus edited photo essay and short video package (material). Service component includes coordination with local housing activists.',
  '2026-05-10T23:59:00Z',
  'Service: daily logs + handoff notes. Material: 15+ edited photos, 1 video package (3-5 min), editorial quality.',
  ARRAY['vault_asset', 'service_log', 'handoff_note'],
  7,
  '2026-04-05T10:00:00Z',
  '2026-04-06T09:00:00Z'
);

INSERT INTO assignment_rights_records (id, assignment_id,
  asset_usage_rights, asset_exclusivity_terms, asset_duration, asset_territory, asset_publication_scope,
  service_scope_of_work, service_confidentiality, service_attendance_obligations)
VALUES (
  '90000001-0000-4000-a000-000000000003',
  '10000001-0000-4000-a000-000000000003',
  'Non-exclusive editorial licence for video and photo content.',
  'No exclusivity. Creator retains right to publish independently.',
  '1 year from acceptance.',
  'Europe (DW distribution territory)',
  'Editorial use in DW housing and social affairs programming.',
  'On-ground interview coordination, translation (Portuguese/English), access to housing activist networks.',
  'Interview subjects may not be independently contacted without buyer coordination.',
  'Available 08:00-18:00 local time on scheduled interview days.'
);

INSERT INTO escrow_records (id, assignment_id, stripe_payment_intent_id,
  total_captured_cents, total_released_cents, total_refunded_cents, total_frozen_cents, captured_at)
VALUES (
  'a0000001-0000-4000-a000-000000000003',
  '10000001-0000-4000-a000-000000000003',
  'pi_hybrid_001_test',
  286000, 0, 0, 0,
  '2026-04-06T10:00:00Z'
);

-- Hybrid Milestone 1: Service interviews (ACTIVE)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at)
VALUES (
  '20000001-0000-4000-a000-000000000006',
  '10000001-0000-4000-a000-000000000003',
  1, 'Service: Field interviews',
  '3 days of interview coordination with housing activists, residents, and municipal officials.',
  'service', 'active',
  '2026-04-20T23:59:00Z',
  'Daily service logs. Interview handoff notes. Minimum 6 recorded interviews.',
  ARRAY['service_log', 'handoff_note'],
  96000, false, 7,
  '2026-04-05T10:00:00Z'
);

-- Hybrid Milestone 2: Material photo essay + video (PENDING)
INSERT INTO milestones (id, assignment_id, ordinal, title, scope_summary, milestone_type, state,
  due_date, acceptance_criteria, required_evidence_types, releasable_amount_cents,
  partial_acceptance_permitted, review_window_days, created_at)
VALUES (
  '20000001-0000-4000-a000-000000000007',
  '10000001-0000-4000-a000-000000000003',
  2, 'Material: Photo essay + video package',
  'Edited photo essay (15+ images) and short video package (3-5 min) on Lisbon housing crisis.',
  'material', 'pending',
  '2026-05-10T23:59:00Z',
  '15+ edited photos and 1 video package (3-5 min). Editorial quality. Subtitled.',
  ARRAY['vault_asset'],
  190000, true, 7,
  '2026-04-05T10:00:00Z'
);

-- CCR: Pending change request on hybrid assignment
INSERT INTO commission_change_requests (id, assignment_id, requester_id, state, rationale,
  response_deadline, created_at)
VALUES (
  '80000001-0000-4000-a000-000000000001',
  '10000001-0000-4000-a000-000000000003',
  '40000001-0000-4000-a000-000000000003', -- creator-ana requesting
  'pending',
  'Requesting deadline extension and expanded geographic scope. Two additional housing developments in Almada (south bank) have been identified as relevant to the story.',
  '2026-04-18T23:59:00Z',
  '2026-04-11T10:00:00Z'
);

INSERT INTO ccr_amended_fields (id, ccr_id, field, current_value, proposed_value) VALUES
  ('80000002-0000-4000-a000-000000000001', '80000001-0000-4000-a000-000000000001', 'deadline', '2026-05-10', '2026-05-20'),
  ('80000002-0000-4000-a000-000000000002', '80000001-0000-4000-a000-000000000001', 'scope', 'Lisbon municipality only', 'Lisbon municipality + Almada (south bank developments)');

-- ──────────────────────────────────────────────
-- ASSIGNMENT EVENTS — CEL entries for audit trail
-- ──────────────────────────────────────────────

INSERT INTO assignment_events (id, assignment_id, event_type, description, actor_id, actor_role, metadata, idempotency_key, created_at) VALUES
  -- Material assignment events
  ('b0000001-0000-4000-a000-000000000001', '10000001-0000-4000-a000-000000000001', 'assignment_created', 'Assignment brief issued for Porto Alegre flood coverage', '30000001-0000-4000-a000-000000000001', 'buyer', '{"assignmentClass": "material"}', 'evt-mat001-created', '2026-04-01T10:00:00Z'),
  ('b0000001-0000-4000-a000-000000000002', '10000001-0000-4000-a000-000000000001', 'assignment_accepted', 'Creator accepted assignment', '40000001-0000-4000-a000-000000000001', 'creator', '{}', 'evt-mat001-accepted', '2026-04-02T08:00:00Z'),
  ('b0000001-0000-4000-a000-000000000003', '10000001-0000-4000-a000-000000000001', 'escrow_captured', 'Escrow captured: €2,750.00', '30000001-0000-4000-a000-000000000001', 'system', '{"amountCents": 275000, "stripePI": "pi_material_001_test"}', 'evt-mat001-escrow', '2026-04-02T09:00:00Z'),
  ('b0000001-0000-4000-a000-000000000004', '10000001-0000-4000-a000-000000000001', 'milestone_activated', 'Milestone 1 activated: Initial field coverage', '30000001-0000-4000-a000-000000000001', 'system', '{"milestoneId": "20000001-0000-4000-a000-000000000001", "ordinal": 1}', 'evt-mat001-ms1-active', '2026-04-02T09:01:00Z'),
  ('b0000001-0000-4000-a000-000000000005', '10000001-0000-4000-a000-000000000001', 'fulfilment_submitted', 'Fulfilment submitted for milestone 1: 12 vault assets', '40000001-0000-4000-a000-000000000001', 'creator', '{"milestoneId": "20000001-0000-4000-a000-000000000001", "evidenceCount": 12}', 'evt-mat001-ms1-fulfil', '2026-04-13T14:00:00Z'),
  ('b0000001-0000-4000-a000-000000000006', '10000001-0000-4000-a000-000000000001', 'review_recorded', 'Milestone 1 accepted. Full release of €1,200.00', '30000001-0000-4000-a000-000000000001', 'buyer', '{"milestoneId": "20000001-0000-4000-a000-000000000001", "determination": "accepted", "releasedCents": 120000}', 'evt-mat001-ms1-review', '2026-04-14T09:00:00Z'),
  ('b0000001-0000-4000-a000-000000000007', '10000001-0000-4000-a000-000000000001', 'escrow_released', 'Escrow release: €1,200.00 to creator', '30000001-0000-4000-a000-000000000001', 'system', '{"milestoneId": "20000001-0000-4000-a000-000000000001", "amountCents": 120000}', 'evt-mat001-ms1-release', '2026-04-14T09:01:00Z'),
  ('b0000001-0000-4000-a000-000000000008', '10000001-0000-4000-a000-000000000001', 'milestone_activated', 'Milestone 2 activated: Recovery and community impact', '30000001-0000-4000-a000-000000000001', 'system', '{"milestoneId": "20000001-0000-4000-a000-000000000002", "ordinal": 2}', 'evt-mat001-ms2-active', '2026-04-14T09:02:00Z'),
  ('b0000001-0000-4000-a000-000000000009', '10000001-0000-4000-a000-000000000001', 'fulfilment_submitted', 'Fulfilment submitted for milestone 2: 3 vault assets (partial)', '40000001-0000-4000-a000-000000000001', 'creator', '{"milestoneId": "20000001-0000-4000-a000-000000000002", "evidenceCount": 3}', 'evt-mat001-ms2-fulfil', '2026-04-18T15:00:00Z'),

  -- Service assignment events
  ('b0000001-0000-4000-a000-000000000010', '10000001-0000-4000-a000-000000000002', 'assignment_created', 'Assignment brief issued for Greece border fixer services', '30000001-0000-4000-a000-000000000002', 'buyer', '{"assignmentClass": "service"}', 'evt-svc001-created', '2026-03-28T10:00:00Z'),
  ('b0000001-0000-4000-a000-000000000011', '10000001-0000-4000-a000-000000000002', 'assignment_accepted', 'Creator accepted fixer assignment', '40000001-0000-4000-a000-000000000002', 'creator', '{}', 'evt-svc001-accepted', '2026-03-29T07:00:00Z'),
  ('b0000001-0000-4000-a000-000000000012', '10000001-0000-4000-a000-000000000002', 'escrow_captured', 'Escrow captured: €2,200.00', '30000001-0000-4000-a000-000000000002', 'system', '{"amountCents": 220000}', 'evt-svc001-escrow', '2026-03-29T08:00:00Z'),
  ('b0000001-0000-4000-a000-000000000013', '10000001-0000-4000-a000-000000000002', 'milestone_accepted', 'Milestone 1 accepted: Pre-trip logistics', '30000001-0000-4000-a000-000000000002', 'buyer', '{"milestoneId": "20000001-0000-4000-a000-000000000003", "determination": "accepted"}', 'evt-svc001-ms1-accept', '2026-04-04T12:00:00Z'),
  ('b0000001-0000-4000-a000-000000000014', '10000001-0000-4000-a000-000000000002', 'escrow_released', 'Escrow release: €400.00 to creator', '30000001-0000-4000-a000-000000000002', 'system', '{"milestoneId": "20000001-0000-4000-a000-000000000003", "amountCents": 40000}', 'evt-svc001-ms1-release', '2026-04-04T12:01:00Z'),

  -- Hybrid assignment events
  ('b0000001-0000-4000-a000-000000000015', '10000001-0000-4000-a000-000000000003', 'assignment_created', 'Assignment brief issued for Lisbon housing crisis coverage', '30000001-0000-4000-a000-000000000003', 'buyer', '{"assignmentClass": "hybrid"}', 'evt-hyb001-created', '2026-04-05T10:00:00Z'),
  ('b0000001-0000-4000-a000-000000000016', '10000001-0000-4000-a000-000000000003', 'assignment_accepted', 'Creator accepted hybrid assignment', '40000001-0000-4000-a000-000000000003', 'creator', '{}', 'evt-hyb001-accepted', '2026-04-06T09:00:00Z'),
  ('b0000001-0000-4000-a000-000000000017', '10000001-0000-4000-a000-000000000003', 'escrow_captured', 'Escrow captured: €2,860.00', '30000001-0000-4000-a000-000000000003', 'system', '{"amountCents": 286000}', 'evt-hyb001-escrow', '2026-04-06T10:00:00Z'),
  ('b0000001-0000-4000-a000-000000000018', '10000001-0000-4000-a000-000000000003', 'ccr_submitted', 'CCR submitted: deadline extension and scope expansion', '40000001-0000-4000-a000-000000000003', 'creator', '{"ccrId": "80000001-0000-4000-a000-000000000001", "amendedFields": ["deadline", "scope"]}', 'evt-hyb001-ccr1', '2026-04-11T10:00:00Z');

COMMIT;
