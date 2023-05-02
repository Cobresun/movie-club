/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import * as path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      reactivityTransform: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "tests/setup.ts",
    root: "src/",
    coverage: {
      all: true,
      provider: "istanbul",
      reporter: ["text", "json", "html"],
    },
  },
});
