import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not auto-generate AGENTS.md / CLAUDE.md in the project root on `next dev`.
  agentRules: false,
};

export default nextConfig;
