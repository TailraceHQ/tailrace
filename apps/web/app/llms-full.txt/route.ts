import { buildLlmsFullTxt } from "@/lib/llms-index";

export const revalidate = false;

export async function GET(): Promise<Response> {
  const body = await buildLlmsFullTxt();
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
