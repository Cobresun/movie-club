/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import * as path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Group stable framework/data-layer deps into their own long-cached
        // chunks so app-code changes don't invalidate them. Route-level code
        // splitting (see src/router/index.ts) already isolates the heavy
        // feature views (ag-charts only loads on /statistics and /admin).
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](vue|vue-router|pinia|@vue)[\\/]/.test(id))
            return "vendor-vue";
          if (id.includes("@tanstack")) return "vendor-query";
        },
      },
    },
  },
  test: {
    globals: true,
    // Both inherited by the projects below via `extends: true`.
    restoreMocks: true,
    // Test-runner only; does not affect the app. Keeps date assertions
    // agreeing between a developer's machine and CI, which runs UTC.
    env: { TZ: "UTC" },
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      // Regression guards set just below the levels achieved by the test
      // suite (82.1% stmts / 70.8% branch / 77.6% func / 83.5% lines). The
      // backend jumped from ~63% to ~95% when the handler tests started
      // running against a real database instead of mocked repositories.
      // Raise these as coverage grows; never lower them to merge.
      thresholds: {
        statements: 82,
        branches: 70,
        functions: 77,
        lines: 83,
      },
      include: ["src/**/*.{ts,vue}", "lib/**/*.ts", "netlify/functions/**/*.ts"],
      exclude: [
        "**/mocks/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "lib/types/generated/**",
        "src/main.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          globals: true,
          environment: "jsdom",
          setupFiles: "src/tests/setup.ts",
          include: ["src/**/*.{test,spec}.ts"],
        },
      },
      {
        // Pure units with no DOM and no database. The previous `root: "src/"`
        // made everything outside src/ invisible to the runner, so no backend
        // test could exist at all.
        extends: true,
        test: {
          name: "server",
          globals: true,
          environment: "node",
          setupFiles: "netlify/functions/tests/setup.ts",
          include: [
            "lib/**/*.{test,spec}.ts",
            "netlify/functions/utils/**/*.{test,spec}.ts",
            "scripts/**/*.{test,spec}.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          // Handler-level tests that run against a real CockroachDB started by
          // globalSetup (see netlify/functions/tests/setup/). Requires Docker.
          name: "integration",
          globals: true,
          environment: "node",
          include: ["netlify/functions/tests/**/*.{test,spec}.ts"],
          globalSetup: "netlify/functions/tests/setup/globalSetup.ts",
          setupFiles: "netlify/functions/tests/setup/integration.ts",
          // One worker, one database: the suite resets shared tables between
          // tests, so files must not run concurrently.
          fileParallelism: false,
          // Pulling and booting the container is a one-off cost paid inside
          // globalSetup's budget, and bcrypt makes the first sign-in of a file
          // slower than a unit test.
          testTimeout: 20_000,
          hookTimeout: 120_000,
          teardownTimeout: 60_000,
          // Service credentials the backend reads at import time. Every one of
          // these hosts is intercepted by MSW, so the values only need to exist
          // — except BETTER_AUTH_SECRET, which really does sign the session
          // cookies the tests send.
          env: {
            BETTER_AUTH_URL: "http://localhost:8888",
            BETTER_AUTH_SECRET: "integration-test-secret-integration-test-secret",
            GOOGLE_CLIENT_ID: "test-google-client-id",
            GOOGLE_CLIENT_SECRET: "test-google-client-secret",
            TMDB_API_KEY: "test-tmdb-key",
            GOOGLE_BOOKS_API_KEY: "test-google-books-key",
            GEMINI_API_KEY: "test-gemini-key",
            RESEND_API_KEY: "test-resend-key",
            CLOUDINARY_URL: "cloudinary://test-key:test-secret@test-cloud",
          },
        },
      },
    ],
  },
});
