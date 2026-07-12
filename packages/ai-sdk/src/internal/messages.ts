/**
 * Walk AI SDK prompt / content trees; scan only text leaves (skip file/image/media).
 * Rewrites in place after a single `check` on a text-only envelope object.
 */

import type { Decision, JsonObject, JsonValue, Tailrace } from "@tailrace/core";
import type {
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LanguageModelV2ToolResultOutput,
} from "@ai-sdk/provider";

import { checkWithOpts } from "./context";
import type { AiSdkWrapOptions } from "../types";
import type { Boundary } from "@tailrace/core";

type Mutable = { [k: string]: JsonValue };

/**
 * Extract a JSON-serializable tree of text-only leaves from a prompt, with a parallel
 * apply function that writes checked strings back into the original prompt structure.
 */
export function extractPromptTextTree(prompt: LanguageModelV2Prompt): {
  tree: JsonObject;
  apply: (checked: JsonObject) => void;
} {
  const messages: JsonValue[] = [];
  const writers: Array<(checkedMsg: JsonValue) => void> = [];

  for (let i = 0; i < prompt.length; i++) {
    const msg = prompt[i]!;
    if (msg.role === "system") {
      messages.push({ content: msg.content });
      writers.push((checkedMsg) => {
        const obj = checkedMsg as Mutable;
        if (typeof obj["content"] === "string") msg.content = obj["content"];
      });
      continue;
    }

    if (msg.role === "user" || msg.role === "assistant" || msg.role === "tool") {
      const parts: JsonValue[] = [];
      const partWriters: Array<(checkedPart: JsonValue) => void> = [];

      for (let j = 0; j < msg.content.length; j++) {
        const part = msg.content[j]!;
        if (part.type === "text" || (part.type === "reasoning" && "text" in part)) {
          const textPart = part as { type: string; text: string };
          parts.push({ type: part.type, text: textPart.text });
          partWriters.push((checkedPart) => {
            const obj = checkedPart as Mutable;
            if (typeof obj["text"] === "string") textPart.text = obj["text"];
          });
        } else if (part.type === "tool-result") {
          const { node, apply } = extractToolResultOutput(part.output);
          parts.push({ type: "tool-result", output: node });
          partWriters.push((checkedPart) => {
            const obj = checkedPart as Mutable;
            if (obj["output"] !== undefined) apply(obj["output"]!);
          });
        } else {
          // file / tool-call / media: skip (v0.1)
          parts.push({ type: part.type, skipped: true });
          partWriters.push(() => {
            /* no-op */
          });
        }
      }

      messages.push({ role: msg.role, content: parts });
      writers.push((checkedMsg) => {
        const obj = checkedMsg as Mutable;
        const checkedParts = obj["content"];
        if (!Array.isArray(checkedParts)) return;
        for (let j = 0; j < partWriters.length; j++) {
          const cp = checkedParts[j];
          if (cp !== undefined) partWriters[j]!(cp);
        }
      });
    }
  }

  const tree: JsonObject = { messages };
  return {
    tree,
    apply: (checked) => {
      const checkedMessages = checked["messages"];
      if (!Array.isArray(checkedMessages)) return;
      for (let i = 0; i < writers.length; i++) {
        const cm = checkedMessages[i];
        if (cm !== undefined) writers[i]!(cm);
      }
    },
  };
}

