import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { SITE_URL, markdownUrlForDocsPath } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/llms.txt`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/llms-full.txt`,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  for (const page of pages) {
    entries.push({
      url: `${SITE_URL}${page.url}`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: {
          // Alternate annotation for the markdown variant (agents / scrapers).
          "x-markdown": `${SITE_URL}${markdownUrlForDocsPath(page.url)}`,
        },
      },
    });
  }

  return entries;
}
