import defaultMdxComponents from "fumadocs-ui/mdx";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import * as Twoslash from "fumadocs-twoslash/ui";
import type { MDXComponents } from "mdx/types";
import { FlowDemo } from "@/components/flow-demo";
import { Mermaid } from "@/components/mermaid";
import { Playground } from "@/components/playground";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...Twoslash,
    Accordion,
    Accordions,
    FlowDemo,
    Mermaid,
    Playground,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- MDX ambient typing
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
