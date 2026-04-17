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

-- ════════════════════════════════════════════════════════════════
-- IDENTITY LAYER SEED (Phase A)
--
-- Seeds the users / user_granted_types / creator_profiles /
-- buyer_accounts rows that the assignment and direct-offer seed
-- above references via fk_*_buyer / fk_*_creator (NOT VALID,
-- added in migration 11). Inserting these rows means a subsequent
--
--   ALTER TABLE assignments VALIDATE CONSTRAINT fk_assignments_buyer;
--   ALTER TABLE assignments VALIDATE CONSTRAINT fk_assignments_creator;
--
-- will now succeed for the first three creators and buyers. The
-- full 24-creator mock set lives in src/data/users.ts and is
-- loaded into the in-memory identity store at runtime; that
-- mapping uses string ids ('creator-001'..) and is deliberately
-- parallel to this UUID-based SQL seed. Full reconciliation is
-- planned for a later phase.
--
-- UUID pattern:
--   Buyers    30000001..30000003 (matching existing assignment seed)
--   Creators  40000001..40000024 (creators 001-024)
-- ════════════════════════════════════════════════════════════════

-- USERS -- creators 001-024

INSERT INTO users (id, username, display_name, email, avatar_url, account_state, founding_member, created_at, updated_at) VALUES
  ('40000001-0000-4000-a000-000000000001', 'marcooliveira', 'Marco Oliveira', 'marcooliveira@frontfiles.test', '/assets/avatars/pexels-edwin-malca-cerna-1875492332-32772332.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000002', 'anasousa', 'Ana Sousa', 'anasousa@frontfiles.test', '/assets/avatars/pexels-caroline-veronez-112078470-10153201.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000003', 'dimitriskatsaros', 'Dimitris Katsaros', 'dimitriskatsaros@frontfiles.test', '/assets/avatars/pexels-imadclicks-9712871.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000004', 'luciaferrante', 'Lucia Ferrante', 'luciaferrante@frontfiles.test', '/assets/avatars/pexels-efrem-efre-2786187-13824575.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000005', 'yaraboukhari', 'Yara Boukhari', 'yaraboukhari@frontfiles.test', '/assets/avatars/pexels-thefullonmonet-17608522.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000006', 'tomasznowak', 'Tomasz Nowak', 'tomasznowak@frontfiles.test', '/assets/avatars/pexels-apunto-group-agencia-de-publicidad-53086916-7752812.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000007', 'elenavasile', 'Elena Vasile', 'elenavasile@frontfiles.test', '/assets/avatars/pexels-kirill-ozerov-109766512-9835449.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000008', 'carmenruiz', 'Carmen Ruiz', 'carmenruiz@frontfiles.test', '/assets/avatars/pexels-pexels-latam-478514802-16135619.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000009', 'nikospapadopoulos', 'Nikos Papadopoulos', 'nikospapadopoulos@frontfiles.test', '/assets/avatars/pexels-gaurav-vishwakarma-3386298-14591977.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000010', 'sarahchen', 'Sarah Chen', 'sarahchen@frontfiles.test', '/assets/avatars/pexels-anete-lusina-4793183.jpg', 'active', true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000011', 'kofimensah', 'Kofi Mensah', 'kofimensah@frontfiles.test', '/assets/avatars/pexels-cottonbro-7611746.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000012', 'priyasharma', 'Priya Sharma', 'priyasharma@frontfiles.test', '/assets/avatars/pexels-bethany-ferr-5176816.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000013', 'fatimaalrashid', 'Fatima Al-Rashid', 'fatimaalrashid@frontfiles.test', '/assets/avatars/pexels-talie-photo-69424917-8346242.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000014', 'larseriksson', 'Lars Eriksson', 'larseriksson@frontfiles.test', '/assets/avatars/portrait-man-grey-hair-glasses.jpeg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000015', 'aikotanaka', 'Aiko Tanaka', 'aikotanaka@frontfiles.test', '/assets/avatars/portrait-woman-asian-dark-hair.jpeg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000016', 'carlosmendoza', 'Carlos Mendoza', 'carlosmendoza@frontfiles.test', '/assets/avatars/pexels-imadclicks-19055975.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000017', 'aminadiallo', 'Amina Diallo', 'aminadiallo@frontfiles.test', '/assets/avatars/pexels-rk-photography-32275125.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000018', 'jamesobrien', 'James O''Brien', 'jamesobrien@frontfiles.test', '/assets/avatars/portrait-man-stubble-grey-bg.jpeg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000019', 'oluwaseunadeyemi', 'Oluwaseun Adeyemi', 'oluwaseunadeyemi@frontfiles.test', '/assets/avatars/pexels-aidemstudios-35933269.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000020', 'mariamtoure', 'Mariam Touré', 'mariamtoure@frontfiles.test', '/assets/avatars/pexels-adietska-kaka-plur-346078987-14232669.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000021', 'abdirahimhassan', 'Abdirahim Hassan', 'abdirahimhassan@frontfiles.test', '/assets/avatars/pexels-aslam-shah-938590627-20777265.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000022', 'yasminalharazi', 'Yasmin Al-Harazi', 'yasminalharazi@frontfiles.test', '/assets/avatars/pexels-hesam-khodaei-1595988017-28086182.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000023', 'tigisthaile', 'Tigist Haile', 'tigisthaile@frontfiles.test', '/assets/avatars/pexels-thais-simplicio-483156064-15935639.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('40000001-0000-4000-a000-000000000024', 'khalidibrahim', 'Khalid Ibrahim', 'khalidibrahim@frontfiles.test', '/assets/avatars/pexels-cottonbro-7618402.jpg', 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- USERS -- buyers (matches assignment seed buyer refs)

INSERT INTO users (id, username, display_name, email, avatar_url, account_state, founding_member, created_at, updated_at) VALUES
  ('30000001-0000-4000-a000-000000000001', 'buyerreuters', 'Reuters Desk', 'desk.reuters@frontfiles.test', NULL, 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('30000001-0000-4000-a000-000000000002', 'buyerborderwire', 'Borderwire Editorial', 'editorial.borderwire@frontfiles.test', NULL, 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('30000001-0000-4000-a000-000000000003', 'buyerechocoverage', 'Echo Coverage', 'desk.echocoverage@frontfiles.test', NULL, 'active', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- USER_GRANTED_TYPES

INSERT INTO user_granted_types (user_id, user_type) VALUES
  ('40000001-0000-4000-a000-000000000001', 'creator'),
  ('40000001-0000-4000-a000-000000000002', 'creator'),
  ('40000001-0000-4000-a000-000000000003', 'creator'),
  ('40000001-0000-4000-a000-000000000004', 'creator'),
  ('40000001-0000-4000-a000-000000000005', 'creator'),
  ('40000001-0000-4000-a000-000000000006', 'creator'),
  ('40000001-0000-4000-a000-000000000007', 'creator'),
  ('40000001-0000-4000-a000-000000000008', 'creator'),
  ('40000001-0000-4000-a000-000000000009', 'creator'),
  ('40000001-0000-4000-a000-000000000010', 'creator'),
  -- Sarah Chen is the demo session user with all three grants
  ('40000001-0000-4000-a000-000000000010', 'buyer'),
  ('40000001-0000-4000-a000-000000000010', 'reader'),
  ('40000001-0000-4000-a000-000000000011', 'creator'),
  ('40000001-0000-4000-a000-000000000012', 'creator'),
  ('40000001-0000-4000-a000-000000000013', 'creator'),
  ('40000001-0000-4000-a000-000000000014', 'creator'),
  ('40000001-0000-4000-a000-000000000015', 'creator'),
  ('40000001-0000-4000-a000-000000000016', 'creator'),
  ('40000001-0000-4000-a000-000000000017', 'creator'),
  ('40000001-0000-4000-a000-000000000018', 'creator'),
  ('40000001-0000-4000-a000-000000000019', 'creator'),
  ('40000001-0000-4000-a000-000000000020', 'creator'),
  ('40000001-0000-4000-a000-000000000021', 'creator'),
  ('40000001-0000-4000-a000-000000000022', 'creator'),
  ('40000001-0000-4000-a000-000000000023', 'creator'),
  ('40000001-0000-4000-a000-000000000024', 'creator'),
  ('30000001-0000-4000-a000-000000000001', 'buyer'),
  ('30000001-0000-4000-a000-000000000002', 'buyer'),
  ('30000001-0000-4000-a000-000000000003', 'buyer');

-- CREATOR_PROFILES
-- Each row is 1:1 with the matching users row via UNIQUE(user_id).
-- Example rows seeded below; the full canonical set lives in
-- src/data/users.ts and is loaded into the mock identity store
-- automatically. Extend this block as Supabase-mode scenarios
-- require more creators.

INSERT INTO creator_profiles (user_id, professional_title, location_base, website_url, biography, trust_tier, trust_badge, verification_status, last_verified_at, coverage_areas, specialisations, media_affiliations, press_accreditations, published_in, skills, also_me_links) VALUES
  ('40000001-0000-4000-a000-000000000001', 'Photojournalist, Southern Brazil', 'Porto Alegre, Brazil', 'https://marcooliveira.press', 'Video and photo journalist covering displacement, flood events, and urban settlement disputes across southern Brazil since 2016.', 'standard', 'verified', 'verified', '2026-03-02T00:00:00Z', ARRAY['Rio Grande do Sul','Southern Brazil','São Paulo'], ARRAY['Flood documentation','Displacement coverage','Aerial survey','Settlement reporting'], ARRAY['Agência Brasil','Folha de S.Paulo','Reuters'], ARRAY['Federação Nacional dos Jornalistas','Rio Grande do Sul Press Association'], ARRAY['Agência Brasil','Folha de S.Paulo','Reuters','Le Monde'], ARRAY['Flood documentation','Drone operation','Field reporting','Video journalism'], ARRAY['https://linkedin.com/in/marcooliveira-journalist','https://twitter.com/marcooliveira']),
  ('40000001-0000-4000-a000-000000000002', 'Parliamentary Photographer, Lisbon', 'Lisbon, Portugal', 'https://anasousa.photo', 'Institutional and parliamentary photographer based in Lisbon.', 'standard', 'verified', 'verified', '2026-03-03T00:00:00Z', ARRAY['Lisbon','Setúbal','Alentejo'], ARRAY['Parliamentary photography','Institutional documentation','Coastal reporting','Storm coverage'], ARRAY['Agência Lusa','Público','Jornal de Negócios'], ARRAY['Assembleia da República Press Gallery','Sindicato dos Jornalistas'], ARRAY['Agência Lusa','Público','The Guardian','El País'], ARRAY['Parliamentary photography','Institutional documentation','Portrait photography','Storm coverage'], ARRAY['https://linkedin.com/in/anasousa-photo','https://twitter.com/anasousaphoto']),
  ('40000001-0000-4000-a000-000000000003', 'Border Correspondent, Evros Region', 'Alexandroupoli, Greece', 'https://dimitriskatsaros.com', 'Documentarian covering the Evros border region since 2019.', 'standard', 'verified', 'verified', '2026-03-04T00:00:00Z', ARRAY['Evros','Northern Greece','Eastern Aegean'], ARRAY['Border documentation','Migration route reporting','Logistics photography','Checkpoint coverage'], ARRAY['Kathimerini','SKAI TV','InfoMigrants'], ARRAY['Hellenic Federation of Journalists','EU External Borders Press Accreditation'], ARRAY['Kathimerini','InfoMigrants','Balkan Insight','Der Spiegel'], ARRAY['Border documentation','Migration reporting','Long-form documentary','Logistics photography'], ARRAY['https://linkedin.com/in/dimitriskatsaros','https://twitter.com/dkatsaros']),
  ('40000001-0000-4000-a000-000000000010', 'Senior Correspondent, Asia Pacific', 'Hong Kong', 'https://sarahchen.press', 'Award-winning journalist covering conflict, climate, and technology across Asia Pacific for over 12 years.', 'standard', 'verified', 'verified', '2026-03-11T00:00:00Z', ARRAY['China','Hong Kong','Taiwan','Southeast Asia'], ARRAY['Conflict reporting','Climate documentation','Technology','Regional politics'], ARRAY['Reuters','South China Morning Post','Foreign Policy'], ARRAY['Foreign Correspondents'' Club of China','Hong Kong Journalists Association'], ARRAY['Reuters','South China Morning Post','Foreign Policy','The Guardian'], ARRAY['Long-form Reporting','Photojournalism','Video Production','Data Journalism'], ARRAY['https://linkedin.com/in/sarahchen-journalist','https://twitter.com/sarahchenreports']);

-- BUYER_ACCOUNTS
-- Sarah Chen also carries an individual buyer facet so her
-- multi-role demo session keeps working end-to-end.

INSERT INTO buyer_accounts (user_id, buyer_type, company_name, vat_number, tax_id) VALUES
  ('30000001-0000-4000-a000-000000000001', 'company', 'Reuters News Desk', NULL, NULL),
  ('30000001-0000-4000-a000-000000000002', 'company', 'Borderwire Editorial', NULL, NULL),
  ('30000001-0000-4000-a000-000000000003', 'company', 'Echo Coverage', NULL, NULL),
  ('40000001-0000-4000-a000-000000000010', 'individual', NULL, NULL, NULL);

COMMIT;
