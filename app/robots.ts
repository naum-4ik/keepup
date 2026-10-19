import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/robots";
import { deploymentSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return robotsRules(deploymentSiteUrl());
}
