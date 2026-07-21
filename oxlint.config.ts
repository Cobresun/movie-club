import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "vue", "import"],
  jsPlugins: [{ name: "@tanstack/query", specifier: "@tanstack/eslint-plugin-query" }],
  rules: {
    "eslint/block-scoped-var": "error",
    "eslint/eqeqeq": "error",
    "eslint/no-var": "error",
    "eslint/prefer-arrow-callback": "error",
    "eslint/no-restricted-globals": [
      "error",
      "event",
      "length",
      "stop",
      "toString",
      "alert",
    ],
    "typescript/method-signature-style": "error",
    "typescript/switch-exhaustiveness-check": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/strict-boolean-expressions": [
      "error",
      { allowNumber: false },
    ],
    "import/newline-after-import": "error",
    "@tanstack/query/exhaustive-deps": "error",
    "@tanstack/query/stable-query-client": "error",
    "@tanstack/query/no-rest-destructuring": "warn",
    "@tanstack/query/no-unstable-deps": "error",
    "@tanstack/query/infinite-query-property-order": "error",
    "@tanstack/query/no-void-query-fn": "error",
    "@tanstack/query/mutation-property-order": "error",
  },
  options: {
    typeAware: true,
  },
});
