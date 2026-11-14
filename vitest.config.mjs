// UNIT TESTS + COVERAGE
// Fails if any line, branch or function in your logic files is not exercised by a test.
import { defineConfig } from 'vitest/config';
import cfg from './kit.config.mjs';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{js,mjs}'],
    reporters: process.env.CI ? ['default', 'github-actions'] : ['dot'],
    coverage: {
      provider: 'v8',
      include: cfg.logic,
      exclude: [...cfg.ignore, 'tests/**'],
      reportsDirectory: 'reports/coverage',
      reporter: ['text-summary', 'html', 'json-summary'],
      thresholds: {
        lines: cfg.coverage,
        statements: cfg.coverage,
        functions: cfg.coverage,
        branches: cfg.coverage,
      },
    },
  },
});
