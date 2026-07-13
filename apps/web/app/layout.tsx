import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Instrument_Sans, Inter } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tailrace | Agent Data Governance for Secrets and PII",
    template: "%s | Tailrace",
  },
  description:
    "Ship agents, not secrets. Govern agent data at the boundary with in-process detection, policy, and tokenization for secrets and PII.",
  applicationName: "Tailrace",
  keywords: [
    "agent data governance",
    "AI agent security",
    "PII protection",
    "secret detection",
    "sensitive data detection",
    "AI data loss prevention",
    "LLM security",
    "MCP security",
    "AI SDK security",
    "data tokenization",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Tailrace",
    title: "Ship agents, not secrets | Tailrace",
    description:
      "Govern agent data at the boundary. Detect secrets and PII in-process, then block, tokenize, or restore across model, tool, and MCP boundaries.",
    images: [
      {
        url: "/link-preview.png",
        width: 1280,
        height: 640,
        alt: "Tailrace - Ship agents, not secrets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ship agents, not secrets | Tailrace",
    description:
      "Govern agent data at the boundary with in-process protection for secrets and PII.",
    images: ["/link-preview.png"],
  },
  category: "technology",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.className} ${inter.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: "dark", enableSystem: true }}>{children}</RootProvider>
      </body>
    </html>
  );
}
