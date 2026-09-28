import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inlined at build time: Vercel builds set VERCEL_GIT_COMMIT_SHA, GitHub Actions set GITHUB_SHA.
  env: {
    APP_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          // Only frame-ancestors here, not a full CSP: this is a targeted clickjacking
          // defense, not the app's content security policy.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
