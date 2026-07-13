import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";

/**
 * Rewrites ```mermaid fenced code blocks into `<Mermaid chart="..." />` MDX
 * elements so they render as diagrams instead of syntax-highlighted source.
 *
 * Authors keep writing plain ```mermaid fences (which GitHub renders natively);
 * this runs before Shiki, so the diagram source is never treated as code. The
 * `chart` attribute is a string, so Fumadocs' `mdxAsPlaceholder` can round-trip
 * the source back into a fenced block for the machine-readable markdown output.
 */
export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang !== "mermaid" || !parent || index === undefined) return;

      const element: MdxJsxFlowElement = {
        type: "mdxJsxFlowElement",
        name: "Mermaid",
        attributes: [{ type: "mdxJsxAttribute", name: "chart", value: node.value }],
        children: [],
      };

      parent.children[index] = element;
    });
  };
}
