import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@tailrace/core", "@tailrace/cloud"],
  turbopack: {
    root: path.join(appDir, "../.."),
  },
};

export default nextConfig;
