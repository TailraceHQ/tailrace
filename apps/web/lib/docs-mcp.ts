import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getLLMText, resolveDocsPage } from "@/lib/get-llm-text";
import { buildLlmsTxt } from "@/lib/llms-index";
import { docsSearch } from "@/lib/search";
import { absoluteUrl, SITE_URL } from "@/lib/site";
import { source } from "@/lib/source";

/**
 * Build a fresh MCP server + transport per request (stateless serverless).
 */
export function createDocsMcpServer(): {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
} {
  const server = new McpServer({
    name: "tailrace-docs",
    version: "0.0.1",
  });

  server.registerTool(
    "search_docs",
    {
      title: "Search Tailrace docs",
      description:
        "Search published Tailrace documentation. Returns titles, URLs, and snippets. Prefer this before guessing page paths.",
      inputSchema: {
        query: z.string().min(1).describe("Search query"),
      },
    },
    async ({ query }) => {
      const results = await docsSearch.search(query);
      const payload = results.slice(0, 12).map((r) => ({
        title: typeof r.content === "string" ? r.content.slice(0, 120) : String(r.content),
        url: absoluteUrl(r.url),
        type: r.type,
        snippet: typeof r.content === "string" ? r.content : String(r.content),
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_page",
    {
      title: "Get docs page as markdown",
      description:
        "Fetch a Tailrace docs page as plain markdown. Accepts a full URL, /docs/... path, or slug.",
      inputSchema: {
        urlOrSlug: z
          .string()
          .min(1)
          .describe("Page URL (https://tailrace.dev/docs/...), /docs path, or slug"),
      },
    },
    async ({ urlOrSlug }) => {
      const page = resolveDocsPage(urlOrSlug);
      if (!page) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Page not found: ${urlOrSlug}. Try search_docs or list_sections.`,
            },
          ],
          isError: true,
        };
      }
      const markdown = await getLLMText(page);
      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    },
  );

  server.registerTool(
    "list_sections",
    {
      title: "List docs sections",
      description:
        "Return the curated llms.txt index (section titles and absolute .md URLs) for routing.",
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: "text" as const, text: buildLlmsTxt() }],
      };
    },
  );

  // Soft discovery resource: page list
  server.registerResource(
    "docs-index",
    `${SITE_URL}/llms.txt`,
    {
      title: "llms.txt",
      description: "Curated Tailrace docs index for agents",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: `${SITE_URL}/llms.txt`,
          mimeType: "text/plain",
          text: buildLlmsTxt(),
        },
      ],
    }),
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  return { server, transport };
}

/** Plain-text hint when a browser GETs /mcp without MCP headers. */
export function browserHintResponse(): Response {
  const pages = source.getPages().length;
  return new Response(
    [
      "Tailrace docs MCP server",
      "",
      `This endpoint is for MCP clients (Cursor, Claude Code, Codex, VS Code).`,
      `${pages} docs pages indexed.`,
      "",
      "Connect with:",
      "  claude mcp add --transport http tailrace-docs https://tailrace.dev/mcp",
      "",
      "Or see https://tailrace.dev/docs/get-started/use-with-ai-tools",
      "",
    ].join("\n"),
    {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  // Browsers navigating here get a helpful plain-text page instead of a JSON-RPC error.
  if (
    request.method === "GET" &&
    (request.headers.get("accept") ?? "").includes("text/html")
  ) {
    return browserHintResponse();
  }

  const { server, transport } = createDocsMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}
