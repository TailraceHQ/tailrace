/**
 * OpenAI chat-completions body: extract / rewrite message text leaves.
 */

import type { JsonObject, JsonValue } from "@tailrace/core";

type Mutable = { [k: string]: JsonValue };

interface ContentPart {
  type?: string;
  text?: string;
}

interface ChatMessage {
  role?: string;
  content?: string | ContentPart[] | null;
}

export interface OpenAiChatBody {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
}

/**
 * Build a checkable tree of message text + apply writers back onto the body.
 * Scans string `content` and `content[].text` for type text (skip image_url etc.).
 */
export function extractMessageTextTree(body: OpenAiChatBody): {
  tree: JsonObject;
  apply: (checked: JsonObject) => void;
} {
  const messages = body.messages ?? [];
  const outMessages: JsonValue[] = [];
  const writers: Array<(checkedMsg: JsonValue) => void> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const content = msg.content;

    if (typeof content === "string") {
      outMessages.push({ role: msg.role ?? "user", content });
      writers.push((checkedMsg) => {
        const obj = checkedMsg as Mutable;
        if (typeof obj["content"] === "string") msg.content = obj["content"];
      });
      continue;
    }

    if (Array.isArray(content)) {
      const parts: JsonValue[] = [];
      const partWriters: Array<(checkedPart: JsonValue) => void> = [];
      for (let j = 0; j < content.length; j++) {
        const part = content[j]!;
        if (part.type === "text" && typeof part.text === "string") {
          parts.push({ type: "text", text: part.text });
          partWriters.push((checkedPart) => {
            const obj = checkedPart as Mutable;
            if (typeof obj["text"] === "string") part.text = obj["text"];
          });
        } else {
          parts.push({ type: part.type ?? "unknown", skipped: true });
          partWriters.push(() => {
            /* skip non-text */
          });
        }
      }
      outMessages.push({ role: msg.role ?? "user", content: parts });
      writers.push((checkedMsg) => {
        const obj = checkedMsg as Mutable;
        const checkedParts = obj["content"];
        if (!Array.isArray(checkedParts)) return;
        for (let j = 0; j < partWriters.length; j++) {
          const cp = checkedParts[j];
          if (cp !== undefined) partWriters[j]!(cp);
        }
      });
      continue;
    }

    outMessages.push({ role: msg.role ?? "user", content: null });
    writers.push(() => {
      /* no content */
    });
  }

  const tree: JsonObject = { messages: outMessages };
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

/** Extract assistant text from a chat completion JSON response. */
export function extractCompletionText(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";
  const parts: string[] = [];
  for (const choice of choices) {
    if (typeof choice !== "object" || choice === null) continue;
    const message = (choice as { message?: unknown }).message;
    if (typeof message === "object" && message !== null) {
      const content = (message as { content?: unknown }).content;
      if (typeof content === "string") parts.push(content);
    }
    const text = (choice as { text?: unknown }).text;
    if (typeof text === "string") parts.push(text);
  }
  return parts.join("");
}

/**
 * Rewrite assistant message content in a completion body from a checked full string.
 * Collapses to the first choice's message.content when length changes.
 */
export function applyCompletionText(body: unknown, checkedText: string): unknown {
  if (typeof body !== "object" || body === null) return body;
  const clone = structuredClone(body) as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  const choices = clone.choices;
  if (!Array.isArray(choices) || choices.length === 0) return clone;
  const first = choices[0]!;
  if (first.message !== undefined) {
    first.message = { ...first.message, content: checkedText };
    for (let i = 1; i < choices.length; i++) {
      const c = choices[i];
      if (c?.message !== undefined) c.message = { ...c.message, content: "" };
    }
  } else if ("text" in first) {
    first.text = checkedText;
  }
  return clone;
}

export function parseOpenAiBody(raw: unknown): OpenAiChatBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  return raw as OpenAiChatBody;
}
