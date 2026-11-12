import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so the Cloudflare/PWA plugins don't load for unit tests.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
