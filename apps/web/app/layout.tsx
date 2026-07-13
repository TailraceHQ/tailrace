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
    default: "Tailrace",
    template: "%s | Tailrace",
  },
  description:
    "In-process agent data governance: detect secrets and PII, then block, tokenize, or restore at model, tool, and MCP boundaries.",
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
