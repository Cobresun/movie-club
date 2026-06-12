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
        // feature views (ag-charts only loads on /statistics).
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
    // Restore every spy/mock to its original implementation after each test so
    // mock state never leaks between tests (a vi.spyOn or mockResolvedValue set
    // in one test cannot silently change the next). Inherited by both projects
    // via `extends: true`.
    restoreMocks: true,
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      // Regression guards set just below the levels achieved by the test
      // suite (61% stmts / 52% branch / 53% func / 61% lines after the
      // profile/settings/watch-list/awards/reviews follow-up coverage).
      // Raise these as coverage grows; never lower them to merge.
      thresholds: {
        statements: 60,
        branches: 51,
        functions: 52,
        lines: 61,
      },
      include: [
        "src/**/*.{ts,vue}",
        "lib/**/*.ts",
        "netlify/functions/**/*.ts",
      ],
      exclude: [
        "**/mocks/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "lib/types/generated/**",
        "src/main.ts",
        // Bootstrap/config modules that only wire up external services at
        // import time; nothing to unit test without a live DB or env secrets.
        "netlify/functions/utils/database.ts",
        "netlify/functions/utils/auth.ts",
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
        extends: true,
        test: {
          name: "server",
          globals: true,
          environment: "node",
          include: [
            "lib/**/*.{test,spec}.ts",
            "netlify/functions/**/*.{test,spec}.ts",
          ],
        },
      },
    ],
  },
});
