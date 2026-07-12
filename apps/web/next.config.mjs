import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();
const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Twoslash type-checks snippets at build time (docs/site/DOCS_AGENTS.md D0).
  // Keep lightningcss / oxide native bindings out of the Turbopack PostCSS worker
  // bundle so `process.arch` is not replaced with a wrong compile-time target
  // (otherwise arm64 macOS looks for lightningcss.darwin-x64.node).
  serverExternalPackages: ["typescript", "twoslash", "lightningcss", "@tailwindcss/oxide"],
  transpilePackages: ["@tailrace/core"],
  // Pin Turbopack to the monorepo root so a parent lockfile is not inferred.
  turbopack: {
    root: path.join(appDir, "../.."),
  },
};

export default withMDX(config);
