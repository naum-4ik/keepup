import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inlined at build time: Vercel builds set VERCEL_GIT_COMMIT_SHA, GitHub Actions set GITHUB_SHA.
  env: {
    APP_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "",
  },
};

export default nextConfig;
