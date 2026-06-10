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
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      include: ["src/**", "lib/**", "netlify/functions/**"],
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
