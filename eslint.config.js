import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/*.config.ts",
      "**/*.config.js",
      "examples/**",
      "benchmarks/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts"],
    rules: {
      // No `any` in public API; internal `any` requires a `// why:` comment (conventions.md).
      "@typescript-eslint/no-explicit-any": "error",
      // Interface-conforming stubs legitimately leave args unused; still flag unused vars/imports.
      "@typescript-eslint/no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true }],
      // Packages may only import each other's public entry points, never internals
      // (architecture.md §2). Enforced across the whole @tailrace scope.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tailrace/*/src/*", "@tailrace/*/dist/*", "@tailrace/*/src"],
              message:
                "Import a package's public entry point only (e.g. `@tailrace/core`), never its internals.",
            },
          ],
        },
      ],
    },
  },
);
