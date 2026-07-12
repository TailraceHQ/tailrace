/**
 * Stream transform: redact mode. Hold-back + applyBlockAs mask on block spans.
 *
 * Same single-check hold-back as abort; blocks are masked instead of throwing.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";

import { checkWithOpts } from "../internal/context";
import { streamPartDelta, withDelta } from "../internal/messages";
import type { AiSdkWrapOptions } from "../types";
import { CARRY_BUFFER_SIZE } from "./carry-buffer";

export function createRedactTransform(
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
      const { output, remainder } = await checkWithOpts(tailrace, combined, boundary, opts, {
        applyBlockAs: "mask",
        stream: { holdback: CARRY_BUFFER_SIZE, final: false },
      });
      if (output.length > 0) {
        const textPart = chunk as LanguageModelV2StreamPart & { type: "text-delta" };
        controller.enqueue(withDelta(textPart, output));
      }
      carry = remainder ?? "";
      pendingDelta = chunk as LanguageModelV2StreamPart & { type: "text-delta" };
    },

    async flush(controller) {
      if (carry.length === 0) return;
      const { output } = await checkWithOpts(tailrace, carry, boundary, opts, {
        applyBlockAs: "mask",
        stream: { holdback: CARRY_BUFFER_SIZE, final: true },
      });
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
