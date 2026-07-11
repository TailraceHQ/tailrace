import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Tailrace",
    },
    githubUrl: "https://github.com/TailraceHQ/tailrace",
    links: [
      {
        text: "Docs",
        url: "/docs",
        active: "nested-url",
      },
    ],
  };
}
