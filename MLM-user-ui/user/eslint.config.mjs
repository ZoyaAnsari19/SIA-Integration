import { defineConfig } from "eslint/config";
import pluginImport from "eslint-plugin-import";
import nextPlugin from "@next/eslint-plugin-next";

const eslintConfig = defineConfig([
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      import: pluginImport,
      "@next/next": nextPlugin,
    },
    rules: {
      // Next.js recommended rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Enforce ES module named imports and disallow CommonJS
      "import/no-commonjs": "error",
      // Disallow default imports from internal modules; external libs allowed
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/**"],
              importNames: ["default"],
              message:
                "Use named imports instead of default imports for internal modules.",
            },
          ],
        },
      ],
      // Keep import order consistent and alphabetical within groups
      "sort-imports": ["error", { ignoreDeclarationSort: true }],
      "import/order": [
        "error",
        {
          groups: [
            ["builtin", "external"],
            "internal",
            ["parent", "sibling", "index"],
          ],
          pathGroups: [
            { pattern: "@/**", group: "internal", position: "after" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
    },
  },
]);

export default eslintConfig;
