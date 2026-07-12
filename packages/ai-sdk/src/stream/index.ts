/**
 * Dispatch stream transforms by streamBlockBehavior.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";

import type { AiSdkWrapOptions, StreamBlockBehavior } from "../types";
import { createAbortTransform } from "./abort";
import { createBufferTransform } from "./buffer";
import { createRedactTransform } from "./redact";

export { CARRY_BUFFER_SIZE, splitCarry } from "./carry-buffer";

export function createStreamTransform(
  tailrace: Tailrace,
  boundary: Boundary,
  opts?: AiSdkWrapOptions,
): TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart> {
  const mode: StreamBlockBehavior = opts?.streamBlockBehavior ?? "abort";
  switch (mode) {
    case "buffer":
      return createBufferTransform(tailrace, boundary, opts);
    case "redact":
      return createRedactTransform(tailrace, boundary, opts);
    case "abort":
    default:
      return createAbortTransform(tailrace, boundary, opts);
  }
}
