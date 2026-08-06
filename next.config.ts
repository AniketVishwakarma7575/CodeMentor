import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shiki ships large grammar/theme payloads; keep them server-side.
  serverExternalPackages: ["shiki"],
};

export default nextConfig;
