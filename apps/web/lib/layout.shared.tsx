import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/logo";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo withTitle size="sm" />,
    },
    githubUrl: "https://github.com/TailraceHQ/tailrace",
    links: [
      {
        text: "Docs",
        url: "/docs",
        active: "nested-url",
      },
      {
        text: "Playground",
        url: "/docs/playground",
        active: "url",
      },
    ],
  };
}
