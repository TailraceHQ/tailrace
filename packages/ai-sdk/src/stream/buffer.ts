/**
 * Stream transform: buffer mode. Accumulate all text; check once at end; throw on block.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";

import { checkWithOpts } from "../internal/context";
import { streamPartDelta, withDelta } from "../internal/messages";
import type { AiSdkWrapOptions } from "../types";

export function createBufferTransform(
  tailrace: Tailrace,
  boundary: Boundary,
  opts?: AiSdkWrapOptions,
): TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart> {
  const held: LanguageModelV2StreamPart[] = [];
  let text = "";
  let lastTextDelta: (LanguageModelV2StreamPart & { type: "text-delta" }) | null = null;

  return new TransformStream({
    transform(chunk) {
      const delta = streamPartDelta(chunk);
      if (delta !== null) {
        text += delta;
        lastTextDelta = chunk as LanguageModelV2StreamPart & { type: "text-delta" };
        held.push(chunk);
        return;
      }
      held.push(chunk);
    },

    async flush(controller) {
      const { output } = await checkWithOpts(tailrace, text, boundary, opts);

      // Re-emit held parts, replacing all text-deltas with a single checked delta.
      let textEmitted = false;
      for (const part of held) {
        if (streamPartDelta(part) !== null) {
          if (!textEmitted) {
            const template =
              lastTextDelta ??
              ({ type: "text-delta", id: "tailrace-buffer", delta: output } as const);
            controller.enqueue(withDelta(template, output));
            textEmitted = true;
          }
          continue;
        }
        controller.enqueue(part);
      }
      if (!textEmitted && output.length > 0) {
        controller.enqueue({
          type: "text-delta",
          id: "tailrace-buffer",
          delta: output,
        });
      }
    },
  });
}
