import type { InferPageType } from "fumadocs-core/source";
import { renderPlaceholder } from "fumadocs-core/mdx-plugins/remark-llms.runtime";
import { source } from "@/lib/source";
import { absoluteUrl } from "@/lib/site";

export type DocsPage = InferPageType<typeof source>;

/**
 * Render a docs page as plain markdown for agents (and Copy as Markdown).
 * Uses Fumadocs processed markdown so tabs/MDX components flatten without JSX residue.
 */
export async function getLLMText(page: DocsPage): Promise<string> {
  const processed = await page.data.getText("processed");
  const body = await renderPlaceholder(processed, {
    FlowDemo() {
      return "*(Interactive detect → policy → apply pipeline demo - open the HTML page to try it.)*";
    },
    Mermaid(data: { attributes?: { chart?: string } }) {
      const chart = data.attributes?.chart ?? "";
      return `\`\`\`mermaid\n${chart}\n\`\`\``;
    },
  });
  const url = absoluteUrl(page.url);
  const description =
    typeof page.data.description === "string" && page.data.description.length > 0
      ? `\n\n> ${page.data.description}`
      : "";

  return `# ${page.data.title}

URL: ${url}${description}

${body}`;
}

/**
 * Resolve a docs page from a full URL, `/docs/...` path, or slug segments.
 */
export function resolveDocsPage(urlOrSlug: string): DocsPage | undefined {
  const raw = urlOrSlug.trim();
  if (raw.length === 0) return undefined;

  let pathname = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      pathname = new URL(raw).pathname;
    }
  } catch {
    return undefined;
  }

  pathname = pathname.replace(/\.mdx?$/i, "").replace(/\/$/, "");
  if (pathname.startsWith("/docs")) {
    const rest = pathname.slice("/docs".length).replace(/^\//, "");
    const slug = rest.length === 0 ? undefined : rest.split("/");
    return source.getPage(slug);
  }

  const slug = pathname.replace(/^\//, "").split("/").filter(Boolean);
  return source.getPage(slug.length === 0 ? undefined : slug);
}
