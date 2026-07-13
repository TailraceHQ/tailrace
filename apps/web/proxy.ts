import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";

const { rewrite: rewriteMdExtension } = rewritePath("/docs{/*path}.md", "/llms.mdx/docs{/*path}");

const { rewrite: rewriteAcceptMarkdown } = rewritePath("/docs{/*path}", "/llms.mdx/docs{/*path}");

/**
 * Rewrite `/docs/*.md` (and Prefer: markdown Accept) to the LLM markdown route.
 * Next.js 16 uses the `proxy` convention (formerly middleware).
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Index page: `/docs.md` is not under `/docs/…`, so handle it explicitly.
  if (pathname === "/docs.md") {
    return NextResponse.rewrite(new URL("/llms.mdx/docs", request.nextUrl));
  }

  const mdExt = rewriteMdExtension(pathname);
  if (mdExt) {
    return NextResponse.rewrite(new URL(mdExt, request.nextUrl));
  }

  if (pathname === "/docs" && isMarkdownPreferred(request)) {
    return NextResponse.rewrite(new URL("/llms.mdx/docs", request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const acceptPath = rewriteAcceptMarkdown(pathname);
    if (acceptPath) {
      return NextResponse.rewrite(new URL(acceptPath, request.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/docs", "/docs.md", "/docs/:path*"],
};
