import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

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
