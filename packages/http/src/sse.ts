/**
 * SSE response transform with local carry-buffer (abort-only on block).
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";

import { CARRY_BUFFER_SIZE } from "./carry-buffer";
import { checkWithOpts } from "./check";
import { policyViolationBody } from "./errors";
import type { OpenAiCompatIdentityOpts } from "./types";

function extractDeltaContent(data: string): string | null {
  if (data === "[DONE]") return null;
  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = parsed.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}

function rewriteDeltaContent(data: string, newContent: string): string {
  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string }; [k: string]: unknown }>;
      [k: string]: unknown;
    };
    const choices = parsed.choices;
    if (!Array.isArray(choices) || choices[0] === undefined) {
      return JSON.stringify({ choices: [{ delta: { content: newContent }, index: 0 }] });
    }
    const first = { ...choices[0], delta: { ...(choices[0].delta ?? {}), content: newContent } };
    return JSON.stringify({ ...parsed, choices: [first, ...choices.slice(1)] });
  } catch {
    return JSON.stringify({ choices: [{ delta: { content: newContent }, index: 0 }] });
  }
}

function formatSseError(err: PolicyViolationError): string {
  return `data: ${JSON.stringify(policyViolationBody(err))}\n\n`;
}

/**
 * Transform an upstream SSE body: hold-back scan text deltas; on block cancel and emit error.
 *
 * @example
 * ```ts
 * const scanned = createOpenAiCompatSseTransform(tr, boundary, { agent: "api" }, res.body);
 * ```
 */
export function createOpenAiCompatSseTransform(
  tailrace: Tailrace,
  boundary: Boundary,
  opts: OpenAiCompatIdentityOpts | undefined,
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let carry = "";
  let lineBuf = "";
  let aborted = false;
  const reader = upstream.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (aborted) {
        controller.close();
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        try {
          if (carry.length > 0) {
            const { output } = await checkWithOpts(tailrace, carry, boundary, opts, {
              stream: { holdback: CARRY_BUFFER_SIZE, final: true },
            });
            if (output.length > 0) {
              const data = rewriteDeltaContent("{}", output);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
        } catch (err) {
          if (err instanceof PolicyViolationError) {
            controller.enqueue(encoder.encode(formatSseError(err)));
            controller.close();
            return;
          }
          throw err;
        }
        controller.close();
        return;
      }

      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");
        if (!line.startsWith("data:")) {
          controller.enqueue(encoder.encode(`${line}\n`));
          continue;
        }
        const data = line.slice(5).trimStart();
        const delta = extractDeltaContent(data);
        if (delta === null) {
          controller.enqueue(encoder.encode(`${line}\n`));
          continue;
        }

        try {
          const combined = carry + delta;
          const { output, remainder } = await checkWithOpts(tailrace, combined, boundary, opts, {
            stream: { holdback: CARRY_BUFFER_SIZE, final: false },
          });
          carry = remainder ?? "";
          if (output.length > 0) {
            const rewritten = rewriteDeltaContent(data, output);
            controller.enqueue(encoder.encode(`data: ${rewritten}\n\n`));
          }
        } catch (err) {
          if (err instanceof PolicyViolationError) {
            aborted = true;
            await reader.cancel().catch(() => {
              /* ignore */
            });
            controller.enqueue(encoder.encode(formatSseError(err)));
            controller.close();
            return;
          }
          throw err;
        }
      }
    },
    async cancel() {
      aborted = true;
      await reader.cancel().catch(() => {
        /* ignore */
      });
    },
  });
}
