import { NEW_ORIGIN } from "@/lib/moved";

// The absolute address share cards (og:url, og:image) point to. Production names its address itself:
// Vercel's VERCEL_PROJECT_PRODUCTION_URL can be any domain attached to the project, and since the old
// keepup-murex domain was attached to keepup-prod it reported that one. Elsewhere (staging, previews)
// Vercel's production address; locally localhost.
export function siteUrl(env: { deployEnv?: string; vercelProductionUrl?: string }): string {
  if (env.deployEnv?.trim() === "production") return NEW_ORIGIN;
  if (env.vercelProductionUrl) return `https://${env.vercelProductionUrl}`;
  return "http://localhost:3000";
}
