import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Colocated unit tests (src) run in both Node and workerd pools; Node-only integration
    // tests (fixtures via fs, perf timing) live in tests/ and run in this Node config only.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
