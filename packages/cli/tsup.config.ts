import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    external: ["@tailrace/core"],
  },
  {
    // CJS bin: faster cold-start than ESM for hook spawn-to-exit budget.
    entry: { cli: "src/cli.ts" },
    format: ["cjs"],
    outExtension: () => ({ js: ".cjs" }),
    dts: false,
    clean: false,
    sourcemap: false,
    minify: true,
    target: "es2022",
    noExternal: ["@tailrace/core"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
