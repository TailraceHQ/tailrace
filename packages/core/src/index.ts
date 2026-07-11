/**
 * @tailrace/core - detection, policy engine, vault, and audit.
 *
 * Zero runtime dependencies; runs on Node 20+, Cloudflare Workers, and Vercel Edge.
 * This is the M0 skeleton: the public type surface is complete and stable, and the
 * runtime factories throw {@link NotImplementedError} until their milestone lands
 * (see docs/milestones.md). Keep this export list short - every export is API forever
 * (docs/architecture.md §6).
 */

import { NotImplementedError } from "./errors";
import type {
  PolicyDocument,
  PolicySource,
  Recognizer,
  Tailrace,
  TailraceOptions,
  Vault,
  KvStore,
} from "./types";

export * from "./errors";
export type * from "./types";
export { SECRET_ENTITY_CLASSES } from "./types";

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
  void options; // wired in M2 (docs/milestones.md)
  const notReady = (): never => {
    throw new NotImplementedError("check/restore land in milestone M2 (docs/milestones.md)");
  };
  return {
    check: () => notReady(),
    restore: () => notReady(),
  };
}

/**
 * Author and (from M2) validate a policy document.
 *
 * @example
 * ```ts
 * const policy = definePolicy({ entities: { email: "tokenize" } });
 * ```
 */
export function definePolicy(doc: PolicyDocument): PolicyDocument {
  // Runtime schema validation (PolicyValidationError) lands in M2 (docs/policy-engine.md §2).
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

/**
 * In-memory vault with TTL sweep; the default vault.
 *
 * @example
 * ```ts
 * const gate = createTailrace({ vault: memoryVault() });
 * ```
 */
export function memoryVault(): Vault {
  throw new NotImplementedError("memoryVault lands in milestone M2 (docs/vault.md)");
}

/**
 * Vault backed by a KV store (Cloudflare KV and compatible). Values are encrypted at rest.
 *
 * @example
 * ```ts
 * const gate = createTailrace({ vault: kvVault(env.MY_KV) });
 * ```
 */
export function kvVault(kv: KvStore): Vault {
  void kv;
  throw new NotImplementedError("kvVault lands in milestone M2 (docs/vault.md)");
}
