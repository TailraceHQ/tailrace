import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { transformerTwoslash } from "fumadocs-twoslash";
import { createFileSystemTypesCache } from "fumadocs-twoslash/cache-fs";
import { z } from "zod";
import { remarkMermaid } from "./lib/remark-mermaid";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema.extend({
      mode: z.enum(["tutorial", "guide", "concept", "reference", "integration"]),
    }),
    postprocess: {
      includeProcessedMarkdown: {
        mdxAsPlaceholder: ["FlowDemo", "Mermaid"],
      },
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (plugins) => [remarkMermaid, ...plugins],
    rehypeCodeOptions: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash({
          typesCache: createFileSystemTypesCache(),
        }),
      ],
      langs: ["js", "jsx", "ts", "tsx", "bash", "json"],
    },
  },
});
