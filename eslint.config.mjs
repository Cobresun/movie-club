import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import tanstackEslint from "@tanstack/eslint-plugin-query";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettierConfig from "@vue/eslint-config-prettier";
import importPlugin from "eslint-plugin-import";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules",
      ".netlify",
      "eslint.config.mjs",
      "**/generated/**",
    ],
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  ...pluginVue.configs["flat/recommended"],
  ...tanstackEslint.configs["flat/recommended"],
  prettierConfig,
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        project: ["tsconfig.json"],
        extraFileExtensions: [".vue"],
        sourceType: "module",
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "block-scoped-var": "error",
      eqeqeq: "error",
      "no-var": "error",
      "prefer-arrow-callback": "error",
      "no-restricted-globals": [
        "error",
        "event",
        "length",
        "stop",
        "toString",
        "alert",
      ],
      "@typescript-eslint/method-signature-style": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNumber: false,
        },
      ],
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"],
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/newline-after-import": "error",
    },
  },
  {
    // Test-file overrides: these rules false-positive on idiomatic Vitest
    // patterns — `expect(Repo.method)` trips unbound-method, inline harness
    // components trip one-component-per-file, and async mocks matching
    // Promise-returning production signatures trip require-await.
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/require-await": "off",
      "vue/one-component-per-file": "off",
    },
  },
];
