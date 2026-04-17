#!/usr/bin/env bun
/**
 * Dual-mode smoke test.
 *
 * Verifies:
 *   - .env.local loads correctly (Supabase vars present)
 *   - isSupabaseConfigured() returns true
 *   - Supabase client connects to remote DB
 *   - Every Phase 1 table is reachable via service role
 *   - pgvector extension works (asset_embeddings table queryable)
 *
 * Run:
 *   bun scripts/verify-dual-mode.ts
 *
 * Service-role only — bypasses RLS deliberately for this smoke check.
 */

import { isSupabaseConfigured, getSupabaseClient } from '../src/lib/db/client'

async function main() {
  console.log('═══ Frontfiles dual-mode smoke test ═══\n')

  // 1. Env vars present?
  const configured = isSupabaseConfigured()
  console.log(`isSupabaseConfigured()  →  ${configured}`)

  if (!configured) {
    console.error('\n❌ Not configured. Verify .env.local contains:')
    console.error('     NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co')
    console.error('     SUPABASE_SERVICE_ROLE_KEY=sb_secret_...')
    process.exit(1)
  }

  // 2. Client instantiates?
  const client = getSupabaseClient()
  console.log('Supabase client        →  created\n')

  // 3. Table accessibility check — service role bypasses RLS
  const tables = [
    'users',
    'vault_assets',
    'asset_media',
    'posts',
    'licence_grants',
    'transactions',
    'companies',
    'company_memberships',
    'assignments',
    'direct_offer_threads',
    'upload_batches',
    'download_events',
    'asset_embeddings',
    'ai_analysis',
    'audit_log',
    'watermark_profiles',
    'creator_profiles',
    'buyer_accounts',
  ]

  console.log('Table accessibility (service-role bypasses RLS):')
  let allOk = true
  for (const t of tables) {
    const { count, error } = await client
      .from(t)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`  ❌ ${t.padEnd(26)} ${error.message}`)
      allOk = false
    } else {
      console.log(`  ✓  ${t.padEnd(26)} ${count ?? 0} rows`)
    }
  }

  // 4. pgvector functional check
  console.log('\npgvector functional check:')
  const { error: pgvErr } = await client
    .from('asset_embeddings')
    .select('asset_id, model, model_version, created_at')
    .limit(1)
  if (pgvErr) {
    console.log(`  ❌ asset_embeddings query failed: ${pgvErr.message}`)
    allOk = false
  } else {
    console.log('  ✓  asset_embeddings queryable (pgvector extension loaded)')
  }

  // 5. Final verdict
  console.log()
  if (allOk) {
    console.log('✅  Phase 1 foundation is live end-to-end.')
    console.log('    The 3 scaffolded stores (auth/provider, post/store,')
    console.log('    providers/store) will hit the real DB when called.')
    process.exit(0)
  } else {
    console.log('⚠️   Some checks failed — see errors above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
