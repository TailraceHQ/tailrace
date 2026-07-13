import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { LogoWithTitle } from "@/components/logo";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <LogoWithTitle size="sm" />,
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
