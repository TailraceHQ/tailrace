import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

/** Shared Orama search for `/api/search` and the docs MCP server. */
export const docsSearch = createFromSource(source, {
  language: "english",
});
