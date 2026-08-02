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
      exclude: ["**/mocks/**", "**/tests/**"],
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
          include: [
            "lib/**/*.{test,spec}.ts",
            "netlify/functions/utils/**/*.{test,spec}.ts",
            "scripts/**/*.{test,spec}.ts",
          ],
        },
      },
    ],
  },
});
