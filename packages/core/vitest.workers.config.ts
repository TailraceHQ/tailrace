import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// Runs the core suite under workerd to prove @tailrace/core works on the edge runtime
// (docs/architecture.md §3). The `nodejs_compat` flag is mandated by the pool runner itself,
// not by core - core's own source uses only WebCrypto and no `node:` imports.
export default defineWorkersConfig({
  test: {
    include: ["src/**/*.test.ts"],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2024-11-06",
          compatibilityFlags: ["nodejs_compat"],
        },
      },
    },
  },
});
