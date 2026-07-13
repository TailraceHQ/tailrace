import { notFound } from "next/navigation";
import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";
import { absoluteUrl, markdownUrlForDocsPath } from "@/lib/site";

export const revalidate = false;

export async function GET(
  _req: Request,
  ctx: RouteContext<"/llms.mdx/docs/[[...slug]]">,
): Promise<Response> {
  const params = await ctx.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const body = await getLLMText(page);
  const mdPath = markdownUrlForDocsPath(page.url);

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      Link: `<${absoluteUrl(mdPath)}>; rel="canonical"`,
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
