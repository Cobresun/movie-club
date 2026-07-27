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
    // Pin the timezone so date assertions mean the same thing everywhere.
    // Components format date-only strings with `new Date(...)` (parsed as UTC)
    // and `toLocaleDateString` (rendered locally), so west of Greenwich a
    // release date renders as the previous day — CI runs UTC and would
    // disagree with a developer's machine. Inherited by both projects.
    env: { TZ: "UTC" },
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      // Regression guards set just below the levels achieved by the test
      // suite (73.9% stmts / 65.4% branch / 68.6% func / 74.8% lines after
      // covering every statistics widget and view, plus the reviews gallery,
      // table, discussion questions, and add-review prompt).
      // Raise these as coverage grows; never lower them to merge.
      thresholds: {
        statements: 73,
        branches: 65,
        functions: 68,
        lines: 74,
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
          include: ["lib/**/*.{test,spec}.ts", "netlify/functions/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
});
