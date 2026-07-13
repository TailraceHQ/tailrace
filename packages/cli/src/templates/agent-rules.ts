/**
 * Agent rules artifact written by `tailrace init --agent-rules`.
 * Keep ~60 lines; links to llms.txt / MCP / schema for machines.
 */

export const AGENT_RULES_MARKER_START = "<!-- tailrace:start -->";
export const AGENT_RULES_MARKER_END = "<!-- tailrace:end -->";

export function agentRulesBody(): string {
  return `# Tailrace

Tailrace is TypeScript-native agent data governance: in-process detection of secrets/PII, reversible tokenization, and per-agent policy at model, tool, and MCP boundaries. No proxy. No sidecar. No network call on the request hot path.

## Integrations (one-liners)

- AI SDK: \`import { withAiSdk } from "@tailrace/ai-sdk"; const t = withAiSdk(createTailrace()); t.model(openai("gpt-4o"));\`
- Tools: \`t.tools({ weather });\` - args/results checked at the tool boundary.
- MCP: \`import { withMcp } from "@tailrace/mcp"; withMcp(createTailrace()).transport(inner, { server: "salesforce" });\`
- Hono: \`app.use("/v1/*", tailraceHono(createTailrace()));\`
- Claude Code: \`npx @tailrace/cli init && npx @tailrace/cli install-hooks\`

## Policy shape (miniature)

\`\`\`ts
definePolicy({
  entities: { api_key: "block", email: "tokenize" },
  boundaries: { "mcp:crm/*": { entities: { email: "tokenize" } } },
});
\`\`\`

JSON Schema: https://tailrace.dev/schema/policy.v1.json

## Top mistakes

1. Never call \`tailrace.restore\` at a model/tool/mcp/telemetry boundary - it throws \`INVARIANT\`. Restore only at \`{ kind: "egress", sink }\`.
2. Secrets cannot be overridden to \`allow\` without \`dangerouslyAllowSecrets: true\` (almost never correct).
3. Do not log raw detected values - audit events carry hashes and entity classes only.
4. Streaming: prefer \`streamBlockBehavior: "abort"\` (default). \`redact\` remaps block→mask for the stream only.
5. Zero config works: \`createTailrace()\` already blocks secret classes and tokenizes common PII.

## Machine-readable docs

- Index: https://tailrace.dev/llms.txt
- Full corpus: https://tailrace.dev/llms-full.txt
- MCP: https://tailrace.dev/mcp (\`claude mcp add --transport http tailrace-docs https://tailrace.dev/mcp\`)
- Per-page markdown: append \`.md\` to any \`/docs/...\` URL
- Connect guide: https://tailrace.dev/docs/get-started/use-with-ai-tools
`;
}

/** Cursor rule file contents. */
export function cursorRulesFile(): string {
  return `---
description: Tailrace agent data governance conventions
globs:
alwaysApply: true
---

${agentRulesBody()}
`;
}

/**
 * Wrap body in idempotent HTML comment markers for CLAUDE.md / AGENTS.md appends.
 */
export function fencedAgentRulesBlock(): string {
  return `${AGENT_RULES_MARKER_START}
${agentRulesBody()}
${AGENT_RULES_MARKER_END}
`;
}

/**
 * Insert or replace a Tailrace rules block in an existing markdown file.
 */
export function upsertFencedBlock(existing: string, block: string): string {
  const start = existing.indexOf(AGENT_RULES_MARKER_START);
  const end = existing.indexOf(AGENT_RULES_MARKER_END);
  if (start !== -1 && end !== -1 && end > start) {
    const afterEnd = end + AGENT_RULES_MARKER_END.length;
    const before = existing.slice(0, start).replace(/\n*$/, "\n\n");
    const after = existing.slice(afterEnd).replace(/^\n*/, "\n");
    return `${before}${block.trim()}${after}`;
  }
  const sep = existing.length === 0 || existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing.replace(/\n*$/, "")}${sep}${block}`;
}
