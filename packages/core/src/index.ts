/**
 * @tailrace/core - detection, policy engine, vault, and audit.
 *
 * Zero runtime dependencies; runs on Node 20+, Cloudflare Workers, and Vercel Edge.
 * Public exports are intentionally short - every export is API forever
 * (docs/architecture.md §6).
 */

import { applyActions } from "./actions/apply";
import type { ApplyItem } from "./actions/apply";
import { getStringAtPointer } from "./actions/pointer";
import { restoreInput } from "./actions/restore";
import { createAuditEmitter } from "./audit/emitter";
import { createDetectionEngine } from "./detect/engine";
import { PolicyViolationError } from "./errors";
import { compilePolicy } from "./policy/compile";
import type { CompiledPolicy } from "./policy/compile";
import { defaultPolicy } from "./policy/default";
import { resolve } from "./policy/resolve";
import { validatePolicy } from "./policy/validate";
import type {
  CheckContext,
  CheckResult,
  Decision,
  JsonObject,
  PolicyDocument,
  PolicySource,
  Recognizer,
  Span,
  Tailrace,
  TailraceOptions,
  Vault,
  VaultOptions,
} from "./types";
import { resolveMasterKey, sha256Hex } from "./vault/crypto";
import { getVaultKey } from "./vault/keys";
import { memoryVault } from "./vault/memory";

export * from "./errors";
export type * from "./types";
export { NER_ENTITY_CLASSES, PII_ENTITY_CLASSES, SECRET_ENTITY_CLASSES } from "./types";
export { consoleSink, jsonlSink } from "./audit/sinks";
export { memoryVault } from "./vault/memory";
export { kvVault } from "./vault/kv";

function isVault(value: Vault | VaultOptions): value is Vault {
  return typeof (value as Vault).put === "function";
}

function isPolicySource(value: PolicyDocument | PolicySource): value is PolicySource {
  return typeof (value as PolicySource).load === "function";
}

function extractSpanValue(input: string | JsonObject, span: Span): string {
  if (typeof input === "string") {
    return input.slice(span.start, span.end);
  }
  const path = span.path ?? "";
  const leaf = getStringAtPointer(input, path);
  if (leaf === null) return "";
  return leaf.slice(span.start, span.end);
}

function resolveVault(options: TailraceOptions): { vault: Vault; masterKey: Uint8Array } {
  if (options.vault === undefined) {
    const vault = memoryVault();
    return { vault, masterKey: getVaultKey(vault) ?? resolveMasterKey() };
  }
  if (isVault(options.vault)) {
    const vault = options.vault;
    return { vault, masterKey: getVaultKey(vault) ?? resolveMasterKey() };
  }
  const vault = memoryVault(options.vault);
  return { vault, masterKey: getVaultKey(vault) ?? resolveMasterKey(options.vault.key) };
}

/**
 * Create a gate. Zero-config by default: all secret classes `block`, common PII `tokenize`.
 *
 * @example
 * ```ts
 * const tailrace = createTailrace();
 * const { output } = await tailrace.check(userInput, {
 *   boundary: { kind: "model", provider: "openai/gpt-4o" },
 *   identity: { agent: "default" },
 * });
 * ```
 */
export function createTailrace(options: TailraceOptions = {}): Tailrace {
  const engine = createDetectionEngine({
    ...(options.recognizers !== undefined ? { recognizers: options.recognizers } : {}),
    ...(options.includePrivateIps !== undefined
      ? { includePrivateIps: options.includePrivateIps }
      : {}),
  });

  const { vault, masterKey } = resolveVault(options);
  const audit = createAuditEmitter(options.audit?.sinks ?? [], options.onDecision);

  let compiled: CompiledPolicy | null = null;
  let unsubscribe: (() => void) | undefined;

  const loadAndCompile = async (): Promise<CompiledPolicy> => {
    if (compiled !== null) return compiled;
    let doc: PolicyDocument;
    if (options.policy === undefined) {
      doc = defaultPolicy();
    } else if (isPolicySource(options.policy)) {
      doc = await options.policy.load();
      if (options.policy.subscribe !== undefined && unsubscribe === undefined) {
        unsubscribe = options.policy.subscribe((next) => {
          compiled = compilePolicy(next);
        });
      }
    } else {
      doc = options.policy;
    }
    compiled = compilePolicy(doc);
    return compiled;
  };

  const check = async <T extends string | JsonObject>(
    input: T,
    ctx: CheckContext,
  ): Promise<CheckResult<T>> => {
    const workflowId = ctx.workflowId ?? "default";
    const identity = {
      agent: ctx.identity.agent || "default",
      ...(ctx.identity.claims !== undefined ? { claims: ctx.identity.claims } : {}),
    };
    const policy = await loadAndCompile();
    const spans = engine.detect(input);
    const items: ApplyItem[] = [];

    for (const span of spans) {
      const value = extractSpanValue(input, span);
      const resolved = resolve(policy, span.entity, ctx.boundary, identity);
      const contentHash = await sha256Hex(value);
      const decision: Decision = {
        action: resolved.action,
        entity: span.entity,
        boundary: ctx.boundary,
        identity,
        rule: resolved.rule,
        span: {
          path: span.path ?? "",
          start: span.start,
          end: span.end,
        },
        contentHash,
      };
      items.push({
        span,
        decision,
        value,
        ...(resolved.format !== undefined ? { format: resolved.format } : {}),
      });
    }

    try {
      const { output, decisions } = await applyActions(input, items, {
        vault,
        masterKey,
        workflowId,
      });
      audit.emit("check", workflowId, decisions);
      return { output, decisions, blocked: false };
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        audit.emit("check", workflowId, err.decisions);
      }
      throw err;
    }
  };

  const restore = async <T extends string | JsonObject>(
    input: T,
    ctx: CheckContext,
  ): Promise<CheckResult<T>> => {
    const workflowId = ctx.workflowId ?? "default";
    const identity = {
      agent: ctx.identity.agent || "default",
      ...(ctx.identity.claims !== undefined ? { claims: ctx.identity.claims } : {}),
    };
    const { output, decisions } = await restoreInput(input, {
      vault,
      workflowId,
      boundary: ctx.boundary,
      identity,
    });
    audit.emit("restore", workflowId, decisions);
    return { output, decisions, blocked: false };
  };

  return { check, restore };
}

/**
 * Author and validate a policy document.
 *
 * @example
 * ```ts
 * const policy = definePolicy({ entities: { email: "tokenize" } });
 * ```
 */
export function definePolicy(doc: PolicyDocument): PolicyDocument {
  validatePolicy(doc);
  return doc;
}

/**
 * Define a custom recognizer.
 *
 * @example
 * ```ts
 * const employeeId = defineRecognizer({
 *   id: "employee-id",
 *   entities: ["employee_id"],
 *   tier: 0,
 *   scan: (text) => [],
 * });
 * ```
 */
export function defineRecognizer(recognizer: Recognizer): Recognizer {
  return recognizer;
}

/**
 * Wrap a local policy document as a {@link PolicySource}. This is the default source and
 * the shape a hosted policy plane implements later (docs/architecture.md §5).
 *
 * @example
 * ```ts
 * const source = staticPolicy(definePolicy({ entities: { email: "tokenize" } }));
 * ```
 */
export function staticPolicy(doc: PolicyDocument): PolicySource {
  return { load: () => Promise.resolve(doc) };
}
