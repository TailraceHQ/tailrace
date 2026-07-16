import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: [
    "@tailrace/core",
    "@tailrace/adapter",
    "@tailrace/ai-sdk",
    "ai",
    "@ai-sdk/provider",
    "agents",
  ],
});
