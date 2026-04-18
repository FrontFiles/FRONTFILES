import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Loads .env.local (and the rest of Next.js's env chain) into
    // process.env BEFORE any test module imports src/lib/env.ts.
    // See vitest.setup.ts for rationale.
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
