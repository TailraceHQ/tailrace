/**
 * Stream transform: abort mode (default). Hold-back + carry; throw on block.
 *
 * Algorithm: accumulate raw text; before emitting a safe prefix, probe-check the
 * full buffer so a secret spanning the emit/carry cut still aborts. Then check the
 * emit slice for tokenize/mask rewrite.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";

import { checkWithOpts } from "../internal/context";
import { streamPartDelta, withDelta } from "../internal/messages";
import type { AiSdkWrapOptions } from "../types";
import { CARRY_BUFFER_SIZE, splitCarry } from "./carry-buffer";

export function createAbortTransform(
  tailrace: Tailrace,
  boundary: Boundary,
  opts?: AiSdkWrapOptions,
): TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart> {
  let carry = "";
  let pendingDelta: (LanguageModelV2StreamPart & { type: "text-delta" }) | null = null;

  return new TransformStream({
    async transform(chunk, controller) {
      const delta = streamPartDelta(chunk);
      if (delta === null) {
        controller.enqueue(chunk);
        return;
      }

      const combined = carry + delta;
      // Probe full buffer first so spanning secrets still fail closed.
      await checkWithOpts(tailrace, combined, boundary, opts);

      const { emit, carry: nextCarry } = splitCarry(combined, CARRY_BUFFER_SIZE, false);
      if (emit.length > 0) {
        const { output } = await checkWithOpts(tailrace, emit, boundary, opts);
        const textPart = chunk as LanguageModelV2StreamPart & { type: "text-delta" };
        controller.enqueue(withDelta(textPart, output));
      }
      carry = nextCarry;
      pendingDelta = chunk as LanguageModelV2StreamPart & { type: "text-delta" };
    },

    async flush(controller) {
      if (carry.length === 0) return;
      const { output } = await checkWithOpts(tailrace, carry, boundary, opts);
      const template = pendingDelta ?? {
        type: "text-delta" as const,
        id: "tailrace-flush",
        delta: output,
      };
      controller.enqueue(withDelta(template, output));
      carry = "";
    },
  });
}
