# P4 Prerequisites

**Purpose.** Items that must be resolved **before** P4 migration drafting begins. Surfaced by ECONOMIC_FLOW_v1 revision 5 (2026-04-20) Phase B / Phase C. Each entry: current state, risk, action, owner.

---

## 1. `buyer_company_role` enum relocation

**Current state.** Defined in `supabase/migrations/20260408230001_assignment_engine_enums.sql:142`. Used by the preserved identity-layer table `buyer_company_memberships.role` (`supabase/migrations/20260408230009_identity_tables.sql:163`). Also used internally by the retiring `reviewer_role` enum.

**Risk.** If the P4 migration drops the Assignment Engine enum set with `CASCADE`, this enum dies and `buyer_company_memberships` loses its column type. The identity layer is out of retirement scope per `docs/specs/ECONOMIC_FLOW_v1.md` §14.1 — this would be an unintended collateral drop.

**Action.** Land a new identity-layer migration **before** the economic-layer drop migration that `CREATE TYPE buyer_company_role ... ` under the same value set, then `ALTER TABLE buyer_company_memberships ALTER COLUMN role TYPE buyer_company_role` pointing at the new type location. Then the P4 drop can CASCADE safely. See also: `docs/specs/ECONOMIC_FLOW_v1.md` §14.1 "Preserve without rename at P4" sub-block (revision 6) — spec-level record of this enum's preservation fate.

**Owner.** P4 migration author.

---

## 2. `protect_ready_package()` trigger body inspection

**Current state.** Function defined in `supabase/migrations/20260413230016_transactions_and_certified_packages_v2.sql:483`. Not inspected during Phase B or Phase C. May reference the old table and column names (`certified_packages`, `certified_package_items`, `certified_package_artifacts`, `certification_hash_at_issue`) inside its body. <!-- allow-banned: pre-rename identifiers cited in P4-prerequisite technical description per §9 compound-ban clarification -->

**Risk.** Post-rename the function body still referencing the old identifiers would break on any insert/update to the renamed tables. Silent rollout hazard if not verified.

**Action.** Read the trigger body during P4 migration drafting. If it references any of the renamed identifiers, update the references to match the §14.1 preserve-with-rename targets (`provenance_packages`, `provenance_package_items`, `provenance_package_artifacts`, `provenance_hash_at_issue`) in the same P4 migration that performs the ALTER-TABLE renames.

**Owner.** P4 migration author.

---

## 3. UI deprecation audit

**Current state.** ECONOMIC_FLOW_v1 §12.6 intro line (L468 post-revision-5) references "the P4 implementation plan's UI deprecation audit." That document does not exist yet.

**Risk.** §12.6 carries a dangling cross-reference to an artefact that must exist before P4 executes. The UI surface (vault/offers page, vault/assignments page, /assignment/[id]/** page tree, 19 assignment-domain components, `src/components/asset/AssetRightsModule.tsx` buyer CTA) consumes the 13 retiring routes and will break at P4 without a planned UI retirement plan.

**Action.** The P4 implementation plan must produce the UI deprecation audit as a first-class deliverable. Minimum content: enumerate every UI page, component, hook, and fetch call-site that consumes any of the 13 retiring routes; classify each (delete / rewrite against new spec-canonical routes / migrate to new spec-canonical routes); sequence the UI retirements relative to the migration cut-over.

**Owner.** P4 planning author.

---

## 4. Founder confirmation on 7 enum fates

**RESOLVED 2026-04-20 (revision 6).** Adjudication: six enums preserve without rename (`transaction_kind`, `transaction_status`, `package_kind`, `package_status`, `artifact_status`, `buyer_company_role`); one confirms parent-enum preservation with pre-captured value rename (`package_artifact_type`). Canonical source of record: `docs/specs/ECONOMIC_FLOW_v1.md` §14.1 "Preserve without rename at P4" sub-block + revision 6 entry at §15. `buyer_company_role` P4 migration-sequencing prerequisite remains open under Entry 1 above.

---

_End of P4 prerequisites._
