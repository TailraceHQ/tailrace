import defaultMdxComponents from "fumadocs-ui/mdx";
import * as Twoslash from "fumadocs-twoslash/ui";
import type { MDXComponents } from "mdx/types";
import { FlowDemo } from "@/components/flow-demo";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...Twoslash,
    FlowDemo,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- MDX ambient typing
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
