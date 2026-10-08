import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not auto-generate AGENTS.md / CLAUDE.md in the project root on `next dev`.
  agentRules: false,
  // Native/dynamic-require driver: load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["snowflake-sdk"],
};

export default nextConfig;
