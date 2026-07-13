import { llms } from "fumadocs-core/source";
import type { InferPageType } from "fumadocs-core/source";
import { source } from "@/lib/source";
import { absoluteUrl, markdownUrlForDocsPath } from "@/lib/site";
import { getLLMText } from "@/lib/get-llm-text";

type DocsPage = InferPageType<typeof source>;

/**
 * Paths included in the curated `/llms.txt` router (not every reference leaf).
 * Keep under ~60 links so the index fits a context window.
 */
const CURATED_PREFIXES = [
  "/docs",
  "/docs/get-started",
  "/docs/guides",
  "/docs/concepts",
  "/docs/integrations",
  "/docs/reference",
  "/docs/reference/cli",
  "/docs/reference/mcp",
  "/docs/reference/hono",
  "/docs/reference/ai-sdk",
  "/docs/reference/errors",
  "/docs/reference/policy-schema",
  "/docs/playground",
] as const;

function isCurated(url: string): boolean {
  if (CURATED_PREFIXES.some((p) => url === p || url.startsWith(`${p}/`))) {
    // Exclude deep AI SDK leaf pages from the router; keep the section index.
    if (url.startsWith("/docs/reference/ai-sdk/") && url !== "/docs/reference/ai-sdk") {
      return false;
    }
    return true;
  }
  return false;
}

function mdHref(pageUrl: string): string {
  return absoluteUrl(markdownUrlForDocsPath(pageUrl));
}

/**
 * Curated llms.txt index with absolute `.md` URLs.
 */
export function buildLlmsTxt(): string {
  const pages = source.getPages().filter((p) => isCurated(p.url));
  const bySection = new Map<string, DocsPage[]>();

  for (const page of pages) {
    const parts = page.url.split("/").filter(Boolean);
    // docs / section / ...
    const section = parts[1] ?? "root";
    const list = bySection.get(section) ?? [];
    list.push(page);
    bySection.set(section, list);
  }

  const lines: string[] = [
    "# Tailrace",
    "",
    "> TypeScript-native agent data governance: in-process detection, reversible tokenization, and per-agent policy at model, tool, and MCP boundaries.",
    "",
    `Full corpus: ${absoluteUrl("/llms-full.txt")}`,
    `MCP server: ${absoluteUrl("/mcp")}`,
    `Policy JSON Schema: ${absoluteUrl("/schema/policy.v1.json")}`,
    "",
  ];

  const sectionOrder = [
    "root",
    "get-started",
    "guides",
    "concepts",
    "integrations",
    "reference",
    "playground",
  ];

  for (const section of sectionOrder) {
    const sectionPages = bySection.get(section);
    if (!sectionPages || sectionPages.length === 0) continue;

    const title =
      section === "root"
        ? "Introduction"
        : section
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

    lines.push(`## ${title}`, "");
    for (const page of sectionPages.sort((a, b) => a.url.localeCompare(b.url))) {
      const desc =
        typeof page.data.description === "string" && page.data.description.length > 0
          ? `: ${page.data.description}`
          : "";
      lines.push(`- [${page.data.title}](${mdHref(page.url)})${desc}`);
    }
    lines.push("");
  }

  // Also emit Fumadocs tree form for clients that expect it (relative links rewritten).
  const treeIndex = llms(source).index();
  lines.push(
    "## Site tree",
    "",
    treeIndex.replace(/\]\((\/docs[^)]*)\)/g, (_m, path: string) => {
      return `](${mdHref(path)})`;
    }),
  );

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Concatenated markdown of all docs pages in IA order.
 */
export async function buildLlmsFullTxt(): Promise<string> {
  const pages = source.getPages().sort((a, b) => a.url.localeCompare(b.url));
  const parts: string[] = [
    "# Tailrace documentation (full)",
    "",
    `Generated for agents. Prefer ${absoluteUrl("/llms.txt")} as a router, then fetch individual .md URLs.`,
    "",
  ];

  for (const page of pages) {
    parts.push(await getLLMText(page), "", "---", "");
  }

  return parts.join("\n");
}
