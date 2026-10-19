import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/robots";
import { deploymentSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(deploymentSiteUrl());
}
