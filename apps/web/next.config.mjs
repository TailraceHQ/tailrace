import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();
const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Twoslash type-checks snippets at build time (docs/site/DOCS_AGENTS.md D0).
  serverExternalPackages: ["typescript", "twoslash"],
  transpilePackages: ["@tailrace/core"],
  // Pin Turbopack to the monorepo root so a parent lockfile is not inferred.
  turbopack: {
    root: path.join(appDir, "../.."),
  },
};

export default withMDX(config);
