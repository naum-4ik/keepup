import type { MetadataRoute } from "next";

// Crawlers may read the public pages (/, /privacy, /install, /whats-new) and nothing behind a sign-in.
// "Allow: /" is a prefix match, so every app route is listed in Disallow. No sitemap.
export const DISALLOWED = [
  "/today",
  "/progress",
  "/habits",
  "/groups",
  "/inbox",
  "/kids",
  "/profile",
  "/onboarding",
  "/login",
  "/signup",
  "/auth",
  "/invite",
  "/offline",
  "/api",
];

export function robotsRules(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: DISALLOWED } };
}
