import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tailrace/core", "@tailrace/ai-sdk"],
};

export default nextConfig;
