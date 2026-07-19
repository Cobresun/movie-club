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
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      exclude: ["**/mocks/**", "**/tests/**"],
    },
    // Two projects: the frontend suite (jsdom, src-rooted) and a lightweight
    // node suite for backend pure-function unit tests (e.g. me/diaryMapping).
    // Backend tests colocate under netlify/functions/**/tests/.
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          globals: true,
          environment: "jsdom",
          setupFiles: "tests/setup.ts",
          root: "src/",
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          globals: true,
          environment: "node",
          include: ["netlify/**/*.spec.ts"],
        },
      },
    ],
  },
});
