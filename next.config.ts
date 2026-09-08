import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.7"],
  agentRules: false,
  reactStrictMode: true,
};

export default nextConfig;