function extractToolResultOutput(output: LanguageModelV2ToolResultOutput): {
  node: JsonValue;
  apply: (checked: JsonValue) => void;
} {
  if (output.type === "text" || output.type === "error-text") {
    return {
      node: { type: output.type, value: output.value },
      apply: (checked) => {
        const obj = checked as Mutable;
        if (typeof obj["value"] === "string") output.value = obj["value"];
      },
    };
  }
  if (output.type === "json" || output.type === "error-json") {
    // Scan JSON values by wrapping; rewrite is best-effort on string leaves only via check.
    const wrapped = { type: output.type, value: output.value as JsonValue };
    return {
      node: wrapped,
      apply: (checked) => {
        const obj = checked as Mutable;
        if (obj["value"] !== undefined) {
          // why: tool result JSON is opaque to the SDK; assign checked tree back.
          (output as { value: JsonValue }).value = obj["value"]!;
        }
      },
    };
  }
  // content array: scan text items, skip media
  const items: JsonValue[] = [];
  const itemWriters: Array<(checked: JsonValue) => void> = [];
  for (const item of output.value) {
    if (item.type === "text") {
      items.push({ type: "text", text: item.text });
      itemWriters.push((checked) => {
        const obj = checked as Mutable;
        if (typeof obj["text"] === "string") item.text = obj["text"];
      });
    } else {
      items.push({ type: "media", skipped: true });
      itemWriters.push(() => {
        /* skip */
      });
    }
  }
  return {
    node: { type: "content", value: items },
    apply: (checked) => {
      const obj = checked as Mutable;
      const arr = obj["value"];
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < itemWriters.length; i++) {
        const c = arr[i];
        if (c !== undefined) itemWriters[i]!(c);
      }
    },
  };
}

/**
 * Check + rewrite all text parts in call-option prompt. Mutates a shallow-cloned params.
 */
export async function checkPromptParams(
  tailrace: Tailrace,
  params: LanguageModelV2CallOptions,
  boundary: Boundary,
  opts?: AiSdkWrapOptions,
): Promise<{ params: LanguageModelV2CallOptions; decisions: Decision[] }> {
  const next: LanguageModelV2CallOptions = { ...params, prompt: clonePrompt(params.prompt) };
  const { tree, apply } = extractPromptTextTree(next.prompt);
  const { output, decisions } = await checkWithOpts(tailrace, tree, boundary, opts);
  apply(output);
  return { params: next, decisions };
}

function clonePrompt(prompt: LanguageModelV2Prompt): LanguageModelV2Prompt {
  // Structured clone preserves part objects we mutate text on.
  return structuredClone(prompt);
}

/** Concatenate text content from a doGenerate result. */
export function extractGenerateText(content: LanguageModelV2Content[]): string {
  const parts: string[] = [];
  for (const part of content) {
    if (part.type === "text") parts.push(part.text);
  }
  return parts.join("");
}

/**
 * Rewrite text parts in generate content from a checked full-text string.
 *
 * v0.1: when tokenize/mask changes length, collapse all model text parts into the
 * first part (full checked string) and blank the rest. Per-part proportional rewrite
 * can land later if multi-part outputs become common.
 */
export function applyGenerateText(
  content: LanguageModelV2Content[],
  checkedText: string,
): LanguageModelV2Content[] {
  const textIndexes: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i]!.type === "text") textIndexes.push(i);
  }
  if (textIndexes.length === 0) {
    if (checkedText.length === 0) return content;
    return [...content, { type: "text", text: checkedText }];
  }
  const out = content.map((part) => ({ ...part })) as LanguageModelV2Content[];
  const first = textIndexes[0]!;
  const firstPart = out[first];
  if (firstPart !== undefined && firstPart.type === "text") {
    out[first] = { ...firstPart, text: checkedText };
  }
  // Clear remaining text parts so we don't duplicate.
  for (let k = 1; k < textIndexes.length; k++) {
    const idx = textIndexes[k]!;
    const part = out[idx];
    if (part !== undefined && part.type === "text") {
      out[idx] = { ...part, text: "" };
    }
  }
  return out;
}

/** Extract delta text from a stream part, if any. */
export function streamPartDelta(part: LanguageModelV2StreamPart): string | null {
  if (part.type === "text-delta") return part.delta;
  return null;
}

/** Clone a text-delta part with new delta text. */
export function withDelta(
  part: LanguageModelV2StreamPart & { type: "text-delta" },
  delta: string,
): LanguageModelV2StreamPart {
  return { ...part, delta };
}
