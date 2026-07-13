import { source } from "@/lib/source";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { CopyMcpUrlButton } from "@/components/copy-mcp-url";
import { absoluteUrl, markdownUrlForDocsPath } from "@/lib/site";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = markdownUrlForDocsPath(page.url);
  const githubUrl = `https://github.com/TailraceHQ/tailrace/blob/main/apps/web/content/docs/${page.path}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="flex flex-row flex-wrap items-center gap-2 border-b pb-4">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
        <CopyMcpUrlButton />
      </div>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const mdPath = markdownUrlForDocsPath(page.url);

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      type: "article",
      url: absoluteUrl(page.url),
      siteName: "Tailrace",
      title: `${page.data.title} | Tailrace`,
      description: page.data.description,
      images: [
        {
          url: absoluteUrl("/link-preview.png"),
          width: 1280,
          height: 640,
          alt: "Tailrace - Ship agents, not secrets",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.data.title} | Tailrace`,
      description: page.data.description,
      images: [absoluteUrl("/link-preview.png")],
    },
    alternates: {
      canonical: absoluteUrl(page.url),
      types: {
        "text/markdown": absoluteUrl(mdPath),
      },
    },
    other: {
      // Helps some clients discover the markdown alternate.
      markdown: absoluteUrl(mdPath),
    },
  };
}
