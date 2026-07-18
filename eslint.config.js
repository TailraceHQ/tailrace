import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/.source/**",
      "packages/cli/templates/**",
      "**/*.config.ts",
      "**/*.config.js",
      "**/*.config.mjs",
      "apps/**",
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
  // @tailrace/http must stay host-agnostic (architecture.md §2 / M9).
  {
    files: ["packages/http/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "hono",
              message: "@tailrace/http must not import host frameworks.",
            },
            {
              name: "express",
              message: "@tailrace/http must not import host frameworks.",
            },
            {
              name: "fastify",
              message: "@tailrace/http must not import host frameworks.",
            },
            {
              name: "@nestjs/common",
              message: "@tailrace/http must not import host frameworks.",
            },
            {
              name: "encore.dev",
              message: "@tailrace/http must not import host frameworks.",
            },
            {
              name: "@trpc/server",
              message: "@tailrace/http must not import host frameworks.",
            },
          ],
          patterns: [
            {
              group: ["@tailrace/*/src/*", "@tailrace/*/dist/*", "@tailrace/*/src"],
              message:
                "Import a package's public entry point only (e.g. `@tailrace/core`), never its internals.",
            },
            {
              group: [
                "@tailrace/hono",
                "@tailrace/express",
                "@tailrace/fastify",
                "@tailrace/nestjs",
                "@tailrace/encore",
                "@tailrace/trpc",
                "@tailrace/ai-sdk",
                "@tailrace/adapter",
              ],
              message: "@tailrace/http may only depend on @tailrace/core.",
            },
          ],
        },
      ],
    },
  },
  // HTTP gateway packages must not import each other (architecture.md §2).
  {
    files: [
      "packages/hono/src/**/*.ts",
      "packages/express/src/**/*.ts",
      "packages/fastify/src/**/*.ts",
      "packages/nestjs/src/**/*.ts",
      "packages/encore/src/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tailrace/*/src/*", "@tailrace/*/dist/*", "@tailrace/*/src"],
              message:
                "Import a package's public entry point only (e.g. `@tailrace/core`), never its internals.",
            },
            {
              group: [
                "@tailrace/hono",
                "@tailrace/express",
                "@tailrace/fastify",
                "@tailrace/nestjs",
                "@tailrace/encore",
              ],
              message:
                "HTTP gateway packages must not import each other; share logic via @tailrace/http.",
            },
          ],
        },
      ],
    },
  },
  // @tailrace/trpc uses adapter, not http (architecture.md §2 / M9).
  {
    files: ["packages/trpc/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tailrace/*/src/*", "@tailrace/*/dist/*", "@tailrace/*/src"],
              message:
                "Import a package's public entry point only (e.g. `@tailrace/core`), never its internals.",
            },
            {
              group: ["@tailrace/http", "@tailrace/hono", "@tailrace/express"],
              message: "@tailrace/trpc must use @tailrace/adapter, not @tailrace/http.",
            },
          ],
        },
      ],
    },
  },
);
