import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// SUPABASE_SERVICE_ROLE_KEY bypasses RLS — it must never reach a
// client bundle. Next.js ships everything under `src/app/` and
// `src/components/` that imports into a client boundary, so any
// literal reference to the key (or `process.env.SUPABASE_SERVICE_
// ROLE_KEY`) from those paths is a lint error. Server-only code
// lives under `src/lib/` and `src/app/api/**`; it reaches the key
// via `getSupabaseClient()` or `env.SUPABASE_SERVICE_ROLE_KEY` from
// `src/lib/env.ts`.
//
// Paired with supabase/migrations/20260420000000_rls_all_tables.sql,
// this rule enforces the "RLS is primary security boundary; UI is
// defence-in-depth" guarantee from AGENTS.md.
const serviceRoleKeyRules = {
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='SUPABASE_SERVICE_ROLE_KEY']",
      message:
        "SUPABASE_SERVICE_ROLE_KEY is server-only — bypasses RLS. Never reference it from src/app/ or src/components/. Use getSupabaseClient() from src/lib/db/client.ts inside an API route instead.",
    },
    {
      selector: "Literal[value='SUPABASE_SERVICE_ROLE_KEY']",
      message:
        "The literal 'SUPABASE_SERVICE_ROLE_KEY' is forbidden in src/app/ and src/components/. Route service-role work through an API handler that calls getSupabaseClient().",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Scope matches the verification grep in the CCP 2 spec exactly:
    //   grep -r "SUPABASE_SERVICE_ROLE_KEY" src/app/ src/components/
    files: ["src/app/**/*.{ts,tsx,js,jsx}", "src/components/**/*.{ts,tsx,js,jsx}"],
    rules: serviceRoleKeyRules,
  },
]);

export default eslintConfig;
